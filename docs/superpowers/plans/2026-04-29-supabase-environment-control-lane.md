# Supabase environment control lane

Fecha: 2026-04-29
Repo: `arga-governance-map`
Supabase target: `governance_OS` (`hzqwefkwsxopwrmtksbg`, eu-central-1)

## Proposito

Este carril recupera el control operativo del estado del entorno Supabase durante la sanitizacion. No sustituye al inventario de paridad; lo convierte en una rutina de decision para que AIMS-GRC y Secretaria puedan seguir avanzando sin mover schema por accidente.

## Artefactos rectores

| Artefacto | Rol |
|---|---|
| `docs/superpowers/plans/2026-04-27-sanitization-master-plan.md` | Politica general de sanitizacion y cierre por carril. |
| `docs/superpowers/plans/2026-04-29-supabase-parity-inventory.md` | Snapshot de drift Cloud/local/types, advisors y decisiones. |
| `docs/superpowers/plans/2026-04-29-migration-corridors-briefing.md` | Paquetes operativos para volver a migrar de forma controlada. |
| `docs/superpowers/plans/2026-04-29-lane-smoke-verification.md` | Smoke focalizado de AIMS-GRC y Secretaria contra Cloud actual. |
| `docs/superpowers/plans/2026-04-30-p0-controlled-thaw-diagnostic.md` | Diagnostico P0: postura `no_schema`, smokes aislados verdes y sin migracion inmediata. |
| `docs/superpowers/contracts/2026-04-27-aims-grc-data-contract.md` | Contrato vivo del carril AIMS-GRC. |
| `docs/superpowers/contracts/2026-04-27-secretaria-data-contract.md` | Contrato vivo del carril Secretaria. |
| `docs/superpowers/contracts/2026-04-27-cross-module-data-contract.md` | Contrato de integracion y ownership compartido. |

## Estado actual

| Control | Estado | Lectura operativa |
|---|---|---|
| Target Supabase | Verde | `bun run db:check-target` confirmado contra `governance_OS`. |
| Diagnostico P0 thaw | Verde | `2026-04-30-p0-controlled-thaw-diagnostic`: postura `no_schema`; no hay migracion ni backfill obligatorio. |
| Drift historico | Amarillo controlado | Hay `materialized_drift`; no se re-aplica ni se corrige con `db push`. |
| Gate sanitizacion | Verde | `20260427000100` y `20260427000101` estan aplicadas y registradas en Cloud. |
| Tipos generados | Verde con thaw controlado | Incluyen objetos criticos; se regeneran solo despues de aplicar una migracion aprobada. |
| Secretaria | Verde con riesgo bajo/medio | Puede avanzar con UI, docs y tests contra tablas/RPC confirmadas. |
| AIMS-GRC | Verde con riesgo medio | Puede avanzar si declara fuente legacy/backbone por pantalla. |
| Evidence/legal hold | Rojo/HOLD | `000049_grc_evidence_legal_hold` no se mueve. |
| Storage documental | Amarillo | `matter-documents` usable para demo; no evidencia final sin hash/bundle/audit/retention. |
| Advisors Supabase | Amarillo backlog | Auth leaked password protection fuera de SQL; performance solo tras medicion. |

## Reglas de operacion

1. No ejecutar `supabase db push`.
2. No aplicar migraciones ni cambios RLS/RPC/storage desde carriles funcionales sin paquete aprobado.
3. No regenerar `supabase/functions/_types/database.ts` durante el freeze operativo.
4. No mover `000049_grc_evidence_legal_hold` sin contrato evidence/legal hold aprobado.
5. No tratar `materialized_drift` como pendiente de re-aplicacion.
6. No borrar objetos obsoletos sin inventario especifico.
7. Cualquier pantalla AIMS-GRC debe declarar si usa `ai_*`, `aims_*`, GRC legacy, `grc_*` o puente read-only.
8. Cualquier flujo Secretaria que archive o emita documentos debe declarar si produce evidencia demo, bundle stub o evidencia final.
9. Los smokes locales deben usar `PLAYWRIGHT_PORT` para aislar Vite y evitar reutilizar servidores ajenos en `5173`.

## Protocolo por tarea

Antes de tocar codigo funcional con dependencia Supabase:

```md
Baseline:
- Supabase target: governance_OS (hzqwefkwsxopwrmtksbg)
- Workstream:
- Scope:
- Schema touch: no | proposed | approved
- Types touch: no | after approved migration
- Storage/RPC/RLS touch: no | proposed | approved
- Freeze dependency:
```

Durante la tarea:

- Si el fallo es de UI, datos demo o contrato local, corregir en UI/docs/tests.
- Si aparece `relation/column/function does not exist`, `permission denied` o fallo RLS real, parar y preparar una migracion o policy aislada para aprobacion explicita.
- Si una pantalla dispara mutaciones al montar, sacarla del smoke principal o documentar el efecto demo.
- Si se consume `governance_module_events/links`, documentar si es lectura o escritura y el owner del estado.
- Si una ruta cae en `/login` durante smoke, restaurar sesion demo y repetir antes de clasificarlo como bloqueo Supabase.

Al cerrar:

```md
Data contract:
- Tables used:
- Source of truth:
- Migration required:
- Types affected:
- RLS/RPC/storage affected:
- Cross-module contracts:
- Parity risk:

Verification:
- db:check-target:
- Typecheck:
- Lint/tests/build:
- Smoke focalizado:
```

## Decision tree

| Sintoma | Decision |
|---|---|
| Pantalla renderiza pero faltan filas demo | Seed/backfill data-only solo con aprobacion del owner; no schema. |
| Error UI/runtime sin fallo SQL | Fix UI local y test focalizado. |
| Falta columna/tabla/RPC confirmada por Cloud | Preparar migracion no destructiva separada; pedir aprobacion. |
| RLS bloquea una mutacion demo | Revisar si la mutacion pertenece al carril; policy aislada solo con aprobacion. |
| Advisor performance sin lentitud real | Backlog; no crear indices masivos. |
| Necesidad de evidencia legal hold | Mantener HOLD; abrir contrato `000049` antes de codigo. |

## Modo thaw controlado para migraciones

Marco vigente desde 2026-05-01: freeze global fuera; thaw controlado por paquete
dentro. El producto y la UX pueden avanzar normalmente sin schema. Supabase puede
avanzar, pero solo por carriles y con paquete explicito.

El freeze funcional puede levantarse por paquete, no de forma global.

| Postura | Significado | Puede avanzar |
|---|---|---|
| `no_schema` | UI/docs/tests/hooks contra objetos confirmados | Si |
| `data_only_backfill` | Inserts/updates idempotentes para datos demo o trazabilidad | Solo con paquete y probes |
| `approved_gap` | Gap Cloud probado que requiere schema/RLS/RPC/storage | Solo con aprobacion explicita |
| `hold_until_contract` | Falta contrato legal/tecnico completo | No |
| `ops_backlog` | Advisor o mejora operativa sin bloqueo funcional | No salvo prioridad aprobada |

Toda migracion nueva debe enlazar el paquete correspondiente de `2026-04-29-migration-corridors-briefing.md`.

### Carriles permitidos

| Carril | Uso permitido |
|---|---|
| `ux_no_schema` | UI, hooks, copy, navegacion, e2e, smoke, estados vacios, responsive. Cada pantalla declara tablas consumidas. |
| `data_only_backfill` | Backfills idempotentes si falta dato demo y el schema ya existe. Requiere probes antes/despues. |
| `approved_gap` | Tabla/columna/RPC/RLS/storage faltante demostrado en Cloud y necesario para desbloquear UI/test. Requiere aprobacion explicita. |
| `hold_until_contract` | Bloqueado hasta contrato completo. Incluye evidence/legal hold y `000049`. |
| `ops_backlog` | Advisors/performance/auth hardening. Solo si hay riesgo real o prioridad explicita. |

### Prohibiciones reforzadas

- No `supabase db push`.
- No reaplicar drift historico.
- No regenerar tipos antes de aplicar una migracion aprobada.
- No mezclar AIMS/GRC/Secretaria/evidence/advisors en una sola migracion.
- No mover `000049_grc_evidence_legal_hold`.
- No crear schema por si acaso.

### Formato minimo de paquete Supabase

```md
Migration packet:
- Type:
- Owner lane:
- Tables/RPC/RLS/storage affected:
- Probe before:
- SQL/change proposed:
- Idempotency:
- Rollback concept:
- Probe after:
- UI/test unblocked:
```

### Orden recomendado de trabajo

1. UX completion no-schema: rutas principales Secretaria, AIMS/GRC y consola;
   incoherencias visuales, estados vacios, navegacion, copy, mobile y e2e
   focalizados.
2. Smoke por carril: Secretaria golden path, AIMS/GRC smoke y clasificacion de
   fallos como UI, dato demo, RLS/RPC o schema.
3. Paquete 0 si falta dato: solo backfills idempotentes, sin schema.
4. Paquete 1/2 si hay bloqueo real: cross-module links/events probes o RPC
   opcional de atomicidad Acuerdo 360 si se demuestra necesidad.
5. Evidence/legal hold queda fuera: no levantar `000049` hasta contrato completo
   de evidence finality.

## Proximos pasos permitidos

1. Seguir AIMS-GRC con UI/docs/tests usando objetos confirmados y postura legacy/backbone explicita.
2. Seguir Secretaria con golden paths y smoke focalizado sin schema.
3. Corregir fallos UI o datos demo detectados por smoke sin ampliar modelo.
4. Activar leaked password protection desde Supabase Dashboard fuera de migraciones SQL.
5. Medir rutas calientes antes de tocar indices o policies de performance.

## Proximos pasos bloqueados

| Paso | Motivo |
|---|---|
| Aplicar `000049_grc_evidence_legal_hold` | Falta contrato evidence/legal hold completo. |
| Crear nuevas tablas/columnas AIMS-GRC | El carril avanza solo contra objetos confirmados. |
| Regenerar tipos antes de aplicar una migracion | Solo despues de migracion aprobada y aplicada. |
| Consolidar RLS por advisor | Sensible; requiere aprobacion y prueba de necesidad. |
| Reconciliar drift con `db push` | Prohibido por sanitizacion. |
