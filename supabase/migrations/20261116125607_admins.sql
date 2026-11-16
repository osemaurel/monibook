-- Monibook administrators. This is not a plan level: the customer side still only knows the binary
-- has_access. Being an admin marks who may use the administration tools. Only the service role
-- (dashboard, SQL, Edge Functions) can name or remove an admin, and every change is audited.
create table public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

revoke all on table public.admins from anon, authenticated, service_role;
grant select, insert, delete on table public.admins to service_role;
grant select on table public.admins to authenticated;

create policy admins_select_own on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

create function public.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  insert into public.audit_log (actor_id, user_id, action, entity_type, entity_id)
  values (
    auth.uid(),
    v_user,
    case when tg_op = 'INSERT' then 'admin.granted' else 'admin.revoked' end,
    'profile',
    v_user
  );
  return null;
end;
$$;

revoke execute on function public.audit_admin_change() from public, anon, authenticated;

create trigger admins_audit_change
  after insert or delete on public.admins
  for each row execute function public.audit_admin_change();
