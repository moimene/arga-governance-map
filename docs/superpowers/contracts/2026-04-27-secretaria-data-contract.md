# 2026-04-27 — Contrato de datos Secretaria Societaria

## Proposito

Fijar el contrato de datos del carril Secretaria para que pueda seguir avanzando funcionalmente sin absorber modelos GRC/AIMS ni declarar evidencia juridica incompleta.

Secretaria es el owner de los actos societarios formales: convocatorias, reuniones, acuerdos, actas, certificaciones, libros, plantillas, rule snapshots y trazabilidad legal.

## Estado rector

- Cloud Supabase es fuente de verdad.
- El saneamiento base confirmo lifecycle/trace/document bucket y hardening RPC principal.
- El bucket documental `matter-documents` existe y es privado.
- `rule_pack_versions` contiene columnas lifecycle/hash.
- `convocatorias` contiene trazas de regla y warnings aceptados.
- Las plantillas PRE se consideran disponibles solo si el flujo concreto las prueba en Cloud.
- GRC/AIMS se consumen por eventos/links/evidencia, no como tablas owner de Secretaria.

## Ownership Secretaria

| Area | Tablas/contratos owner | Consumidores |
|---|---|---|
| Acuerdo 360 | `agreements`, `meeting_resolutions`, `no_session_resolutions`, `unipersonal_decisions` | Shell, GRC, AIMS |
| Convocatorias | `convocatorias`, `attachments`, trazas JSON | Shell, Board Pack |
| Reuniones | `meetings`, `meeting_attendees`, `meeting_resolutions`, `agenda_items` cuando exista paridad | Shell, GRC/AIMS via links |
| Actas | `minutes` | Shell, evidencia compartida |
| Certificaciones | `certifications`, RPCs QTSP/stub | Shell, GRC, AIMS |
| Plantillas/documentos | `plantillas_protegidas`, doc-gen, storage `matter-documents` | Secretaria, auditoria |
| Reglas legales | `rule_packs`, `rule_pack_versions`, `rule_param_overrides`, `rule_evaluation_results` | Secretaria, Board Pack |
| Pactos | `pactos_parasociales`, `pacto_clausulas`, `pacto_evaluacion_results` | Secretaria |
| Evidencia | `evidence_bundles`, `audit_log`, storage | Todos por contrato |

## Acuerdo 360

`agreements.id` es el identificador estable del ciclo de vida societario.

Un acuerdo puede nacer desde:

- propuesta preparada;
- convocatoria;
- campana de grupo;
- reunion;
- acuerdo sin sesion;
- decision unipersonal.

Contrato minimo:

```ts
type Agreement360Contract = {
  agreement_id: string;
  tenant_id: string;
  entity_id?: string | null;
  body_id?: string | null;
  agreement_kind: string;
  matter_class: string;
  adoption_mode: string;
  status: string;
  compliance_snapshot?: Record<string, unknown> | null;
  compliance_explain?: Record<string, unknown> | null;
  document_url?: string | null;
};
```

Reglas:

- No crear otro identificador owner paralelo para el mismo acto.
- Si un punto de reunion materializa un acuerdo, debe enlazar `meeting_resolutions.agreement_id`.
- Si se usa JSON temporal (`execution_mode`, `quorum_data`), debe documentarse como puente demo o contrato transitorio.

## Convocatorias

La convocatoria no debe bloquear ciegamente la ejecucion si el acto se hizo fuera del sistema. Debe:

- alertar;
- recordar requisitos;
- guardar trazabilidad;
- capturar warnings aceptados;
- permitir explicacion posterior.

Contrato:

- `convocatorias.rule_trace`
- `convocatorias.reminders_trace`
- `convocatorias.accepted_warnings`
- `publication_channels`
- `attachments`

Reglas:

- Las advertencias legales se registran, no se esconden.
- Una convocatoria universal o regularizada debe conservar explicacion.
- Los canales ERDS deben referenciar EAD Trust, no proveedores alternativos.

## Reuniones y agenda

La agenda puede componerse desde:

- `agenda_items` si existe paridad;
- `convocatorias.agenda_items`;
- `agreements.parent_meeting_id`;
- `meetings.quorum_data.debates`;
- puntos nacidos en sala;
- campañas de grupo si estan confirmadas.

Reglas:

- El stepper puede usar fallback demo, pero debe declarar fuente.
- La votacion por punto debe conservar snapshot de quorum/mayoria.
- La proclamacion debe materializar o enlazar acuerdo.

## Documentos, QTSP y evidencia

Un documento generado no es evidencia final productiva hasta tener:

- contenido/render;
- storage object o URL verificable;
- hash;
- owner record (`agreement`, `minute`, `certification`, etc.);
- bundle o manifest;
- audit linkage;
- si aplica, token QES/QSeal/ERDS/timestamp EAD Trust o stub claramente marcado.

Niveles:

| Nivel | Uso |
|---|---|
| `GENERATED` | Documento creado pero no archivado |
| `ARCHIVED` | Documento en storage con hash; evidencia demo/operativa mientras no exista cadena completa |
| `BUNDLED` | Documento incluido en evidence bundle/manifest; no evidencia final productiva sin audit/retention/legal hold |
| `QTSP_SIGNED` | Firma/sello/notificacion EAD Trust trazada |
| `AUDIT_VERIFIED` | Cadena auditada o verificable |

UI debe mostrar el nivel real, no uno aspiracional.

### Gate futuro de promocion a evidencia final productiva

Este corte solo define un contrato puro de readiness: `src/lib/secretaria/final-evidence-readiness-contract.ts`.

No activa promocion, no escribe en Supabase, no cambia storage y no modifica RPC/RLS. Los artefactos actuales siguen siendo evidencia demo/operativa:

- `evidence_bundles`: bundle operativo demo.
- `certifications.evidence_id`: enlace operativo a evidencia emitida.
- `agreements.document_url`: documento generado/archivado, no evidencia final productiva.

La readiness futura solo puede ser positiva si todos los gates estan satisfechos explicitamente:

1. artefacto marcado como `FINAL_PROMOTION_CANDIDATE`;
2. owner record canonico;
3. storage object o referencia verificable;
4. hash criptografico;
5. bundle o manifest;
6. cierre auditado con referencia;
7. retencion cerrada con referencia;
8. legal hold cerrado o no aplicable con referencia;
9. politica probatoria aprobada;
10. aprobacion explicita de promocion.

La promocion real queda fuera de este corte y exigira revision posterior de migraciones, RLS/RPC/storage, audit, retention/legal hold y contratos cross-module.

El flujo documental consume este contrato solo como diagnostico interno mediante `src/lib/doc-gen/process-document-readiness.ts`. `generateProcessDocx()` devuelve `finalEvidenceReadiness`, pero no lo muestra como badge final, no lo persiste y no habilita acciones de promocion.

## Rule packs

`rule_pack_versions` lifecycle es parte del contrato juridico:

- `status`
- `effective_from`
- `effective_to`
- `approved_at`
- `approved_by`
- `payload_hash`
- `supersedes_version_id`

Reglas:

- No evaluar produccion contra payload sin snapshot/hash si el flujo exige trazabilidad.
- Las advertencias DL-2 para cotizadas no deben bloquear por defecto.
- Las plantillas SA/SL deben resolverse automaticamente cuando haya datos suficientes.

## Integracion con GRC/AIMS

Secretaria puede consumir:

- eventos materiales GRC/AIMS;
- links a hallazgos/incidentes/sistemas IA;
- evidencias compartidas.

Secretaria no debe:

- poseer controles GRC;
- crear inventario IA;
- cerrar workflows GRC/AIMS directamente;
- replicar evidence/legal hold AIMS-GRC.

Mutaciones permitidas por Secretaria tras evento:

- crear propuesta de agenda;
- crear expediente societario;
- incluir punto en Board Pack;
- emitir acta/certificacion si corresponde.

## Campanas de grupo

`group_campaigns` y tablas relacionadas son contrato de producto avanzado. Si el flujo depende de ellas:

- confirmar Cloud;
- confirmar tipos;
- confirmar RLS;
- declarar si son fuente unica o puente demo;
- no bloquear Secretaria core si no estan disponibles.

## Gates por flujo

| Flujo | Gate minimo |
|---|---|
| Convocatoria | `convocatorias` + trazas + rule pack o fallback documentado |
| Reunion | `meetings` + asistentes + resoluciones + snapshot punto |
| Acta | `minutes` + acuerdo/resolutions + hash/gate si aplica |
| Certificacion | `certifications` + authority evidence + QTSP/stub + bundle URI si emite |
| Documento | `plantillas_protegidas` + renderer + storage/hash |
| Board Pack | Lecturas owner; no muta GRC/AIMS |
| Cross-module | Evento/link probado; owner muta estado |

## Matriz sanitizada por flujo — 2026-04-29

Esta matriz es el corte operativo bajo sanitizacion Supabase. No introduce schema; documenta que puede demoarse y que queda condicionado por paridad.

| Flujo | Tablas owner | Tablas compartidas | Fuente de verdad | Evidencia real | Riesgo paridad | Demo |
|---|---|---|---|---|---|---|
| Acuerdo 360 | `agreements`, `meeting_resolutions`, `no_session_resolutions`, `unipersonal_decisions` | `rule_evaluation_results`, `evidence_bundles`, `audit_log` | Cloud | `OWNER_RECORD`; documento archivado es evidencia demo/operativa, no evidencia final productiva sin cadena completa | Medio | Listo |
| Convocatorias | `convocatorias`, `attachments` | `governing_bodies`, `rule_packs`, `rule_pack_versions`, `plantillas_protegidas` | Cloud | `ARCHIVED` solo si hay storage/hash/attachment; `publication_evidence_url` es referencia | Medio | Listo |
| Reuniones | `meetings`, `meeting_attendees`, `meeting_resolutions`, `meeting_votes` | `agenda_items`, `convocatorias`, `agreements`, `rule_packs`, `rule_pack_versions`, `pactos_parasociales` | Cloud | `OWNER_RECORD`; snapshot en `meetings.quorum_data` | Medio | Listo |
| Actas | `minutes` | `meetings`, `meeting_resolutions`, `agreements`, `certifications` | Cloud | `GENERATED`; sube a `ARCHIVED/BUNDLED` solo con doc-gen/evidence | Bajo | Listo |
| Certificaciones | `certifications` | `minutes`, `meetings`, `meeting_resolutions`, `authority_evidence`, `capability_matrix`, `evidence_bundles` | Cloud | `QTSP_SIGNED`/stub si RPC completa; `evidence_id` es vínculo demo/operativo, no evidencia final productiva | Medio | Parcial |
| Gestor documental | `plantillas_protegidas` | `agreements`, `convocatorias`, `attachments`, `evidence_bundles` | Cloud; fixtures locales solo fallback | Mixto: `GENERATED`, `ARCHIVED` o `BUNDLED`; postura demo/operativa hasta audit/retention/legal hold | Medio | Listo |
| Plantillas PRE | `plantillas_protegidas` | `convocatorias`, `rule_packs`, `rule_pack_versions`, `attachments` | Cloud; fixtures locales no son aprobacion legal | `GENERATED`; puede existir antes de `agreement_id` | Medio | Parcial |
| Board Pack | Ninguna; lectura compuesta | `meetings`, `agenda_items`, `agreements`, `risks`, `obligations`, `incidents`, `controls`, `findings`, `action_plans`, `attestations`, `delegations`, `ai_systems`, `ai_compliance_checks` | Cloud con mezcla legacy/backbone declarada | `none`; no evidencia final productiva | Alto | Parcial |

Reglas aplicadas a esta matriz:

- Ningun flujo requiere migracion nueva.
- Ningun flujo toca tipos generados.
- Ningun flujo toca RLS, RPC ni storage en esta tanda.
- Board Pack no posee ni muta GRC/AIMS; solo compone lecturas para demo.
- Los fixtures locales del gestor documental deben mostrarse como no persistidos y no sustituyen plantillas Cloud aprobadas.
- La captura Capa 3 en convocatorias se guarda solo dentro de trazas JSON existentes (`rule_trace`/`reminders_trace`) y no crea borradores normalizados.
- Si un documento no tiene storage/hash/bundle/audit, no se declara evidencia final productiva.

Artefactos de soporte:

- `src/lib/secretaria/sanitized-flow-contracts.ts`
- `src/lib/secretaria/__tests__/sanitized-flow-contracts.test.ts`
- `src/lib/secretaria/capa3-fields.ts`
- `src/lib/secretaria/template-process-matrix.ts`
- `src/lib/secretaria/__tests__/template-process-matrix.test.ts`
- `src/components/secretaria/Capa3CaptureDialog.tsx`
- `src/pages/secretaria/Dashboard.tsx` muestra el panel de contratos por flujo.

## Matriz plantilla -> proceso -> variables -> fuentes

El consumo documental de Secretaria se coordina mediante `template-process-matrix.ts`.
La matriz es codigo TypeScript puro y no crea dependencias nuevas de schema.

Contrato:

- Entrada: plantilla Cloud o fixture local, `processHint`, variables ya disponibles en UI y valores Capa 3 capturados.
- Salida: proceso owner, tipos documentales compatibles, campos Capa 3, variables resueltas, fuente por variable y faltantes obligatorios.
- Fuentes permitidas: `template`, `derived`, `capa3`.
- Persistencia permitida: solo la ya existente en el flujo owner. En convocatorias, la captura Capa 3 queda dentro de `rule_trace`/`reminders_trace`.
- Evidencia: la matriz no convierte documentos en evidencia final productiva; eso sigue dependiendo de storage/hash/bundle/audit ya existente.

Riesgo de paridad:

- Bajo para fixtures locales y tests puros.
- Medio para plantillas PRE reales hasta validar IDs y cobertura Cloud.
- No habilita migraciones, tipos generados, RLS, RPC ni storage.

## Fase 3 documental — PRE parity y trace evidence

Este corte deja las plantillas PRE cableadas sin ampliar contrato Supabase.

PRE Cloud confirmadas:

- `INFORME_PRECEPTIVO`: `b2b3b741-d2d6-4c8a-bb00-7b519854d39e`.
- `INFORME_DOCUMENTAL_PRE`: `d6c6fa3e-8c5c-417a-8cbb-0f5b681375d3`.

Contrato de traza:

- Helper owner: `buildTemplateTraceEvidence()` en `src/lib/secretaria/template-process-matrix.ts`.
- Persistencia permitida: solo `convocatorias.rule_trace` y `convocatorias.reminders_trace`.
- No persiste fixtures como fuente de verdad: `source_of_truth = "fixture_fallback_non_persistent"` y `fixture_persisted_as_source_of_truth = false`.
- La postura probatoria para este corte es `GENERATED_TRACE_ONLY`; no declara storage, bundle, audit ni evidencia final productiva.
- Paridad PRE se expresa con `validatePreTemplateParity()` y estados `CLOUD_ACTIVE`, `CLOUD_ACTIVE_WITH_WARNINGS`, `INPUTS_INCOMPLETE`, `CLOUD_NOT_APPROVED`, `CLOUD_MISSING`, `FIXTURE_ONLY` y `NOT_PRE`.

Hardening Capa 3:

- `normalizeCapa3Fields()` ignora entradas no-objeto, campos vacios, duplicados y nombres no seguros.
- `normalizeCapa3Draft()` normaliza valores parciales, vacios, legacy keys, claves inesperadas y valores `null`.
- `Capa3CaptureDialog`, `ProcessDocxButton` y `GenerarDocumentoStepper` pasan por el normalizador antes de render/generacion.

Data contract:

- Tables used: `plantillas_protegidas` read-only; `convocatorias.rule_trace`/`convocatorias.reminders_trace` existing writes.
- Source of truth: Cloud for real PRE; local fixtures are bridge only.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Cross-module contracts: none new.
- Parity risk: low-medium; IDs PRE Cloud confirmed, full matter coverage pending global Supabase parity.

## Reuniones v2 — adopcion por punto y Acuerdo 360

Este corte refuerza el flujo de reunion sin tocar schema.

Contrato runtime:

- Snapshot owner: `meetings.quorum_data.point_snapshots`.
- Snapshot por acuerdo materializado: `agreements.compliance_snapshot` y `agreements.compliance_explain`.
- Resolucion owner: `meeting_resolutions` conserva texto, punto, estado y `agreement_id`.
- Voto owner: `meeting_votes` conserva sentido de voto, conflicto y motivo.
- Materializacion 360: `agreement-360.ts` sigue siendo la unica puerta para crear/actualizar `agreements`.

Reglas de motor fijadas:

- Cada punto exige voto expreso de todo votante elegible.
- Conflictos requieren motivo; el voto de conflictuado puede verse en UI pero se ignora en denominador.
- `votes_incomplete_for_point` bloquea proclamacion societaria.
- `mayoria_consejeros` se calcula con votos favorables frente a total de miembros, no con presencia.
- El voto de calidad elimina `majority_not_achieved` solo cuando se usa validamente para desempatar.
- El voto de calidad queda deshabilitado para `COMISION_DELEGADA`; en Consejo se toma de `governing_bodies.quorum_rule.voto_calidad_presidente` si existe.

Data contract:

- Tables used: `meetings`, `governing_bodies`, `meeting_attendees`, `meeting_resolutions`, `meeting_votes`, `agreements`; pactos via hooks existentes.
- Source of truth: Cloud; `quorum_data.point_snapshots` es puente JSON explicable.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Cross-module contracts: none new.
- Parity risk: medium; snapshot por punto aun no tiene WORM/gate hash dedicado y las escrituras cliente no son transaccionales.

## Data contract de cierre Secretaria

```md
Data contract:
- Flow:
- Tables used:
- Source of truth:
- Owner records:
- Shared records:
- Migration required:
- Types affected:
- RLS/RPC/storage affected:
- Evidence level:
- Cross-module contracts:
- Parity risk:

Verification:
- db:check-target:
- Typecheck:
- Lint:
- Tests:
- Build:
- e2e:
```
