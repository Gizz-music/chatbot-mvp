-- Chat history and captured leads. Every row here is written by the chat Edge
-- Function with the service-role key; the browser only reads its own data.
-- Re-runnable: safe to apply twice.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots (id) on delete cascade,
  source text not null default 'app' check (source in ('app', 'widget')),
  -- Anonymous widget visitor, identified by a cookie-less id from the embed.
  visitor_id text,
  created_at timestamptz not null default now()
);

create index if not exists conversations_bot_id_created_at_idx
  on public.conversations (bot_id, created_at desc);

alter table public.conversations enable row level security;

drop policy if exists "Owners can read their conversations" on public.conversations;
create policy "Owners can read their conversations"
  on public.conversations
  for select
  to authenticated
  using (public.owns_bot(bot_id));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  -- Chunks the answer was grounded on: [{ "document_id": ..., "filename": ... }]
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

create or replace function public.owns_conversation(conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations as c
    join public.bots as b on b.id = c.bot_id
    where c.id = conversation
      and b.user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_conversation(uuid) from public, anon;
grant execute on function public.owns_conversation(uuid) to authenticated;

drop policy if exists "Owners can read their messages" on public.messages;
create policy "Owners can read their messages"
  on public.messages
  for select
  to authenticated
  using (public.owns_conversation(conversation_id));

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

create index if not exists leads_bot_id_created_at_idx
  on public.leads (bot_id, created_at desc);

alter table public.leads enable row level security;

drop policy if exists "Owners can read their leads" on public.leads;
create policy "Owners can read their leads"
  on public.leads
  for select
  to authenticated
  using (public.owns_bot(bot_id));

drop policy if exists "Owners can delete their leads" on public.leads;
create policy "Owners can delete their leads"
  on public.leads
  for delete
  to authenticated
  using (public.owns_bot(bot_id));
