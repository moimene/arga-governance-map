#!/usr/bin/env bash
# MOI-142 — validación EJECUTABLE de la migración 20260926114200 (revisión P1).
#
# El test src/test/schema/secretaria-convocation-junta-emit-rpc.test.ts es un
# contrato ESTÁTICO: comprueba con toContain() que ciertos literales siguen
# presentes en el .sql. Eso no ejecuta ni una línea de SQL, así que no valida
# sintaxis, no valida que el CASE/ELSIF compile, no valida que las columnas
# referenciadas existan y no valida que las CHECK constraints se instalen sin
# error (hallazgo P1 de la revisión). Este script cierra esa brecha aplicando
# la migración de verdad contra un Postgres desechable:
#
#   1. Vuelca SOLO el esquema (pg_dump --schema-only, ninguna fila, ninguna
#      escritura) del proyecto Cloud governance_OS vía el pooler — es una
#      lectura, equivalente a un SELECT sobre el catálogo.
#   2. Levanta un contenedor Postgres 17 LOCAL Y DESECHABLE (nunca toca
#      governance_OS) y carga ese volcado, con un puñado de stubs mínimos
#      (roles anon/authenticated/service_role, auth.uid()/role()/jwt(),
#      extensions.gen_random_uuid()/digest()) para los objetos que sólo
#      existen por la plataforma Supabase y no están en un dump de esquema.
#   3. Aplica la migración real contra ese esquema real con
#      ON_ERROR_STOP=1: si el CASE/ELSIF no compila, si una columna no existe
#      o si una CHECK no se puede instalar, este paso falla de verdad.
#   4. Comprueba con SELECT que la función y el CHECK quedaron instalados
#      (control positivo) y destruye el contenedor.
#
# Requiere: docker, psql, pg_dump (misma mayor versión que el proyecto Cloud
# o superior) y red de salida al pooler de Supabase. No requiere ni toca
# supabase/.temp de ningún worktree salvo para leer pooler-url.
#
# Uso: bash supabase/migrations/proposed/20260926114200_secretaria_convocation_junta_emit_rpc.verify-live.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

MIGRATION="supabase/migrations/20260926114200_secretaria_convocation_junta_emit_rpc.sql"
CONTAINER="moi142-verify-live-$$"
WORKDIR="$(mktemp -d)"
PGPORT=55433

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

if [[ ! -f .env ]]; then
  echo "FAIL: falta .env en la raíz del worktree (DATABASE_PASSWORD)." >&2
  exit 1
fi
if [[ ! -f supabase/.temp/pooler-url ]]; then
  echo "FAIL: falta supabase/.temp/pooler-url (copiar del worktree canónico)." >&2
  exit 1
fi

DB_PASSWORD="$(grep '^DATABASE_PASSWORD=' .env | cut -d= -f2-)"
POOLER_URL="$(cat supabase/.temp/pooler-url)"
POOLER_HOST="$(printf '%s' "$POOLER_URL" | sed -E 's#^postgresql://[^@]+@([^:/]+).*#\1#')"
POOLER_USER="$(printf '%s' "$POOLER_URL" | sed -E 's#^postgresql://([^:@]+).*#\1#')"

echo "1/5 — volcando solo esquema (lectura) de governance_OS vía el pooler…"
PGPASSWORD="$DB_PASSWORD" PGSSLMODE=require pg_dump \
  -h "$POOLER_HOST" -p 5432 -U "$POOLER_USER" -d postgres \
  --schema-only --no-owner --no-privileges \
  --schema=public --schema=secretaria_private --schema=extensions --schema=sii \
  -f "$WORKDIR/schema_only.sql"

echo "2/5 — levantando Postgres 17 desechable local (contenedor $CONTAINER)…"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=verifypw -p "$PGPORT:5432" postgres:17 >/dev/null
# postgres:17 reinicia una vez tras el init inicial (carga de locale/config);
# pg_isready puede dar OK durante esa ventana justo antes del reinicio, así
# que el criterio real es una conexión psql que responda dos veces seguidas.
ready=0
for _ in $(seq 1 60); do
  if PGPASSWORD=verifypw psql -h localhost -p "$PGPORT" -U postgres -d postgres -tA -c "select 1;" >/dev/null 2>&1 \
    && sleep 1 \
    && PGPASSWORD=verifypw psql -h localhost -p "$PGPORT" -U postgres -d postgres -tA -c "select 1;" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != "1" ]]; then
  echo "FAIL: el Postgres desechable no respondió a tiempo." >&2
  exit 1
fi

cat > "$WORKDIR/prelude.sql" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE OR REPLACE FUNCTION extensions.gen_random_uuid() RETURNS uuid
LANGUAGE sql AS $$ SELECT public.gen_random_uuid(); $$;
CREATE OR REPLACE FUNCTION extensions.digest(bytea, text) RETURNS bytea
LANGUAGE sql AS $$ SELECT public.digest($1, $2); $$;
SQL

echo "3/5 — instalando stubs de plataforma (roles, auth.*, extensions.*)…"
PGPASSWORD=verifypw psql -h localhost -p "$PGPORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -q -f "$WORKDIR/prelude.sql"

echo "4/5 — cargando el esquema real de governance_OS (silenciando ruido de orden de carga; sin datos)…"
PGPASSWORD=verifypw psql -h localhost -p "$PGPORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=0 -q -f "$WORKDIR/schema_only.sql" > "$WORKDIR/schema_load.log" 2>&1 || true
# Segunda pasada: algunas tablas referencian extensions.gen_random_uuid() antes
# de que exista el stub anterior en la primera pasada de golpe; reintentar es
# idempotente (ON_ERROR_STOP=0 tolera los "already exists" del primer barrido).
PGPASSWORD=verifypw psql -h localhost -p "$PGPORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=0 -q -f "$WORKDIR/schema_only.sql" > "$WORKDIR/schema_load2.log" 2>&1 || true

REAL_ERRORS="$(grep 'ERROR:' "$WORKDIR/schema_load2.log" | sed -E 's/^psql:[^:]+:[0-9]+: //' | grep -v 'already exists' | grep -v 'multiple primary keys' | sort -u || true)"
if [[ -n "$REAL_ERRORS" ]]; then
  echo "FAIL: el volcado de esquema no cargó limpio en el Postgres desechable:" >&2
  echo "$REAL_ERRORS" >&2
  exit 1
fi

echo "5/5 — aplicando la migración real contra el esquema real…"
PGPASSWORD=verifypw psql -h localhost -p "$PGPORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f "$MIGRATION"

echo "--- control positivo ---"
FN_EXISTS="$(PGPASSWORD=verifypw psql -h localhost -p "$PGPORT" -U postgres -d postgres -tA \
  -c "select count(*) from pg_proc where proname='fn_emit_convocatoria_junta';")"
CHECK_DEF="$(PGPASSWORD=verifypw psql -h localhost -p "$PGPORT" -U postgres -d postgres -tA \
  -c "select pg_get_constraintdef(oid) from pg_constraint where conname='convocatorias_authority_route_check';")"

if [[ "$FN_EXISTS" != "1" ]]; then
  echo "FAIL: fn_emit_convocatoria_junta no quedó instalada." >&2
  exit 1
fi
if [[ "$CHECK_DEF" != *"PRESIDENTE_ART_166_JUNTA"* ]]; then
  echo "FAIL: el CHECK de convocatorias no incluye la ruta de Junta." >&2
  exit 1
fi

echo "PASS: la migración compila y se aplica contra el esquema real de governance_OS."
echo "      (contenedor local desechable, nada persiste en Cloud; se destruye al salir)."
