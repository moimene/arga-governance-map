# 2026-05-02 - AIMS/GRC reactivation log

## Decision

Reactivar funcionalidad real donde ya existe tabla/hook owner, manteniendo el
cierre `no_schema`.

No se reabre el carril de migraciones, no se adopta `aims_*` ni `grc_*` de forma
silenciosa y no se escriben contratos compartidos cross-module.

## Estado actual

| Carril | Estado | Mutacion permitida ahora | Bloqueado |
|---|---|---|---|
| Secretaria | Prototipo avanzado maduro | Flujos societarios owner ya conectados | Absorber AIMS/GRC |
| AIMS | Reactivado desde P0 read-only a owner-write controlado | Alta de sistemas IA en `ai_systems`; alta de incidentes IA en `ai_incidents` | `aims_*`, evaluaciones hasta RLS, riesgos/controles GRC, actos Secretaria |
| GRC | Conectado en pantallas core | Incidentes GRC en `incidents`; riesgos en `risks`; vista Penal/Anticorrupcion | TPRM como producto conectado sin ruta+datos |
| TGMS Console | Composicion/readiness | Ninguna mutacion owner nueva | Supermodelo o writes cross-module |

## Cambio implementado

### AIMS - alta de sistemas IA

- Ruta: `/ai-governance/sistemas/nuevo`.
- Owner: AIMS 360.
- Hook: `useCreateAiSystem`.
- Tabla: `ai_systems`.
- Postura: `legacy_write`.
- Source of truth: `ai_systems`.
- Mutacion: owner-write AIMS.
- Handoffs: ninguno; la alta no crea riesgos, controles, incidentes GRC ni actos Secretaria.
- Backbone: `aims_*` sigue candidato futuro y no se usa en esta pantalla.

La lista `/ai-governance/sistemas` incorpora CTA a la ruta owner-write. El
dashboard AIMS mantiene el mapa pantalla por pantalla y ahora declara la ruta de
alta como write controlado.

### AIMS - alta de incidentes IA

- Ruta: `/ai-governance/incidentes/nuevo`.
- Owner: AIMS 360.
- Hook: `useCreateAiIncident`.
- Tabla: `ai_incidents`.
- Postura: `legacy_write`.
- Source of truth: `ai_incidents`.
- Mutacion: owner-write AIMS.
- Handoffs: post-alta, si el incidente es material, solo rutas read-only hacia GRC/Secretaria.
- Probe: `WRITE_POLICY_REACHED_FK_SAFE` usando `system_id` inexistente; no se escribieron datos.

### AIMS - evaluaciones bloqueadas por RLS

- Ruta propuesta: `/ai-governance/evaluaciones/nuevo`.
- Tabla: `ai_risk_assessments`.
- Probe: `42501 new row violates row-level security policy for table "ai_risk_assessments"`.
- Decision: no activar formulario hasta paquete de RLS aprobado.
- Necesidad exacta: policy INSERT para usuario autenticado, tenant-scoped mediante `ai_systems.tenant_id` del `system_id` insertado.

### GRC - alta/edicion de riesgos

- Rutas: `/grc/risk-360/nuevo`, `/grc/risk-360/:id/editar`.
- Owner: GRC Compass.
- Hooks: `useCreateRisk`, `useRiskById`, `useUpdateRisk`.
- Tabla: `risks`.
- Postura: `legacy_write`.
- Source of truth: `risks`.
- Mutacion: owner-write GRC.
- Probe: `WRITE_POLICY_REACHED_FK_SAFE` usando `obligation_id` inexistente; no se escribieron datos.
- Gotcha schema: `inherent_score` y `residual_score` no son insertables desde UI; se dejan al schema/read model.

### GRC - Penal / Anticorrupcion

- Ruta: `/grc/penal-anticorrupcion`.
- Owner: GRC Compass.
- Hooks: `useRisks`, `useObligationsList`, `useAllControlsByObligationIds`.
- Tablas: `risks`, `obligations`, `controls`.
- Postura: `legacy_read` para vista; los writes pasan por `risks` en Risk 360.
- Taxonomia inicial: `module_id=penal` y term matching sobre titulo/descripcion/source.
- Probe: `risks.module_id='penal'` aceptado hasta FK segura; no requiere columna nueva.
- TPRM: sigue backlog no conectado.

## Supabase coherence

Antes de cualquier trabajo Supabase se ejecuto `bun run db:check-target`. El
primer intento fallo porque el CLI local no estaba enlazado, aunque la app y el
wrapper MCP apuntaban al proyecto correcto.

Accion local:

```bash
supabase link --project-ref hzqwefkwsxopwrmtksbg
bun run db:check-target
```

Resultado: target verde contra `governance_OS`. Esto no aplica migraciones ni
escribe datos; solo corrige metadatos locales de CLI. `supabase/.temp/` queda
ignorado por Git.

## GRC reactivation stance

- `/grc/incidentes/nuevo` ya es owner-write real sobre `incidents`.
- `/grc/risk-360` permanece read-only para matriz/lista y delega writes a rutas owner.
- Penal/anticorrupcion ya no esta congelado: arranca como vista conectada sin tabla dedicada.
- TPRM sigue congelado porque no existe todavia una pantalla conectada y validada con datos/source posture.

## Documentacion y memoria

- `CLAUDE.md`: sincronizado con la nueva postura AIMS owner-write.
- Contrato AIMS/GRC: `docs/superpowers/contracts/2026-04-27-aims-grc-data-contract.md`.
- Roadmap carriles paralelos: `docs/superpowers/plans/2026-05-01-aims-grc-parallel-lanes.md`.
- Log actual: `docs/superpowers/plans/2026-05-02-aims-grc-reactivation-log.md`.
- Memory key prevista: `patterns/aims_grc_reactivation_forms_penal_no_schema_2026_05_02`.

## Guardrails mantenidos

- No migrations.
- No `db push`.
- No Supabase typegen.
- No RLS/RPC/storage/policy changes.
- No writes to `governance_module_events` or `governance_module_links`.
- `000049_grc_evidence_legal_hold` remains HOLD.
- No silent `ai_*` + `aims_*` mixing.

## Verification target

```bash
bun run db:check-target
bun test src/lib/aims/** src/lib/grc/**
bunx tsc --noEmit --pretty false
bun run lint
bun run build
PLAYWRIGHT_PORT=5192 bunx playwright test e2e/10-grc.spec.ts e2e/16-sanitization-smoke.spec.ts --project=chromium --reporter=list
```

Resultados ejecutados:

| Check | Resultado |
|---|---|
| `bun run db:check-target` | Pass contra `governance_OS` |
| `bun test src/lib/aims/** src/lib/grc/**` | Pass, 14/14 |
| `bun test` | Pass, 582 pass / 66 skipped |
| `bunx tsc --noEmit --pretty false` | Pass |
| `bun run lint` | Pass, 0 errores / 23 warnings conocidos |
| `bun run build` | Pass |
| `e2e/10-grc.spec.ts` + `e2e/16-sanitization-smoke.spec.ts` | Pass, 16/16 |
| `git diff --check` | Pass |

## Data contract

- Tables used: `ai_systems`, `ai_incidents`, existing AIMS read tables `ai_risk_assessments`, `ai_compliance_checks`; GRC `risks`, `incidents`, `obligations`, `controls`.
- Source of truth: `ai_systems` for AIMS system inventory; `ai_incidents` for AIMS incidents; `risks` for GRC risks.
- Migration required: no for implemented surfaces; yes policy packet for AIMS assessment writes.
- Types affected: no regeneration; local TS only.
- Cross-module contracts: route-only handoffs unchanged.
- Parity risk: medium for eventual `ai_* -> aims_*`; low for this UI increment.

## Memory

- Stored: `patterns/aims_grc_reactivation_forms_penal_no_schema_2026_05_02`.
- No secrets stored: yes.
