# F4.G17 — Staging Supabase Provisioning Runbook

**Fecha:** 2026-05-16
**Plan:** docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §6
**Owner decision (2026-05-16):** autorizado a provisionar.

> Este documento describe los pasos para crear el proyecto Supabase staging que aísla los E2E destructivos del proyecto demo `governance_OS`. La creación del proyecto requiere ejecutar comandos en el dashboard de Supabase (no es scriptable sin un PAT con privilegio elevado), por lo que aquí se documentan los pasos a seguir manualmente y los secrets GitHub que deben configurarse al finalizar.

## §1 Decisión owner

- **Path elegido:** crear un proyecto Supabase nuevo `governance_OS_staging` separado del demo `governance_OS`.
- **Región:** `eu-central-1` (misma que demo para latencia comparable).
- **Tier:** Free (alcanza para E2E semanales; sube a Pro si se observa throttling).
- **Schema:** clonar baseline desde `governance_OS` aplicando las mismas migraciones de este repo (`supabase/migrations/*`).
- **Datos:** sintéticos. NO copiar datos demo reales (PII evitable).

## §2 Pasos de provisionamiento

### 2.1 Crear el proyecto

1. Login en `https://supabase.com/dashboard` con la cuenta organizacional.
2. New project → name `governance-os-staging` → región `eu-central-1` → tier Free.
3. Anotar:
   - **Project ref** (e.g. `abcdefgh1234567`).
   - **Project URL** (`https://<ref>.supabase.co`).
   - **anon key** (público, safe en client).
   - **service_role key** (secreto, no commitear).

### 2.2 Aplicar migraciones del repo

```bash
# En una shell con SUPABASE_ACCESS_TOKEN exportado:
supabase link --project-ref <staging-ref>
# (opcional) cuando haya múltiples linked projects, usar --workdir o
# variables locales para no contaminar el link de governance_OS.
supabase db push --linked
```

Verificar:

```bash
supabase migration list --linked
# Esperado: 0 local-only, 0 remote-only, lista de migraciones consistente.
```

### 2.3 Sembrar datos sintéticos

Crear seed específico de staging que NO use el nombre real del cliente y use UUIDs aleatorios (NO el demo `00000000-0000-0000-0000-000000000001`):

```bash
SUPABASE_URL="https://<staging-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<staging-service-role>" \
bun run scripts/seed-staging-synthetic.ts   # TODO: crear este script
```

El seed debe:
- Crear un tenant sintético con UUID v4 aleatorio.
- Crear un user `staging-e2e@example.invalid` en `auth.users`.
- Insertar `user_profiles` row con el tenant sintético.
- Insertar mínimo: 1 entidad, 1 órgano, 1 reunión, 1 acuerdo, 1 evidence_bundle.

### 2.4 Configurar secrets en GitHub Actions

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret name | Value |
|---|---|
| `SUPABASE_STAGING_REF` | el project ref de §2.1 (e.g. `abcdefgh1234567`) |
| `SUPABASE_STAGING_URL` | `https://<staging-ref>.supabase.co` |
| `SUPABASE_STAGING_ANON_KEY` | anon key de §2.1 |

Una vez configurados, el workflow `.github/workflows/e2e-destructive.yml`:
- Detecta `SUPABASE_STAGING_REF` no vacío → ejecuta el job.
- Verifica que el ref **no** sea `hzqwefkwsxopwrmtksbg` (demo) y aborta si lo es.
- Corre `e2e/43-*` y `e2e/45-*` con `SECRETARIA_E2E_DESTRUCTIVE=1`.

### 2.5 Validación post-provisioning

```bash
# 1) Healthcheck básico:
curl -s "https://<staging-ref>.supabase.co/rest/v1/" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>"
# Esperado: HTTP 200 con OpenAPI doc.

# 2) Smoke test schema mismatch:
SUPABASE_URL=... SUPABASE_ANON_KEY=... bun run scripts/check-supabase-target.sh
# Esperado: marca staging, NO governance_OS.

# 3) Workflow E2E semanal — manual trigger:
gh workflow run e2e-destructive.yml
# Verificar en GitHub Actions que pasa y NO toca governance_OS.
```

## §3 Mantenimiento

- **Sincronización schema**: cada vez que se aplican migraciones a `governance_OS` (demo), también se aplican a staging. CI workflow recomendado: `supabase db push --linked` contra ambos proyectos en `release/*` branches.
- **Reset periódico**: tras 4 semanas, el dataset sintético acumula ruido de E2E. Reset trimestral con script `seed-staging-synthetic.ts` desde zero.
- **Costes**: Free tier soporta hasta 500MB DB + 1GB storage + 2GB egress. Si se rebasa, upgrade a Pro (~$25/mes) según la decisión owner.

## §4 Rollback

Si el staging causa más fricción que valor:

1. Revoke los 3 secrets de GitHub (`SUPABASE_STAGING_*`).
2. Pause/delete el proyecto Supabase desde el dashboard.
3. El workflow `e2e-destructive.yml` detecta `SUPABASE_STAGING_REF` vacío → emite warning `staging-not-configured` y termina sin ejecutar tests.

## §5 Pendiente — handoff humano

Este documento es la fase 1 de G17: documentar el procedimiento. La fase 2 (ejecutar §2.1–§2.4) requiere acceso al dashboard de Supabase de la organización, que está fuera del alcance del agente. Estado actual:

- ✅ Documento provisioning runbook
- ✅ GitHub workflow `.github/workflows/e2e-destructive.yml` configurado con guards
- ⏳ Crear proyecto en dashboard → owner
- ⏳ Configurar secrets en GitHub → owner
- ⏳ Ejecutar primer workflow manual → owner
- ⏳ Crear `scripts/seed-staging-synthetic.ts` (sprint posterior)

---

*v1 — 2026-05-16. Pendiente de ejecución por owner.*
