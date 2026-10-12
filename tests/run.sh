#!/usr/bin/env bash
# Applies all migrations to a scratch database on a local Postgres and runs db.test.sql.
# Usage: PGHOST=/var/tmp/lickdpg PGPORT=54329 PGUSER=postgres ./run.sh
set -euo pipefail
cd "$(dirname "$0")"
DB=lickd_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
# roles are cluster-wide: recreate
psql -q -d postgres -c "drop role if exists anon" -c "drop role if exists authenticated" -c "drop role if exists service_role" 2>/dev/null || true
psql -v ON_ERROR_STOP=1 -q -d $DB -f bootstrap.sql
for f in ../supabase/migrations/*.sql; do
  echo "== applying $(basename $f)"; psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"
done
psql -v ON_ERROR_STOP=1 -q -d $DB -f db.test.sql
