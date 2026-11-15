create type public.credit_transaction_kind as enum ('grant', 'reservation', 'release', 'debit');

create table public.credit_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  kind public.credit_transaction_kind not null,
  amount integer not null,
  job_id uuid references public.jobs (id),
  created_at timestamptz not null default now(),
  constraint credit_transactions_kind_shape check (
    (kind = 'grant' and amount > 0 and job_id is null)
    or (kind = 'reservation' and amount < 0 and job_id is not null)
    or (kind = 'release' and amount > 0 and job_id is not null)
    or (kind = 'debit' and amount < 0 and job_id is not null)
  )
);

comment on table public.credit_transactions is
  'Append-only ledger. Available balance = sum(amount). A job reserves -n at launch; success writes release +n and debit -n; failure writes release +n.';

create index credit_transactions_user_id_created_at_idx
  on public.credit_transactions (user_id, created_at desc);

-- At most one reservation, one release and one debit per job: settlement is idempotent.
create unique index credit_transactions_job_id_kind_key
  on public.credit_transactions (job_id, kind)
  where job_id is not null;

create trigger credit_transactions_append_only
  before update or delete on public.credit_transactions
  for each row execute function public.prevent_mutation();

create trigger credit_transactions_no_truncate
  before truncate on public.credit_transactions
  for each statement execute function public.prevent_mutation();

alter table public.credit_transactions enable row level security;

create policy credit_transactions_select_own on public.credit_transactions
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.credit_transactions from anon, authenticated, service_role;
grant select on table public.credit_transactions to authenticated, service_role;

create view public.credit_balances
with (security_invoker = true)
as
select
  p.id as user_id,
  coalesce(sum(t.amount), 0)::bigint as available,
  coalesce(-sum(t.amount) filter (where t.kind in ('reservation', 'release')), 0)::bigint as reserved
from public.profiles p
left join public.credit_transactions t on t.user_id = p.id
group by p.id;

revoke all on table public.credit_balances from anon, authenticated, service_role;
grant select on table public.credit_balances to authenticated, service_role;

-- Job lifecycle. Callable only by service_role (Edge Functions), which passes the
-- user id taken from the verified JWT, never from the request body.

create function public.create_job(
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

  perform 1 from public.projects where id = p_project_id and user_id = p_user_id;
  if not found then
    raise exception 'project_not_found';
  end if;

  select k.credit_cost into v_cost
  from public.job_kinds k
  where k.kind = p_kind and k.is_active;

  if not found then
    raise exception 'unknown_job_kind';
  end if;

  select coalesce(sum(t.amount), 0) into v_available
  from public.credit_transactions t
  where t.user_id = p_user_id;

  if v_available < v_cost then
    raise exception 'insufficient_credits';
  end if;

  insert into public.jobs (user_id, project_id, kind, credit_cost, input)
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

create function public.set_job_progress(p_job_id uuid, p_progress integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_progress < 0 or p_progress > 99 then
    raise exception 'invalid_progress';
  end if;

  update public.jobs
  set status = 'running',
      progress = greatest(progress, p_progress),
      started_at = coalesce(started_at, now())
  where id = p_job_id and status in ('queued', 'running');

  if not found then
    raise exception 'job_not_active';
  end if;
end;
$$;

create function public.complete_job(p_job_id uuid, p_output jsonb default null)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if not found then
    raise exception 'job_not_found';
  end if;

  if v_job.status not in ('queued', 'running') then
    raise exception 'job_not_active';
  end if;

  update public.jobs
  set status = 'succeeded',
      progress = 100,
      output = p_output,
      started_at = coalesce(started_at, now()),
      finished_at = now()
  where id = p_job_id
  returning * into v_job;

  insert into public.credit_transactions (user_id, kind, amount, job_id)
  values
    (v_job.user_id, 'release', v_job.credit_cost, v_job.id),
    (v_job.user_id, 'debit', -v_job.credit_cost, v_job.id);

  insert into public.audit_log (user_id, action, entity_type, entity_id, details)
  values (v_job.user_id, 'credits.debited', 'job', v_job.id,
          jsonb_build_object('amount', v_job.credit_cost, 'kind', v_job.kind));

  return v_job;
end;
$$;

create function public.fail_job(p_job_id uuid, p_error_code text)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id for update;

  if not found then
    raise exception 'job_not_found';
  end if;

  if v_job.status not in ('queued', 'running') then
    raise exception 'job_not_active';
  end if;

  update public.jobs
  set status = 'failed',
      error_code = p_error_code,
      finished_at = now()
  where id = p_job_id
  returning * into v_job;

  insert into public.credit_transactions (user_id, kind, amount, job_id)
  values (v_job.user_id, 'release', v_job.credit_cost, v_job.id);

  insert into public.audit_log (user_id, action, entity_type, entity_id, details)
  values (v_job.user_id, 'credits.released', 'job', v_job.id,
          jsonb_build_object('amount', v_job.credit_cost, 'kind', v_job.kind,
                             'error_code', p_error_code));

  return v_job;
end;
$$;

create function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_actor_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id bigint;
begin
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'reason_required';
  end if;

  insert into public.credit_transactions (user_id, kind, amount)
  values (p_user_id, 'grant', p_amount)
  returning id into v_transaction_id;

  insert into public.audit_log (actor_id, user_id, action, entity_type, entity_id, details)
  values (p_actor_id, p_user_id, 'credits.granted', 'profile', p_user_id,
          jsonb_build_object('amount', p_amount, 'reason', p_reason,
                             'transaction_id', v_transaction_id));

  return v_transaction_id;
end;
$$;

revoke execute on function public.create_job(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.set_job_progress(uuid, integer) from public, anon, authenticated;
revoke execute on function public.complete_job(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_job(uuid, text) from public, anon, authenticated;
revoke execute on function public.grant_credits(uuid, integer, text, uuid) from public, anon, authenticated;

grant execute on function public.create_job(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.set_job_progress(uuid, integer) to service_role;
grant execute on function public.complete_job(uuid, jsonb) to service_role;
grant execute on function public.fail_job(uuid, text) to service_role;
grant execute on function public.grant_credits(uuid, integer, text, uuid) to service_role;
