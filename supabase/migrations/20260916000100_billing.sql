-- Billing state of a workspace. In the MVP a workspace is a single user, so
-- every table is keyed by auth.users.id directly.
-- Re-runnable: safe to apply twice.

-- public.subscriptions is the single source of truth for the current plan,
-- so the duplicate column on profiles goes away.
alter table public.profiles
  drop column if exists plan_id;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'team')),
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Read-only for the owner: plan changes arrive from the payment provider
-- through a service-role webhook, never from the browser.
drop policy if exists "Owners can read their subscription" on public.subscriptions;
create policy "Owners can read their subscription"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row
  execute function public.set_updated_at();

-- Message quota per billing period. Only the chat Edge Function increments it.
create table if not exists public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  messages_used integer not null default 0 check (messages_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

alter table public.usage_counters enable row level security;

drop policy if exists "Owners can read their usage" on public.usage_counters;
create policy "Owners can read their usage"
  on public.usage_counters
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists usage_counters_set_updated_at on public.usage_counters;
create trigger usage_counters_set_updated_at
  before update on public.usage_counters
  for each row
  execute function public.set_updated_at();

-- Every user gets a profile and a free subscription on sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Backfill users that signed up before this migration.
insert into public.subscriptions (user_id)
select id from auth.users
on conflict (user_id) do nothing;
