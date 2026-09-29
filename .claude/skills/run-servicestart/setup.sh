#!/usr/bin/env bash
# Bring up ServiceStart locally without Docker: native Postgres 16 (dev DB on
# :5432, unit-test DB on :5433), a seeded dev database, a Juno stub on :8888
# and `next dev` on :3000. Idempotent; safe to re-run after a container restart.
#   RESET_DB=1 .claude/skills/run-servicestart/setup.sh   # wipe + reseed dev DB
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
SKILL_DIR=.claude/skills/run-servicestart
LOG_DIR=${LOG_DIR:-/tmp/servicestart}
mkdir -p "$LOG_DIR/storage"

start_cluster() {
  local name=$1 port=$2 role=$3
  pg_lsclusters -h | awk '{print $2}' | grep -qx "$name" ||
    pg_createcluster 16 "$name" -p "$port" >/dev/null
  pg_ctlcluster 16 "$name" status >/dev/null 2>&1 || pg_ctlcluster 16 "$name" start
  su postgres -c "psql -p $port -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$role'\"" | grep -q 1 ||
    su postgres -c "psql -p $port -c \"CREATE ROLE $role WITH LOGIN SUPERUSER PASSWORD 'root';\""
}
start_cluster main 5432 dev
start_cluster test 5433 test
echo "postgres: dev on :5432, test on :5433"

if [ ! -f .env ]; then
  cp .env.template .env
  sed -i \
    -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -base64 32)|" \
    -e "s|^FILE_STORAGE_DIR=.*|FILE_STORAGE_DIR=$LOG_DIR/storage|" \
    -e "s|^JUNO_API_KEY=.*|JUNO_API_KEY=local-stub-key|" \
    -e "s|^E2E_TENANT_DOMAIN=.*|E2E_TENANT_DOMAIN=lvh.me|" \
    -e "s|^ALLOWED_DEV_ORIGINS=.*|ALLOWED_DEV_ORIGINS=*.lvh.me|" \
    .env
  echo "wrote .env"
fi

pnpm install --frozen-lockfile >"$LOG_DIR/install.log" 2>&1

# The database that migrate and seed use (DB_URL from .env, <branch> resolved).
DB=$(pnpm exec tsx -e 'import "dotenv/config"; import { getDbUrl } from "./lib/env"; process.stdout.write(getDbUrl())')
if [ "${RESET_DB:-}" = 1 ]; then
  case "$DB" in
  postgres*://*@localhost:*/* | postgres*://*@127.0.0.1:*/*) ;;
  *)
    echo "RESET_DB=1 refused: DB_URL in .env is not a local database" >&2
    exit 1
    ;;
  esac
  PGOPTIONS=--client-min-messages=warning psql "$DB" -q \
    -c "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
fi
pnpm run db:migrate >"$LOG_DIR/migrate.log" 2>&1
# Notifications are the seed's last step, so none means the seed never ran or
# stopped partway. Re-running is safe: earlier steps skip rows that exist.
if [ "$(psql "$DB" -tAc 'SELECT count(*) FROM notifications')" = 0 ]; then
  pnpm run db:seed >"$LOG_DIR/seed.log" 2>&1
  echo "seeded dev database"
fi

if ! lsof -ti:8888 -sTCP:LISTEN >/dev/null; then
  nohup node "$SKILL_DIR/juno-stub.mjs" "$LOG_DIR/juno-requests.log" >"$LOG_DIR/juno-stub.log" 2>&1 &
fi
if ! lsof -ti:3000 -sTCP:LISTEN >/dev/null; then
  nohup pnpm exec next dev >"$LOG_DIR/dev.log" 2>&1 &
fi
# The first request compiles the route (~30s with Turbopack).
timeout 180 bash -c 'until curl -sf -o /dev/null http://localhost:3000/login; do sleep 2; done'
echo "ready: http://localhost:3000 (logs in $LOG_DIR)"
