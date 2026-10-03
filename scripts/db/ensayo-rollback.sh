#!/usr/bin/env bash
# Ensayo revertido de migraciones/sondas contra governance_OS.
#
# Concatena los ficheros SQL indicados dentro de un único BEGIN … ROLLBACK y
# los ejecuta con psql (ON_ERROR_STOP): si algo falla, psql aborta y la
# transacción se deshace; si todo pasa, se hace ROLLBACK igualmente. NADA
# queda aplicado en Cloud. La contraseña se lee de `.env` (DATABASE_PASSWORD)
# y nunca se imprime.
#
# Uso:
#   scripts/db/ensayo-rollback.sh supabase/migrations/2026X.sql [más.sql …] > salida.txt
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -lt 1 ]]; then
  echo "uso: $0 <fichero.sql> [fichero.sql …]" >&2
  exit 2
fi

bash scripts/check-supabase-target.sh >/dev/null || { echo "db:check-target FALLÓ: no se ensaya" >&2; exit 3; }

set -a
# shellcheck disable=SC1091
source .env
set +a
: "${DATABASE_PASSWORD:?falta DATABASE_PASSWORD en .env}"
PGURL="$(cat supabase/.temp/pooler-url)"

TMP="$(mktemp -t ensayo-rollback.XXXXXX.sql)"
trap 'rm -f "$TMP"' EXIT
{
  echo '\set ON_ERROR_STOP on'
  echo 'BEGIN;'
  for f in "$@"; do
    echo "\\echo === ensayo: $f ==="
    cat "$f"
    echo
  done
  echo 'ROLLBACK;'
  echo '\echo === ROLLBACK ejecutado: nada aplicado ==='
} > "$TMP"

set +e
PGPASSWORD="$DATABASE_PASSWORD" psql "$PGURL" -X -q -v ON_ERROR_STOP=1 -f "$TMP"
rc=$?
set -e
echo "[ensayo-rollback] exit=$rc (0 = todo pasó y se revirtió; otro valor = error, también revertido)"
exit $rc
