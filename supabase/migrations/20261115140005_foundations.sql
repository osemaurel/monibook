create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append_only_table: %', tg_table_name;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_mutation() from public, anon, authenticated;

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  user_id uuid,
  action text not null check (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb
);

comment on table public.audit_log is
  'Append-only. actor_id = who triggered the action (null for system), user_id = whose account is affected.';

create index audit_log_user_id_occurred_at_idx on public.audit_log (user_id, occurred_at desc);

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.prevent_mutation();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.prevent_mutation();

alter table public.audit_log enable row level security;

revoke all on table public.audit_log from anon, authenticated, service_role;
grant select, insert on table public.audit_log to service_role;
