# Plan de integracion de informes y certificaciones

**Estado:** implementado localmente, aplicado en Cloud `governance_OS` y registrado en `supabase_migrations.schema_migrations` como `20260620045834 secretaria_informes_certificaciones`  
**Fecha:** 2026-06-20  
**Origen:** `Revisión_y_Mejora_del_Módulo_de_Gestión (1).docx` + plan W11 `2026-06-15-w11-generador-informes-preceptivos-plan.md`  
**Perimetro:** modulo `/secretaria/*`, Supabase `governance_OS`, tenant demo ARGA.

## 1. Decision de arquitectura

La integracion debe resolver dos lineas complementarias:

1. **Informes y documentos preceptivos por materia.**  
   Extiende W11: la exigibilidad nace en `rule_pack_versions.payload.documentacionPreceptiva`, el texto vive en `plantillas_protegidas` de tres capas, y la instancia generada se vincula al expediente de acuerdo, convocatoria, reunion, acta, certificacion, board pack y tramitador.

2. **Certificaciones autonomas.**  
   Nueva familia de certificados que no nacen necesariamente de un acta: libro de socios, transmisiones, extractos de actas, estado de legalizacion de libros, vigencia de cargos, cap table, autoridad certificante, comunicaciones y evidencias. No deben forzar `minute_id`, `agreements_certified[]` ni `canonical_minutes_hash`.

Regla central: **no estirar la tabla `certifications` actual para casos que no sean certificacion de acuerdos con acta o acuerdo sin sesion.** La certificacion autonoma necesita `source_domain`, `source_id`, `source_hash`, `certification_kind`, `cutoff_at`, `legal_effect` y politica de autoridad propia.

## 2. Activos existentes que se reutilizan

- `plantillas_protegidas`: fuente de verdad documental, tres capas y Gate PRE.
- `src/lib/motor-plantillas/*`: composicion, variables, borradores y validaciones.
- `src/lib/doc-gen/process-documents.ts`: tipos documentales `INFORME_PRECEPTIVO`, `INFORME_DOCUMENTAL_PRE` y archivado.
- `secretaria_document_drafts`: persistencia de borradores generados.
- `fn_generar_certificacion`: pipeline actual de certificacion desde `minutes`.
- `fn_generar_certificacion_acuerdo_sin_sesion`: patron para acuerdos sin sesion.
- `fn_firmar_certificacion` y `fn_emitir_certificacion`: firma demo, transicion y audit.
- `authority_evidence` + `capability_matrix`: capacidad certificante y autoridad.
- `DocumentosPendientesRevision.tsx`: bandeja que debe evolucionar para revisar informes generados.
- `document-generation-boundary.ts` y `agreement-document-contract.ts`: contratos de frontera documental.

## 3. Invariantes no negociables

- Exigibilidad documental solo en rule packs o perfil formal derivado; nunca en React ni en plantilla.
- Plantillas solo contienen texto y variables, no deciden si un documento es obligatorio.
- Deduplicacion antes de generar: un unico artefacto documental puede satisfacer varios requisitos.
- Versionado separado: version de instancia, version de plantilla y version/snapshot normativo.
- No borrar versiones previas: regenerar marca `SUPERSEDED` o crea anexo complementario.
- Certificaciones autonomas calculan `source_hash` sobre la fuente certificada; no fabrican `gate_hash` de acta.
- EAD Trust es el unico QTSP. Mientras QES/QSeal/TSQ/ERDS sigan en demo/sandbox, la UI debe decir `DEMO_OPERATIVA`, no evidencia cualificada productiva.
- Los roles `COMPLIANCE` y `AUDITOR` pueden leer, pero no emitir ni sustituir certificaciones.

## 4. Modelo de datos propuesto

### 4.1. Capa documental compartida

Crear una capa comun de artefactos para evitar duplicar hashes entre informes y certificaciones:

- `secretaria_document_artifacts`
  - `id`, `tenant_id`, `artifact_kind`
  - `template_id`, `template_version`
  - `title`, `status`, `version`
  - `document_url`, `mime_type`, `content_hash`, `hash_sha512`
  - `evidence_bundle_id`, `evidence_status`
  - `source_domain`, `source_id`, `source_hash`
  - `rule_pack_version_id`, `normative_snapshot_hash`
  - `generated_by`, `generated_at`, `reviewed_by`, `reviewed_at`

`artifact_kind` debe cubrir al menos `INFORME_PRECEPTIVO`, `INFORME_DOCUMENTAL_PRE`, `INFORME_GESTION`, `CERTIFICACION_AUTONOMA`, `CERTIFICACION_ACUERDO`, `ANEXO_EXTERNO`, `DOCUMENTO_REGISTRAL`.

### 4.2. Informes por acuerdo

- `agreement_document_requirements`
  - requisito calculado por materia y snapshot normativo.
  - campos: `agreement_id`, `matter_code`, `requirement_code`, `document_kind`, `required_level`, `blocking_policy`, `fase`, `legal_basis`, `annex_targets`, `evidence_policy`, `rule_pack_version_id`, `normative_snapshot_hash`, `status`.

- `agreement_document_links`
  - relacion M:N entre requisitos y artefactos.
  - necesario porque varias materias pueden exigir el mismo informe deduplicado.

- `document_annex_links`
  - anexa un artefacto a `convocatoria`, `meeting`, `minute`, `certification`, `standalone_certification`, `board_pack`, `registry_filing` o `agreement`.
  - campos: `artifact_id`, `linked_domain`, `linked_id`, `annex_role`, `annex_order`, `is_mandatory_annex`, `included_in_export`, `included_in_certification_bundle`.

### 4.3. Certificaciones autonomas

- `standalone_certification_kinds`
  - catalogo gobernado por Legal.
  - campos: `kind_code`, `label`, `source_domain`, `legal_effect`, `requires_visto_bueno`, `requires_rm_reference`, `requires_qes`, `template_binding_key`, `authority_policy`, `disclaimer_policy`.

- `standalone_certifications`
  - instancia emitida.
  - campos: `id`, `tenant_id`, `entity_id`, `body_id`, `kind_code`, `source_domain`, `source_id`, `source_payload`, `source_hash`, `cutoff_at`, `issued_to`, `legal_effect`, `certificante_role`, `authority_evidence_id`, `visto_bueno_persona_id`, `requires_visto_bueno`, `signature_status`, `artifact_id`, `evidence_bundle_id`, `status`.

Estados minimos: `DRAFT`, `SOURCE_LOCKED`, `GENERATED`, `SIGNED`, `EMITTED`, `SUPERSEDED`, `REVOKED`, `FAILED`.

## 5. Catalogo MVP de certificaciones

Implementar primero estas siete:

1. `CERT_LIBRO_SOCIOS_TITULARIDAD`
2. `CERT_LIBRO_SOCIOS_TRANSMISION`
3. `CERT_LIBRO_ACTAS_EXTRACTO`
4. `CERT_VIGENCIA_CARGO`
5. `CERT_LIBROS_LEGALIZACION`
6. `CERT_ACUERDO_SIN_SESION` (convergencia con RPC existente)
7. `CERT_DECISION_SOCIO_UNICO`

Segunda fase:

- `CERT_CAP_TABLE_FECHA`
- `CERT_MOVIMIENTOS_CAPITAL`
- `CERT_COMPOSICION_ORGANO`
- `CERT_AUTORIDAD_CERTIFICANTE`
- `CERT_REPRESENTANTE_PJ_ADMIN`
- `CERT_ENVIO_CONVOCATORIA`
- `CERT_DOCUMENTACION_DISPONIBLE`

Tercera fase:

- conflictos, delegaciones, poderes, pactos parasociales, comunicaciones regulatorias, fit & proper, Solvencia II, evidence bundle, expediente documental y board pack.

## 6. Librerias y servicios

### 6.1. Informes

Crear `src/lib/secretaria/document-requirements/`:

- `resolveDocumentRequirementsForAgreement(input)`
- `deduplicateDocumentRequirements(requirements)`
- `bindRequirementToTemplate(requirement, templates)`
- `buildDocumentRequirementExplainNodes(result)`
- `evaluateRequirementBlockingState(result)`

Salida obligatoria: requisitos normalizados, documentos deduplicados, fuentes normativas, severidad `OK/WARNING/BLOCKING`, plantilla sugerida y razon explicativa.

### 6.2. Certificaciones autonomas

Crear `src/lib/secretaria/standalone-certifications/`:

- `resolveStandaloneCertificationSource(kind, sourceInput)`
- `canonicalizeCertificationSource(payload)`
- `computeSourceHash(payload)`
- `resolveCertificationAuthority(kind, effect, entityId, bodyId)`
- `buildStandaloneCertificationExplainNodes(result)`

La fuente certificable debe venir de datos canonicos, no de Capa 3 manual. Capa 3 queda para alcance, destinatario, salvedades y motivo.

### 6.3. RPCs

Nuevas funciones recomendadas:

- `fn_prepare_standalone_certification_source(p_kind, p_source_input) -> jsonb`
- `fn_create_standalone_certification(p_kind, p_source_input, p_cutoff_at, p_issued_to, p_capa3) -> uuid`
- `fn_emit_standalone_certification(p_certification_id, p_artifact_id) -> text`
- `fn_supersede_standalone_certification(p_certification_id, p_reason) -> uuid`

No deben llamar internamente a `fn_generar_certificacion` salvo que el `kind` sea certificacion de acuerdo con acta.

## 7. Hooks

Nuevos hooks:

- `useAgreementDocumentRequirements(agreementId)`
- `useGenerateAgreementDocument(requirementId)`
- `useReviewAgreementDocument()`
- `useAttachDocumentArtifact()`
- `useAgreementDocumentBundle(agreementId)`
- `useStandaloneCertificationKinds(context)`
- `useStandaloneCertificationSource(kind, input)`
- `useCreateStandaloneCertification()`
- `useEmitStandaloneCertification()`
- `useStandaloneCertifications(filters)`

Todos con `tenant_id`, estados de carga/error y sin persistencia local simulada.

## 8. Superficies UI

### 8.1. Nuevas rutas

- `/secretaria/informes`
- `/secretaria/informes/:artifactId`
- `/secretaria/certificaciones`
- `/secretaria/certificaciones/nueva`
- `/secretaria/certificaciones/:id`

En sidebar Garrigues:

- bajo **Documentacion**: `Informes preceptivos` y `Certificaciones autonomas`.
- mantener `Certificaciones vinculadas` como vista de actas/acuerdos, no mezclarla con autonomas.

### 8.2. Entradas contextuales

- `LibroSocios.tsx`: emitir titularidad, transmision, cap table y movimientos.
- `LibrosObligatorios.tsx`: emitir extracto/indice/estado de legalizacion.
- `PersonasList.tsx` y `PersonaDetalle.tsx`: emitir vigencia de cargo, autoridad, representante PJ.
- `SociedadDetalle.tsx`: panel de certificaciones de sociedad.
- `ExpedienteAcuerdo.tsx`: panel documental consolidado y anexos.
- `ActaDetalle.tsx`: anexos obligatorios y certificacion de acuerdo.
- `ConvocatoriasStepper.tsx`: documentacion preceptiva antes de emision.
- `ReunionStepper.tsx`: gate documental antes de votacion/cierre.
- `TramitadorStepper.tsx`: soporte documental registral.
- `BoardPack.tsx` y `BoardPackPreview.tsx`: indice de informes, certificados y hashes.
- `DocumentosPendientesRevision.tsx`: pasar de schema gate a bandeja real de revision.

### 8.3. Wizard de certificacion autonoma

Pasos:

1. Tipo y contexto.
2. Fuente canonica y fecha de corte.
3. `source_hash` y resumen certificable.
4. Plantilla de tres capas.
5. Capa 3: alcance, destinatario, salvedades, motivo.
6. Preview y advertencias.
7. Autoridad, Vº Bº y efecto declarado.
8. Generacion DOCX, SHA-512, archivado, evidence bundle y auditoria.

Implementacion local actual:

- `useGenerateStandaloneCertificationDocument` genera el DOCX antes de emitir si el artefacto no tiene `document_url`, SHA-512 y `evidence_bundle_id`.
- `archiveStandaloneCertificationDocument` guarda el DOCX en `matter-documents`, crea `evidence_bundles` con `source_object_type=STANDALONE_CERTIFICATION` y enlaza el artefacto.
- `fn_emit_standalone_certification` mantiene la responsabilidad SQL de congelar estado, anexos y `annex_manifest_hash`.

## 9. Integracion con gates

Orden recomendado:

1. **Modo informativo.** Mostrar requisitos y certificados disponibles sin bloquear flujos actuales.
2. **Warnings.** Activar `WARNING` y `OVERRIDE_REQUIRED` por materias validadas.
3. **Bloqueos.** Activar `BLOCKING` solo tras matriz Legal por materia.
4. **Certificacion con anexos.** `EmitirCertificacionButton` debe verificar anexos obligatorios antes de certificar.
5. **Hash de anexo.** El `gate_hash` de certificacion de acuerdos debe incorporar un `annex_manifest_hash` cuando el rule pack declare anexos obligatorios para certificacion.
6. **Tramitador.** Los documentos con `annex_targets` que incluyan `REGISTRO` deben viajar al expediente registral sin duplicar archivo.

## 10. Dependencias de Legal

Bloqueantes para activar exigibilidad real:

- Matriz por materia: `materia -> documento -> tipo -> nivel -> blocking_policy -> fase -> annex_targets -> evidencia/firma -> referencia legal`.
- Catalogo `standalone_certification_kinds`: autoridad, Vº Bº, RM, efecto, disclaimer y fuente canonica.
- Plantillas de tres capas para los siete certificados MVP.
- Decision de si `CERT_LIBRO_ACTAS_EXTRACTO` para auditor requiere Vº Bº o solo secretario.
- Decision de efecto de certificados en cotizadas: advertencias Iberclear/CNMV cuando aplique.

No bloquea la implementacion tecnica de tablas, librerias, hooks ni UI informativa.

## 11. Plan de ejecucion

### F0 - Preflight

- Ejecutar `bun run db:check-target` y confirmar `governance_OS`.
- Confirmar migraciones enlazadas con `supabase migration list --linked`.
- Inventariar plantillas activas de `INFORME_PRECEPTIVO`, `INFORME_DOCUMENTAL_PRE`, `INFORME_GESTION` y `CERTIFICACION`.
- Confirmar existencia real de `authority_evidence`, `mandatory_books`, `capital_holdings`, `capital_movements`, `minutes`, `communications`.

### F1 - Base de datos

- Crear tablas compartidas y RLS.
- Crear catalogo MVP de certificaciones.
- Crear RPCs de preparacion/emision de certificacion autonoma.
- Añadir pruebas de schema para tablas y RPCs.

### F2 - Motor de informes

- Implementar `document-requirements`.
- Añadir payload `documentacionPreceptiva` en rule packs demo solo en modo informativo.
- Persistir requisitos en `agreement_document_requirements`.
- Testear deduplicacion, plantilla ausente, override y versionado.

### F3 - Generacion y anexado

- Reutilizar motor de plantillas/doc-gen para crear `secretaria_document_artifacts`.
- Implementar anexado a convocatoria, acta, certificacion, board pack y tramitador.
- Evolucionar `DocumentosPendientesRevision.tsx` a bandeja real.

### F4 - Certificaciones autonomas MVP

- Implementado: libreria `standalone-certifications`, wizard/pagina de gestion y botones contextuales en libro de socios, libros obligatorios y personas/cargos.
- Implementado: emision demo con `source_hash`, DOCX, SHA-512, `evidence_bundles` y `source_object_type=STANDALONE_CERTIFICATION`.
- Validado en Cloud: certificacion autonoma real `CERT_LIBROS_LEGALIZACION` emitida contra ARGA Seguros S.A. con fuente `mandatory_books`, 19 filas fuente, `source_hash` SHA-256, artefacto `ARCHIVED`, `hash_sha512` de 128 caracteres, anexo congelado y eventos `STANDALONE_CERT_SOURCE_LOCKED` + `STANDALONE_CERT_EMITIDA`.
- Validado contra el DOCX de revision: las tablas del informe proponen 40 codigos `CERT_*`; la migracion incluye los 40 y añade `CERT_ACUERDO_360` como extension para el expediente Agreement 360.
- Ledger Cloud reconciliado: `supabase migration repair 20260620045834 --status applied --linked` registro la migracion con nombre `secretaria_informes_certificaciones`, 97 statements y 79.935 caracteres de SQL en `supabase_migrations.schema_migrations`.

### F5 - Integracion profunda

- Incluir anexos obligatorios en certificacion de acuerdos.
- Añadir `annex_manifest_hash` al calculo de certificacion cuando aplique.
- Board Pack exporta indice documental con hashes.
- Tramitador consume artefactos `REGISTRO` sin duplicar.

### F6 - Bloqueos y cierre demo

- Activar bloqueos por materia tras aprobacion Legal.
- Añadir datos demo ARGA para golden paths:
  - informe preceptivo generado y anexado a convocatoria.
  - acta con anexo documental congelado.
  - certificacion con anexo obligatorio.
  - certificado de titularidad libro de socios.
  - certificado de vigencia de cargo.
  - certificado de estado de legalizacion de libros.

## 12. Pruebas

- Unitarias:
  - `resolveDocumentRequirementsForAgreement`
  - deduplicacion M:N requisito-documento
  - `resolveStandaloneCertificationSource`
  - `computeSourceHash` determinista
  - autoridad y Vº Bº por `certification_kind`

- Schema:
  - tablas nuevas con `tenant_id` y RLS.
  - RPCs existen y no devuelven `function does not exist`.
  - `source_hash` no nulo en certificaciones autonomas emitidas.

- Integracion:
  - convocatoria -> informe -> reunion -> acta -> certificacion -> tramitador.
  - mismo `artifact_id` anexado a varios dominios.
  - regeneracion deja version previa `SUPERSEDED`.
  - certificacion autonoma no usa `minute_id` ni `canonical_minutes_hash`.

- E2E:
  - emitir certificado de titularidad desde Libro de socios.
  - emitir extracto de actas desde Libros obligatorios.
  - emitir vigencia de cargo desde Personas.
  - verificacion hash y descarga desde `/secretaria/certificaciones`.

Comandos de cierre: `bun run test`, `bun run typecheck`, `bun run build` y smoke E2E focalizado.

### 12.1 Evidencia de cierre 2026-06-20

- `bun run db:check-target`: OK contra `governance_OS` (`hzqwefkwsxopwrmtksbg`).
- Cloud schema: 6/6 tablas nuevas presentes con RLS activo:
  `secretaria_document_artifacts`, `agreement_document_requirements`, `agreement_document_links`,
  `document_annex_links`, `standalone_certification_kinds`, `standalone_certifications`.
- Catalogo demo: 41 `standalone_certification_kinds` activas para tenant ARGA.
- RPCs Cloud presentes: `fn_prepare_standalone_certification_source`,
  `fn_create_standalone_certification`, `fn_emit_standalone_certification`,
  `fn_supersede_standalone_certification`, `fn_refresh_agreement_document_requirements`
  y helpers `fn_secretaria_*`.
- Smoke autenticado con `demo@arga-seguros.com`: `fn_prepare_standalone_certification_source`
  para `CERT_LIBROS_LEGALIZACION` devuelve fuente `mandatory_books`, 19 filas y hash SHA-256.
- Smoke end-to-end autenticado: creada y emitida certificacion autonoma
  `82024b03-4182-497f-93cb-c8de5e286b50`; artefacto
  `82c06273-c13b-47dd-b38b-3b4127122267` archivado con `hash_sha512`,
  anexo incluido en bundle y auditoria WORM registrada.
- Validacion local previa a Cloud: suite completa Vitest 709 suites / 2228 tests / 0 fallos,
  `bun run typecheck`, `bun run build`, `git diff --check` y grep UX Garrigues sin violaciones.
- Ledger de migracion: `20260620045834` presente en `supabase_migrations.schema_migrations`
  con nombre `secretaria_informes_certificaciones`, 97 statements y `supabase migration list --linked`
  muestra `20260620045834 | 20260620045834`.
- Limitacion operativa residual: `supabase db push --linked --dry-run` no es usable en este momento por
  `SUPABASE_DB_PASSWORD` ausente y divergencia historica remota/local en migraciones del 13-14 de junio.
  La migracion de informes/certificaciones ya no forma parte de ese drift.

## 13. Criterios de aceptacion

- Un punto decisorio calcula documentos preceptivos por materia y muestra origen normativo.
- Un informe preceptivo se genera desde plantilla de tres capas, se archiva con SHA-512 y se anexa sin duplicar.
- Una certificacion de acuerdo no se emite si falta anexo obligatorio `BLOCKING`.
- Una certificacion autonoma se emite desde fuente canonica con `source_hash` propio.
- La UI distingue certificacion vinculada a acta/acuerdo de certificacion autonoma.
- La evidencia demo se etiqueta como demo operativa, nunca como cualificada productiva.
- Auditor y Compliance pueden consultar certificados y hashes, pero no emitir ni sustituir.

## 14. Riesgos

- **Falta matriz Legal:** mitigar con modo informativo y no activar bloqueos.
- **Duplicar logica documental:** mitigar con libreria headless y snapshots.
- **Confundir certificado autonomo con registral:** mitigar con `legal_effect`, disclaimers y tabla separada.
- **Regenerar documentos cerrados:** mitigar con `SUPERSEDED` y anexos complementarios.
- **Datos legacy:** source_hash debe leer modelo canonico y advertir si detecta fuentes legacy o incompletas.

## 15. Primer sprint recomendado

Sprint 1 debe limitarse a base comun y MVP visible:

1. Migracion con `secretaria_document_artifacts`, `agreement_document_requirements`, `agreement_document_links`, `document_annex_links`, `standalone_certification_kinds`, `standalone_certifications`.
2. Librerias headless de informes y certificaciones con tests.
3. UI informativa en `ExpedienteAcuerdo` y nueva pagina `/secretaria/certificaciones`.
4. MVP `CERT_LIBRO_SOCIOS_TITULARIDAD` y `CERT_VIGENCIA_CARGO`.
5. Sin bloqueos `BLOCKING` productivos hasta matriz Legal.
