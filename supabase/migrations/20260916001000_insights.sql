-- Insights: unanswered answers, owner-facing analytics, widget lead capture.
-- Re-runnable: safe to apply twice.

alter table public.messages
  add column if not exists unanswered boolean not null default false;

create index if not exists messages_unanswered_idx
  on public.messages (conversation_id)
  where unanswered;

-- Backfill: an assistant turn with no citations never found a matching chunk.
update public.messages
set unanswered = true
where role = 'assistant'
  and unanswered = false
  and citations = '[]'::jsonb;

create unique index if not exists leads_bot_id_lower_email_idx
  on public.leads (bot_id, lower(email));

create or replace function public.bot_insights(p_bot_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.owns_bot(p_bot_id) then
    raise exception 'Bot not found' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'messagesByDay', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(bucket.day, 'YYYY-MM-DD'),
        'count', bucket.count
      ) order by bucket.day), '[]'::jsonb)
      from (
        select
          (m.created_at at time zone 'utc')::date as day,
          count(*)::int as count
        from public.messages as m
        join public.conversations as c on c.id = m.conversation_id
        where c.bot_id = p_bot_id
          and m.created_at >= (timezone('utc', now()) - interval '13 days')
        group by 1
      ) as bucket
    ),
    'topQuestions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'question', ranked.question,
        'count', ranked.count
      ) order by ranked.count desc), '[]'::jsonb)
      from (
        select
          left(regexp_replace(btrim(m.content), '\s+', ' ', 'g'), 200) as question,
          count(*)::int as count
        from public.messages as m
        join public.conversations as c on c.id = m.conversation_id
        where c.bot_id = p_bot_id
          and m.role = 'user'
          and length(btrim(m.content)) > 0
        group by 1
        order by count(*) desc, question asc
        limit 8
      ) as ranked
    ),
    'unanswered', (
      select jsonb_build_object(
        'total', count(*) filter (where m.role = 'assistant'),
        'unanswered', count(*) filter (where m.role = 'assistant' and m.unanswered),
        'share', case
          when count(*) filter (where m.role = 'assistant') = 0 then 0
          else round(
            (
              100.0 * count(*) filter (where m.role = 'assistant' and m.unanswered)
              / count(*) filter (where m.role = 'assistant')
            )::numeric,
            1
          )
        end
      )
      from public.messages as m
      join public.conversations as c on c.id = m.conversation_id
      where c.bot_id = p_bot_id
    ),
    'totals', jsonb_build_object(
      'conversations', (
        select count(*)::int from public.conversations where bot_id = p_bot_id
      ),
      'messages', (
        select count(*)::int
        from public.messages as m
        join public.conversations as c on c.id = m.conversation_id
        where c.bot_id = p_bot_id
      ),
      'leads', (
        select count(*)::int from public.leads where bot_id = p_bot_id
      )
    )
  )
  into result;

  return result;
end;
$$;

revoke all on function public.bot_insights(uuid) from public, anon;
grant execute on function public.bot_insights(uuid) to authenticated;

create or replace function public.capture_widget_lead(
  p_public_key text,
  p_email text,
  p_name text default null,
  p_conversation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  bot record;
  clean_email text;
  clean_name text;
  lead_id uuid;
  conversation uuid;
begin
  clean_email := lower(btrim(coalesce(p_email, '')));
  clean_name := nullif(left(btrim(coalesce(p_name, '')), 80), '');
  conversation := p_conversation_id;

  if clean_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;

  select b.id, b.status
  into bot
  from public.bots as b
  where b.public_key = btrim(coalesce(p_public_key, ''))
     or b.public_key = replace(btrim(coalesce(p_public_key, '')), 'pk_live_', '')
     or concat('pk_live_', b.public_key) = btrim(coalesce(p_public_key, ''))
  limit 1;

  if bot.id is null or bot.status <> 'active' then
    raise exception 'This bot is not available.' using errcode = '42501';
  end if;

  if conversation is not null then
    if not exists (
      select 1
      from public.conversations as c
      where c.id = conversation
        and c.bot_id = bot.id
    ) then
      conversation := null;
    end if;
  end if;

  select l.id
  into lead_id
  from public.leads as l
  where l.bot_id = bot.id
    and lower(l.email) = clean_email;

  if lead_id is not null then
    update public.leads
    set
      name = coalesce(clean_name, name),
      conversation_id = coalesce(conversation, conversation_id)
    where id = lead_id;

    return lead_id;
  end if;

  insert into public.leads (bot_id, conversation_id, email, name)
  values (bot.id, conversation, clean_email, clean_name)
  returning id into lead_id;

  return lead_id;
end;
$$;

revoke all on function public.capture_widget_lead(text, text, text, uuid)
  from public;
grant execute on function public.capture_widget_lead(text, text, text, uuid)
  to anon, authenticated;
