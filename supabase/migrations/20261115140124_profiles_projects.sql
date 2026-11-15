create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  has_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.audit_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, user_id, action, entity_type, entity_id)
  values (
    auth.uid(),
    new.id,
    case when new.has_access then 'access.granted' else 'access.revoked' end,
    'profile',
    new.id
  );
  return new;
end;
$$;

revoke execute on function public.audit_access_change() from public, anon, authenticated;

create trigger profiles_audit_access_change
  after update of has_access on public.profiles
  for each row
  when (old.has_access is distinct from new.has_access)
  execute function public.audit_access_change();

create function public.has_access()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select p.has_access from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke execute on function public.has_access() from public, anon;
grant execute on function public.has_access() to authenticated, service_role;

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on table public.profiles from anon, authenticated, service_role;
grant select, update (display_name) on table public.profiles to authenticated;
grant select, update on table public.profiles to service_role;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index projects_user_id_created_at_idx on public.projects (user_id, created_at desc);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy projects_select_own on public.projects
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy projects_insert_own on public.projects
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_access()));

create policy projects_update_own on public.projects
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select public.has_access()));

revoke all on table public.projects from anon, authenticated, service_role;
grant select, insert (name, description), update (name, description)
  on table public.projects to authenticated;
grant select, insert, update on table public.projects to service_role;
