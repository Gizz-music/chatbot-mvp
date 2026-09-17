-- Chat retrieval, usage accounting, and the public widget bot card.
-- Re-runnable: safe to apply twice.

alter table public.conversations
  add column if not exists title text not null default 'New chat';

alter table public.conversations
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row
  execute function public.set_updated_at();

create index if not exists conversations_bot_id_updated_at_idx
  on public.conversations (bot_id, updated_at desc);

-- A new message is what makes a conversation "recent" in the sidebar.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row
  execute function public.touch_conversation();

-- Vector search used by the chat Edge Function. Not granted to the browser:
-- the widget must not read chunks directly.
create or replace function public.match_chunks(
  query_embedding extensions.vector(1536),
  match_bot_id uuid,
  match_count integer default 6,
  min_similarity double precision default 0.2
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  filename text,
  similarity double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.document_id,
    c.content,
    d.filename,
    (1 - (c.embedding operator(extensions.<=>) query_embedding))::double precision as similarity
  from public.chunks as c
  join public.documents as d on d.id = c.document_id
  where c.bot_id = match_bot_id
    and c.embedding is not null
    and d.status = 'ready'
    and 1 - (c.embedding operator(extensions.<=>) query_embedding) >= min_similarity
  order by c.embedding operator(extensions.<=>) query_embedding
  limit greatest(coalesce(match_count, 6), 1);
$$;

revoke all on function public.match_chunks(
  extensions.vector,
  uuid,
  integer,
  double precision
) from public, anon, authenticated;
grant execute on function public.match_chunks(
  extensions.vector,
  uuid,
  integer,
  double precision
) to service_role;

-- Counts a billed user message against the current UTC month.
create or replace function public.increment_message_usage(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usage_counters (user_id, period_start, messages_used)
  values (
    p_user_id,
    (date_trunc('month', timezone('utc', now())))::date,
    1
  )
  on conflict (user_id, period_start)
  do update set messages_used = public.usage_counters.messages_used + 1;
end;
$$;

revoke all on function public.increment_message_usage(uuid) from public, anon, authenticated;
grant execute on function public.increment_message_usage(uuid) to service_role;

-- Safe subset of a bot for the public widget. Drafts stay hidden unless the
-- signed-in owner is previewing their own bot.
create or replace function public.widget_bot(p_bot_id uuid)
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
  select b.id, b.name, b.welcome_message, b.accent_color, b.show_branding
  from public.bots as b
  where b.id = p_bot_id
    and (
      b.status = 'active'
      or b.user_id = (select auth.uid())
    );
$$;

revoke all on function public.widget_bot(uuid) from public;
grant execute on function public.widget_bot(uuid) to anon, authenticated;
