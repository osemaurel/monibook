create schema private;
revoke all on schema private from public;

-- Settings ------------------------------------------------------------------

create table public.settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint settings_credit_costs_shape check (
    key <> 'credit_costs'
    or (
      jsonb_typeof(value) = 'object'
      and not jsonb_path_exists(value, '$.keyvalue() ? (!(@.key like_regex "^[a-z][a-z0-9_]{1,62}$") || @.value.type() != "number" || @.value <= 0 || @.value > 1000000 || @.value.floor() != @.value)')
    )
  ),
  constraint settings_providers_shape check (
    key <> 'providers'
    or (
      jsonb_typeof(value) = 'object'
      and not jsonb_path_exists(value, '$.keyvalue() ? (!(@.key like_regex "^(text|image|video|voice|ads)$") || @.value.type() != "string")')
    )
  )
);

comment on table public.settings is
  'Runtime configuration. credit_costs (public): job kind -> credits. providers (private): service -> provider adapter.';

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

create function public.audit_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, action, entity_type, details)
  values (
    auth.uid(),
    'settings.' || lower(tg_op),
    'setting',
    jsonb_build_object(
      'key', new.key,
      'old', case when tg_op = 'UPDATE' then old.value end,
      'new', new.value
    )
  );
  return new;
end;
$$;

revoke execute on function public.audit_settings_change() from public, anon, authenticated;

create trigger settings_audit_change
  after insert or update on public.settings
  for each row execute function public.audit_settings_change();

alter table public.settings enable row level security;

create policy settings_select_public on public.settings
  for select to authenticated
  using (is_public);

revoke all on table public.settings from anon, authenticated, service_role;
grant select on table public.settings to authenticated;
grant select, insert, update on table public.settings to service_role;

insert into public.settings (key, value, is_public) values
  ('credit_costs', '{"engine_test": 5}', true),
  ('providers', '{"text": "simulation", "image": "simulation", "video": "simulation", "voice": "simulation", "ads": "simulation"}', false);

-- Jobs: pricing moves to settings, lifecycle gains attempts and heartbeat ----

alter table public.jobs drop constraint jobs_kind_fkey;
drop index public.jobs_kind_idx;
drop table public.job_kinds;

alter type public.job_status rename value 'succeeded' to 'done';

alter table public.jobs rename column credit_cost to credits_reserved;
alter table public.jobs rename constraint jobs_credit_cost_check to jobs_credits_reserved_check;
alter table public.jobs rename constraint jobs_check to jobs_finished_at_check;
alter table public.jobs rename constraint jobs_check1 to jobs_error_code_required_check;

alter table public.jobs
  add column attempts smallint not null default 0,
  add column max_attempts smallint not null default 3,
  -- Current step, in French, shown as is by the UI.
  add column step text,
  -- Final failure message, in French, shown as is by the UI. Never a raw provider message.
  add column error_message text,
  add column run_after timestamptz not null default now(),
  add column heartbeat_at timestamptz,
  add constraint jobs_kind_format_check check (kind ~ '^[a-z][a-z0-9_]{1,62}$'),
  add constraint jobs_max_attempts_check check (max_attempts between 1 and 10),
  add constraint jobs_attempts_check check (attempts between 0 and max_attempts),
  add constraint jobs_step_length_check check (char_length(step) <= 200),
  add constraint jobs_error_message_length_check check (char_length(error_message) <= 500),
  add constraint jobs_error_message_required_check check ((status = 'failed') = (error_message is not null)),
  add constraint jobs_heartbeat_check check ((status = 'running') = (heartbeat_at is not null));

create index jobs_queued_run_after_idx on public.jobs (run_after) where status = 'queued';
create index jobs_running_heartbeat_idx on public.jobs (heartbeat_at) where status = 'running';

drop function public.set_job_progress(uuid, integer);
drop function public.complete_job(uuid, jsonb);
drop function public.fail_job(uuid, text);

-- Internal helpers (not exposed through the API) -----------------------------

create function private.job_stale_after()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '15 minutes';
$$;

create function private.requeue_job(p_job_id uuid, p_delay interval)
returns void
language sql
set search_path = ''
as $$
  update public.jobs
  set status = 'queued',
      run_after = now() + p_delay,
      step = null,
      heartbeat_at = null
  where id = p_job_id;
$$;

-- Caller must hold the row lock on the job.
create function private.release_failed_job(p_job_id uuid, p_error_code text, p_error_message text)
returns public.jobs
language plpgsql
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  update public.jobs
  set status = 'failed',
      error_code = p_error_code,
      error_message = p_error_message,
      step = null,
      heartbeat_at = null,
      finished_at = now()
  where id = p_job_id
  returning * into v_job;

  insert into public.credit_transactions (user_id, kind, amount, job_id)
  values (v_job.user_id, 'release', v_job.credits_reserved, v_job.id);

  insert into public.audit_log (user_id, action, entity_type, entity_id, details)
  values (v_job.user_id, 'credits.released', 'job', v_job.id,
          jsonb_build_object('amount', v_job.credits_reserved, 'kind', v_job.kind,
                             'error_code', p_error_code, 'attempts', v_job.attempts));

  return v_job;
end;
$$;

revoke execute on function private.job_stale_after() from public;
revoke execute on function private.requeue_job(uuid, interval) from public;
revoke execute on function private.release_failed_job(uuid, text, text) from public;

-- Job lifecycle (service_role only) ------------------------------------------

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

  perform 1 from public.projects where id = p_project_id and user_id = p_user_id;
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

create function public.claim_jobs(p_limit integer)
returns setof public.jobs
language sql
security definer
set search_path = ''
as $$
  update public.jobs j
  set status = 'running',
      attempts = j.attempts + 1,
      progress = 0,
      step = null,
      started_at = coalesce(j.started_at, now()),
      heartbeat_at = now()
  from (
    select q.id
    from public.jobs q
    where q.status = 'queued'
      and q.run_after <= now()
      and q.attempts < q.max_attempts
    order by q.run_after, q.created_at
    limit least(greatest(p_limit, 1), 20)
    for update skip locked
  ) claimed
  where j.id = claimed.id
  returning j.*;
$$;

-- p_attempt fences out a worker whose attempt was already recovered or retried.
create function public.set_job_progress(
  p_job_id uuid,
  p_attempt integer,
  p_progress integer,
  p_step text
)
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
  set progress = greatest(progress, p_progress),
      step = p_step,
      heartbeat_at = now()
  where id = p_job_id
    and status = 'running'
    and attempts = p_attempt;

  if not found then
    raise exception 'job_not_active';
  end if;
end;
$$;

create function public.complete_job(
  p_job_id uuid,
  p_attempt integer,
  p_output jsonb,
  p_assets jsonb default '[]'::jsonb
)
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

  if v_job.status <> 'running' or v_job.attempts <> p_attempt then
    raise exception 'job_not_active';
  end if;

  if jsonb_typeof(coalesce(p_assets, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_assets';
  end if;

  update public.jobs
  set status = 'done',
      progress = 100,
      step = null,
      heartbeat_at = null,
      output = p_output,
      finished_at = now()
  where id = p_job_id
  returning * into v_job;

  insert into public.assets (user_id, project_id, job_id, kind, title, storage_path, mime_type, size_bytes, content)
  select v_job.user_id, v_job.project_id, v_job.id,
         (a ->> 'kind')::public.asset_kind,
         a ->> 'title',
         a ->> 'storage_path',
         a ->> 'mime_type',
         (a ->> 'size_bytes')::bigint,
         a -> 'content'
  from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb)) a;

  insert into public.credit_transactions (user_id, kind, amount, job_id)
  values
    (v_job.user_id, 'release', v_job.credits_reserved, v_job.id),
    (v_job.user_id, 'debit', -v_job.credits_reserved, v_job.id);

  insert into public.audit_log (user_id, action, entity_type, entity_id, details)
  values (v_job.user_id, 'credits.debited', 'job', v_job.id,
          jsonb_build_object('amount', v_job.credits_reserved, 'kind', v_job.kind,
                             'attempts', v_job.attempts));

  return v_job;
end;
$$;

-- A retryable failure keeps the reservation and requeues the job until
-- max_attempts is reached; the final failure releases the reservation.
create function public.fail_job(
  p_job_id uuid,
  p_attempt integer,
  p_error_code text,
  p_error_message text,
  p_retryable boolean
)
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

  if v_job.status <> 'running' or v_job.attempts <> p_attempt then
    raise exception 'job_not_active';
  end if;

  if p_retryable and v_job.attempts < v_job.max_attempts then
    perform private.requeue_job(v_job.id, make_interval(secs => 10 * v_job.attempts));
    select * into v_job from public.jobs where id = p_job_id;
    return v_job;
  end if;

  return private.release_failed_job(v_job.id, p_error_code, p_error_message);
end;
$$;

create function public.recover_stale_jobs(p_error_code text, p_error_message text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_count integer := 0;
begin
  for v_job in
    select *
    from public.jobs
    where status = 'running'
      and heartbeat_at < now() - private.job_stale_after()
    order by heartbeat_at
    for update skip locked
  loop
    if v_job.attempts < v_job.max_attempts then
      perform private.requeue_job(v_job.id, interval '0 seconds');
    else
      perform private.release_failed_job(v_job.id, p_error_code, p_error_message);
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.claim_jobs(integer) from public, anon, authenticated;
revoke execute on function public.set_job_progress(uuid, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.complete_job(uuid, integer, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_job(uuid, integer, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.recover_stale_jobs(text, text) from public, anon, authenticated;

grant execute on function public.claim_jobs(integer) to service_role;
grant execute on function public.set_job_progress(uuid, integer, integer, text) to service_role;
grant execute on function public.complete_job(uuid, integer, jsonb, jsonb) to service_role;
grant execute on function public.fail_job(uuid, integer, text, text, boolean) to service_role;
grant execute on function public.recover_stale_jobs(text, text) to service_role;

-- Credit history -------------------------------------------------------------

-- The release written alongside a debit is an internal step of a success: it is
-- hidden here, but still counted in balance_after.
create view public.credit_history
with (security_invoker = true)
as
with ledger as (
  select
    t.*,
    sum(t.amount) over (partition by t.user_id order by t.id) as balance_after,
    bool_or(t.kind = 'debit') over (partition by t.job_id) as job_debited
  from public.credit_transactions t
)
select
  l.id,
  l.user_id,
  l.created_at,
  l.kind,
  l.amount,
  l.balance_after::bigint as balance_after,
  l.job_id,
  j.kind as job_kind,
  j.project_id,
  p.name as project_name
from ledger l
left join public.jobs j on j.id = l.job_id
left join public.projects p on p.id = j.project_id
where not (l.kind = 'release' and l.job_id is not null and l.job_debited);

revoke all on table public.credit_history from anon, authenticated, service_role;
grant select on table public.credit_history to authenticated, service_role;
