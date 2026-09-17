-- Knowledge base: uploaded documents and their embedded chunks.
-- Re-runnable: safe to apply twice.

-- pgvector lives in the `extensions` schema, matching the Supabase default.
-- If it was already enabled somewhere else, the `extensions.vector` references
-- below have to follow that schema.
create extension if not exists vector with schema extensions;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots (id) on delete cascade,
  filename text not null,
  -- Path inside the Storage bucket, unique so a re-upload cannot shadow a row.
  storage_path text not null unique,
  mime text not null,
  size bigint not null check (size >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  error text,
  chunks_count integer not null default 0 check (chunks_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_bot_id_created_at_idx
  on public.documents (bot_id, created_at desc);

alter table public.documents enable row level security;

drop policy if exists "Owners can read their documents" on public.documents;
create policy "Owners can read their documents"
  on public.documents
  for select
  to authenticated
  using (public.owns_bot(bot_id));

drop policy if exists "Owners can add documents" on public.documents;
create policy "Owners can add documents"
  on public.documents
  for insert
  to authenticated
  with check (public.owns_bot(bot_id));

drop policy if exists "Owners can delete their documents" on public.documents;
create policy "Owners can delete their documents"
  on public.documents
  for delete
  to authenticated
  using (public.owns_bot(bot_id));

-- No update policy on purpose: status, error and chunks_count are written by the
-- ingest Edge Function with the service-role key.

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.set_updated_at();

create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  content text not null,
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chunks_bot_id_idx on public.chunks (bot_id);
create index if not exists chunks_document_id_idx on public.chunks (document_id);

-- Cosine distance matches the normalised Gemini embeddings used for retrieval.
create index if not exists chunks_embedding_hnsw_idx
  on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.chunks enable row level security;

-- Chunks are sealed off from anonymous visitors: the widget never queries them
-- directly, it goes through the chat Edge Function (service role). The owner
-- keeps read access so the dashboard can show what was indexed. Writes belong
-- to the ingest Edge Function only, hence no insert/update/delete policy.
revoke all on table public.chunks from anon;

drop policy if exists "Owners can read their chunks" on public.chunks;
create policy "Owners can read their chunks"
  on public.chunks
  for select
  to authenticated
  using (public.owns_bot(bot_id));
