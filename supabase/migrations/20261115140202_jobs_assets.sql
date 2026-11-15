create table public.job_kinds (
  kind text primary key check (kind ~ '^[a-z][a-z0-9_]{1,62}$'),
  credit_cost integer not null check (credit_cost > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.job_kinds is
  'Single source of truth for credit costs: read by the UI to show the cost before an action, and by create_job to reserve it.';

create trigger job_kinds_set_updated_at
  before update on public.job_kinds
  for each row execute function public.set_updated_at();

alter table public.job_kinds enable row level security;

create policy job_kinds_select_authenticated on public.job_kinds
  for select to authenticated
  using (true);

revoke all on table public.job_kinds from anon, authenticated, service_role;
grant select on table public.job_kinds to authenticated;
grant select, insert, update on table public.job_kinds to service_role;

create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  kind text not null references public.job_kinds (kind),
  status public.job_status not null default 'queued',
  progress smallint not null default 0 check (progress between 0 and 100),
  credit_cost integer not null check (credit_cost > 0),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  -- Stable code translated by the UI; never a raw provider message.
  error_code text check (error_code ~ '^[a-z][a-z0-9_]{1,62}$'),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (id, project_id),
  foreign key (project_id, user_id) references public.projects (id, user_id),
  check ((status in ('succeeded', 'failed')) = (finished_at is not null)),
  check ((status = 'failed') = (error_code is not null))
);

create index jobs_user_id_created_at_idx on public.jobs (user_id, created_at desc);
create index jobs_project_id_user_id_idx on public.jobs (project_id, user_id);
create index jobs_kind_idx on public.jobs (kind);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;

create policy jobs_select_own on public.jobs
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Writes go exclusively through the job lifecycle functions (security definer).
revoke all on table public.jobs from anon, authenticated, service_role;
grant select on table public.jobs to authenticated, service_role;

alter publication supabase_realtime add table public.jobs;

create type public.asset_kind as enum ('document', 'image', 'video', 'audio', 'text');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  job_id uuid,
  kind public.asset_kind not null,
  title text check (char_length(title) <= 200),
  storage_path text unique,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  content jsonb,
  created_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects (id, user_id),
  foreign key (job_id, project_id) references public.jobs (id, project_id),
  check (storage_path is not null or content is not null),
  -- Keeps the storage read policy (first folder = owner) aligned with ownership.
  check (storage_path is null or storage_path like user_id::text || '/' || project_id::text || '/%')
);

create index assets_project_id_user_id_idx on public.assets (project_id, user_id);
create index assets_job_id_project_id_idx on public.assets (job_id, project_id);

alter table public.assets enable row level security;

create policy assets_select_own on public.assets
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.assets from anon, authenticated, service_role;
grant select on table public.assets to authenticated;
grant select, insert on table public.assets to service_role;

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false);

create policy assets_objects_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
