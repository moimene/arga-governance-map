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
  adoption_mode: 'MEETING' | 'UNIVERSAL' | 'NO_SESSION' |
                 'UNIPERSONAL_SOCIO' | 'UNIPERSONAL_ADMIN' |
                 'CO_APROBACION' | 'SOLIDARIO';
  status: string;
  compliance_snapshot?: Record<string, unknown> | null;
  compliance_explain?: Record<string, unknown> | null;
  document_url?: string | null;
};
```

Reglas:

- No crear otro identificador owner paralelo para el mismo acto.
- Si un punto de reunion materializa un acuerdo, debe enlazar `meeting_resolutions.agreement_id`.
- Si se usa JSON temporal (`quorum_data`), debe documentarse como puente demo o contrato transitorio.
- `execution_mode` sigue documentado como puente hasta que el paquete v2.1 lo promueva formalmente en Cloud/local/types; al ocurrir, este contrato debe actualizarlo a contrato permanente.

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

### Boundary con el carril Document Assembly

Desde 2026-05-02, Secretaria no se considera owner del generador documental final. Secretaria es owner de los datos canonicos del acto y puede emitir una solicitud hacia un carril independiente de ensamblado documental.

Contrato rector:

- `docs/superpowers/contracts/2026-05-02-secretaria-document-generation-boundary.md`
- `src/lib/secretaria/document-generation-boundary.ts`

Reglas:

- Secretaria conserva `agreements.id`, actas, certificaciones, snapshots, rule traces y postura demo/operativa.
- El futuro `Document Assembly Pipeline` sera owner del `document_model`, render DOCX/PDF, controles de plantilla, validacion post-render y, si se aprueba, integracion documental productiva.
- El flujo actual `doc-gen` queda como bridge demo/operativo mientras no exista el carril independiente.
- La solicitud saliente de Secretaria nunca puede declarar `evidence_status` distinto de `DEMO_OPERATIVA`.
- Acta, certificacion, acuerdo sin sesion, decision unipersonal, documento registral y subsanacion deben converger en `agreement_ids` antes de generar documentos derivados.

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

- Snapshot explicable UI/demo: `meetings.quorum_data.point_snapshots`.
- Snapshot juridico versionado, cuando hay traza Cloud V2 completa:
  `rule_evaluation_results`.
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
- Una fila `rule_evaluation_results` solo se inserta si el punto tiene
  `agreement_id`, `rule_pack_version_id`, `payload_hash` y
  `ruleset_snapshot_id`.
- Si el punto usa fallback tecnico, la traza queda como
  `PROTOTYPE_FALLBACK` en el snapshot explicable y no se presenta como WORM.

Data contract:

- Tables used: `meetings`, `governing_bodies`, `meeting_attendees`, `meeting_resolutions`, `meeting_votes`, `agreements`, `rule_evaluation_results`; pactos via hooks existentes.
- Source of truth: Cloud; `rule_evaluation_results` es el destino versionado
  para puntos V2 completos y `quorum_data.point_snapshots` queda como puente
  JSON explicable.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Cross-module contracts: none new.
- Parity risk: medium; faltan datos Cloud reales de asistentes/capital y limpieza
  de duplicados `ACTIVE` antes de retirar fallbacks V1.

## Gestor de plantillas — revision legal read-only

Este corte incorpora una clasificacion pura de revision legal para no confundir
`ACTIVA` con aprobacion legal formal.

Contrato runtime:

- Clasificador owner: `src/lib/secretaria/legal-template-review.ts`.
- UI owner: `/secretaria/gestor-plantillas`.
- Fuente runtime: `plantillas_protegidas` leida via hooks existentes.
- Fixtures locales: solo puente no persistente; no sustituyen fuente Cloud ni aprobacion legal.
- Huecos criticos expuestos: `ACTA_DECISION_CONJUNTA` para `CO_APROBACION` y
  `ACTA_ORGANO_ADMIN` para `SOLIDARIO`.
- Fixtures locales nuevos: `legal-fixture-acta-decision-conjunta-es` y
  `legal-fixture-acta-organo-admin-solidario-es`; ambos quedan como
  `fixture_pending_load`, no como aprobacion Cloud.

Reglas fijadas:

- Una plantilla activa solo es aprobada legalmente si tiene aprobacion formal y
  no presenta banderas de version tecnica, referencia, owner o duplicidad.
- `MODELO_ACUERDO` requiere referencia legal explicita y metadatos de organo /
  `AdoptionMode` para pasar revision.
- Versiones `0.x`, version ausente o version no semver se tratan como tecnicas.
- Fixtures locales se muestran como `fixture_bridge`, nunca como aprobacion legal.

Data contract:

- Tables used: `plantillas_protegidas` read-only.
- Source of truth: Cloud; fixtures locales solo fallback visual/test.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Cross-module contracts: none new.
- Parity risk: low for UI/read-only; medium for future legal approval workflow.

## Prototipo operativo — campanas y reunion desde convocatoria

Este corte empieza la transicion de demo a prototipo: la logica critica deja de
estar embebida solo en pantallas y pasa a contratos puros testeables.

Campanas de grupo:

- Motor owner: `src/lib/secretaria/group-campaign-engine.ts`.
- UI consumer: `/secretaria/procesos-grupo`.
- Contrato: `CampaignTemplate` + `CampaignParams` + `CampaignSocietyInput`
  generan expedientes derivados, `AdoptionMode`, rule pack, alertas, deadlines
  y payload de lanzamiento.
- Invariante: sociedad cotizada no bloquea; se anade alerta LMV y se mantiene el
  flujo societario.
- Invariante: consejo, administrador unico, mancomunados, solidarios y socio
  unico no se aplanan.

Convocatoria a reunion:

- Motor owner: `src/lib/secretaria/meeting-scheduler.ts`.
- Hooks owner: `useMeetingForConvocatoria()` y
  `useCreateMeetingFromConvocatoria()` en `src/hooks/useReunionSecretaria.ts`.
- UI consumer: `/secretaria/convocatorias/:id`.
- Owner record: `meetings.id`.
- Bridge JSON: `meetings.quorum_data.source_links`.
- Regla: la programacion es idempotente por `convocatoria_id`; si ya existe
  reunion vinculada se abre la existente.
- Regla: no se programa reunion sin `body_id` ni `fecha_1`.
- Regla Cloud confirmada: la reunion creada desde convocatoria usa
  `meetings.status = CONVOCADA`; `PROGRAMADA` queda como etiqueta UI legacy y
  no se inserta porque no pasa el constraint Cloud actual.

Data contract:

- Tables used: `convocatorias`, `meetings`, `governing_bodies` read; `meetings`
  write only when the user ejecuta "Programar reunion".
- Source of truth: Cloud.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Evidence level: owner record operativo; no evidencia final productiva.
- Cross-module contracts: none new.
- Parity risk: medium; depends on existing INSERT permission for `meetings`.

## Prototipo operativo — trazabilidad legal acta/certificacion/tramitador

Este corte refuerza la explicabilidad legal de la cadena posterior a la reunion
sin tocar schema.

Superficies:

- Acta: `/secretaria/actas/:id`.
- Certificacion: panel de certificaciones dentro del acta.
- Tramitador: `/secretaria/tramitador/nuevo?certificacion=...`.
- Reuniones: paso de votacion/cierre con lenguaje de expediente Acuerdo 360.

Reglas de lenguaje fijadas:

- `agreement_id` no se muestra al usuario legal como requisito tecnico; se
  explica como expediente Acuerdo 360 canonico.
- Las referencias por punto se muestran como referencia temporal del punto, no
  como evidencia final.
- "Materializar" se reemplaza por "crear expediente Acuerdo 360".
- `Bundle demo` se reemplaza por evidencia demo/operativa.
- `fn_generar_acta`, `audit_log`, `tenant activo` y `WORM` no aparecen como
  instrucciones de usuario en estos flujos.
- Evidencia sigue siendo demo/operativa y no evidencia final productiva.

Data contract:

- Tables used: no nuevas; flujos existentes leen/escriben `minutes`,
  `certifications`, `agreements`, `registry_filings` y trazas operativas ya
  documentadas.
- Source of truth: Cloud.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Cross-module contracts: none new.
- Parity risk: low for copy/e2e; evidence final remains future contract.

## Prototipo operativo — golden path legal completo

Este corte cierra una prueba unica de prototipo para el equipo legal:
`Convocatoria -> Reunion -> Votacion -> Acta -> Certificacion -> Tramitador -> Documento`.

Superficies:

- Convocatoria: `/secretaria/convocatorias/:id`.
- Reunion: `/secretaria/reuniones/:id`.
- Acta: `/secretaria/actas/:id`.
- Tramitador: `/secretaria/tramitador/nuevo?certificacion=...`.
- Documento: generacion DOCX de convocatoria, informe PRE, acta y documento
  registral cuando el acuerdo seleccionado lo permite.

Reglas fijadas:

- La reunion se abre desde la convocatoria y conserva el origen en
  `meetings.quorum_data.source_links`.
- El paso de votacion mantiene snapshot por punto, denominador, conflictos y
  pactos como contexto legal explicable.
- Si un organo demo no tiene `condiciones_persona` vigentes ni asistentes
  persistidos, el prototipo muestra y usa un censo demo no persistido para
  quorum/votacion. No se presenta como censo legal productivo.
- Si Cloud no devuelve un rule pack compatible para una materia de reunion, el
  prototipo puede usar `src/lib/secretaria/prototype-rule-pack-fallback.ts` para
  mantener el circuito operativo. Ese fallback:
  - queda marcado como `prototype_rule_pack_fallback_used`;
  - usa `source_of_truth = none`;
  - no sustituye rule pack aprobado;
  - no habilita evidencia final productiva.
- Si Cloud no devuelve un rule pack registral activo para el acuerdo
  seleccionado en el tramitador, el prototipo puede usar
  `src/lib/secretaria/prototype-registry-rule-fallback.ts`. Ese fallback:
  - queda marcado como `prototype_fallback = true`;
  - usa `source_of_truth = none`;
  - solo habilita continuidad UX del prototipo;
  - no sustituye validacion registral/legal productiva ni rule pack aprobado.
- El cierre de reunion reutiliza el acta existente si ya hay una para esa
  reunion; evita duplicados en pruebas repetidas y mantiene el enlace
  estable hacia certificacion/tramitador.
- La generacion documental desde Capa 3 normaliza valores precargados y
  editados antes de validar/generar, de modo que el boton `Generar DOCX`
  consume el mismo contrato matriz plantilla -> proceso -> variables -> fuentes
  que el resto del gestor documental.
- La certificacion se emite como evidencia demo/operativa si no existe una
  certificacion previa navegable.
- Ningun documento generado se declara evidencia final productiva.

Data contract:

- Tables used: `convocatorias`, `meetings`, `meeting_attendees`,
  `meeting_resolutions`, `meeting_votes`, `minutes`, `certifications`,
  `agreements`, `registry_filings`, `evidence_bundles`.
- Source of truth: Cloud.
- Owner records: convocatoria, reunion, acta, certificacion, acuerdo y tramite
  registral.
- Shared records: none new.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Evidence level: evidencia demo/operativa; no evidencia final productiva.
- Cross-module contracts: none new.
- Parity risk: medium; la prueba depende de permisos Cloud existentes para
  escrituras UI ya soportadas por el prototipo y de la cobertura Cloud real de
  rule packs. El fallback tecnico solo reduce friccion de prototipo; no cierra
  la deuda de aprobacion legal ni de paridad.

## Plan de retirada de fallbacks — paso de prototipo a produccion

El mapa operativo vive en
`src/lib/secretaria/fallback-retirement-plan.ts` y es puro/testeable. No consulta
Supabase ni activa migraciones. Su funcion es fijar que fallbacks existen, que
rule pack o plantilla Cloud deben sustituirlos y cuando puede considerarse
eliminado el fallback.

Fallbacks P0 actualmente inventariados:

- Plazos de convocatoria hardcodeados (`checkNoticePeriodByType`) -> rule packs
  Cloud con `convocatoria.antelacionDias` por materia y forma social.
- Quorum/mayoria genericos (`computeQuorumStatus`) -> rule packs Cloud con
  `constitucion` y `votacion` por materia, organo y tipo social.
- Fixtures locales de plantillas -> `plantillas_protegidas` Cloud aprobadas por
  Legal, con hash/protecciones/version formal.
- Hueco `CO_APROBACION` -> plantilla `ACTA_DECISION_CONJUNTA` Cloud aprobada.
- Hueco `SOLIDARIO` -> plantilla `ACTA_ORGANO_ADMIN` Cloud aprobada.
- `meetings.quorum_data.point_snapshots` como puente explicable -> escritura
  append-only en `rule_evaluation_results` cuando el punto tenga V2 Cloud
  completo (`rule_pack_version_id`, `payload_hash`, `ruleset_snapshot_id` y
  `agreement_id`).
- `MODELO_ACUERDO` activo sin aprobacion formal -> modelo Cloud aprobado con
  referencia LSC, organo, `AdoptionMode` y semver final.
- Censo demo no persistido -> `meeting_attendees` + mandatos/capital Cloud
  completos.
- `prototype-rule-pack-fallback.ts` -> `rule_pack_versions` activo compatible
  por materia/clase/organo.
- `prototype-registry-rule-fallback.ts` -> `rule_pack_versions.payload.postAcuerdo`
  activo por materia.

Rule packs v2.1 priorizados para seed controlado:

- P0: `DELEGACION_FACULTADES`, `DIVIDENDO_A_CUENTA`,
  `OPERACION_VINCULADA`, `AUTORIZACION_GARANTIA`.
- P1: `COOPTACION`, `CUENTAS_CONSOLIDADAS`, `INFORME_GESTION`,
  `EJECUCION_AUMENTO_DELEGADO`, `TRASLADO_DOMICILIO`,
  `PODERES_APODERADOS`, `NOMBRAMIENTO_AUDITOR`, `APROBACION_PRESUPUESTO`.
- P2: `WEB_CORPORATIVA`, `AUTOCARTERA`, `DISOLUCION_LIQUIDADORES`,
  `RATIFICACION_ACTOS`.

Decision de nomenclatura 2026-05-01: `AUTORIZACION_GARANTIA` es el pack/materia
canonico para garantias intragrupo en el prototipo. `GARANTIA_PRESTAMO` queda
como alias legacy aceptado con warning por `src/lib/secretaria/p0-controlled-thaw.ts`,
no como equivalencia silenciosa. Antes de retirar fallbacks deben limpiarse
duplicados `ACTIVE` y mantenerse el payload versionado como fuente juridica si
hay discrepancia con el catalogo.

Criterio de fallback eliminado:

1. `rule_pack_versions` existe activo con hash verificable.
2. El motor V2 consume el pack y produce explain/snapshot.
3. La plantilla Cloud relacionada esta aprobada por Legal.
4. El fixture/fallback equivalente esta retirado o marcado deprecated.
5. La funcion V1 equivalente se convirtio en wrapper V2 o fue eliminada.

Hasta que los cinco criterios se cumplan, el flujo puede ser prototipo operativo
pero no produccion juridica defendible.

Doble evaluacion V1/V2:

- Contrato puro: `src/lib/secretaria/dual-evaluation.ts`.
- Convocatorias:
  - V1 mantiene el criterio operativo de recordatorio de plazo.
  - V2 calcula regla Cloud, required days, canales, documentos y explain.
  - La comparacion se guarda en `convocatorias.rule_trace.dual_evaluation` y
    `convocatorias.reminders_trace.notice_period.dual_evaluation`.
- Reuniones:
  - V1 operativo conserva el resultado actual del prototipo con fallback tecnico
    si es necesario.
  - V2 estricto calcula con Cloud rule packs compatibles, sin crear fallback.
  - La comparacion se guarda en
    `meetings.quorum_data.point_snapshots[*].dual_evaluation`.
  - La fila WORM versionada se inserta en `rule_evaluation_results` solo si la
    traza del punto es `V2_CLOUD`; los puntos `PROTOTYPE_FALLBACK` no generan
    evidencia final.
- Divergencia no bloquea. Se trata como warning para revision legal/tecnica y
  como entrada para decidir cuando retirar fallbacks.

Data contract:

- Tables used: `rule_packs`, `rule_pack_versions`, `rule_param_overrides`;
  trazas existentes `convocatorias.rule_trace`,
  `convocatorias.reminders_trace`, `meetings.quorum_data`.
- Source of truth: Cloud para V2; V1 fallback operativo hasta retirada.
- Migration required: no.
- Types affected: no generated Supabase types.
- RLS/RPC/storage affected: no.
- Cross-module contracts: none new.
- Parity risk: medium; las divergencias son telemetry operativa, no evidencia
  final ni aprobacion legal.

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
