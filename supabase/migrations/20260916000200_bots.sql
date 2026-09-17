-- Bots: the only table the browser writes to directly.
-- Re-runnable: safe to apply twice.

create table if not exists public.bots (
  id uuid primary key default gen_random_uuid(),
  -- Defaulted from the JWT, so an insert never has to trust a client-sent owner.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '',
  system_prompt text not null default
    'You are a helpful support assistant. Answer using the provided context only.',
  welcome_message text not null default 'Hi! How can I help you today?',
  accent_color text not null default '#4f46e5' check (accent_color ~* '^#[0-9a-f]{6}$'),
  show_branding boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'active')),
  -- Public identifier the embed snippet sends to the widget Edge Function.
  -- Never the primary key, so the widget cannot guess other rows.
  public_key text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- Empty array means "no domain restriction yet".
  allowed_domains text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bots_user_id_created_at_idx
  on public.bots (user_id, created_at desc);

alter table public.bots enable row level security;

drop policy if exists "Owners can read their bots" on public.bots;
create policy "Owners can read their bots"
  on public.bots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Owners can create bots" on public.bots;
create policy "Owners can create bots"
  on public.bots
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can update their bots" on public.bots;
create policy "Owners can update their bots"
  on public.bots
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can delete their bots" on public.bots;
create policy "Owners can delete their bots"
  on public.bots
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists bots_set_updated_at on public.bots;
create trigger bots_set_updated_at
  before update on public.bots
  for each row
  execute function public.set_updated_at();

-- Ownership helper for every table that hangs off a bot. Security definer keeps
-- the check to a single primary-key lookup instead of re-running the bots policy.
create or replace function public.owns_bot(bot uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bots as b
    where b.id = bot
      and b.user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_bot(uuid) from public, anon;
grant execute on function public.owns_bot(uuid) to authenticated;
