#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -z "${NODE_BIN:-}" ]]; then
  if [[ -x "/usr/local/bin/node" ]]; then
    NODE_BIN="/usr/local/bin"
  else
    NODE_BIN="/Users/moisesmenendez/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
  fi
fi
export PATH="${NODE_BIN}:${HOME}/.bun/bin:${PATH}"

cd "$ROOT_DIR"

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

if ! command -v supabase >/dev/null 2>&1; then
  {
    printf '%s\n' '#!/usr/bin/env bash'
    printf '%s\n' 'exec bunx supabase@2.98.1 "$@"'
  } > "$tmpdir/supabase"
  chmod +x "$tmpdir/supabase"
  export PATH="$tmpdir:$PATH"
fi

echo "== Secretaria P0 preflight =="
echo "Repository: $ROOT_DIR"
echo

echo "== Supabase target =="
bun run db:check-target
echo

echo "== Secretaria Cloud transactional smoke =="
bun scripts/secretaria-p0-cloud-smoke.ts \
  --transactional \
  --require-transactional \
  --tenant-isolation \
  --require-tenant-isolation \
  --auth-user-isolation \
  --require-auth-user-isolation
echo

echo "== TypeScript =="
bunx tsc --noEmit --pretty false
echo

echo "== P0 RPC contract tests =="
bunx --bun vitest run \
  src/test/schema/secretaria-p0-rpc-hardening.test.ts \
  src/test/schema/secretaria-p0-pgcrypto-search-path.test.ts \
  src/test/schema/secretaria-p0-capital-movement-audit.test.ts \
  src/test/schema/secretaria-p0-http-service-role.test.ts \
  src/test/schema/secretaria-p0-tenant-isolation-smoke.test.ts \
  src/test/schema/secretaria-p0-destructive-fixture-guard.test.ts \
  src/test/schema/secretaria-p0-transactional-rpcs.test.ts \
  src/lib/secretaria/__tests__/supabase-rpc-fallback.test.ts \
  src/lib/secretaria/__tests__/no-session-idempotency-contract.test.ts \
  src/lib/secretaria/__tests__/certification-agreement-source-contract.test.ts \
  src/lib/secretaria/__tests__/capital-transmission-contract.test.ts \
  --reporter=verbose
echo

echo "== Lint =="
bun run lint
echo

echo "== Build =="
bun run build
echo

echo "== Secretaria critical E2E =="
PLAYWRIGHT_PORT="${PLAYWRIGHT_PORT:-5201}" \
  bunx playwright test \
  e2e/30-secretaria-functional-watchdog.spec.ts \
  e2e/21-secretaria-responsive.spec.ts \
  --project=chromium \
  --workers=1 \
  --reporter=list
echo

if [[ "${SECRETARIA_P0_FULL_E2E:-0}" == "1" ]]; then
  echo "== Secretaria full E2E =="
  PLAYWRIGHT_PORT="${PLAYWRIGHT_PORT:-5201}" \
    bunx playwright test \
    e2e/*secretaria*.spec.ts \
    --project=chromium \
    --workers=1 \
    --reporter=list
  echo
fi

echo "Secretaria P0 preflight passed."
