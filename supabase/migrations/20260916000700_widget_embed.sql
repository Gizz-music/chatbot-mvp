-- Public widget keys, per-visitor rate limits, and plan-based branding.
-- Re-runnable: safe to apply twice.

-- Snippet identifier looks like a publishable key, not a row UUID.
alter table public.bots
  alter column public_key set default 'pk_live_' || replace(gen_random_uuid()::text, '-', '');

update public.bots
set public_key = 'pk_live_' || public_key
where public_key not like 'pk_live_%';

-- Sliding-window counter used by widget-chat. Service role only.
create table if not exists public.widget_rate_limits (
  bot_id uuid not null references public.bots (id) on delete cascade,
  visitor_id text not null,
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (bot_id, visitor_id, window_start)
);

alter table public.widget_rate_limits enable row level security;

create or replace function public.consume_widget_rate_limit(
  p_bot_id uuid,
  p_visitor_id text,
  p_limit integer default 30,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_visitor_id is null or length(btrim(p_visitor_id)) = 0 then
    return false;
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds)::bigint
    * p_window_seconds
  );

  insert into public.widget_rate_limits (
    bot_id,
    visitor_id,
    window_start,
    hits
  )
  values (p_bot_id, p_visitor_id, v_window, 1)
  on conflict (bot_id, visitor_id, window_start)
  do update set hits = public.widget_rate_limits.hits + 1
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_widget_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_widget_rate_limit(uuid, text, integer, integer)
  to service_role;

-- Widget bootstrap by public key. Branding follows the owner's plan, not a
-- per-bot checkbox: Free always shows "Powered by".
drop function if exists public.widget_bot(uuid);

create or replace function public.widget_bot(p_public_key text)
returns table (
  id uuid,
  name text,
  welcome_message text,
  accent_color text,
  show_branding boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.name,
    b.welcome_message,
    b.accent_color,
    (coalesce(s.plan, 'free') = 'free') as show_branding
  from public.bots as b
  left join public.subscriptions as s on s.user_id = b.user_id
  where b.public_key = p_public_key
    and (
      b.status = 'active'
      or b.user_id = (select auth.uid())
    );
$$;

revoke all on function public.widget_bot(text) from public;
grant execute on function public.widget_bot(text) to anon, authenticated;
