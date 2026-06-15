# W11 — Generador de Informes y Documentos Preceptivos por Materia (plan)

**Estado:** propuesto · **Origen:** memo Comité Legal junio 2026 (`Downloads/provisional generador md`, líneas 130-392) · **Fecha:** 2026-06-15

Nuevo submódulo (NO estaba en el backlog de los 9). El spec funcional completo lo redactó el Comité Legal; este documento es el plan de ejecución y, sobre todo, fija el **bloqueo de entrada**.

## Veredicto de ingeniería
El diseño es **sólido y coherente** con la arquitectura existente: la exigibilidad vive en los rule packs (no en plantillas ni UI), el texto en `plantillas_protegidas` (3 capas + Gate PRE), la evidencia con SHA-512, deduplicación por unión, y separa los cuatro planos — **requisito / plantilla / instancia generada / anexo**. NO crea un sistema paralelo: extiende motor + plantillas + doc-gen + expediente.

## Bloqueo de entrada (antes de implementar)
El propio spec lo reconoce (línea 304): **Legal debe entregar la matriz de exigibilidad por materia** — qué documentos son `OBLIGATORIO` / `OBLIGATORIO_SI_APLICA` / `RECOMENDADO` / `INFORMATIVO`, su `blocking_policy`, su `fase` (PRE_CONVOCATORIA/CONVOCATORIA/PRE_REUNION/REUNION/POST_ACUERDO/CERTIFICACION/REGISTRO) y su `annex_targets`, por cada materia societaria. Sin esa matriz el generador no tiene contenido jurídico que evaluar. **No se implementa la lógica de exigibilidad hasta recibirla.**

## Fases
1. **F0 — BD (idempotente):** tablas `agreement_document_requirements`, `agreement_documents`, `document_annex_links` (con `tenant_id` + RLS); FKs a agreements/plantillas_protegidas/convocatorias/meetings/minutes/certifications/registry_filings; índices. Resumen documental en `agreements.compliance_snapshot`.
2. **F1 — Librería pura `src/lib/secretaria/document-requirements/`:** `resolveDocumentRequirementsForAgreement(input)` headless + testeada (dedup por `requirement_code`, resolución de plantilla por clave funcional, nodos OK/WARNING/BLOCKING). Sin React.
3. **F2 — Rule packs:** sección `documentacionPreceptiva` versionada (atada a `rule_pack_versions` + snapshot). **Poblada por Legal** (la matriz).
4. **F3 — Motor:** `evaluarDocumentacionPreceptiva` dentro de la fase documental del orquestador → `compliance_snapshot`/`compliance_explain`.
5. **F4 — Hooks:** `useAgreementDocumentRequirements`, `useGenerateAgreementDocument`, `useReviewAgreementDocument`, `useAttachDocumentToDomain`, `useAgreementDocumentBundle` (reutilizan resolver de variables + archivero existentes).
6. **F5 — UI progresiva (no bloqueante primero):** panel informativo en ConvocatoriasStepper/ReunionStepper/ActaDetalle/ExpedienteAcuerdo/BoardPack/TramitadorStepper/DocumentosPendientesRevision; bloqueos `BLOCKING` se activan **después**, cuando Legal confirme por materia.

## Invariantes (del spec, no negociables)
- Exigibilidad SOLO en rule packs; UI consume, no decide.
- Una sola instancia documental compartida por varios requisitos (dedup); múltiples vínculos jurídicos.
- Versionado en 3 dimensiones: instancia / plantilla / `rule_pack_version`+`normative_snapshot_hash`.
- Frontera de confianza: sin firma QTSP real → `evidence_status = DEMO_OPERATIVA`; fail-closed, sin sintetizar hashes/firmas.
- Regeneración → versión anterior `SUPERSEDED`, nunca se borra; no altera artefactos ya cerrados (acta firmada/certificación/bundle).

## Riesgo
Activar bloqueos demasiado pronto rompería flujos operativos hoy válidos → **panel informativo primero, bloqueos por materia después**. No convertir documentos externos (experto/auditor/notario) en plantillas internas: el modelo admite documentos aportados con origen/hash/evidencia.

## Siguiente paso
Solicitar a Legal la **matriz de exigibilidad por materia** (plantilla de respuesta: materia → documento → tipo → nivel → blocking_policy → fase → annex_targets → firma requerida). Con ella, F0-F1 son arrancables.
