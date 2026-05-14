# Secretaria Societaria - cierre de riesgos y deuda

**Fecha:** 2026-05-14
**Repo:** `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`
**Rama:** `main`
**Supabase:** `governance_OS` / `hzqwefkwsxopwrmtksbg`
**Tenant demo:** `00000000-0000-0000-0000-000000000001`
**Entidad canonica ARGA Seguros S.A.:** `6d7ed736-f263-4531-a59d-c6ca0cd41602`

## Resultado

El ciclo cierra la deuda critica que era accionable sin decision externa y formaliza lo que no debe automatizarse. No se han ejecutado cambios destructivos ni consolidaciones semanticas. No se ha usado `supabase db push`.

Documentos de soporte:

- `docs/superpowers/plans/2026-05-14-secretaria-personas-consolidation-decisions.md`
- `docs/superpowers/plans/2026-05-14-supabase-migration-governance.md`
- `docs/superpowers/plans/2026-05-14-secretaria-external-integrations-matrix.md`

## Riesgos cerrados

| Riesgo | Estado | Cierre |
|---|---|---|
| Consolidacion automatica insegura | Cerrado como bloqueo gobernado | Dry-run ejecutado; 0 pares Type A; 1 Type B bloqueado por preflight; fichas documentadas |
| Drift Supabase que podria romper `db push` | Mitigado | `db push` bloqueado; doc de gobernanza creado; nuevas migraciones deben usar timestamp completo |
| `xlsx` cargado en bundle principal de Secretaria | Cerrado | `PersonasImportStepper` usa `await import("xlsx")`; CSV no carga parser Excel |
| Integraciones externas comunicadas como productivas | Mitigado | Matriz real-vs-demo creada; gates productivos definidos |
| Seguridad de consolidacion de personas | Mitigado | `fn_consolidate_person` permanece solo para `service_role`; no se ejecuta sin aprobacion por par |

## Decisiones pendientes

### D1 - Cartera ARGA

El dry-run detecta:

- Canonical propuesto: `b50fad18-ca71-41bb-a940-45d43f4fcdb7`, Cartera ARGA S.L.U., `B-99999902`.
- Duplicate propuesto: `17aa1e03-769b-49ad-9296-d41a8f3cbc51`, Cartera ARGA, `PENDIENTE-*`.
- Bloqueo: ambas personas estan vinculadas a entidades activas distintas:
  - Cartera ARGA S.L.U., `00000000-0000-0000-0000-000000000020`, SLU.
  - Cartera ARGA, S.A., `517522ab-60bf-4c41-9376-09c2948ca056`, SA.

Decision requerida: confirmar si son la misma sociedad o sociedades distintas. Sin esa decision, no se consolida.

### D2 - Drift historico Supabase

Decision requerida: elegir entre reconciliacion historica, baseline nuevo o continuidad gobernada por MCP/apply SQL. Recomendacion actual: continuidad gobernada para piloto y tarea separada de plataforma.

### D3 - Integraciones externas

Decision requerida: activar productivo solo cuando existan credenciales/contratos de EAD Trust, RM, CNMV/IBEX y Sentinel. Hasta entonces, permanecer en modo demo/stub.

## Migraciones aplicadas o evitadas

Aplicadas en Cloud durante este ciclo: **ninguna**.

Evitadas explicitamente:

- `supabase db push`.
- `supabase migration repair`.
- `scripts/consolidate-duplicate-persons.ts --apply`.
- Cualquier escritura sobre WORM, `audit_log`, `no_session_*`, `censo_snapshot` o `capital_movements`.

## Cambios de codigo

- `src/pages/secretaria/PersonasImportStepper.tsx`: carga dinamica de `xlsx` solo para `.xlsx/.xls`.
- `src/test/secretaria/personas-cargos-sprint2-ui-contract.test.ts`: contrato actualizado para exigir `await import("xlsx")` y prohibir import estatico.

## Pruebas ejecutadas

- `bun run db:check-target`: OK, target `governance_OS / hzqwefkwsxopwrmtksbg`.
- `scripts/consolidate-duplicate-persons.ts --dry-run`: OK, 0 Type A, 1 Type B bloqueado por preflight.
- `supabase migration list --linked`: drift confirmado; `db push` queda bloqueado.
- `bunx vitest run src/test/secretaria/personas-cargos-sprint2-ui-contract.test.ts`: 10/10 OK.
- `bun run lint`: OK.
- `bun run typecheck`: OK.
- `bun run test`: 1494 passed, 134 skipped.
- `bun run build`: OK. `xlsx` queda como chunk separado (`xlsx-*.js`, 429.35 kB / gzip 144.37 kB) y `PersonasImportStepper` queda en 10.60 kB / gzip 3.83 kB.
- `bun run e2e -- e2e/44-personas-cargos-flow.spec.ts e2e/45-secretaria-isolated-fixture.spec.ts`: 9 passed, 1 skipped. La fixture destructiva aislada se salto correctamente porque no estaban activadas `SECRETARIA_E2E_DESTRUCTIVE=1` y `SECRETARIA_E2E_ISOLATED_TENANT=1`.

## Runbook operativo

### Antes de tocar Cloud

```bash
bun run db:check-target
supabase migration list --linked
```

Verificar manualmente:

- Proyecto: `governance_OS`.
- Project ID: `hzqwefkwsxopwrmtksbg`.
- No usar `db push` mientras siga el drift.

### Consolidacion de personas

```bash
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_SECRET" SUPABASE_URL="$URL" \
  bun run scripts/consolidate-duplicate-persons.ts --dry-run
```

Solo si existe aprobacion por par:

```bash
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_SECRET" SUPABASE_URL="$URL" \
  bun run scripts/consolidate-duplicate-persons.ts \
  --apply --pair=<canonical_person_id>:<duplicate_person_id>
```

### Integraciones externas

Mantener demo/stub hasta que haya:

- proxy server-side,
- secretos server-side,
- contrato sandbox/productivo,
- auditoria,
- feature flag tenant,
- runbook de errores,
- aprobacion tecnica y legal.

## Riesgos residuales aceptados

- Cartera ARGA requiere decision legal/data-owner.
- Supabase requiere tarea de plataforma para reconciliar historia o crear baseline.
- QTSP/RM/CNMV/Sentinel siguen como demo/stub hasta disponer de dependencias externas.
- Los datos demo con `PENDIENTE-*` no bloquean piloto, pero no deben presentarse como master data final.

## Script recomendado de demo/piloto

1. Entrar con usuario demo.
2. Mostrar Dashboard Secretaria y Acciones Rapidas.
3. Alta/edicion de persona y designacion de cargo con chips RM.
4. Importar CSV pequeno para mostrar dry-run sin cargar Excel.
5. Generar documento desde plantilla activa.
6. Mostrar expediente Acuerdo 360 y timeline.
7. Mostrar certificacion/QTSP como flujo demo con gate de integracion externa pendiente.
8. Cerrar con matriz de riesgos: consolidacion y migraciones gobernadas, integraciones bloqueadas por credenciales.
