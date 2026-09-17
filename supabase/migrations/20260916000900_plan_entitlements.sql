-- Plan entitlements, invoices, checkout sessions, and the bot-limit trigger.
-- Re-runnable: safe to apply twice.

-- The third tier was called `team` in earlier migrations. The product name is
-- Business; existing rows are renamed so the check constraint can follow.
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

update public.subscriptions
set plan = 'business'
where plan = 'team';

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('free', 'pro', 'business'));

alter table public.subscriptions
  add column if not exists billing_interval text not null default 'monthly';

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_interval_check;

alter table public.subscriptions
  add constraint subscriptions_billing_interval_check
  check (billing_interval in ('monthly', 'yearly'));

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

alter table public.plan_limits
  drop constraint if exists plan_limits_plan_check;

update public.plan_limits
set plan = 'business'
where plan = 'team';

alter table public.plan_limits
  add constraint plan_limits_plan_check
  check (plan in ('free', 'pro', 'business'));

alter table public.plan_limits
  add column if not exists max_bots integer,
  add column if not exists max_messages integer,
  add column if not exists remove_branding boolean not null default false,
  add column if not exists widget_customization boolean not null default false,
  add column if not exists domain_allowlist boolean not null default false;

-- Numbers match client/src/entities/plan/model/plans.ts.
insert into public.plan_limits (
  plan,
  max_file_bytes,
  max_documents,
  max_bots,
  max_messages,
  remove_branding,
  widget_customization,
  domain_allowlist
)
values
  ('free', 5 * 1024 * 1024, 10, 1, 100, false, false, false),
  ('pro', 20 * 1024 * 1024, 150, 3, 2000, true, true, true),
  ('business', 50 * 1024 * 1024, 1000, 10, 10000, true, true, true)
on conflict (plan) do update
set max_file_bytes = excluded.max_file_bytes,
    max_documents = excluded.max_documents,
    max_bots = excluded.max_bots,
    max_messages = excluded.max_messages,
    remove_branding = excluded.remove_branding,
    widget_customization = excluded.widget_customization,
    domain_allowlist = excluded.domain_allowlist;

alter table public.plan_limits
  alter column max_bots set not null,
  alter column max_messages set not null;

alter table public.plan_limits
  drop constraint if exists plan_limits_max_bots_check;

alter table public.plan_limits
  add constraint plan_limits_max_bots_check
  check (max_bots > 0);

alter table public.plan_limits
  drop constraint if exists plan_limits_max_messages_check;

alter table public.plan_limits
  add constraint plan_limits_max_messages_check
  check (max_messages > 0);

drop function if exists public.current_plan_limits();

create or replace function public.current_plan_limits()
returns table (
  plan_id text,
  max_file_bytes bigint,
  max_documents integer,
  max_bots integer,
  max_messages integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.plan,
    l.max_file_bytes,
    l.max_documents,
    l.max_bots,
    l.max_messages
  from public.subscriptions as s
  join public.plan_limits as l on l.plan = s.plan
  where s.user_id = (select auth.uid());
$$;

revoke all on function public.current_plan_limits() from public, anon;
grant execute on function public.current_plan_limits() to authenticated;

-- Display name used in exception text, matching the client matrix.
create or replace function public.plan_display_name(p_plan text)
returns text
language sql
immutable
as $$
  select case p_plan
    when 'pro' then 'Pro'
    when 'business' then 'Business'
    else 'Free'
  end;
$$;

create or replace function public.check_bot_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits public.plan_limits%rowtype;
  stored_count integer;
begin
  select l.* into limits
  from public.subscriptions as s
  join public.plan_limits as l on l.plan = s.plan
  where s.user_id = new.user_id;

  if not found then
    return new;
  end if;

  select count(*) into stored_count
  from public.bots as b
  where b.user_id = new.user_id;

  if stored_count >= limits.max_bots then
    raise exception
      'You''ve reached the % bot limit on %',
      limits.max_bots,
      public.plan_display_name(limits.plan)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists bots_check_limit on public.bots;
create trigger bots_check_limit
  before insert on public.bots
  for each row
  execute function public.check_bot_limit();

create or replace function public.enforce_document_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limits public.plan_limits%rowtype;
  stored_count integer;
begin
  select l.* into limits
  from public.bots as b
  join public.subscriptions as s on s.user_id = b.user_id
  join public.plan_limits as l on l.plan = s.plan
  where b.id = new.bot_id;

  if not found then
    return new;
  end if;

  if new.size > limits.max_file_bytes then
    raise exception
      'The % plan allows files up to % bytes, this one is % bytes.',
      public.plan_display_name(limits.plan),
      limits.max_file_bytes,
      new.size
      using errcode = 'check_violation';
  end if;

  if limits.max_documents is not null then
    select count(*) into stored_count
    from public.documents as d
    where d.bot_id = new.bot_id;

    if stored_count >= limits.max_documents then
      raise exception
        'The % plan allows up to % documents per bot.',
        public.plan_display_name(limits.plan),
        limits.max_documents
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- Atomic check-and-increment. Returns false when the monthly cap is already hit.
create or replace function public.consume_message_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap integer;
  period date := (date_trunc('month', timezone('utc', now())))::date;
  used integer;
begin
  select l.max_messages into cap
  from public.subscriptions as s
  join public.plan_limits as l on l.plan = s.plan
  where s.user_id = p_user_id;

  if cap is null then
    return false;
  end if;

  insert into public.usage_counters (user_id, period_start, messages_used)
  values (p_user_id, period, 1)
  on conflict (user_id, period_start)
  do update
    set messages_used = public.usage_counters.messages_used + 1
    where public.usage_counters.messages_used < cap
  returning messages_used into used;

  return used is not null;
end;
$$;

revoke all on function public.consume_message_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_message_quota(uuid) to service_role;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  number text not null unique,
  plan text not null check (plan in ('free', 'pro', 'business')),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'paid' check (status in ('paid', 'open', 'void')),
  description text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists invoices_user_id_created_at_idx
  on public.invoices (user_id, created_at desc);

alter table public.invoices enable row level security;

drop policy if exists "Owners can read their invoices" on public.invoices;
create policy "Owners can read their invoices"
  on public.invoices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'business')),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  amount_cents integer not null check (amount_cents >= 0),
  success_url text not null,
  cancel_url text not null,
  status text not null default 'open'
    check (status in ('open', 'complete', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

alter table public.checkout_sessions enable row level security;

-- No client policies: sessions are written and read by the mock-checkout
-- function with the service role.

update storage.buckets
set file_size_limit = 50 * 1024 * 1024
where id = 'documents';
