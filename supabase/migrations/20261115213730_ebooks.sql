-- Long jobs: an executor may hand over to a later invocation without consuming an attempt.

alter table public.jobs add column continuation boolean not null default false;

create or replace function private.requeue_job(p_job_id uuid, p_delay interval)
returns void
language sql
set search_path = ''
as $$
  update public.jobs
  set status = 'queued',
      run_after = now() + p_delay,
      step = null,
      heartbeat_at = null,
      continuation = false
  where id = p_job_id;
$$;

create or replace function public.claim_jobs(p_limit integer)
returns setof public.jobs
language sql
security definer
set search_path = ''
as $$
  update public.jobs j
  set status = 'running',
      attempts = case when j.continuation then j.attempts else j.attempts + 1 end,
      progress = case when j.continuation then j.progress else 0 end,
      step = case when j.continuation then j.step else null end,
      continuation = false,
      started_at = coalesce(j.started_at, now()),
      heartbeat_at = now()
  from (
    select q.id
    from public.jobs q
    where q.status = 'queued'
      and q.run_after <= now()
      and (q.continuation or q.attempts < q.max_attempts)
    order by q.run_after, q.created_at
    limit least(greatest(p_limit, 1), 20)
    for update skip locked
  ) claimed
  where j.id = claimed.id
  returning j.*;
$$;

create function public.yield_job(p_job_id uuid, p_attempt integer)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  update public.jobs
  set status = 'queued',
      continuation = true,
      run_after = now(),
      heartbeat_at = null
  where id = p_job_id
    and status = 'running'
    and attempts = p_attempt
  returning * into v_job;

  if not found then
    raise exception 'job_not_active';
  end if;
  return v_job;
end;
$$;

-- Lets job-create start a worker right away instead of waiting for the next cron tick.
create function public.kick_job_runner()
returns void
language sql
security definer
set search_path = ''
as $$
  select private.dispatch_job_runner();
$$;

revoke execute on function public.yield_job(uuid, integer) from public, anon, authenticated;
revoke execute on function public.kick_job_runner() from public, anon, authenticated;
grant execute on function public.yield_job(uuid, integer) to service_role;
grant execute on function public.kick_job_runner() to service_role;

-- Ebooks -----------------------------------------------------------------------

create type public.ebook_template as enum ('method_guide', 'step_by_step', 'recipes', 'business_money', 'free');
create type public.ebook_length as enum ('short', 'standard', 'complete');
create type public.ebook_chapter_status as enum ('pending', 'writing', 'written');

create table public.ebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  project_id uuid not null,
  -- Step of the 9-step flow the user is on; a step can only be reached once the previous ones are valid.
  step smallint not null default 1 check (step between 1 and 9),
  subject text check (char_length(btrim(subject)) between 1 and 1000),
  template public.ebook_template,
  title_proposals jsonb not null default '[]'::jsonb check (jsonb_typeof(title_proposals) = 'array'),
  title text check (char_length(btrim(title)) between 1 and 200),
  subtitle text check (char_length(btrim(subtitle)) between 1 and 300),
  summary text check (char_length(btrim(summary)) between 1 and 5000),
  length public.ebook_length,
  tone text check (char_length(btrim(tone)) between 1 and 200),
  instructions text check (char_length(btrim(instructions)) between 1 and 3000),
  author_name text check (char_length(btrim(author_name)) between 1 and 120),
  -- Reference injected in every writing call: promise, audience, tone, full outline.
  bible jsonb,
  coherence_notes text,
  written_at timestamptz,
  cover_path text,
  export_template text not null default 'classic' check (export_template in ('classic', 'modern', 'elegant')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id),
  unique (id, user_id),
  foreign key (project_id, user_id) references public.projects (id, user_id),
  check (cover_path is null or cover_path like user_id::text || '/' || project_id::text || '/%')
);

create index ebooks_user_id_idx on public.ebooks (user_id);

create table public.ebook_chapters (
  id uuid primary key default gen_random_uuid(),
  ebook_id uuid not null,
  user_id uuid not null default auth.uid(),
  position smallint not null check (position >= 1),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  brief text check (char_length(brief) <= 2000),
  content text check (char_length(content) <= 100000),
  summary text check (char_length(summary) <= 3000),
  status public.ebook_chapter_status not null default 'pending',
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ebook_id, user_id) references public.ebooks (id, user_id) on delete cascade,
  -- Deferred so a whole reordering can happen in one statement.
  constraint ebook_chapters_position_key unique (ebook_id, position) deferrable initially deferred
);

create index ebook_chapters_user_id_idx on public.ebook_chapters (user_id);

create trigger ebooks_set_updated_at
  before update on public.ebooks
  for each row execute function public.set_updated_at();

create trigger ebook_chapters_set_updated_at
  before update on public.ebook_chapters
  for each row execute function public.set_updated_at();

create function public.ebooks_enforce_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Once writing has started, what the text was written from can no longer change.
  if tg_op = 'UPDATE' and old.bible is not null and (
       new.subject is distinct from old.subject
       or new.template is distinct from old.template
       or new.summary is distinct from old.summary
       or new.length is distinct from old.length
       or new.tone is distinct from old.tone
       or new.instructions is distinct from old.instructions
     ) then
    raise exception 'ebook_locked';
  end if;

  if (new.step >= 2 and (new.subject is null or new.template is null))
     or (new.step >= 3 and new.title is null)
     or (new.step >= 4 and new.summary is null)
     or (new.step >= 5 and (new.length is null or new.tone is null or new.author_name is null))
     or (new.step >= 6 and not exists (select 1 from public.ebook_chapters c where c.ebook_id = new.id))
     or (new.step >= 7 and new.written_at is null)
     or (new.step >= 8 and new.cover_path is null) then
    raise exception 'ebook_step_incomplete';
  end if;

  if new.cover_path is not null
     and (tg_op = 'INSERT' or new.cover_path is distinct from old.cover_path)
     and not exists (
       select 1 from public.assets a
       where a.storage_path = new.cover_path and a.project_id = new.project_id and a.kind = 'image'
     ) then
    raise exception 'invalid_cover';
  end if;

  return new;
end;
$$;

revoke execute on function public.ebooks_enforce_rules() from public, anon, authenticated;

create trigger ebooks_enforce_rules
  before insert or update on public.ebooks
  for each row execute function public.ebooks_enforce_rules();

create function public.ebook_chapters_track_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.content is distinct from old.content then
    new.word_count := case
      when coalesce(btrim(new.content), '') = '' then 0
      else array_length(regexp_split_to_array(btrim(new.content), '\s+'), 1)
    end;
    if new.status <> 'writing' then
      new.status := case when new.word_count = 0 then 'pending' else 'written' end;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.ebook_chapters_track_content() from public, anon, authenticated;

create trigger ebook_chapters_track_content
  before insert or update on public.ebook_chapters
  for each row execute function public.ebook_chapters_track_content();

-- Positions are rewritten 1..n in one statement; the list must contain every chapter once.
create function public.reorder_ebook_chapters(p_ebook_id uuid, p_chapter_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_count integer := coalesce(array_length(p_chapter_ids, 1), 0);
begin
  if v_count = 0
     or v_count <> (select count(distinct x) from unnest(p_chapter_ids) x)
     or v_count <> (select count(*) from public.ebook_chapters c where c.ebook_id = p_ebook_id) then
    raise exception 'invalid_chapter_order';
  end if;

  update public.ebook_chapters c
  set position = o.ord
  from unnest(p_chapter_ids) with ordinality as o(id, ord)
  where c.id = o.id and c.ebook_id = p_ebook_id;
end;
$$;

revoke execute on function public.reorder_ebook_chapters(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_ebook_chapters(uuid, uuid[]) to authenticated, service_role;

alter table public.ebooks enable row level security;
alter table public.ebook_chapters enable row level security;

create policy ebooks_select_own on public.ebooks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy ebooks_insert_own on public.ebooks
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_access()));

create policy ebooks_update_own on public.ebooks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.has_access()));

create policy ebook_chapters_select_own on public.ebook_chapters
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy ebook_chapters_insert_own on public.ebook_chapters
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_access()));

create policy ebook_chapters_update_own on public.ebook_chapters
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.has_access()));

create policy ebook_chapters_delete_own on public.ebook_chapters
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.has_access()));

revoke all on table public.ebooks from anon, authenticated, service_role;
grant select,
      insert (project_id, subject, template, step),
      update (step, subject, template, title, subtitle, summary, length, tone, instructions, author_name, cover_path, export_template)
  on table public.ebooks to authenticated;
grant select, insert, update on table public.ebooks to service_role;

revoke all on table public.ebook_chapters from anon, authenticated, service_role;
grant select, delete,
      insert (ebook_id, position, title, brief, content),
      update (position, title, brief, content)
  on table public.ebook_chapters to authenticated;
grant select, insert, update, delete on table public.ebook_chapters to service_role;

alter publication supabase_realtime add table public.ebooks, public.ebook_chapters;

-- Prices of the ebook generations (credits).
update public.settings
set value = value || '{
  "ebook_titles": 1,
  "ebook_summary": 1,
  "ebook_outline": 2,
  "ebook_write_short": 15,
  "ebook_write_standard": 30,
  "ebook_write_complete": 60,
  "ebook_cover": 4,
  "ebook_chapter_rewrite": 3
}'::jsonb
where key = 'credit_costs';
