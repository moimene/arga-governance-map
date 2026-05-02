# Migration corridors briefing - AIMS-GRC, Secretaria, cross-module

Fecha: 2026-04-29
Repo: `arga-governance-map`
Supabase target: `governance_OS` (`hzqwefkwsxopwrmtksbg`, eu-central-1)

## Objetivo

Dar a cada carril informacion suficiente para volver a avanzar con migraciones controladas y cerrar proyectos sin reabrir drift silencioso.

Este documento no aplica schema. Define paquetes de trabajo, contratos y orden de desbloqueo.

## Estado de partida

| Area | Estado | Decision |
|---|---|---|
| Local/remote drift historico | Documentado en `2026-04-29-supabase-parity-inventory.md` | No re-aplicar migraciones materializadas. |
| `20260427_000100` y `20260427_000101` | Aplicadas y registradas en Cloud | Son el gate base vigente. |
| Tipos generados | Incluyen objetos criticos AIMS/GRC/Secretaria | No regenerar hasta aplicar una migracion nueva aprobada. |
| AIMS/GRC | Puede leer `ai_*`, `aims_*`, GRC legacy y `grc_*` con postura declarada | Migraciones solo para gaps probados por pantalla/workflow. |
| Secretaria | Puede seguir con flujos funcionales sobre tablas confirmadas | Migraciones solo si completan evidencia, atomicidad o datos demo necesarios. |
| Cross-module | `governance_module_events/links` existen | Writes solo con contrato, probes y tests. |
| Evidence/legal hold | Parcial | `000049` sigue bloqueada hasta contrato completo. |

## Modo migracion controlada

Una migracion queda habilitada solo si cumple todo:

1. `bun run db:check-target` verde contra `governance_OS`.
2. Cloud leido antes de escribir.
3. Objeto clasificado como `local_pending`, `approved_gap` o `data_only_backfill`.
4. SQL no destructivo y acotado.
5. Rollback conceptual documentado aunque Supabase no tenga rollback automatico.
6. Tests/probes definidos antes de aplicar.
7. Tipos regenerados solo despues de aplicar y verificar.
8. Cierre con `tsc`, tests focalizados, build y smoke del carril.

Prohibido:

- `supabase db push`.
- Re-aplicar `materialized_drift`.
- Mezclar en una misma migracion cambios de AIMS, GRC, Secretaria, evidence/legal hold y advisors.
- Crear schema "por si acaso".
- Resolver advisors de performance en tanda masiva.

## Cola recomendada

| Orden | Paquete | Carril | Tipo | Migration posture | Motivo |
|---:|---|---|---|---|---|
| 0 | Data demo backfills focalizados | Secretaria / AIMS-GRC | Data-only | `data_only_backfill` | Desbloquear pantallas sin tocar schema. |
| 1 | Cross-module event/link write probes | Plataforma | Tests/probes primero | `approved_gap` solo si falla RLS/contract | Validar handoffs reales sin mutar owners. |
| 2 | Secretaria atomicidad Acuerdo 360 | Secretaria | RPC no destructiva opcional | `approved_gap` si el flujo necesita transaccion | Evitar writes cliente parciales entre `agreements` y `meeting_resolutions`. |
| 3 | Secretaria evidence promotion contract | Secretaria + Plataforma | Schema/RPC/storage coordinado | `hold_until_contract` | Convertir evidencia demo en evidencia final productiva. |
| 4 | AIMS/GRC backbone write enablement | AIMS-GRC | RLS/RPC/data contract | `approved_gap` por workflow | Habilitar writes sobre `aims_*`/`grc_*` solo donde Cloud/tipos/RLS esten claros. |
| 5 | Advisors selectivos | Supabase ops | RLS/index/Auth config | `ops_backlog` | Cerrar warnings solo con medicion o riesgo real. |

## Paquete 0 - Data demo backfills focalizados

Owner: carril funcional afectado.

Uso: cuando el smoke o una pantalla demuestren que falta dato demo, pero el schema existe.

Ejemplos permitidos:

- Completar filas demo de `authority_evidence` si falta autoridad vigente para una sociedad/organo.
- Materializar relaciones demo entre `meeting_resolutions.agreement_id` y `agreements.id`.
- Poblar registros backbone `aims_*`/`grc_*` necesarios para una pantalla concreta si Cloud ya tiene tabla y tipos.
- Insertar seeds de `governance_module_events/links` solo si son fixtures demo claramente marcados y el contrato cross-module lo permite.

Template:

```md
Migration packet:
- Proposed file: supabase/migrations/YYYYMMDD_000xxx_<name>.sql
- Type: data-only
- Owner lane:
- Tables written:
- Rows expected:
- Idempotency:
- RLS context:
- Probe before:
- Probe after:
- Rollback concept:
- UI/test unblocked:
```

SQL rules:

- Usar `INSERT ... ON CONFLICT ... DO UPDATE` o `WHERE NOT EXISTS`.
- No borrar datos.
- No cambiar policies.
- No depender de IDs nuevos si hay IDs demo canonicos.

## Paquete 1 - Cross-module event/link write probes

Owner: Plataforma compartida.

Objetivo: permitir handoffs entre GRC, AIMS y Secretaria sin que el shell mute estados owner.

Antes de migrar:

- Probar lectura de `governance_module_events`.
- Probar lectura de `governance_module_links`.
- Probar un insert controlado con rol autenticado solo en entorno demo, o definir que los inserts solo van por service role/Edge Function.

Decision esperada:

| Resultado | Accion |
|---|---|
| Reads OK, writes no necesarios | No migrar. Mantener read-only. |
| Writes fallan por RLS y el flujo los necesita | Migracion policy aislada para events/links. |
| Falta columna para payload/version/status | Migracion schema minima, no mezclar con UI. |
| Se necesita auditoria material | No usar events/links como evidencia; pasar a paquete evidence. |

Contrato de migracion si procede:

```md
Cross-module migration:
- Event types enabled:
- Source modules:
- Target modules:
- Insert actor: authenticated | service_role | Edge Function
- Policies changed:
- Tests:
- Failure mode:
```

Tests minimos:

- Unit contract de payload por evento canonico.
- Probe de insert/read si hay write enablement.
- Smoke UI que confirme que el owner decide el siguiente estado.

## Paquete 2 - Secretaria atomicidad Acuerdo 360

Owner: Secretaria.

Problema que puede justificar migracion: hoy algunas materializaciones pueden requerir dos writes cliente (`agreements` y `meeting_resolutions.agreement_id`). Si el flujo real necesita atomicidad, usar RPC transaccional.

Migration candidate:

- Nueva RPC `fn_materializar_acuerdo_360_desde_resolucion(...)`.
- No requiere nueva tabla si el contrato actual basta.
- Debe ser idempotente por `tenant_id`, `meeting_id`, `agenda_item_index`.
- Debe actualizar/enlazar `meeting_resolutions.agreement_id`.
- Debe devolver `agreement_id`.

No migrar si:

- La UI actual puede tolerar fallo parcial y mostrar reintento.
- No hay fallo RLS o consistencia demostrado.

Contrato:

```md
Secretaria migration:
- Flow: Acta/Reunion -> Acuerdo 360
- Tables written: agreements, meeting_resolutions
- RPC:
- Idempotency key:
- RLS/security mode:
- Audit behavior:
- Tests:
- UI route:
```

Tests minimos:

- RPC existe.
- Idempotencia: segunda llamada devuelve el mismo `agreement_id`.
- Resolucion queda enlazada.
- No crea duplicado por punto.
- Smoke no dispara mutacion al montar.

## Paquete 3 - Secretaria evidence promotion contract

Owner: Secretaria + Plataforma + Legal.

Este es el paquete que puede levantar `000049_grc_evidence_legal_hold`, pero solo cuando el contrato este completo.

No basta con:

- `certifications.evidence_id`.
- `agreements.document_url`.
- `evidence_bundle:<id>@<hash>` sintetico.
- Documento en `matter-documents` sin retention/legal hold.

Contrato minimo antes de SQL:

| Dimension | Decision requerida |
|---|---|
| Owner record | `agreement`, `minute`, `certification`, `grc_*`, `aims_*` o link canonico. |
| Artifact | Storage path o referencia externa verificable. |
| Hash | Algoritmo, columna y momento de calculo. |
| Bundle | Tabla owner, manifest y artifacts. |
| Audit | Enlace a `audit_log` o hash chain. |
| Retention | Policy, plazos y owner. |
| Legal hold | Campo/tabla, efecto sobre purga y RLS. |
| QTSP | QES/QSeal/ERDS/timestamp EAD Trust o stub demo marcado. |
| Promotion | Quien aprueba pasar de demo/operativo a evidencia final. |

Migration candidate:

- Separar en 2 migraciones, no una grande:
  - `evidence_final_readiness_contract`: columnas/enlaces minimos y checks no destructivos.
  - `legal_hold_retention_enforcement`: enforcement legal hold/retention y policies.
- `000049` no se reutiliza si el contenido real cambia; crear timestamp nuevo y dejar 000049 como referencia de plan si no existe archivo local aprobado.

Tests minimos:

- Crear bundle final demo con artifact, hash, audit link y owner.
- Verificar readiness positiva solo cuando todos los gates estan presentes.
- Verificar readiness negativa si falta storage/hash/audit/legal hold.
- Verificar que legal hold bloquea purga en rutas aprobadas.
- Verificar que UI no llama evidencia final a bundles incompletos.

## Paquete 4 - AIMS/GRC backbone write enablement

Owner: AIMS-GRC.

Objetivo: pasar pantallas concretas de `legacy_read`/`bridge_read` a `backbone_write` cuando el proyecto lo necesite.

Antes de migrar, cada pantalla debe declarar:

```md
AIMS-GRC screen contract:
- Screen/hook:
- Current posture:
- Target posture:
- Legacy tables:
- Backbone tables:
- Writes needed:
- RLS status:
- Generated types status:
- Evidence level:
- Migration required:
```

Migration candidates tipicas:

| Caso | Tipo |
|---|---|
| Tabla backbone existe, write falla por RLS | Policy aislada para esa tabla/accion. |
| Tabla backbone existe, falta seed demo | Data-only backfill. |
| UI necesita campo que solo existe en legacy | Adapter/read model primero; schema solo si hay contrato de ownership. |
| Workflow necesita evento hacia Secretaria | Usar paquete cross-module antes de escribir. |
| Evidence/legal hold necesario | Pasar a paquete 3; no resolver dentro de AIMS-GRC. |

Tests minimos:

- Contract test del adapter legacy/backbone.
- Probe CRUD minimo si hay write.
- Smoke ruta AIMS/GRC.
- Test de no escritura fuera de owner.

## Paquete 5 - Advisors selectivos

Owner: Supabase ops.

No bloquean carriles funcionales salvo evidencia de riesgo.

| Advisor | Accion |
|---|---|
| Leaked password protection | Activar en Supabase Dashboard. No SQL. |
| `multiple_permissive_policies` | Migracion RLS solo si se aprueba consolidacion de `jurisdiction_rule_sets`. |
| `unindexed_foreign_keys` | Indices por consulta caliente medida, no tanda masiva. |
| `unused_index` | No eliminar durante cierre funcional. |
| `auth_db_connections_absolute` | Backlog operativo. |

Template de indice selectivo:

```md
Index migration:
- Query/page measured:
- Existing plan:
- Proposed index:
- Expected cardinality:
- Write overhead:
- Rollback concept:
- Verification:
```

## Prompts para reactivar carriles

### Carril Secretaria

```md
Objetivo: completar el flujo Secretaria sin introducir schema innecesario.

Lee:
- docs/superpowers/contracts/2026-04-27-secretaria-data-contract.md
- docs/superpowers/plans/2026-04-29-migration-corridors-briefing.md
- docs/superpowers/plans/2026-04-29-supabase-parity-inventory.md

Entrega:
1. Lista de flujos que requieren migracion real vs UI/data-only.
2. Para cada migracion propuesta: tipo, tablas, RLS/RPC/storage, probes, tests.
3. Primer paquete recomendado con SQL no destructivo o decision "no migration".

No hagas:
- supabase db push
- regenerar tipos antes de aplicar migracion aprobada
- tocar 000049
- declarar evidencia final sin contrato completo
```

### Carril AIMS-GRC

```md
Objetivo: completar AIMS-GRC declarando legacy/backbone por pantalla y habilitando writes solo donde haga falta.

Lee:
- docs/superpowers/contracts/2026-04-27-aims-grc-data-contract.md
- docs/superpowers/contracts/2026-04-27-cross-module-data-contract.md
- docs/superpowers/plans/2026-04-29-migration-corridors-briefing.md

Entrega:
1. Matriz pantalla/hook -> legacy_read, backbone_read, bridge_read, backbone_write o migration_candidate.
2. Gaps que requieren data-only seed, RLS policy, RPC o ninguna migracion.
3. Tests/probes por gap.

No hagas:
- crear tablas nuevas sin contrato
- mover evidence/legal hold
- escribir governance_module_events/links sin paquete cross-module
```

### Carril Cross-module

```md
Objetivo: habilitar handoffs reales sin que el shell mute estados owner.

Lee:
- docs/superpowers/contracts/2026-04-27-cross-module-data-contract.md
- docs/superpowers/plans/2026-04-29-migration-corridors-briefing.md

Entrega:
1. Eventos canonicos a probar.
2. Si writes van por authenticated, service_role o Edge Function.
3. Probes SQL/RLS y tests de payload.
4. Migracion minima solo si el write falla y el flujo lo necesita.
```

### Carril Evidence/legal hold

```md
Objetivo: decidir si se puede levantar 000049 o si debe seguir en HOLD.

Lee:
- docs/superpowers/contracts/2026-04-27-aims-grc-data-contract.md
- docs/superpowers/contracts/2026-04-27-secretaria-data-contract.md
- docs/superpowers/contracts/2026-04-27-cross-module-data-contract.md
- docs/superpowers/plans/2026-04-29-migration-corridors-briefing.md

Entrega:
1. Contrato evidence/legal hold completo con owner, artifact, hash, bundle, audit, retention, legal hold y QTSP.
2. Lista de tablas/RPC/storage/policies afectadas.
3. Decision: levantar 000049, sustituirla por migracion nueva, o mantener HOLD.
4. Tests negativos y positivos de readiness.
```

## Cierre esperado por migracion aplicada

```md
Migration closeout:
- Migration file:
- Applied to Cloud:
- Supabase target:
- Tables/functions/policies changed:
- Data changed:
- Types regenerated:
- Probes:
- Tests:
- Build:
- Smoke:
- Docs updated:
- Residual risk:
```

## Orden practico para completar proyectos

1. Ejecutar smokes actuales y capturar fallos reales.
2. Resolver datos demo con paquete 0 antes de schema.
3. Cerrar Secretaria atomicidad solo si la materializacion Acuerdo 360 falla o necesita transaccion.
4. Mapear AIMS/GRC pantalla por pantalla antes de habilitar writes.
5. Probar cross-module events/links con contrato minimo.
6. Levantar evidence/legal hold solo cuando el contrato de evidencia final este completo.
7. Regenerar tipos despues de cada migracion aplicada, no antes.
8. Cerrar cada carril con docs, tests, build y smoke focalizado.
