-- Phase 4: ad visuals and sales copy.
-- The offer (benefits, call to action, guarantee) joins the project, so that every module reads it
-- from there and no form asks for it twice.

create function private.texts_within(p_items text[], p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(char_length(btrim(item)) between 1 and p_max), true)
  from unnest(p_items) as item
$$;

revoke execute on function private.texts_within(text[], integer) from public;
grant execute on function private.texts_within(text[], integer) to authenticated, service_role;

alter table public.projects
  add column benefits text[] not null default '{}',
  add column call_to_action text,
  add column guarantee text,
  add constraint projects_benefits_check check (
    cardinality(benefits) <= 6 and private.texts_within(benefits, 160)
  ),
  add constraint projects_call_to_action_check check (char_length(btrim(call_to_action)) between 1 and 80),
  add constraint projects_guarantee_check check (char_length(btrim(guarantee)) between 1 and 200);

grant insert (benefits, call_to_action, guarantee), update (benefits, call_to_action, guarantee)
  on table public.projects to authenticated;

-- New columns are appended so the view keeps its existing column order.
create or replace view public.project_overview
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.name,
  p.niche,
  p.angle,
  p.audience,
  p.promise,
  p.planned_price_fcfa,
  p.language,
  p.status,
  p.cover_path,
  p.created_at,
  p.updated_at,
  coalesce(done.by_kind, '{}'::jsonb) as done_jobs_by_kind,
  coalesce(active.n, 0)::integer as active_jobs,
  p.benefits,
  p.call_to_action,
  p.guarantee
from public.projects p
left join lateral (
  select jsonb_object_agg(x.kind, x.n) as by_kind
  from (
    select j.kind, count(*) as n
    from public.jobs j
    where j.project_id = p.id and j.status = 'done'
    group by j.kind
  ) x
) done on true
left join lateral (
  select count(*) as n
  from public.jobs j
  where j.project_id = p.id and j.status in ('queued', 'running')
) active on true
where p.deleted_at is null;

-- Saved sales copy. Generations propose variations (kept in the job's output); the user picks one,
-- edits it and saves it here.
create type public.copy_type as enum (
  'hooks',
  'facebook_short',
  'facebook_long',
  'sales_page',
  'email_sequence',
  'product_description',
  'social_captions',
  'free'
);

create type public.copy_angle as enum ('emotional', 'numbers', 'testimonial', 'urgency');

create table public.copy_texts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  project_id uuid not null,
  -- Generation the text comes from; it belongs to the same project.
  job_id uuid,
  type public.copy_type not null,
  -- Null for free-mode texts, which are not written along a fixed angle.
  angle public.copy_angle,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  content text not null check (char_length(btrim(content)) between 1 and 30000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects (id, user_id),
  foreign key (job_id, project_id) references public.jobs (id, project_id)
);

create index copy_texts_project_idx on public.copy_texts (project_id, created_at desc);
create index copy_texts_job_idx on public.copy_texts (job_id, project_id);

create trigger copy_texts_set_updated_at
  before update on public.copy_texts
  for each row execute function public.set_updated_at();

alter table public.copy_texts enable row level security;

create policy copy_texts_select_own on public.copy_texts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy copy_texts_insert_own on public.copy_texts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.has_access())
    and exists (
      select 1 from public.projects p
      where p.id = copy_texts.project_id and p.user_id = (select auth.uid()) and p.deleted_at is null
    )
  );

create policy copy_texts_update_own on public.copy_texts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.has_access()));

create policy copy_texts_delete_own on public.copy_texts
  for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.has_access()));

revoke all on table public.copy_texts from anon, authenticated, service_role;
grant select, delete,
      insert (project_id, job_id, type, angle, title, content),
      update (title, content)
  on table public.copy_texts to authenticated;
grant select, insert, update, delete on table public.copy_texts to service_role;

-- Optional visual reference for a batch of ad visuals, uploaded by the owner to
-- {user_id}/{project_id}/visuals/references/{file}. Generated visuals are written by the server.
create policy assets_objects_insert_own_visual_reference on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assets'
    and array_length(storage.foldername(name), 1) = 4
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[3] = 'visuals'
    and (storage.foldername(name))[4] = 'references'
    and lower(storage.extension(name)) in ('webp', 'jpg', 'jpeg', 'png')
    and (select public.has_access())
    and exists (
      select 1
      from public.projects p
      where p.id::text = (storage.foldername(objects.name))[2]
        and p.user_id = (select auth.uid())
        and p.deleted_at is null
    )
  );

-- Prices (credits). A batch makes 4 visuals; each copy generation makes 4 variations.
update public.settings
set value = value || '{
  "ad_visuals": 6,
  "copy_hooks": 2,
  "copy_facebook_short": 2,
  "copy_facebook_long": 3,
  "copy_sales_page": 4,
  "copy_email_sequence": 4,
  "copy_product_description": 2,
  "copy_social_captions": 2,
  "copy_free": 2
}'::jsonb
where key = 'credit_costs';
