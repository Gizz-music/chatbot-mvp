-- Ingestion side of the knowledge base: per-plan upload limits, the website
-- source, and the Storage bucket uploaded files land in.
-- Re-runnable: safe to apply twice.

-- Upload limits per plan. Kept in the database so the browser and the insert
-- trigger read the same numbers instead of each hard-coding their own copy.
create table if not exists public.plan_limits (
  plan text primary key check (plan in ('free', 'pro', 'team')),
  max_file_bytes bigint not null check (max_file_bytes > 0),
  -- NULL means "no cap on the number of documents".
  max_documents integer check (max_documents > 0)
);

insert into public.plan_limits (plan, max_file_bytes, max_documents)
values
  ('free', 2 * 1024 * 1024, 5),
  ('pro', 10 * 1024 * 1024, 100),
  ('team', 25 * 1024 * 1024, null)
on conflict (plan) do update
set max_file_bytes = excluded.max_file_bytes,
    max_documents = excluded.max_documents;

alter table public.plan_limits enable row level security;

-- No policy on purpose: the table is reached through current_plan_limits(),
-- so a client can only ever see the row for its own plan.

create or replace function public.current_plan_limits()
returns table (plan_id text, max_file_bytes bigint, max_documents integer)
language sql
stable
security definer
set search_path = ''
as $$
  select l.plan, l.max_file_bytes, l.max_documents
  from public.subscriptions as s
  join public.plan_limits as l on l.plan = s.plan
  where s.user_id = (select auth.uid());
$$;

revoke all on function public.current_plan_limits() from public, anon;
grant execute on function public.current_plan_limits() to authenticated;

-- A document is either an uploaded file or a crawled web page.
alter table public.documents
  add column if not exists source_type text not null default 'file',
  add column if not exists source_url text;

alter table public.documents
  drop constraint if exists documents_source_type_check;
alter table public.documents
  add constraint documents_source_type_check
  check (source_type in ('file', 'url'));

-- Web pages have no object in Storage, so the path is no longer mandatory.
alter table public.documents
  alter column storage_path drop not null;

alter table public.documents
  drop constraint if exists documents_source_location_check;
alter table public.documents
  add constraint documents_source_location_check
  check (
    (source_type = 'file' and storage_path is not null)
    or (source_type = 'url' and source_url is not null)
  );

-- Plan limits are enforced here rather than in the client, which only mirrors
-- them to show a friendly message before the upload starts.
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

  -- No subscription row yet: leave the decision to the RLS policies.
  if not found then
    return new;
  end if;

  if new.size > limits.max_file_bytes then
    raise exception
      'The % plan allows files up to % bytes, this one is % bytes.',
      limits.plan, limits.max_file_bytes, new.size
      using errcode = 'check_violation';
  end if;

  if limits.max_documents is not null then
    select count(*) into stored_count
    from public.documents as d
    where d.bot_id = new.bot_id;

    if stored_count >= limits.max_documents then
      raise exception
        'The % plan allows up to % documents per bot.',
        limits.plan, limits.max_documents
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists documents_enforce_limits on public.documents;
create trigger documents_enforce_limits
  before insert on public.documents
  for each row
  execute function public.enforce_document_limits();

-- Private bucket for the uploaded originals. The size cap matches the most
-- generous plan; the trigger above narrows it down per subscription.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 25 * 1024 * 1024)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- Objects are stored as `<bot_id>/<uuid>.<ext>`, so the first path segment
-- decides ownership. Anything that is not a bot folder is rejected outright,
-- which also keeps the uuid cast below from raising.
create or replace function public.owns_bot_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folder text := split_part(object_name, '/', 1);
begin
  if folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.owns_bot(folder::uuid);
end;
$$;

revoke all on function public.owns_bot_object(text) from public, anon;
grant execute on function public.owns_bot_object(text) to authenticated;

drop policy if exists "Owners can upload bot documents" on storage.objects;
create policy "Owners can upload bot documents"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'documents' and public.owns_bot_object(name));

drop policy if exists "Owners can read bot documents" on storage.objects;
create policy "Owners can read bot documents"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'documents' and public.owns_bot_object(name));

drop policy if exists "Owners can delete bot documents" on storage.objects;
create policy "Owners can delete bot documents"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'documents' and public.owns_bot_object(name));
