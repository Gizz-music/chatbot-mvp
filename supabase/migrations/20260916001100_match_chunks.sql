-- Rank this bot's chunks first, then apply the similarity cutoff.
-- The previous query ordered by the HNSW index across every bot, then filtered
-- by bot_id, which could return no rows even when this bot had matching text.
-- Re-runnable.

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
  with bot_chunks as materialized (
    select
      c.id,
      c.document_id,
      c.content,
      c.embedding,
      d.filename
    from public.chunks as c
    join public.documents as d on d.id = c.document_id
    where c.bot_id = match_bot_id
      and c.embedding is not null
      and d.status = 'ready'
  )
  select
    bot_chunks.id,
    bot_chunks.document_id,
    bot_chunks.content,
    bot_chunks.filename,
    (1 - (bot_chunks.embedding operator(extensions.<=>) query_embedding))::double precision as similarity
  from bot_chunks
  where 1 - (bot_chunks.embedding operator(extensions.<=>) query_embedding) >= min_similarity
  order by bot_chunks.embedding operator(extensions.<=>) query_embedding
  limit greatest(coalesce(match_count, 6), 1);
$$;
