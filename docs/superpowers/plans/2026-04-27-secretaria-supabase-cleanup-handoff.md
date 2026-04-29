# 2026-04-27 — Informe de estado para migracion orquestada Supabase y limpieza de repo

## Proposito

Este informe prepara el traspaso a una conversacion coordinadora de migracion Supabase. Su objetivo es dejar claro el estado de Secretaria Societaria, que depende de Cloud/local/types/UI, que riesgos hay en el repo y que necesito para poder dejar limpia mi parte sin romper la trazabilidad juridica ni duplicar modelos.

No es una migracion. No aplica cambios en Supabase. No guarda secretos.

## Estado ejecutivo

Actualizacion de cierre 2026-04-27:

- El carril de sanitizacion Supabase quedo cerrado con las migraciones Cloud `20260427000100` (`supabase_sanitization_gate`) y `20260427000101` (`supabase_sanitization_advisors`).
- El historial remoto fue verificado por Supabase MCP en `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- Checks Cloud confirmados: columnas lifecycle/hash en `rule_pack_versions`, bucket privado `matter-documents`, RLS en `materia_catalog`, `fn_verify_audit_chain` como invoker.
- Verificacion local: `bun run db:check-target`, `bunx tsc --noEmit`, `bun run lint`, `bun run test` y `bun run build` pasan.
- Advisor de seguridad restante: `auth_leaked_password_protection`, configuracion de Auth fuera de SQL.
- La continuidad operativa queda regida por `docs/superpowers/plans/2026-04-27-sanitization-master-plan.md` y por el contrato especifico `docs/superpowers/contracts/2026-04-27-secretaria-data-contract.md`.

- Supabase target verificado con `bun run db:check-target`: `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- El repo esta en estado muy sucio, con cambios mezclados en Secretaria, doc-gen, rules-engine, e2e, docs, scripts y nuevas migraciones locales pendientes.
- Secretaria ha avanzado mucho en UX operativa, gestor documental, acuerdos 360, reuniones, reglas y campanas de grupo.
- El siguiente bloqueo real no es funcional sino de orden: cerrar paridad Cloud/local/types/UI antes de seguir ampliando schema o confiar en tipos generados.
- Hasta cerrar paridad, cualquier pantalla nueva debe declarar tablas, fuente de verdad, migracion requerida y riesgo de paridad.

## Lo que debe preservarse de Secretaria

### 1. Acuerdo 360 como unidad de gestion

El acuerdo es el objeto de gestion de extremo a extremo:

- puede nacer como propuesta preparada;
- puede venir de convocatoria o campana;
- puede nacer validamente durante una reunion;
- puede adoptarse, certificarse, publicarse, inscribirse o archivarse;
- debe mantener identificador estable durante todo su ciclo.

Contratos actuales:

- `agreements.id`: identificador 360.
- `meeting_resolutions.agreement_id`: vinculo de punto votado con acuerdo.
- `agreements.execution_mode.agreement_360`: origen y metadatos de materializacion.
- `agreements.execution_mode.agenda_item_index`: idempotencia para puntos nacidos o materializados en reunion.
- `agreements.compliance_snapshot` y `agreements.compliance_explain`: trazabilidad juridica y explicacion.

Riesgo:

- El contrato `execution_mode` es JSON y esta funcionando como puente sin nueva tabla. Es valido para demo y paridad rapida, pero conviene decidir si despues de paridad se convierte en tabla puente formal.

### 2. Agenda real/preparada de reuniones

Las reuniones ya no pueden funcionar como una lista plana de debates. El stepper debe mezclar:

- puntos preparados;
- puntos de convocatoria;
- puntos de campana de grupo;
- acuerdos ya precreados;
- puntos nacidos en sala.

Contratos actuales:

- `meetings.quorum_data.debates`: lista editable de puntos de reunion.
- `meetings.quorum_data.point_snapshots`: snapshot de constitucion/votacion/proclamacion por punto.
- `meetings.quorum_data.source_links`: contrato JSON de origen.
- `agenda_items`: fuente preferente cuando existe y este aplicada en Cloud.
- `convocatorias.agenda_items`: fallback documental/convocatoria.
- `agreements.parent_meeting_id`: acuerdos preparados vinculables a reunion.

`source_links` actual:

```json
{
  "convocatoria_id": "uuid",
  "convocatoria_ids": ["uuid"],
  "group_campaign_id": "uuid",
  "group_campaign_ids": ["uuid"],
  "agreement_ids": ["uuid"],
  "source": "convocatoria | group_campaign | manual"
}
```

Riesgo:

- `agenda_items` debe confirmarse en Cloud, migraciones locales y tipos generados. Hay consumidores UI preparados, pero no debemos asumir paridad.

### 3. Convocatoria como recordatorio, no bloqueo

Decision de producto confirmada: la convocatoria no bloquea la ejecucion si se ha hecho fuera del sistema. La plataforma debe:

- alertar;
- dejar traza;
- recordar requisitos;
- capturar aceptacion de warnings;
- permitir explicar la decision posterior.

Contratos actuales a confirmar:

- `convocatorias.rule_trace`
- `convocatorias.reminders_trace`
- `convocatorias.accepted_warnings`

Riesgo:

- Estas columnas son criticas para UX y explicabilidad. No se debe seguir ampliando UI que dependa de ellas sin confirmar Cloud/local/types.

### 4. Reglas legales, estatutarias y pactos

El proceso no puede aplanar reglas. Los steppers deben preservar:

- organo competente;
- tipo social;
- forma de administracion;
- estatutos;
- pactos parasociales;
- quorum de asistencia;
- mayoria legal;
- mayorias reforzadas;
- vetos;
- conflictos y exclusiones del denominador;
- derechos economicos y derechos de voto cuando proceda;
- evidencia documental y plazos.

Contratos actuales:

- `rule_packs`
- `rule_pack_versions`
- `rule_param_overrides`
- `pactos_parasociales`
- `pacto_clausulas`
- `pacto_evaluacion_results`
- snapshots JSON en `meetings.quorum_data.point_snapshots`
- snapshots en `agreements.compliance_snapshot`

Riesgos:

- `rule_pack_versions` lifecycle esta en trabajo local y debe reconciliarse con Cloud.
- Hay que distinguir validez societaria de incumplimiento contractual de pactos. Un veto contractual puede generar alerta o incumplimiento, no necesariamente invalidez societaria.

### 5. Gestor documental como infraestructura critica

El gestor documental no es una pantalla auxiliar. Debe generar:

- convocatorias;
- actas;
- certificaciones;
- informes preceptivos;
- informes documentales PRE;
- documentos de expediente;
- documentos registrales o de publicacion cuando aplique.

Contratos actuales:

- `plantillas_protegidas`
- `attachments`
- `minutes`
- `certifications`
- `registry_filings`
- `evidence_bundles`
- `evidence_bundle_artifacts`
- `audit_log`
- storage Supabase
- QTSP EAD Trust como unico proveedor.

Riesgos:

- No declarar documento como firmado/archivado si no existe hash, storage object, evidence bundle y linkage auditable.
- Las plantillas PRE (`INFORME_PRECEPTIVO`, `INFORME_DOCUMENTAL_PRE`) deben confirmarse en Cloud y tipos antes de hacerlas obligatorias.

### 6. Campanas de grupo

Valor operativo principal: lanzar una campana unica y descomponerla en expedientes por sociedad segun datos maestros y reglas.

Contratos previstos:

- `group_campaigns`
- `group_campaign_expedientes`
- `group_campaign_steps`
- `group_campaign_post_tasks`
- vinculos hacia `agreements`, `convocatorias`, `meetings`, `minutes`, `certifications`, `registry_filings`

Riesgo:

- La migracion local `20260426_000042_group_campaigns.sql` debe ser revisada contra Cloud antes de depender de ella sin restricciones.

## Paridad Supabase pendiente

### Drift conocido

| Area | Riesgo | Accion requerida |
|---|---|---|
| Convocatorias | UI usa trazas juridicas y accepted warnings. | Confirmar columnas en Cloud, migracion local y tipos generados. |
| Rules lifecycle | `rule_pack_versions` lifecycle no puede quedar solo en local. | Reconciliar migracion y regenerar tipos. |
| Plantillas PRE | Flujos documentales pueden requerir PRE. | Confirmar datos seed y cobertura Cloud. |
| AIMS | Coexisten `ai_*` legacy y `aims_*`. | Decidir por pantalla si usa legacy o backbone. |
| GRC | Coexisten legacy operational y `grc_*`. | Mapear consumidores UI y evitar modelo mixto silencioso. |
| Evidence | Bundle/storage/audit no siempre son fuente unica fiable. | Crear probes y no declarar evidencia final sin linkage completo. |
| Generated types | Tipos Supabase parecen atrasados respecto a migraciones Cloud/local. | Regenerar solo tras paridad cerrada. |
| `agenda_items` | Consumidores preparados, paridad incierta. | Confirmar tabla y tipos antes de convertir en fuente unica. |
| `agreements.adoption_mode` | Posible constraint Cloud limitado a modos antiguos. | Decidir estrategia para `CO_APROBACION` y `SOLIDARIO`. |
| `meetings.status` | Cloud permite valores concretos; codigo antiguo uso `OPEN`. | Mantener `CELEBRADA` o migrar constraint de forma explicita. |

### Migraciones locales que deben entrar en inventario

- `supabase/migrations/20260426_000042_group_campaigns.sql`
- `supabase/migrations/20260426_000043_rule_lifecycle_governance.sql`
- `supabase/migrations/20260426_000044_convocatoria_rule_trace.sql`
- `supabase/migrations/20260426_000045_documental_process_templates.sql`

Estas migraciones no deben aplicarse en bloque sin comprobar:

1. si Cloud ya tiene parte del objeto;
2. si local lo representa con el mismo nombre y constraint;
3. si tipos generados incluyen los campos;
4. si UI ya tiene fallback cuando el campo no existe;
5. si el cambio es no destructivo.

## Archivos relevantes de mi bloque

### Secretaria core

- `src/lib/secretaria/agreement-360.ts`
- `src/lib/secretaria/meeting-agenda.ts`
- `src/lib/secretaria/meeting-links.ts`
- `src/lib/secretaria/certification-snapshot.ts`
- `src/lib/secretaria/registry-certification-link.ts`
- `src/lib/secretaria/template-routing.ts`
- `src/lib/secretaria/scope-filters.ts`
- `src/hooks/useReunionSecretaria.ts`
- `src/hooks/useAcuerdosSinSesion.ts`
- `src/hooks/useAgreementCompliance.ts`
- `src/hooks/useGroupCampaigns.ts`
- `src/pages/secretaria/ReunionStepper.tsx`
- `src/pages/secretaria/ProcesosGrupo.tsx`

### Rules y documentos

- `src/lib/rules-engine/meeting-adoption-snapshot.ts`
- `src/lib/rules-engine/rule-resolution.ts`
- `src/lib/doc-gen/process-documents.ts`
- `src/lib/doc-gen/template-renderer.ts`
- `src/lib/doc-gen/storage-archiver.ts`
- `src/components/secretaria/ProcessDocxButton.tsx`

### Pruebas focalizadas

- `src/lib/secretaria/__tests__/agreement-360.test.ts`
- `src/lib/secretaria/__tests__/meeting-agenda.test.ts`
- `src/lib/secretaria/__tests__/meeting-links.test.ts`
- `src/lib/secretaria/__tests__/certification-snapshot.test.ts`
- `src/lib/rules-engine/__tests__/meeting-adoption-snapshot.test.ts`
- `src/lib/rules-engine/__tests__/rule-resolution.test.ts`
- `src/lib/doc-gen/__tests__/process-documents.test.ts`
- `e2e/04-secretaria-convocatorias.spec.ts`
- `e2e/05-secretaria-reuniones.spec.ts`
- `e2e/12-secretaria-navigation.spec.ts`
- `e2e/13-secretaria-lote2-qa.spec.ts`
- `e2e/14-secretaria-documentos.spec.ts`

### Documentacion

- `docs/superpowers/plans/2026-04-27-ruflo-supabase-architecture-mission.md`
- `docs/superpowers/plans/2026-04-27-secretaria-estado-refactor-ux-documental.md`
- `docs/superpowers/plans/2026-04-27-secretaria-human-milestone-test-guide.md`
- `docs/superpowers/plans/2026-04-27-secretaria-supabase-cleanup-handoff.md`

## Que necesito para dejar limpio el repo

### Decisiones de coordinacion

1. Congelar writes de schema salvo la conversacion coordinadora.
2. Confirmar que todo se ordena en el repo `arga-governance-map`, no en el workspace de planificacion.
3. Decidir si las migraciones `000042` a `000045` son draft, canonical local o ya aplicadas parcialmente en Cloud.
4. Definir si `source_links` y `agreement_360` se mantienen como JSON para el hito humano o si se crea tabla puente formal despues de paridad.
5. Resolver estrategia de `CO_APROBACION` y `SOLIDARIO`:
   - opcion A: ampliar constraint `agreements.adoption_mode`;
   - opcion B: guardar `adoption_mode = NO_SESSION` y detalle real en `execution_mode`.
6. Confirmar que `agenda_items` existe y es fuente preferente o mantener fallback `convocatorias.agenda_items` + `meetings.quorum_data.debates`.
7. Confirmar generated types como artefacto que se regenera despues de paridad, no antes.
8. Confirmar que evidence backbone queda como "no final" hasta tener probe bundle/storage/hash/audit.
9. Asignar ownership de cambios no Secretaria que aparecen en el worktree.
10. Decidir frontera de commits para no mezclar docs, UI, migrations, rules, doc-gen y e2e en un unico cambio inmanejable.

### Orden recomendado de limpieza

1. Crear inventario de worktree por propietario: Secretaria, rules-engine, doc-gen, e2e, docs, scripts, Supabase.
2. Ejecutar `bun run db:check-target` antes de cualquier accion Supabase.
3. Exportar o consultar schema Cloud actual y compararlo con `supabase/migrations`.
4. Crear schema registry: tabla -> owner -> Cloud -> local migration -> generated types -> UI consumers -> tests.
5. Marcar cada migracion local como:
   - aplicada en Cloud;
   - pendiente no destructiva;
   - duplicada/parcial;
   - requiere split;
   - requiere renombrado o backfill.
6. Regenerar tipos Supabase solo tras cerrar el diff.
7. Ajustar UI/hook al tipo regenerado, evitando casts opacos salvo boundaries PostgREST.
8. Ejecutar probes de schema para columnas/RPCs criticas.
9. Ejecutar verificacion tecnica:
   - `bunx tsc --noEmit --pretty false`
   - tests focalizados Secretaria/rules/doc-gen
   - `bun run build`
   - e2e Secretaria golden path
10. Separar commits por dominio.

## Instruccion sugerida para la conversacion coordinadora

```text
Coordina una limpieza Supabase/repo sin migraciones destructivas.

Target obligatorio: governance_OS (hzqwefkwsxopwrmtksbg). Antes de tocar Supabase, ejecutar bun run db:check-target.

Objetivo:
1. Cerrar paridad Cloud/local/types/UI.
2. Clasificar migraciones locales 000042-000045.
3. Decidir source of truth para agenda_items, source_links, agreement_360, rule lifecycle, trazas de convocatoria y plantillas PRE.
4. Regenerar tipos solo cuando la paridad este clara.
5. Dejar commits separados por docs, Secretaria UI/core, rules-engine, doc-gen/evidence, e2e y Supabase.

Reglas:
- No destructivo.
- No guardar tokens ni secretos.
- No duplicar AIMS/GRC.
- Secretaria conserva snapshots juridicos, trazabilidad de reglas y evidence chain.
- Convocatoria genera alertas, no bloqueo, salvo gates posteriores de constitucion/votacion/certificacion/evidencia.
- Todo avance debe cerrar con data contract, verification y memory.
```

## Criterio de salida para "repo limpio"

El repo puede considerarse limpio para seguir sin restricciones cuando:

- `git status` queda explicado por commits o por una lista corta de pendientes asignados.
- Todas las migraciones locales estan clasificadas y ordenadas.
- Cloud/local/types/UI coinciden para las tablas usadas por Secretaria.
- Generated types estan al dia o se documenta explicitamente por que no se regeneran todavia.
- Los e2e criticos de Secretaria pasan contra el schema elegido.
- La documentacion de estado y la memoria Ruflo registran la decision estable.

## Data contract de este informe

- Tables used: none at runtime. El informe referencia `agreements`, `convocatorias`, `meetings`, `meeting_resolutions`, `agenda_items`, `minutes`, `certifications`, `registry_filings`, `plantillas_protegidas`, `attachments`, `evidence_bundles`, `evidence_bundle_artifacts`, `audit_log`, `rule_packs`, `rule_pack_versions`, `rule_param_overrides`, `pactos_parasociales`, `pacto_clausulas`, `pacto_evaluacion_results`, `group_campaigns`, `group_campaign_expedientes`, `group_campaign_steps`, `group_campaign_post_tasks`, `governance_module_links`, `governance_module_events`.
- Source of truth: none for this docs-only change. El contenido describe Cloud/local pending decisions.
- Migration required: no.
- Types affected: no.
- Cross-module contracts: documentados, no modificados.
- Parity risk: alto hasta cerrar Cloud/local/types/UI; mitigado por el plan de limpieza.

## Verification

- `bun run db:check-target`: OK, target `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- Typecheck: no ejecutado para este informe docs-only.
- Tests: no ejecutados para este informe docs-only.
- Build/lint/e2e: no ejecutados para este informe docs-only.
