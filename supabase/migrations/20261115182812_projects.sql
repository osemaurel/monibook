create type public.project_status as enum ('draft', 'in_progress', 'launched', 'archived');

alter table public.projects drop column description;

alter table public.projects
  add column niche text,
  add column angle text,
  add column audience text,
  add column promise text,
  add column planned_price_fcfa integer,
  add column language text not null default 'fr',
  add column status public.project_status not null default 'draft',
  add column cover_path text,
  add column deleted_at timestamptz,
  -- Optional texts are null when missing, never empty: readiness relies on it.
  add constraint projects_niche_check check (char_length(btrim(niche)) between 1 and 200),
  add constraint projects_angle_check check (char_length(btrim(angle)) between 1 and 500),
  add constraint projects_audience_check check (char_length(btrim(audience)) between 1 and 500),
  add constraint projects_promise_check check (char_length(btrim(promise)) between 1 and 300),
  add constraint projects_planned_price_check check (planned_price_fcfa between 0 and 100000000),
  add constraint projects_language_check check (language in ('fr', 'en')),
  add constraint projects_cover_path_check check (
    cover_path is null or cover_path like user_id::text || '/' || id::text || '/cover/%'
  );

create index projects_user_id_active_idx on public.projects (user_id, updated_at desc)
  where deleted_at is null;

revoke insert, update on table public.projects from authenticated;
grant insert (name, niche, angle, audience, promise, planned_price_fcfa, language, status),
      update (name, niche, angle, audience, promise, planned_price_fcfa, language, status, cover_path, deleted_at)
  on table public.projects to authenticated;

-- Counters come from rows actually written: done jobs per kind and active jobs.
create view public.project_overview
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
  coalesce(active.n, 0)::integer as active_jobs
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

revoke all on table public.project_overview from anon, authenticated, service_role;
grant select on table public.project_overview to authenticated, service_role;

-- Covers are uploaded by the owner to {user_id}/{project_id}/cover/{file}.
create policy assets_objects_insert_own_cover on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assets'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[3] = 'cover'
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

create policy assets_objects_delete_own_cover on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assets'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[3] = 'cover'
  );

-- A deleted project can no longer start generations.
create or replace function public.create_job(
  p_user_id uuid,
  p_project_id uuid,
  p_kind text,
  p_input jsonb default '{}'::jsonb
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_access boolean;
  v_cost integer;
  v_available bigint;
  v_job public.jobs;
begin
  -- Serializes credit reservations per user.
  select p.has_access into v_has_access
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if not v_has_access then
    raise exception 'access_denied';
  end if;

  perform 1 from public.projects
  where id = p_project_id and user_id = p_user_id and deleted_at is null;
  if not found then
    raise exception 'project_not_found';
  end if;

  select (s.value ->> p_kind)::numeric::integer into v_cost
  from public.settings s
  where s.key = 'credit_costs';

  if v_cost is null then
    raise exception 'unknown_job_kind';
  end if;

  select coalesce(sum(t.amount), 0) into v_available
  from public.credit_transactions t
  where t.user_id = p_user_id;

  if v_available < v_cost then
    raise exception 'insufficient_credits';
  end if;

  insert into public.jobs (user_id, project_id, kind, credits_reserved, input)
  values (p_user_id, p_project_id, p_kind, v_cost, coalesce(p_input, '{}'::jsonb))
  returning * into v_job;

  insert into public.credit_transactions (user_id, kind, amount, job_id)
  values (p_user_id, 'reservation', -v_cost, v_job.id);

  insert into public.audit_log (actor_id, user_id, action, entity_type, entity_id, details)
  values (p_user_id, p_user_id, 'credits.reserved', 'job', v_job.id,
          jsonb_build_object('amount', v_cost, 'kind', p_kind));

  return v_job;
end;
$$;
