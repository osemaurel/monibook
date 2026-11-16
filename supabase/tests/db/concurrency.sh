#!/usr/bin/env bash
# 30 credits, cost 10, 12 simultaneous create_job calls: exactly 3 must succeed.
set -uo pipefail
db=monibook_test
C=00000000-0000-0000-0000-0000000000cc
q() { su postgres -c "psql -X -q -At -v ON_ERROR_STOP=1 -d $db -c \"$1\""; }

q "insert into auth.users (id) values ('$C')" >/dev/null
q "update public.profiles set has_access = true where id = '$C'" >/dev/null
q "update public.settings set value = value || jsonb_build_object('race_kind', 10) where key = 'credit_costs'" >/dev/null
P=$(q "insert into public.projects (user_id, name) values ('$C', 'race') returning id" | head -1)
q "select public.grant_credits('$C', 30, 'race test')" >/dev/null

out=$(mktemp -d)
for i in $(seq 1 12); do
  ( q "set role service_role; select pg_sleep(0.2); select (public.create_job('$C', '$P', 'race_kind')).id" \
      >"$out/$i.ok" 2>"$out/$i.err" ) &
done
wait

ok=$(grep -l -E '^[0-9a-f-]{36}$' "$out"/*.ok | wc -l)
insufficient=$(grep -l insufficient_credits "$out"/*.err | wc -l)
echo "succeeded=$ok insufficient_credits=$insufficient"
q "select 'available=' || available || ' reserved=' || reserved from public.credit_balances where user_id = '$C'"
rm -rf "$out"
[ "$ok" -eq 3 ] && [ "$insufficient" -eq 9 ] && echo "CONCURRENCY TEST PASSED"
