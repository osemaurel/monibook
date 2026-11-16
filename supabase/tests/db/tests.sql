\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'

create schema test;
grant usage on schema test to anon, authenticated, service_role;
create function test.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm !~ p_pattern then
      raise exception 'WRONG ERROR for [%]: got "%", expected /%/', p_sql, sqlerrm, p_pattern;
    end if;
    raise notice 'ok (refused): % -> %', left(p_sql, 70), sqlerrm;
    return;
  end;
  raise exception 'EXPECTED ERROR /%/ for [%] but it succeeded', p_pattern, p_sql;
end $$;
grant execute on function test.expect_error(text, text) to anon, authenticated, service_role;
create function test.check(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAILED: %', p_label; end if;
  raise notice 'ok: %', p_label;
end $$;
grant execute on function test.check(boolean, text) to anon, authenticated, service_role;
-- Simulates time passing for a job (owner only).
create function test.make_due(p_job uuid) returns void language sql as $$
  update public.jobs set run_after = now() where id = p_job
$$;

-- ===== Signup and access
insert into auth.users (id) values (:'A'), (:'B');
select test.check((select count(*) from public.profiles) = 2, 'signup trigger creates profiles');

-- The signup name becomes the display name; nothing else is read from the user-written metadata.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', '{"display_name": "  Awa\n  Diallo ", "has_access": true}'),
  ('00000000-0000-0000-0000-0000000000c2', jsonb_build_object('display_name', repeat('x', 300))),
  ('00000000-0000-0000-0000-0000000000c3', '{"display_name": "   "}');
select test.check(
  (select display_name = 'Awa Diallo' and not has_access from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'signup name is cleaned and access is not taken from metadata');
select test.check(
  (select char_length(display_name) = 100 from public.profiles where id = '00000000-0000-0000-0000-0000000000c2'),
  'an oversized signup name is capped instead of failing the signup');
select test.check(
  (select display_name is null from public.profiles where id = '00000000-0000-0000-0000-0000000000c3'),
  'a blank signup name leaves no display name');
delete from auth.users where id::text like '00000000-0000-0000-0000-0000000000c%';

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, false);
select test.check((select count(*) from public.profiles) = 1, 'A sees only own profile');
update public.profiles set display_name = 'Awa' where id = :'A';
select test.expect_error($$update public.profiles set has_access = true$$, 'permission denied');
select test.expect_error($$insert into public.projects (name) values ('P1')$$, 'row-level security');
select test.expect_error($$select * from public.audit_log$$, 'permission denied');
select test.expect_error(format($$select public.create_job(%L, gen_random_uuid(), 'engine_test')$$, :'A'), 'permission denied');
select test.expect_error($$select public.claim_jobs(1)$$, 'permission denied');
select test.expect_error($$select public.recover_stale_jobs('x_y', 'm')$$, 'permission denied');
select test.expect_error($$select public.verify_job_runner_secret('x')$$, 'permission denied');
select test.expect_error(format($$select public.grant_credits(%L, 1000, 'self')$$, :'A'), 'permission denied');
select test.expect_error($$select private.requeue_job(gen_random_uuid(), interval '0')$$, 'permission denied');

-- Settings visibility
select test.check((select value ->> 'engine_test' from public.settings where key = 'credit_costs') = '5', 'authenticated reads credit_costs');
select test.check((select count(*) from public.settings where key = 'providers') = 0, 'providers setting is hidden from clients');
select test.expect_error($$update public.settings set value = '{"engine_test": 1}' where key = 'credit_costs'$$, 'permission denied');

reset role;
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
update public.profiles set has_access = true where id = :'A';
select test.check((select count(*) from public.audit_log where action = 'access.granted') = 1, 'access grant is audited');

-- Settings validation and audit
select test.expect_error($$update public.settings set value = '{"engine_test": -1}' where key = 'credit_costs'$$, 'settings_credit_costs_shape');
select test.expect_error($$update public.settings set value = '{"engine_test": 2.5}' where key = 'credit_costs'$$, 'settings_credit_costs_shape');
select test.expect_error($$update public.settings set value = '{"engine_test": "5"}' where key = 'credit_costs'$$, 'settings_credit_costs_shape');
select test.expect_error($$update public.settings set value = '{"Bad Kind": 5}' where key = 'credit_costs'$$, 'settings_credit_costs_shape');
select test.expect_error($$update public.settings set value = '{"music": "x"}' where key = 'providers'$$, 'settings_providers_shape');
select test.expect_error($$update public.settings set value = '{"text": 3}' where key = 'providers'$$, 'settings_providers_shape');
update public.settings set value = value || '{"other_kind": 7}' where key = 'credit_costs';
select test.check(
  (select count(*) from public.audit_log
   where action = 'settings.update' and details ->> 'key' = 'credit_costs'
     and details -> 'new' ? 'other_kind' and not details -> 'old' ? 'other_kind') = 1,
  'price change is audited with old and new values');

-- ===== Projects
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, false);
insert into public.projects (name) values ('Ebook cuisine');
select test.expect_error(format($$insert into public.projects (name, user_id) values ('spoof', %L)$$, :'B'), 'permission denied');
reset role;
insert into public.projects (user_id, name) values (:'B', 'Projet de B');
select id as "P" from public.projects where name = 'Ebook cuisine' \gset
select id as "PB" from public.projects where name = 'Projet de B' \gset

-- ===== Job creation
set role service_role;
select test.expect_error(format($$select public.create_job(%L, %L, 'engine_test')$$, :'A', :'P'), 'insufficient_credits');
select test.expect_error(format($$select public.create_job(%L, %L, 'engine_test')$$, :'A', :'PB'), 'project_not_found');
select test.expect_error(format($$select public.create_job(%L, %L, 'unpriced_kind')$$, :'A', :'P'), 'unknown_job_kind');
select test.expect_error(format($$select public.create_job(%L, %L, 'engine_test')$$, :'B', :'PB'), 'access_denied');

select public.grant_credits(:'A', 22, 'test') is not null as granted \gset
select (public.create_job(:'A', :'P', 'engine_test', '{"simulate_failure":"none"}')).id as "J1" \gset
select (public.create_job(:'A', :'P', 'engine_test', '{"simulate_failure":"always"}')).id as "J2" \gset
select test.check(
  (select status = 'queued' and credits_reserved = 5 and attempts = 0 from public.jobs where id = :'J1'),
  'job created queued with credits_reserved from settings');
select test.check(
  (select available = 12 and reserved = 10 from public.credit_balances where user_id = :'A'),
  'reservations -> available 12, reserved 10');

-- ===== Claim
select test.check((select count(*) from public.claim_jobs(10)) = 2, 'claim_jobs takes both queued jobs');
select test.check((select count(*) from public.claim_jobs(10)) = 0, 'a claimed job is not claimed twice');
select test.check(
  (select status = 'running' and attempts = 1 and heartbeat_at is not null from public.jobs where id = :'J1'),
  'claimed job is running, attempt 1, with heartbeat');

-- ===== Progress
select public.set_job_progress(:'J1', 1, 40, 'Étape 3 sur 6 : Rédaction');
select public.set_job_progress(:'J1', 1, 20, 'Étape 2 sur 6 : Analyse');
select test.check((select progress = 40 and step like 'Étape 2%' from public.jobs where id = :'J1'), 'progress monotonic, step updated');
select test.expect_error(format($$select public.set_job_progress(%L, 2, 50, 'x')$$, :'J1'), 'job_not_active');
select test.expect_error(format($$select public.set_job_progress(%L, 1, 100, 'x')$$, :'J1'), 'invalid_progress');

-- ===== Success
select test.expect_error(
  format($$select public.complete_job(%L, 1, '{}', '{"kind":"text"}')$$, :'J1'), 'invalid_assets');
select public.complete_job(:'J1', 1, '{"text":"Bonjour"}',
  '[{"kind":"text","title":"Résultat du test","content":{"text":"Bonjour"}}]') is not null as completed \gset
select test.check(
  (select status = 'done' and progress = 100 and finished_at is not null and heartbeat_at is null from public.jobs where id = :'J1'),
  'success -> done, 100%');
select test.check(
  (select count(*) from public.assets where job_id = :'J1' and project_id = :'P' and content ->> 'text' = 'Bonjour') = 1,
  'result asset written atomically with project_id');
select test.check(
  (select available = 12 and reserved = 5 from public.credit_balances where user_id = :'A'),
  'success debits: available 12, reserved 5 (J2 still running)');
select test.expect_error(format($$select public.complete_job(%L, 1, '{}')$$, :'J1'), 'job_not_active');

-- ===== Retryable failure x3 -> final failure and refund
select public.fail_job(:'J2', 1, 'simulated_failure', 'Échec simulé.', true) is not null as f1 \gset
select test.check(
  (select status = 'queued' and attempts = 1 and run_after > now() and error_message is null from public.jobs where id = :'J2'),
  'attempt 1 failed -> requeued with backoff, no message yet');
select test.check(
  (select reserved = 5 from public.credit_balances where user_id = :'A'),
  'reservation kept during retries');
select test.check((select count(*) from public.claim_jobs(10)) = 0, 'backoff respected');
reset role; select test.make_due(:'J2'); set role service_role;
select test.check((select attempts from public.claim_jobs(10)) = 2, 'attempt 2 claimed');
select public.fail_job(:'J2', 2, 'simulated_failure', 'Échec simulé.', true) is not null as f2 \gset
reset role; select test.make_due(:'J2'); set role service_role;
select test.check((select attempts from public.claim_jobs(10)) = 3, 'attempt 3 claimed');
select public.fail_job(:'J2', 3, 'simulated_failure', 'Échec simulé pour le test du moteur.', true) is not null as f3 \gset
select test.check(
  (select status = 'failed' and attempts = 3 and error_code = 'simulated_failure'
          and error_message = 'Échec simulé pour le test du moteur.' and finished_at is not null
   from public.jobs where id = :'J2'),
  'third failure -> failed with French message');
select test.check(
  (select available = 17 and reserved = 0 from public.credit_balances where user_id = :'A'),
  'abandoned job not billed: available 17, reserved 0');
select test.check(
  (select count(*) from public.credit_transactions where job_id = :'J2' and kind = 'release') = 1,
  'exactly one release for the abandoned job');
select test.expect_error(format($$select public.complete_job(%L, 3, '{}')$$, :'J2'), 'job_not_active');

-- ===== Non-retryable failure is final at once
select (public.create_job(:'A', :'P', 'engine_test')).id as "J3" \gset
select count(*) as c from public.claim_jobs(10) \gset
select public.fail_job(:'J3', 1, 'invalid_input', 'Paramètres invalides.', false) is not null as f \gset
select test.check(
  (select status = 'failed' and attempts = 1 from public.jobs where id = :'J3'),
  'non-retryable failure is final at attempt 1');

-- ===== Stale running job: requeued, old worker fenced out, then exhausted -> failed
select (public.create_job(:'A', :'P', 'engine_test')).id as "J4" \gset
select count(*) as c from public.claim_jobs(10) \gset
select test.check(public.recover_stale_jobs('job_timeout', 'Trop long.') = 0, 'fresh running job is not stale');
reset role;
update public.jobs set heartbeat_at = now() - interval '16 minutes' where id = :'J4';
set role service_role;
select test.check(public.recover_stale_jobs('job_timeout', 'Trop long.') = 1, 'stale job recovered');
select test.check((select status = 'queued' and attempts = 1 from public.jobs where id = :'J4'), 'stale job requeued');
select test.expect_error(format($$select public.set_job_progress(%L, 1, 10, 'x')$$, :'J4'), 'job_not_active');
select test.check((select attempts from public.claim_jobs(10)) = 2, 'stale job re-claimed as attempt 2');
select test.expect_error(format($$select public.complete_job(%L, 1, '{}')$$, :'J4'), 'job_not_active');
reset role;
update public.jobs set attempts = 3, heartbeat_at = now() - interval '16 minutes' where id = :'J4';
set role service_role;
select test.check(public.recover_stale_jobs('job_timeout', 'La génération a pris trop de temps.') = 1, 'exhausted stale job handled');
select test.check(
  (select status = 'failed' and error_code = 'job_timeout' from public.jobs where id = :'J4'),
  'exhausted stale job failed');
select test.check(
  (select available = 17 and reserved = 0 from public.credit_balances where user_id = :'A'),
  'all failures refunded: available 17, reserved 0');

-- ===== Direct writes stay refused
select test.expect_error($$update public.jobs set status = 'failed'$$, 'permission denied');
select test.expect_error($$update public.credit_transactions set amount = 1000$$, 'permission denied');
reset role;
select test.expect_error($$update public.credit_transactions set amount = 1000$$, 'append_only_table');
select test.expect_error($$delete from public.audit_log$$, 'append_only_table');

-- ===== History as seen by A
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, false);
select test.check(
  (select string_agg(kind::text || ':' || amount || ':' || balance_after, ' ' order by id) from public.credit_history)
    = 'grant:22:22 reservation:-5:17 reservation:-5:12 debit:-5:12 release:5:17 reservation:-5:12 release:5:17 reservation:-5:12 release:5:17',
  'history: release of a success hidden, balance_after running');
select test.check(
  (select bool_and(project_name = 'Ebook cuisine' and job_kind = 'engine_test') from public.credit_history where job_id is not null),
  'history rows carry project and action');
select test.check((select count(*) from public.assets) = 1, 'A sees own asset');
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, false);
select test.check((select count(*) from public.credit_history) = 0, 'B sees no history of A');
select test.check((select count(*) from public.jobs) = 0, 'B sees no jobs of A');

-- ===== Dispatcher
reset role;
select test.check(public.verify_job_runner_secret((select secret from vault.secrets where name = 'job_runner_secret')), 'runner secret accepted');
select test.check(not public.verify_job_runner_secret('wrong'), 'wrong runner secret refused');
select test.check(not public.verify_job_runner_secret(null), 'missing runner secret refused');
select test.check((select length(secret) from vault.secrets where name = 'job_runner_secret') = 64, 'runner secret generated in vault');
select private.dispatch_job_runner();
select test.check((select count(*) from net.calls) = 0, 'no work -> no HTTP call');
set role service_role;
select (public.create_job(:'A', :'P', 'engine_test')).id as "J5" \gset
reset role;
select private.dispatch_job_runner();
select test.check((select count(*) from net.calls) = 0, 'work but runner URL not configured -> no call');
select vault.create_secret('https://example.invalid/functions/v1/job-run', 'job_runner_url');
select private.dispatch_job_runner();
select test.check(
  (select count(*) = 1 and bool_and(headers ->> 'x-job-runner-secret' = (select secret from vault.secrets where name = 'job_runner_secret')) from net.calls),
  'queued job -> one call with the runner secret');
select test.check((select count(*) from cron.job where jobname = 'job-run-dispatch' and schedule = '10 seconds') = 1, 'dispatcher scheduled every 10 seconds');

select test.check(
  (select count(*) from public.audit_log where user_id = :'A' and action like 'credits.%')
    = 1 + 5 + 1 + 3,
  'every credit movement audited (1 grant, 5 reservations, 1 debit, 3 releases)');
select test.check(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'jobs') = 1,
  'jobs published to realtime');

-- ===== Projects (phase 2)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, false);
insert into public.projects (name, niche, angle, audience, promise, planned_price_fcfa, language)
values ('Cuisine express', 'Cuisine rapide', 'Recettes en 15 minutes', 'Jeunes actifs', 'Cuisinez sain en 15 minutes', 1500, 'fr');
select id as "P2" from public.projects where name = 'Cuisine express' \gset
select test.check(
  (select status = 'draft' and user_id = auth.uid() from public.projects where id = :'P2'),
  'project created as draft with all fields');
select test.expect_error($$insert into public.projects (name, niche) values ('x', '   ')$$, 'projects_niche_check');
select test.expect_error($$insert into public.projects (name, language) values ('x', 'de')$$, 'projects_language_check');
select test.expect_error($$insert into public.projects (name, planned_price_fcfa) values ('x', -1)$$, 'projects_planned_price_check');
select test.expect_error($$insert into public.projects (name, cover_path) values ('x', 'a/b/cover/c.webp')$$, 'permission denied');
select test.expect_error($$insert into public.projects (name, deleted_at) values ('x', now())$$, 'permission denied');
update public.projects set status = 'in_progress', promise = 'Cuisinez sain, vite' where id = :'P2';
select test.expect_error(format($$update public.projects set cover_path = 'other/%s/cover/c.webp' where id = %L$$, :'P2', :'P2'), 'projects_cover_path_check');

-- Cover upload policy
insert into storage.objects (bucket_id, name) values ('assets', :'A' || '/' || :'P2' || '/cover/c1.webp');
update public.projects set cover_path = :'A' || '/' || :'P2' || '/cover/c1.webp' where id = :'P2';
select test.check((select cover_path is not null from public.projects where id = :'P2'), 'owner uploads a cover and links it');
select test.expect_error(format($$insert into storage.objects (bucket_id, name) values ('assets', '%s/%s/cover/c.pdf')$$, :'A', :'P2'), 'row-level security');
select test.expect_error(format($$insert into storage.objects (bucket_id, name) values ('assets', '%s/%s/cover/c.webp')$$, :'A', :'PB'), 'row-level security');
select test.expect_error(format($$insert into storage.objects (bucket_id, name) values ('assets', '%s/%s/cover/c.webp')$$, :'B', :'PB'), 'row-level security');
select test.expect_error(format($$insert into storage.objects (bucket_id, name) values ('assets', '%s/%s/ebook.pdf')$$, :'A', :'P2'), 'row-level security');
delete from storage.objects where name = :'A' || '/' || :'P2' || '/cover/c1.webp';
select test.check((select count(*) from storage.objects where name like '%/cover/c1.webp') = 0, 'owner deletes own cover');

-- Overview counters come from real rows
select test.check(
  (select active_jobs = 1 and (done_jobs_by_kind ->> 'engine_test')::int = 1 from public.project_overview where id = :'P'),
  'overview counts done jobs per kind and active jobs');
select test.check(
  (select active_jobs = 0 and done_jobs_by_kind = '{}'::jsonb from public.project_overview where id = :'P2'),
  'overview of a fresh project is empty');

-- Soft delete
update public.projects set deleted_at = now() where id = :'P2';
select test.check((select count(*) from public.project_overview where id = :'P2') = 0, 'deleted project leaves the overview');
select test.expect_error($$delete from public.projects$$, 'permission denied');
reset role;
set role service_role;
select test.expect_error(format($$select public.create_job(%L, %L, 'engine_test')$$, :'A', :'P2'), 'project_not_found');
reset role;
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, false);
select test.expect_error(format($$insert into storage.objects (bucket_id, name) values ('assets', '%s/%s/cover/c2.webp')$$, :'A', :'P2'), 'row-level security');
select test.check(
  (select count(*) > 0 from public.credit_history where project_name = 'Ebook cuisine'),
  'history keeps project names');
select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, false);
select test.check((select count(*) from public.project_overview) = 1, 'B sees only own project in overview');
reset role;

-- ===== Ebooks (phase 3)
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, false);
select test.expect_error(format($$insert into public.ebooks (project_id, subject, step) values (%L, 'Sujet', 2)$$, :'P'), 'ebook_step_incomplete');
insert into public.ebooks (project_id, subject, template, step) values (:'P', 'Cuisine rapide', 'method_guide', 2);
select id as "E" from public.ebooks where project_id = :'P' \gset
select test.check((select user_id = auth.uid() and step = 2 from public.ebooks where id = :'E'), 'ebook created at step 2 for its owner');
select test.expect_error(format($$insert into public.ebooks (project_id, subject, template) values (%L, 'x', 'free')$$, :'P'), 'duplicate key');
select test.expect_error(format($$update public.ebooks set step = 3 where id = %L$$, :'E'), 'ebook_step_incomplete');
select test.expect_error(format($$update public.ebooks set title_proposals = '["x"]' where id = %L$$, :'E'), 'permission denied');
select test.expect_error(format($$update public.ebooks set bible = '{}' where id = %L$$, :'E'), 'permission denied');
update public.ebooks set title = 'Cuisiner en 15 minutes', step = 3 where id = :'E';
select test.expect_error(format($$update public.ebooks set step = 4 where id = %L$$, :'E'), 'ebook_step_incomplete');
update public.ebooks set summary = 'Un guide pratique.', step = 4 where id = :'E';
select test.expect_error(format($$update public.ebooks set step = 5, length = 'short' where id = %L$$, :'E'), 'ebook_step_incomplete');
update public.ebooks set length = 'short', tone = 'Chaleureux', author_name = 'Awa', step = 5 where id = :'E';
select test.expect_error(format($$update public.ebooks set step = 6 where id = %L$$, :'E'), 'ebook_step_incomplete');

insert into public.ebook_chapters (ebook_id, position, title, brief) values
  (:'E', 1, 'Les bases', 'Matériel et principes'),
  (:'E', 2, 'Les recettes', 'Dix recettes'),
  (:'E', 3, 'Organiser sa semaine', 'Planification');
select test.check(
  (select bool_and(status = 'pending' and word_count = 0 and user_id = auth.uid()) from public.ebook_chapters where ebook_id = :'E'),
  'outline chapters start pending, owned by the user');
update public.ebooks set step = 6 where id = :'E';
update public.ebook_chapters set content = 'un deux trois' where ebook_id = :'E' and position = 1;
select test.check((select status = 'written' and word_count = 3 from public.ebook_chapters where ebook_id = :'E' and position = 1), 'manual content -> written, words counted');
update public.ebook_chapters set content = '' where ebook_id = :'E' and position = 1;
select test.check((select status = 'pending' and word_count = 0 from public.ebook_chapters where ebook_id = :'E' and position = 1), 'emptied chapter -> pending');
select test.expect_error(format($$update public.ebook_chapters set summary = 'x' where ebook_id = %L$$, :'E'), 'permission denied');

select array_agg(id order by position desc) as "REV" from public.ebook_chapters where ebook_id = :'E' \gset
select public.reorder_ebook_chapters(:'E', :'REV'::uuid[]);
select test.check(
  (select string_agg(title, ' | ' order by position) from public.ebook_chapters where ebook_id = :'E') = 'Organiser sa semaine | Les recettes | Les bases',
  'chapters reordered in one statement');
select test.expect_error(format($$select public.reorder_ebook_chapters(%L, array[(select id from public.ebook_chapters where ebook_id = %L limit 1)])$$, :'E', :'E'), 'invalid_chapter_order');

select set_config('request.jwt.claims', json_build_object('sub', :'B')::text, false);
select test.check((select count(*) from public.ebooks) = 0 and (select count(*) from public.ebook_chapters) = 0, 'B sees no ebook of A');
select test.expect_error(format($$select public.reorder_ebook_chapters(%L, %L::uuid[])$$, :'E', :'REV'), 'invalid_chapter_order');
select test.expect_error(format($$insert into public.ebook_chapters (ebook_id, position, title) values (%L, 9, 'intrus')$$, :'E'), 'row-level security|foreign key');

-- Writing starts: the bible locks what the text is written from
reset role;
set role service_role;
update public.ebooks set bible = '{"promise": "x"}' where id = :'E';
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, false);
select test.expect_error(format($$update public.ebooks set subject = 'Autre sujet' where id = %L$$, :'E'), 'ebook_locked');
select test.expect_error(format($$update public.ebooks set length = 'complete' where id = %L$$, :'E'), 'ebook_locked');
update public.ebooks set title = 'Cuisiner vite et bien' where id = :'E';
select test.expect_error(format($$update public.ebooks set step = 7 where id = %L$$, :'E'), 'ebook_step_incomplete');
reset role;
set role service_role;
update public.ebooks set written_at = now() where id = :'E';
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, false);
update public.ebooks set step = 7 where id = :'E';
select test.expect_error(format($$update public.ebooks set cover_path = '%s/%s/ebook/covers/none.svg' where id = %L$$, :'A', :'P', :'E'), 'invalid_cover');
reset role;
insert into public.assets (user_id, project_id, kind, storage_path, mime_type)
values (:'A', :'P', 'image', :'A' || '/' || :'P' || '/ebook/covers/c1.svg', 'image/svg+xml');
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, false);
update public.ebooks set cover_path = :'A' || '/' || :'P' || '/ebook/covers/c1.svg', step = 8 where id = :'E';
update public.ebooks set step = 9, export_template = 'elegant' where id = :'E';
select test.check((select step = 9 from public.ebooks where id = :'E'), 'all nine steps validated in order');
delete from public.ebook_chapters where ebook_id = :'E' and title = 'Les recettes';
select test.check((select count(*) from public.ebook_chapters where ebook_id = :'E') = 2, 'owner deletes a chapter');
reset role;

-- Long jobs hand over without consuming an attempt
set role service_role;
select (public.create_job(:'A', :'P', 'engine_test')).id as "J6" \gset
select count(*) as c from public.claim_jobs(20) \gset
select test.check((select attempts from public.jobs where id = :'J6') = 1, 'long job claimed as attempt 1');
select public.set_job_progress(:'J6', 1, 40, 'Chapitre 3 sur 8');
select test.expect_error(format($$select public.yield_job(%L, 2)$$, :'J6'), 'job_not_active');
select (public.yield_job(:'J6', 1)).status as yielded \gset
select test.check((select status = 'queued' and continuation and heartbeat_at is null from public.jobs where id = :'J6'), 'yield requeues as a continuation');
select test.check((select count(*) from public.claim_jobs(5) where id = :'J6') = 1, 'continuation claimed right away');
select test.check(
  (select attempts = 1 and progress = 40 and step = 'Chapitre 3 sur 8' and not continuation from public.jobs where id = :'J6'),
  'continuation keeps attempt, progress and step');
select public.fail_job(:'J6', 1, 'generation_failed', 'x', true) is not null as f \gset
select test.check((select status = 'queued' and not continuation from public.jobs where id = :'J6'), 'a failure is a fresh attempt, not a continuation');
reset role;
update public.jobs set attempts = 3, run_after = now(), status = 'running', heartbeat_at = now() where id = :'J6';
set role service_role;
select (public.yield_job(:'J6', 3)).status as y3 \gset
select test.check((select count(*) from public.claim_jobs(5) where id = :'J6') = 1, 'a continuation is claimed even at the last attempt');
select test.check((select attempts from public.jobs where id = :'J6') = 3, 'last attempt not exceeded');
select public.complete_job(:'J6', 3, '{}') is not null as done6 \gset

select (public.create_job(:'A', :'P', 'engine_test')).id as "J7" \gset
reset role;
select count(*) as before_kick from net.calls \gset
set role service_role;
select public.kick_job_runner();
reset role;
select test.check((select count(*) from net.calls) = :before_kick + 1, 'kick dispatches the runner at once when work is queued');
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A')::text, false);
select test.expect_error($$select public.kick_job_runner()$$, 'permission denied');
select test.expect_error(format($$select public.yield_job(%L, 1)$$, :'J7'), 'permission denied');
select test.check(
  (select (value ->> 'ebook_write_standard')::int = 30 and (value ->> 'ebook_titles')::int = 1 from public.settings where key = 'credit_costs'),
  'ebook generations are priced in settings');
reset role;
select test.check(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('ebooks', 'ebook_chapters')) = 2,
  'ebooks and chapters published to realtime');

\echo ALL TESTS PASSED
