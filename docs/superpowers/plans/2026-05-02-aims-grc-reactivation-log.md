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
| AIMS | Reactivado desde P0 read-only a primer owner-write | Alta de sistemas IA en `ai_systems` | `aims_*`, riesgos/controles GRC, actos Secretaria |
| GRC | Conectado en pantallas core | Incidentes GRC en `incidents` | Penal/anticorrupcion/TPRM como producto conectado sin ruta+datos |
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
- `/grc/risk-360` permanece read-only sobre `risks`.
- Penal/anticorrupcion y TPRM no estan paralizados por perdida de trabajo: estan
  congelados porque no existe todavia una pantalla conectada y validada con
  datos/source posture.
- Siguiente paso seguro: definir si penal/anticorrupcion puede vivir como vista
  GRC sobre `risks` + `obligations` + `controls` existentes. Si falta tabla,
  columna, RPC, policy o storage, se debe parar y documentar la necesidad exacta.

## Documentacion y memoria

- `CLAUDE.md`: sincronizado con la nueva postura AIMS owner-write.
- Contrato AIMS/GRC: `docs/superpowers/contracts/2026-04-27-aims-grc-data-contract.md`.
- Roadmap carriles paralelos: `docs/superpowers/plans/2026-05-01-aims-grc-parallel-lanes.md`.
- Log actual: `docs/superpowers/plans/2026-05-02-aims-grc-reactivation-log.md`.
- Memory key prevista: `patterns/aims_grc_reactivation_no_schema_2026_05_02`.

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
bun test src/lib/aims/**
bunx tsc --noEmit --pretty false
bun run lint
bun run build
PLAYWRIGHT_PORT=5192 bunx playwright test e2e/16-sanitization-smoke.spec.ts --project=chromium --reporter=list
```

Resultados ejecutados:

| Check | Resultado |
|---|---|
| `bun run db:check-target` | Pass contra `governance_OS` |
| `bun test src/lib/aims/**` | Pass, 5/5 |
| `bun test` | Pass, 582 pass / 66 skipped |
| `bunx tsc --noEmit --pretty false` | Pass |
| `bun run lint` | Pass, 0 errores / 23 warnings conocidos |
| `bun run build` | Pass |
| `e2e/16-sanitization-smoke.spec.ts` | Pass, 4/4 incluyendo `/ai-governance/sistemas/nuevo` |
| `git diff --check` | Pass |

## Data contract

- Tables used: `ai_systems`, existing AIMS read tables `ai_risk_assessments`, `ai_compliance_checks`, `ai_incidents`; GRC existing `incidents` / `risks` remain as previously declared.
- Source of truth: `ai_systems` for AIMS system inventory.
- Migration required: no.
- Types affected: no regeneration; local TS only.
- Cross-module contracts: route-only handoffs unchanged.
- Parity risk: medium for eventual `ai_* -> aims_*`; low for this UI increment.

## Memory

- Stored: `patterns/aims_grc_reactivation_no_schema_2026_05_02`.
- No secrets stored: yes.
