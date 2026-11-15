#!/usr/bin/env bash
# Applies every migration to a local Postgres emulating Supabase (roles, auth, storage, vault, cron, net)
# and runs tests.sql. Usage: run.sh <with-defaults|no-defaults>; then concurrency.sh for the race test.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
db=monibook_test

admin() { su postgres -c "psql -X -q -v ON_ERROR_STOP=1 -c \"$1\""; }
psqlq() { su postgres -c "psql -X -q -v ON_ERROR_STOP=1 -d $db"; }

admin "drop database if exists $db"
admin "drop role if exists anon"
admin "drop role if exists authenticated"
admin "drop role if exists service_role"
admin "create database $db"

psqlq < "$here/bootstrap.sql"
if [ "$1" = "with-defaults" ]; then psqlq < "$here/supabase_defaults.sql"; fi

for f in "$repo"/supabase/migrations/*.sql; do
  echo "== applying $(basename "$f")"
  grep -v "^create extension" "$f" | psqlq
done

echo "== running tests ($1)"
psqlq < "$here/tests.sql" 2>&1
