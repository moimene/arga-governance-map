# Lane smoke verification — AIMS-GRC y Secretaria

Fecha: 2026-04-29
Scope: verificacion funcional focalizada sin cambios de schema.

## Objetivo

Validar que los carriles principales pueden seguir construyendo sobre el Supabase actual:

- AIMS-GRC: navegacion, dashboards y pantallas core.
- Secretaria: convocatoria -> reunion -> acuerdo -> acta/certificacion/documento.

## Test añadido

Archivo: `e2e/16-sanitization-smoke.spec.ts`

El test:

- navega rutas core de AIMS, GRC y Secretaria;
- comprueba que no hay redirect a login;
- detecta mensajes de fallo tipicos de schema/RLS/RPC en UI;
- abre registros demo existentes cuando son necesarios para validar detalle;
- no aplica migraciones ni regenera tipos.

## Matriz de cobertura

| Carril | Rutas / flujo | Tipo de fallo que detecta | Mutacion esperada |
|---|---|---|---|
| AIMS | `/ai-governance`, `/sistemas`, `/evaluaciones`, `/incidentes` | tipos, RLS, datos demo, UI | Ninguna |
| GRC | `/grc`, `/risk-360`, `/packs`, `/mywork`, `/alertas`, `/excepciones` | tipos, RLS, datos demo, UI | Ninguna |
| Secretaria convocatoria | lista y primer detalle | datos demo, tipos, RLS, botones documentales | Ninguna |
| Secretaria reunion | lista y primer detalle | datos demo, tipos, RLS, stepper/detail UI | Ninguna |
| Secretaria acuerdo | `/secretaria/acuerdos-sin-sesion/nuevo` | tipos, datos base, UI del asistente | Ninguna si no se guarda |
| Secretaria acta/certificacion | lista y primer detalle | datos demo, RPC-related UI, botones doc/cert | Ninguna |
| Secretaria documento | `/secretaria/gestor-plantillas` | plantillas, tipos, UI documental | Ninguna |

Nota: se evita usar la lista de acuerdos sin sesion como prueba principal porque esa pantalla puede ejecutar `fn_cerrar_votaciones_vencidas` al montar. La ruta del asistente cubre el carril de acuerdo sin disparar cierre automatico.

## Taxonomia de fallos

| Sintoma | Causa probable | Recomendacion |
|---|---|---|
| Redirect a `/login` | Auth/session demo | Fix UI/auth fixture, no schema. |
| `relation/column/function does not exist` | Paridad schema/tipos/RPC | Preparar migracion no destructiva y pedir aprobacion. |
| `permission denied` o `row-level security` | RLS/grants | Revisar policy minima del owner; no parchear masivamente. |
| Pagina renderiza pero sin filas criticas | Datos demo incompletos | Seed/backfill demo con aprobacion, no schema. |
| Boton documental ausente en detalle | UI/contrato documental o datos incompletos | Primero fix UI/guard; solo schema si falta columna/RPC probada. |
| ErrorBoundary o pantalla en blanco | UI/runtime | Fix UI local; no tocar Supabase salvo error de contrato. |

## Bloqueos Supabase separados

| Bloqueo | Estado |
|---|---|
| `000049_grc_evidence_legal_hold` | HOLD absoluto |
| Auth leaked password protection | Pendiente en Dashboard Supabase |
| Performance advisors | Backlog; no bloquean smoke |
| Local/remote migration history drift | Documentado; no usar `db push` |

## Resultado de ejecucion

Ejecutado en este turno:

```bash
bun run db:check-target
bunx tsc --noEmit
bunx eslint e2e/16-sanitization-smoke.spec.ts
bunx playwright test e2e/16-sanitization-smoke.spec.ts --project=chromium
bun run build
```

Resultado:

| Verificacion | Resultado | Lectura |
|---|---:|---|
| Target Supabase | Verde | CLI/app/MCP apuntan a `governance_OS` (`hzqwefkwsxopwrmtksbg`). |
| TypeScript | Verde | El smoke y el codigo actual compilan con `tsc --noEmit`. |
| Lint focalizado smoke | Verde | `e2e/16-sanitization-smoke.spec.ts` sin errores. |
| Playwright smoke | Verde | 3/3 tests: setup, AIMS-GRC y Secretaria. |
| Build | Verde | `vite build` limpio; solo warning de chunk size/browserlist. |

Lint global no queda verde por deuda preexistente ajena a este smoke:

- `src/lib/secretaria/legal-template-normalizer.ts:481` — `no-useless-escape`.
- 24 warnings existentes de fast-refresh/hooks.

## Fallos detectados

No hay fallos funcionales en el smoke focalizado.

## Bloqueos Supabase observados por smoke

Ninguno. Las rutas probadas no muestran errores de columnas, relaciones, RPC inexistentes, permisos ni RLS.

## Recomendacion fix UI vs fix schema

- AIMS-GRC: puede seguir con UI/docs/tests contra tablas confirmadas; no requiere fix schema ahora.
- Secretaria: puede seguir construyendo flujo funcional; no requiere fix schema ahora.
- Lint global: fix UI/codigo local, no schema.
- Advisors Supabase: tratar fuera del carril funcional salvo aprobacion explicita.

## Tanda posterior — Secretaria Acta / Certificacion / Acuerdo 360

Fecha: 2026-04-29

Se ha avanzado el flujo de acta y certificacion sin tocar schema ni persistencia:

- `buildCertificationPlan` separa referencias canónicas `agreement_id` de referencias estables por punto (`meeting:{id}:point:{n}`).
- El detalle de acta muestra readiness de Acuerdo 360: certificables, acuerdos materializados, referencias por punto y alertas contractuales.
- Las variables documentales de acta/certificacion incluyen `agreement_ids`, `canonical_agreement_ids`, `certification_point_refs` y `certification_reference_details`.
- Si una certificacion se basa en puntos sin `agreement_id`, la UI lo permite como referencia operativa, pero advierte que no debe tratarse como evidencia final productiva ni tramitacion registral hasta materializar el Acuerdo 360 canónico.

Contrato de datos de esta tanda:

- Tablas leidas: `minutes`, `meetings.quorum_data`, `meeting_resolutions`, `certifications`.
- RPCs consumidas por boton existente: `fn_generar_certificacion`, `fn_firmar_certificacion`, `fn_emitir_certificacion`.
- Source of truth: Cloud.
- Migracion requerida: no.
- Tipos/RLS/RPC/storage: no modificados.
- Riesgo de paridad: bajo/medio, limitado a datos demo que no tengan snapshots por punto o `agreement_id` materializado.

Verificacion:

- `bun run db:check-target`: verde contra `governance_OS`.
- Unit tests focalizados de certificacion/document contract: verde.
- `bunx tsc --noEmit --pretty false`: verde.
- `bun run build`: verde.
- `e2e/16-sanitization-smoke.spec.ts` en Vite aislado `5182`: verde.

Nota operativa: un primer intento de Playwright contra `5173` fallo porque reutilizo un servidor ajeno (`Persona Tax`) y no el repo actual. La repeticion con `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5182` paso correctamente.

## Tanda posterior — Materializacion Acuerdo 360 desde acta

Fecha: 2026-04-29

Se ha cerrado el siguiente corte funcional de Secretaria sin tocar schema:

- El detalle de acta permite materializar un punto certificable sin `agreement_id` como Acuerdo 360 canónico.
- La accion es idempotente: si ya existe un acuerdo para `parent_meeting_id + agenda_item_index`, lo actualiza/enlaza; si no existe, lo crea en `agreements`.
- La resolucion queda enlazada en `meeting_resolutions.agreement_id`.
- No se modifica la certificacion ya emitida: si `certifications.agreements_certified` conserva una referencia `meeting:{id}:point:{n}`, el intake del tramitador la resuelve dinamicamente contra `meeting_resolutions.agreement_id`.
- El tramitador diferencia referencias por punto no resueltas de referencias ya resueltas a Acuerdo 360.

Contrato de datos de esta tanda:

- Tablas leidas: `minutes`, `meetings.quorum_data`, `meeting_resolutions`, `certifications`, `agreements`.
- Tablas escritas: `agreements`, `meeting_resolutions.agreement_id`.
- Source of truth: Cloud.
- Migracion requerida: no.
- Tipos/RLS/RPC/storage: no modificados.
- Cross-module contracts: ninguno nuevo.
- Riesgo de paridad: medio si RLS impide `insert/update` sobre `agreements` o `meeting_resolutions`; el smoke de navegacion no ejecuta la mutacion.

Verificacion:

- `bun run db:check-target`: verde contra `governance_OS`.
- Unit tests focalizados: `certification-registry-intake`, `certification-snapshot`, `agreement-360`: verde.
- `bunx tsc --noEmit --pretty false`: verde.
- `bun run build`: verde.
- `e2e/16-sanitization-smoke.spec.ts` en Vite aislado `5182`: verde.

Bloqueo potencial clasificado:

- Tipo: RLS/datos demo, no schema.
- Ruta: `/secretaria/actas/:id`.
- Accion: boton "Materializar Acuerdo 360".
- Si falla en entorno real, capturar error exacto de `agreements.insert/update` o `meeting_resolutions.update` y decidir fix UI vs policy aprobada. No aplicar cambios RLS sin aprobacion explicita.

## Tanda posterior — Postura probatoria documental demo-safe

Fecha: 2026-04-29

Se ha reforzado el contrato documental sin tocar storage/policies/schema:

- `agreement-document-contract` clasifica cada documento por postura probatoria:
  - documento PRE operativo;
  - documento final sin `agreement_id`;
  - listo para archivo;
  - bundle demo archivado no final;
  - no evidencia.
- Los DOCX generados incorporan en el footer `Postura probatoria`, `Evidencia final productiva: no` y la razon.
- `ProcessDocxButton` muestra en el tooltip/toast la postura probatoria y evita llamar "evidencia final productiva" a un bundle operativo.
- Un documento archivado en `matter-documents` + `evidence_bundles` sigue siendo evidencia demo/operativa, no evidencia final productiva, hasta cerrar audit/retention/legal hold.

Contrato de datos de esta tanda:

- Tablas leidas/escritas nuevas: ninguna.
- Tablas usadas por flujo existente al generar: `evidence_bundles`, `certifications.evidence_id`, `agreements.document_url`, storage bucket `matter-documents`.
- Source of truth: Cloud.
- Migracion requerida: no.
- Tipos/RLS/RPC/storage: no modificados.
- Cross-module contracts: ninguno nuevo.
- Riesgo de paridad: bajo; el cambio es contrato puro + copy/footer/toast.

Verificacion:

- `bun run db:check-target`: verde contra `governance_OS`.
- Unit tests focalizados: `agreement-document-contract`, `process-documents`, `template-renderer`: verde.
- `bunx tsc --noEmit --pretty false`: verde.
- `bun run build`: verde.
- `e2e/16-sanitization-smoke.spec.ts` en Vite aislado `5182`: verde.

## Tanda posterior — Seguridad de lenguaje probatorio

Fecha: 2026-04-29

Se ha cerrado una pasada de endurecimiento sobre UI, contratos y documentacion para evitar que el demostrador llame "evidencia final productiva" a artefactos operativos:

- El dashboard de Secretaria etiqueta niveles documentales como postura probatoria demo/operativa o "sin evidencia final productiva".
- Los toasts de generacion DOCX y emision de certificaciones distinguen evidencia demo/operativa de evidencia final productiva.
- La clasificacion documental mantiene `finalEvidence = false` para todos los estados actuales, incluso con bundle archivado.
- El contrato de datos de Secretaria y el contrato cross-module explicitan que `evidence_bundles`, storage y DOCX generados no son evidencia final productiva hasta cerrar audit/retention/legal hold.

Contrato de datos de esta tanda:

- Tablas leidas/escritas nuevas: ninguna.
- Tablas usadas por flujo existente: `evidence_bundles`, `certifications.evidence_id`, `agreements.document_url`.
- Source of truth: Cloud.
- Migracion requerida: no.
- Tipos/RLS/RPC/storage: no modificados.
- Cross-module contracts: ninguno nuevo.
- Riesgo de paridad: bajo; cambios de copy, tests y contrato puro.

Verificacion:

- `bun run db:check-target`: verde contra `governance_OS`.
- `bun test src/lib/secretaria/__tests__/agreement-document-contract.test.ts src/lib/doc-gen/__tests__`: verde, 25/25.
- `bunx tsc --noEmit --pretty false`: verde.
- `bun run build`: verde; warnings conocidos de Browserslist/chunk size.
- `e2e/16-sanitization-smoke.spec.ts` en Vite aislado `5182`: verde, 3/3.

## Tanda posterior — Diagnostico interno de readiness documental

Fecha: 2026-04-29

Se ha conectado el gate futuro a la generacion documental solo como diagnostico interno:

- Nuevo adapter puro: `src/lib/doc-gen/process-document-readiness.ts`.
- `generateProcessDocx()` devuelve `finalEvidenceReadiness` calculado desde `agreementTrace`, `evidencePosture`, `archive` y `contentHash`.
- El adapter no marca ningun artefacto actual como `FINAL_PROMOTION_CANDIDATE`; por defecto preserva la postura demo/operativa.
- Un DOCX archivado con hash y bundle demo sigue devolviendo `ready = false` y `finalProductiveEvidence = false` si faltan audit, retention, legal hold, politica probatoria y aprobacion explicita.
- No se ha añadido UI visible, boton, RPC, storage write ni evento cross-module para promocion.

Contrato de datos de esta tanda:

- Tablas leidas/escritas nuevas: ninguna.
- Tablas usadas por flujo existente: `evidence_bundles`, `certifications.evidence_id`, `agreements.document_url`.
- Source of truth: Cloud para flujos existentes; adapter puro sin lectura Cloud.
- Migracion requerida: no.
- Tipos/RLS/RPC/storage: no modificados.
- Cross-module contracts: ninguno nuevo operativo.
- Riesgo de paridad: bajo; diagnostico interno sin mutaciones.

Verificacion:

- `bun run db:check-target`: verde contra `governance_OS`.
- `bun test src/lib/secretaria/__tests__/agreement-document-contract.test.ts src/lib/secretaria/__tests__/final-evidence-readiness-contract.test.ts src/lib/doc-gen/__tests__`: verde, 36/36.
- `bun test src/lib/secretaria/__tests__/sanitized-flow-contracts.test.ts`: verde, 4/4.
- `bunx tsc --noEmit --pretty false`: verde.
- `bun run build`: verde; warnings conocidos de Browserslist/chunk size.
- `e2e/16-sanitization-smoke.spec.ts` en Vite aislado `5182`: primer intento con timeout ambiental en `/login`; repeticion verde, 3/3.

## Tanda posterior — Cierre UX probatorio Actas/Tramitador

Fecha: 2026-04-29

Se ha cerrado la nomenclatura funcional en los puntos finales del flujo:

- Acta detalle ya no muestra `FINAL_READY` como final probatorio: lo expresa como "Acuerdo 360 enlazado; evidencia no final productiva".
- Los chips de certificacion hablan de "Bundle demo vinculado" o "Evidencia operativa pendiente".
- El tramitador usa "Vínculo probatorio operativo de certificación" para evitar confundir audit/linking demo con evidencia final productiva.
- No se ha añadido UI de promocion final, boton, mutacion, RPC, storage write ni evento cross-module.

Contrato de datos:

- Tablas leidas/escritas nuevas: ninguna.
- Source of truth: Cloud para flujos existentes.
- Migracion requerida: no.
- Tipos/RLS/RPC/storage: no modificados.
- Cross-module contracts: ninguno nuevo operativo.
- Riesgo de paridad: bajo; cambios de lenguaje UI.

Verificacion:

- `bun run db:check-target`: verde contra `governance_OS`.
- `bun test src/lib/secretaria/__tests__/agreement-document-contract.test.ts src/lib/secretaria/__tests__/final-evidence-readiness-contract.test.ts src/lib/doc-gen/__tests__`: verde, 36/36.
- `bun test src/lib/secretaria/__tests__/sanitized-flow-contracts.test.ts src/lib/secretaria/__tests__/certification-snapshot.test.ts src/lib/secretaria/__tests__/certification-registry-intake.test.ts`: verde, 13/13.
- `bunx tsc --noEmit --pretty false`: verde.
- `bun run build`: verde; warnings conocidos de Browserslist/chunk size.
- `e2e/16-sanitization-smoke.spec.ts` en Vite aislado `5182`: verde, 3/3.

## Tanda posterior — Gate futuro de promocion probatoria

Fecha: 2026-04-29

Se ha definido un contrato puro para evaluar readiness futura de evidencia final productiva sin activar promocion:

- Nuevo modulo: `src/lib/secretaria/final-evidence-readiness-contract.ts`.
- El contrato es cerrado por defecto: entradas vacias, desconocidas o parciales devuelven `ready = false`.
- Las posturas demo/operativas actuales no promocionan por implicacion, aunque existan storage, hash o bundle.
- La readiness positiva exige artefacto marcado como `FINAL_PROMOTION_CANDIDATE`, owner record, storage, hash, bundle, audit, retention, legal hold, politica probatoria y aprobacion explicita.
- El resultado es solo clasificacion: no muta, no persiste, no llama RPC/storage y no crea eventos cross-module.

Contrato de datos de esta tanda:

- Tablas leidas/escritas nuevas: ninguna.
- Source of truth: Cloud para los flujos existentes; este contrato es puro y no lee Cloud.
- Migracion requerida: no.
- Tipos/RLS/RPC/storage: no modificados.
- Cross-module contracts: ninguno nuevo operativo.
- Riesgo de paridad: bajo; la promocion real queda como contrato futuro no activado.

Verificacion:

- `bun run db:check-target`: verde contra `governance_OS`.
- `bun test src/lib/secretaria/__tests__/agreement-document-contract.test.ts src/lib/secretaria/__tests__/final-evidence-readiness-contract.test.ts src/lib/doc-gen/__tests__`: verde, 35/35.
- `bun test src/lib/secretaria/__tests__/sanitized-flow-contracts.test.ts`: verde, 4/4.
- `bunx tsc --noEmit --pretty false`: verde.
- `bun run build`: verde; warnings conocidos de Browserslist/chunk size.
- `e2e/16-sanitization-smoke.spec.ts` en Vite aislado `5182`: verde, 3/3.
