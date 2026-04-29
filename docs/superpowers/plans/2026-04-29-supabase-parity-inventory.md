# Supabase parity inventory — sanitization gate

Fecha: 2026-04-29
Repo: `arga-governance-map`
Supabase target: `governance_OS` (`hzqwefkwsxopwrmtksbg`, eu-central-1)

## Guardrails

- No se aplican cambios de schema en este inventario.
- No se ejecuta `supabase db push`.
- No se regeneran tipos.
- `000049_grc_evidence_legal_hold` permanece en HOLD absoluto.
- AIMS/GRC y Secretaria solo pueden avanzar con UI, docs y tests contra tablas confirmadas.

## Evidencia usada

- `bun run db:check-target`: OK contra `governance_OS`.
- `supabase migration list --linked`: confirma desalineacion historica de versiones locales/remotas y presencia remota de `20260427000100` y `20260427000101`.
- Lecturas Cloud SQL/MCP previas del gate de sanitizacion: objetos, columnas, RLS, bucket storage, RPCs y advisors.
- Verificacion local por `rg` de tipos generados en `supabase/functions/_types/database.ts`.

## Tabla de drift

| Area / objeto | Local | Cloud | Tipos generados | Clasificacion | Decision |
|---|---:|---:|---:|---|---|
| Core historico hasta `000041` | Migraciones locales con versiones no equivalentes al historial remoto | Materializado y remoto con timestamps historicos | Presente para objetos usados | `materialized_drift` | No re-aplicar. Tratar como base historica ya materializada. |
| `20260426_000042_group_campaigns` | Existe local | Tablas `group_campaigns`, `group_campaign_expedientes`, `group_campaign_steps`, `group_campaign_post_tasks` materializadas | Presente | `materialized_drift` | No re-aplicar. Usar como drift historico confirmado. |
| `20260426_000043_rule_lifecycle_governance` | Existe local | Columnas lifecycle de `rule_pack_versions` y hash/severity de `rule_evaluation_results` materializadas por gate `000100`; audit row especifica no encontrada | Presente | `materialized_drift` | No re-aplicar. Opcional: backfill data-only de `rule_change_audit` si legal quiere trazabilidad formal. |
| `20260426_000044_convocatoria_rule_trace` | Existe local | `convocatorias.rule_trace`, `reminders_trace`, `accepted_warnings` materializadas | Presente | `materialized_drift` | No re-aplicar. Cubierto por `000100`. |
| `20260426_000045_documental_process_templates` | Existe local | Constraint y plantillas PRE/gestion materializadas | Presente | `materialized_drift` | No re-aplicar. Cubierto por `000100`. |
| `20260427_000100_supabase_sanitization_gate` | Existe local | Registrada como `20260427000100` | Presente | `applied_and_tracked` | Mantener como gate rector ya aplicado. |
| `20260427_000101_supabase_sanitization_advisors` | Existe local | Registrada como `20260427000101` | Presente | `applied_and_tracked` | Mantener como cierre SQL de advisors saneables. |
| AIMS backbone `aims_*` | No hay migracion local equivalente visible en este repo | Remoto tiene `000043_aims360_core` y `000044_aims360_seed`; tablas materializadas | Presente | `materialized_drift` | AIMS-GRC puede leerlas; no crear nuevas migraciones sin contrato. |
| GRC backbone `grc_*` | No hay migracion local equivalente visible en este repo | Remoto tiene `000045_grc_core_backbone` y `000046_grc_core_seed`; tablas materializadas | Presente | `materialized_drift` | GRC puede leerlas; no mover evidence/legal hold. |
| Legacy AI UI `ai_*` | Migraciones historicas locales/remotas | Tablas y RLS presentes | Presente | `applied_and_tracked` funcional | Seguir declarando si una pantalla usa legacy `ai_*` o backbone `aims_*`. |
| `matter-documents` storage bucket | Cubierto por `000100` | Bucket privado y policies para authenticated presentes | N/A | `applied_and_tracked` | Usable para demo documental, no declararlo evidencia final sin bundle/hash/audit. |
| `fn_verify_audit_chain(uuid)` | Cubierta por `000100` | SECURITY INVOKER y grants restringidos | Presente | `applied_and_tracked` | OK para verificacion autenticada/service_role. |
| `fn_cerrar_votaciones_vencidas(uuid)` | Cubierta por `000100` | SECURITY INVOKER y grants restringidos | Presente | `applied_and_tracked` | OK, pero recordar que algunas pantallas pueden disparar cierre de datos demo. |
| `000049_grc_evidence_legal_hold` | Referenciado por plan, no liberado | No debe moverse | No debe regenerar tipos | `hold` | HOLD absoluto hasta contrato evidence/legal hold completo. |
| Objetos obsoletos | No confirmados | No confirmados | N/A | `obsolete` no detectado | No borrar ni limpiar sin inventario especifico. |

## Verificacion de tipos

Los tipos generados locales contienen los objetos criticos probados contra Cloud:

- `aims_*`: model registry, system versions, requirement checks, technical file, evidence packs, incidents.
- `grc_*`: modules, controls, risks, obligations, work items, workflows, evidence links.
- `governance_module_events` y `governance_module_links`.
- `group_campaign*`.
- `convocatorias.rule_trace`, `reminders_trace`, `accepted_warnings`.
- `plantillas_protegidas` con `adoption_mode`, capas y contrato de variables.
- `rule_pack_versions` lifecycle y `rule_evaluation_results` trace/hash/severity.
- RPCs `fn_verify_audit_chain` y `fn_cerrar_votaciones_vencidas`.

No se ha regenerado `supabase/functions/_types/database.ts` en este paso.

## Advisors

### Security

| Advisor | Severidad | Estado | Accion recomendada |
|---|---|---|---|
| Leaked password protection desactivado | WARN | Pendiente | Configuracion de Auth en Supabase Dashboard, no SQL migration. Activar fuera de este carril. |

### Performance

| Advisor | Severidad | Estado | Accion recomendada |
|---|---|---|---|
| `multiple_permissive_policies` en `jurisdiction_rule_sets` SELECT | WARN | Pendiente | Consolidar policies solo si aparece coste real o bloqueo; requiere aprobacion. |
| `unindexed_foreign_keys` | INFO | Pendiente | Crear indices selectivos por consultas calientes, no tanda masiva. |
| `unused_index` | INFO | Pendiente | No eliminar indices durante sanitizacion funcional; medir despues. |
| `auth_db_connections_absolute` | INFO | Pendiente | Backlog operativo Supabase, no bloquea demo. |

## Migraciones seguras propuestas

No hay migracion SQL obligatoria para desbloquear AIMS-GRC o Secretaria ahora mismo.

Propuestas solo con aprobacion explicita:

| Propuesta | Tipo | Destructiva | Motivo | Prioridad |
|---|---|---:|---|---|
| Data-only audit marker para `20260426_000043_rule_lifecycle_governance` en `rule_change_audit` | Datos | No | Completar trazabilidad documental del drift cubierto por `000100` | Baja |
| Consolidar SELECT policies de `jurisdiction_rule_sets` | RLS | No, pero sensible | Reducir advisor `multiple_permissive_policies` | Media solo si performance/security lo exige |
| Indices FK selectivos | Performance | No | Resolver advisors `unindexed_foreign_keys` en rutas calientes | Baja hasta medir |
| Activar leaked password protection | Auth config | No SQL | Cerrar unico advisor security restante | Media, fuera de migraciones |

## Migraciones en HOLD

| Migracion / area | Estado | Motivo |
|---|---|---|
| `000049_grc_evidence_legal_hold` | HOLD absoluto | Requiere contrato evidence/legal hold completo, storage/hash/bundle/audit/retention y decision de ownership. |
| Nuevas tablas/columnas AIMS-GRC | HOLD | AIMS/GRC avanza solo con UI/docs/tests contra objetos confirmados. |
| Cambios RLS/RPC/storage AIMS-GRC | HOLD | Evitar mover permisos bajo carriles funcionales. |
| Regeneracion de tipos | HOLD operativo | Solo despues de migracion aprobada y aplicada. |

## Riesgo por carril

| Carril | Riesgo | Lectura |
|---|---|---|
| Secretaria | Bajo/medio | Las columnas y RPCs core estan presentes. Riesgo principal: datos demo incompletos o pantallas que mutan workflow al cargar. |
| AIMS-GRC | Medio | Hay dos capas (`ai_*` legacy y `aims_*`/`grc_*` backbone). El avance debe declarar fuente de verdad por pantalla. |
| Evidence/legal hold | Alto | Sigue congelado; no presentar como backbone probatorio unico. |
| Cross-module | Medio/alto | `governance_module_events/links` existen, pero los writes requieren contrato y tests. |
| Operacion Supabase | Bajo/medio | Security advisor restante es Auth config; performance advisors son backlog salvo evidencia de lentitud. |

## Orden recomendado

1. Mantener freeze de schema y `000049` en HOLD.
2. Ejecutar smoke focalizado AIMS-GRC y Secretaria contra Cloud actual.
3. Permitir que AIMS-GRC y Secretaria sigan con UI/docs/tests usando solo tablas confirmadas y contratos explicitos.
4. Si el smoke revela fallo UI o datos demo, corregir UI/datos seed bajo aprobacion del carril owner; no tocar schema.
5. Si el smoke revela fallo RLS/RPC/schema, preparar migracion no destructiva separada y pedir aprobacion explicita.
6. Cerrar Auth leaked password protection desde Dashboard Supabase.
7. Posponer performance advisors hasta medicion de rutas calientes.
8. Levantar `000049` solo con contrato evidence/legal hold aprobado y migracion aislada.
