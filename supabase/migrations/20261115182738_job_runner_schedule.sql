create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- The runner secret is generated here and never leaves the database: cron sends it,
-- job-run checks it with verify_job_runner_secret.
select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'job_runner_secret',
  'Authenticates the cron dispatcher to the job-run Edge Function'
)
where not exists (select 1 from vault.secrets where name = 'job_runner_secret');

create function public.verify_job_runner_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets s
    where s.name = 'job_runner_secret'
      and sha256(convert_to(s.decrypted_secret, 'UTF8')) = sha256(convert_to(coalesce(p_secret, ''), 'UTF8'))
  );
$$;

revoke execute on function public.verify_job_runner_secret(text) from public, anon, authenticated;
grant execute on function public.verify_job_runner_secret(text) to service_role;

-- Calls job-run only when there is something to do. The function URL is
-- environment-specific and lives in the vault secret 'job_runner_url'.
create function private.dispatch_job_runner()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
       select 1 from public.jobs where status = 'queued' and run_after <= now()
     )
     and not exists (
       select 1 from public.jobs
       where status = 'running' and heartbeat_at < now() - private.job_stale_after()
     ) then
    return;
  end if;

  select s.decrypted_secret into v_url
  from vault.decrypted_secrets s where s.name = 'job_runner_url';

  select s.decrypted_secret into v_secret
  from vault.decrypted_secrets s where s.name = 'job_runner_secret';

  if v_url is null or v_secret is null then
    raise warning 'job runner is not configured (vault secrets job_runner_url / job_runner_secret)';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-job-runner-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );
end;
$$;

revoke execute on function private.dispatch_job_runner() from public;

select cron.schedule('job-run-dispatch', '10 seconds', 'select private.dispatch_job_runner()');

select cron.schedule(
  'cron-history-cleanup',
  '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '3 days'$$
);
