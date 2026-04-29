# 2026-04-27 — Demo-Operable Roadmap Sprints 1-4

## Propósito

Este documento convierte el addendum PRD de **Modo Demo-Operable** en una hoja de ruta ejecutable para cuatro sprints.

Objetivo: preparar una demo comercial determinista, navegable y jurídicamente coherente del vertical:

```text
Convocatoria -> Sesión -> Gate -> Acta -> Certificación -> Evidencia
```

La demo debe permitir vender y validar la visión TGMS/ARGA mientras se cierran paridad Supabase, WORM, QES productivo y cadena probatoria completa.

## Fuentes de decisión

- `docs/superpowers/plans/2026-04-27-demo-operable-prd-addendum.md`
- `docs/superpowers/plans/2026-04-27-arga-console-erp-shell-architecture.md`
- `docs/superpowers/plans/2026-04-27-ruflo-supabase-architecture-mission.md`

## Alcance de esta tarea

Este roadmap nació como entregable de documentación y ahora actúa también como registro de ejecución incremental de la capa Demo-Operable.

- Archivo creado: `docs/superpowers/plans/2026-04-27-demo-operable-roadmap.md`.
- Los sprints ejecutados documentan código local cuando aplica.
- No se editan migraciones.
- No se ejecutan writes en Supabase Cloud.
- No se aplican migraciones locales ni remotas.
- No se regeneran tipos.
- No se revierte ningún cambio paralelo del worktree.

## Principios operativos

1. **Demo no es fake.** Demo = simulación controlada con evidencia trazable.
2. **Demo-Operable no es un quinto dominio.** Es capa de ejecución, dataset, narrativa y simulación segura.
3. **Bounded contexts intactos.** Secretaría, GRC y AIMS conservan sus fuentes de verdad y lógica propietaria.
4. **La consola orquesta, no decide.** ARGA Console puede seleccionar escenarios, mostrar progreso, explicar y enrutar; no evalúa mayorías, no genera actas, no firma y no crea evidencia productiva.
5. **Integridad siempre activa.** La demo puede simular dependencias externas, pero no saltarse reglas, snapshots, hashes, trazas, ownership ni explicabilidad.
6. **Sandbox visible.** Cualquier firma, timestamp o evidencia simulada debe verse como `sandbox` o `QES_SANDBOX`.
7. **Sin filing real.** Ningún flujo demo puede activar presentación registral o notificación externa real.
8. **Sin QTSP productivo en demo.** En `demo_mode=true`, no se llama a EAD Trust productivo.
9. **ARGA siempre.** No usar el nombre real del cliente en código, datos, fixtures, commits ni narrativa de demo.
10. **Schema con paridad antes de runtime.** Cualquier columna futura requiere Cloud/local/types/probes antes de usarse como dependencia runtime.

## Hitos

| Hito | Sprint | Resultado | Gate de salida |
|---|---:|---|---|
| M0 | 0 | Roadmap y contratos de producto documentados | Este documento aprobado |
| M1 | 1 | Superficie Demo-Operable en consola, read-only y sin writes | Scenario picker, banner, contratos y handoffs visibles |
| M2 | 2 | Harness determinista de escenarios y gate preview compatible con contrato API | 5 escenarios producen payload estable y explain legal |
| M3 | 3 | Trust sandbox y evidencia sandbox trazable en UI | QES/TSQ simulados, bundle stub, hashes y postura visibles |
| M4 | 4 | Demo end-to-end presentable en menos de 10 min | 5/5 escenarios e2e, sin errores visibles, reset documentado |
| M5 | Post-sprint | Decisión de persistencia Cloud/local/types | Cerrado como fixtures-only comercial v1; persistencia queda bloqueada por gates |

## Owners

| Owner | Responsabilidad |
|---|---|
| Codex / Integration owner | Coordinar roadmap, preservar bounded contexts, revisar contratos y cerrar verificación final. |
| ARGA Console / TGMS Shell | Banner demo, selector de escenarios, modo presentación, progreso del vertical, presenter notes, handoffs y lectura agregada. |
| Secretaría Societaria | Fuente formal de convocatorias, sesiones, acuerdos, actas, certificaciones, libros, snapshots y reglas societarias. |
| Motor LSC / Legal rules | Gate preview, explainability, bases legales, ruleset hash, snapshot hash y separación validez societaria vs pactos. |
| Trust / Documental | Simulación QES/TSQ/ERDS, guard anti-QTSP real, generación documental y archivo controlado. |
| Evidence / Audit spine | Postura de evidencia sandbox, hashes, audit reference y reglas para no reclamar evidencia productiva sin bundle/storage/audit. |
| Core / Identity / RBAC | Tenant, entidad, órgano, persona, rol, scope canónico y `demo_mode` como contrato futuro. |
| QA | E2E del vertical, tests de guardrails, smokes de rutas y verificación de no-regresión. |
| Producto / Legal demo | Guion comercial, narrativa ejecutiva, criterios de comprensión legal y aprobación de escenarios ARGA. |

## Bounded Context Rule

La implementación debe seguir la decisión: **separate product, shared platform**.

| Contexto | Puede hacer | No puede hacer |
|---|---|---|
| ARGA Console / Shell | Orquestar demo, mostrar narrativa, componer read-only, enrutar a módulos owner. | Persistir modelos paralelos, evaluar reglas societarias, generar actas/certificaciones, firmar o crear evidencia productiva. |
| Secretaría | Mutar expedientes societarios y ejecutar lógica legal owner. | Absorber workflows GRC/AIMS o crear inventarios IA. |
| GRC Compass | Consumir eventos/evidencia cuando exista contrato. | Poseer actas, acuerdos o certificaciones societarias. |
| AIMS 360 | Consumir eventos/evidencia cuando exista contrato. | Poseer ledger GRC ni expedientes societarios. |
| Plataforma compartida | Identidad, RBAC base, eventos, links, evidencia, audit, legal hold, retención. | Convertirse en supermódulo transaccional. |

## Roadmap Por Sprint

### Sprint 1 — Contratos, consola y narrativa demo

**Objetivo:** dejar la experiencia comercial visible sin introducir writes ni schema nuevo.

| Prioridad | Backlog | Owner | Entregable | Postura de datos |
|---|---|---|---|---|
| P0 | Registrar contratos Demo-Operable en docs/UI config | Integration + Shell | Contratos de `run-scenario`, `gate-preview`, `trust/simulate-signature`, `explain` documentados en código o registry UI | `none`; fixtures/contratos en memoria |
| P0 | Banner global `DEMO MODE` | Shell | Banner visible en rutas de demo con copy sandbox | Sin DB |
| P0 | Scenario picker ARGA | Shell + Producto | Lista de 5 escenarios con resultado esperado, duración y narrativa | Fixtures ARGA, sin writes |
| P0 | Presenter notes | Producto + Shell | Guion visible solo para operador demo | Sin DB |
| P0 | Progreso vertical | Shell | Stepper `Convocatoria -> Sesión -> Gate -> Acta -> Certificación -> Evidencia` | Estado UI local |
| P1 | Handoffs owner | Shell + Secretaría | Links a rutas Secretaría para inspección del detalle legal | Read-only/handoff |
| P1 | Copy de evidencia sandbox | Legal + Evidence | Microcopy que distingue "sandbox verificable" de evidencia productiva | Sin DB |

**DoD Sprint 1**

- La consola muestra Demo-Operable como modo comercial, no como dominio nuevo.
- Cada tarjeta/acción declara owner y fuente.
- No hay writes a Supabase.
- No se introducen columnas, tablas ni migraciones.
- El usuario puede seleccionar cualquiera de los 5 escenarios P0 y ver narrativa esperada.
- La UI no afirma evidencia productiva cuando solo hay sandbox o fixture.

**Verificación Sprint 1**

- `bunx tsc --noEmit --pretty false`
- `bun run build`
- Smoke visual de `/` y ruta demo.
- Revisión textual: no aparece el nombre real del cliente.
- Revisión de grep: no llamadas QTSP productivas desde demo UI.

### Sprint 1.5 — Runner determinista local

**Objetivo:** implementar la siguiente iteración como runner local in-memory para ejecutar los 5 escenarios ARGA sin Cloud, sin migraciones y sin duplicar lógica legal propietaria.

**Estado 2026-04-27:** implementado en `src/lib/demo-operable/*`, consumido por `DemoOperablePanel` y cubierto por unit test + smoke e2e. Sigue siendo in-memory: no hace lecturas/escrituras Supabase, no usa Storage y no invoca QTSP productivo.

| Prioridad | Backlog | Owner | Entregable | Postura de datos |
|---|---|---|---|---|
| P0 | Runner in-memory local | Secretaría + Shell | Función local que recibe `scenario_id` y devuelve estado del vertical, resultado esperado y trazas explicables | Fixtures ARGA versionados; sin Cloud |
| P0 | 5 escenarios ARGA | Producto + Legal demo | `JUNTA_UNIVERSAL_OK`, `JUNTA_UNIVERSAL_FAIL_99`, `VETO_BLOCK`, `DOBLE_UMBRAL_FAIL`, `CONFLICTO_EXCLUSION_OK` ejecutables desde memoria | Fixtures locales |
| P0 | Explainability mínima | Motor LSC + Legal | Payload con `why_adopted`, `legal_basis`, `ruleset_hash`, `snapshot_hash`, `veto_context` y `evidence_posture` | Derivado del runner |
| P0 | Sandbox evidence stubs | Trust + Evidence | Stub local de evidencia con hashes, `sandbox=true`, `QES_SANDBOX` y referencia audit simulada | Sin Storage, sin QTSP real |
| P0 | No duplicación de lógica legal propietaria | Integration + Motor LSC | El runner compone fixtures y llama helpers puros existentes cuando existan; si falta lógica owner, usa contrato/stub explícito | Sin nueva lógica paralela |
| P1 | Reset determinista | QA + Shell | Re-run del mismo escenario produce el mismo payload salvo `scenario_run_id` controlado | Estado local/session |

**DoD Sprint 1.5**

- 5/5 escenarios ARGA se pueden ejecutar localmente sin leer ni escribir en Supabase Cloud.
- No se crean migraciones, seeds Cloud, tablas, columnas ni tipos generados.
- El runner produce un payload estable para UI, explainability y sandbox evidence stubs.
- La evidencia sandbox nunca se presenta como evidencia productiva.
- La lógica legal propietaria no se reimplementa en paralelo: se reutilizan helpers puros existentes o se deja stub/contrato owner visible.
- El flujo puede reiniciarse y repetir resultados de forma determinista.

**Verificación Sprint 1.5**

- Tests unitarios del runner para los 5 escenarios.
- Snapshot tests del payload de explainability y evidence stubs.
- Revisión de grep: sin `supabase.from`, `supabase.rpc`, Storage ni cliente QTSP productivo en el runner local.
- Revisión de grep: sin migraciones nuevas ni cambios en `supabase/functions/_types/database.ts`.
- `bunx tsc --noEmit --pretty false`
- `bun run build`
- Smoke e2e focalizado: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/15-demo-operable.spec.ts --project=chromium --reporter=list`

### Sprint 2 — Harness determinista y gate preview

**Objetivo:** ejecutar escenarios como payloads deterministas compatibles con el contrato API, sin depender de Cloud writes.

**Estado 2026-04-28:** ejecutado como capa local determinista. Se añadieron Demo Pack ARGA versionado (`SA_COTIZADA`, `SL`, `SLU`), contratos API locales (`buildDemoRunScenarioResponse`, `buildDemoGatePreviewResponse`, `buildDemoExplainResponse`) y la vista `/demo-operable/:scenarioId` con gate preview, explainability, steps, hashes y evidencia sandbox. No se han creado migraciones ni dependencias Cloud runtime.

| Prioridad | Backlog | Owner | Entregable | Postura de datos |
|---|---|---|---|---|
| P0 | Demo Pack ARGA en fixtures | Secretaría + Producto | SA, SL, SLU y escenarios canónicos | Fixtures versionados; no seed Cloud |
| P0 | Runner in-memory `runScenario` | Secretaría + Shell | Output estable con IDs simulados, resultado, explain y narrativa | `none` o generated fixtures |
| P0 | Gate preview determinista | Motor LSC | Evaluación con snapshot fixture y ruleset hash simulado/derivado | Motor puro, sin DB |
| P0 | Explainability contract | Motor LSC + Legal | `why_adopted`, `legal_basis`, `ruleset_hash`, `snapshot_hash`, `evidence_posture` | Contrato read-only |
| P0 | 5 escenarios P0 | Secretaría + QA | `JUNTA_UNIVERSAL_OK`, `JUNTA_UNIVERSAL_FAIL_99`, `VETO_BLOCK`, `DOBLE_UMBRAL_FAIL`, `CONFLICTO_EXCLUSION_OK` | Fixtures |
| P1 | Idempotencia local por `scenario_run_id` | Shell + QA | Reset local y re-run sin drift visible | Estado UI/session |
| P1 | Negative guards | QA + Trust | Tests que prueban no QTSP real y no filing real en demo | Sin DB |

**DoD Sprint 2**

- 5/5 escenarios devuelven resultado determinista.
- Gate preview coincide con resultado final.
- Explain separa quorum, mayoría, clases, doble umbral, consents, conflicto y veto.
- Los pactos se presentan como cumplimiento contractual cuando corresponda, sin confundirlo con validez societaria.
- No hay dependencia de schema nuevo.
- No se crea seed ni migración Cloud.

**Verificación Sprint 2**

- Unit tests del runner y escenarios.
- Unit tests del gate preview.
- Snapshot tests de payload API.
- `bunx tsc --noEmit --pretty false`
- `bun run build`
- Revisión de guardrails: demo bloquea filing y QTSP real.
- Smoke e2e focalizado: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/15-demo-operable.spec.ts --project=chromium --reporter=list`

### Sprint 2.5 — UX Coherence & Board Demo Readiness

**Objetivo:** revisar y corregir la experiencia para que la demo se perciba como consola de consejo/consejero, no como harness técnico.

**Estado 2026-04-28:** ejecutado. Se reencuadró el panel como `Consola de decisión del Consejo`, se retiraron IDs técnicos del primer plano, se sustituyó `Escenarios de venta` por `Casos de consejo`, se añadieron dashboards por rol de gobierno y se movieron hashes/flags a trazabilidad técnica. La vista de resultado prioriza decisión, motivo, siguiente acción y confianza sandbox.

| Prioridad | Backlog | Owner | Entregable | Postura de datos |
|---|---|---|---|---|
| P0 | Reencuadre ejecutivo | Shell + Producto | Hero y tarjetas orientadas a consejo/consejero | Sin DB |
| P0 | UI labels ejecutivos | Shell + Legal demo | Labels humanos para gates, estados, owners y evidencia | Sin DB |
| P0 | Dashboard por rol | Shell + Gobierno corporativo | Presidente, consejero independiente, secretario, compliance/auditor | Derivado del runner |
| P0 | Sandbox como confianza | Trust + Shell | Copy que explica no firma productiva/no filing/no escritura externa | Sin DB |
| P0 | Detalle técnico secundario | Shell + QA | Hashes, flags y payload lejos del primer plano ejecutivo | Sin DB |
| P1 | Responsive/accessibility smoke | QA | E2E con aria labels de negocio y viewport móvil | Sin DB |

**Verificación Sprint 2.5**

- `bunx tsc --noEmit --pretty false`
- `bunx vitest run src/lib/demo-operable/__tests__/scenario-runner.test.ts --reporter=verbose`
- `bun run build`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/15-demo-operable.spec.ts --project=chromium --reporter=list`
- Grep UX: no `Escenarios de venta`, `Gate preview`, `Explainability`, `Evidence sandbox`, `Abrir owner` en superficie demo.

### Sprint 3 — Trust sandbox y evidencia sandbox

**Objetivo:** hacer creíble la capa de confianza sin afirmar evidencia productiva.

**Estado 2026-04-28:** ejecutado como capa sandbox/API-ready. Se añadió `trust-sandbox.ts` con contrato de endpoints EAD Trust, guard anti-QTSP productivo en demo y frontera `server-side QTSP proxy required`. La UI muestra `Integración QTSP API preparada`, `EAD Trust · SANDBOX`, QES/TSQ sandbox, evidencia no productiva y endpoints objetivo. Además se saneó el cliente QTSP frontend para no contener credenciales client_credentials embebidas.

| Prioridad | Backlog | Owner | Entregable | Postura de datos |
|---|---|---|---|---|
| P0 | Simulador QES/TSQ | Trust / Documental | Payload `QES_SANDBOX`, OCSP ok, authority valid, TSQ mock | Servicio demo aislado |
| P0 | Evidence sandbox panel | Evidence + Shell | Bundle stub, hash, sandbox flag, audit reference simulado o explícitamente pendiente | UI/read-only |
| P0 | Guard anti-EAD productivo | Trust + QA | En demo, cualquier intento de cliente productivo falla seguro | Sin DB |
| P0 | Guard anti-evidencia final | Evidence + QA | Sandbox no puede mostrarse como evidencia final/productiva | Sin DB |
| P1 | Documental demo bridge | Secretaría + Documental | Acta/certificación demo con estado de archivo sandbox | Fixtures o generación local |
| P1 | Audit posture display | Evidence | Mostrar si `audit_log` es productivo, sandbox o no disponible | Read-only |
| P2 | Draft de migración futura | Integration + Evidence | Diseño de `evidence_bundles.sandbox` y `simulation_meta` para revisar después | Documento, no migración aplicada |

**DoD Sprint 3**

- La demo muestra firma/timestamp sandbox de forma explícita.
- Ningún texto llama "verificable" a evidencia productiva si falta bundle/storage/hash/audit completo.
- El evidence panel muestra hash de payload demo y postura.
- La simulación de trust está aislada del cliente EAD Trust productivo.
- Los tests fallan si `demo_mode=true` intenta usar QTSP real.

**Verificación Sprint 3**

- Unit tests de trust sandbox.
- Tests de guard anti-QTSP productivo.
- Tests de copy/postura de evidencia.
- `bunx tsc --noEmit --pretty false`
- `bun run build`
- Smoke de escenario completo hasta evidencia sandbox.
- Grep seguridad: sin secretos/endpoints productivos en las capas demo/QTSP tocadas, salvo patrones de bloqueo en tests.

### Sprint 4 — Presenter mode, e2e y hardening comercial

**Objetivo:** cerrar una demo usable por equipo comercial/legal sin intervención técnica.

**Estado 2026-04-29 — completado bajo Ruflo supervisado**

Se implementó presenter mode local con `?presenter=1`, controles de iniciar/pausar/reanudar, pasos anterior/siguiente, salto entre los 5 escenarios, reset demo hacia `JUNTA_UNIVERSAL_OK` y handoff a Secretaría pausado durante presentación. El smoke Playwright cubre dashboard, 5 escenarios deterministas, modo presentación, reset, navegación, móvil y guard anti-QTSP productivo / anti-lecturas de dominio desde rutas demo. Sin cambios Supabase/schema, sin migraciones, sin seeds Cloud y sin regenerar tipos.

| Prioridad | Backlog | Owner | Entregable | Postura de datos |
|---|---|---|---|---|
| P0 | Presenter mode auto-avanzable | Shell | Estados `PREPARED`, `AUTO_RUNNING`, `PAUSED`, `RESULT`, `FAILED_SAFE` | Estado UI local |
| P0 | E2E vertical completo | QA | Playwright para 5 escenarios P0 | Sin Cloud writes |
| P0 | Reset de escenario | Shell + QA | Reset visible en menos de 60 s | Estado UI/local |
| P0 | Demo readiness checklist | Producto + Integration | Checklist antes de reunión comercial | Docs |
| P0 | Failure-safe UX | Shell | Si un paso falla, mostrar estado controlado y no error técnico crudo | UI |
| P1 | Métricas demo | Producto + Shell | Tiempo de ejecución, pasos completados, fricción visible | UI/local |
| P1 | Handoff final a Secretaría | Shell + Secretaría | Botón para inspeccionar expediente/demo legal owner | Ruta owner |
| P2 | Gate de persistencia post-demo | Integration | Decisión formal: fixtures-only vs Cloud-backed demo_mode | Documento posterior |

**DoD Sprint 4**

- Demo completa en menos de 10 minutos.
- 5/5 escenarios P0 ejecutables sin errores visibles.
- Reset de escenario en menos de 60 segundos.
- Banner demo visible durante todo el recorrido.
- Explain y evidence panel disponibles en resultado final.
- No hay filing real ni QTSP productivo.
- QA puede ejecutar la demo desde cero con instrucciones documentadas.

**Verificación Sprint 4**

- Playwright vertical completo para los 5 escenarios.
- Smoke mobile/desktop de presenter mode.
- `bun run db:check-target` solo como verificación de entorno si se toca código con dependencia Supabase; no para escribir.
- `bunx tsc --noEmit --pretty false`
- `bun run build`
- Revisión manual legal/producto de narrativa y copy sandbox.

**Verificación ejecutada 2026-04-29**

- `bun run db:check-target` — OK contra `governance_OS` / `hzqwefkwsxopwrmtksbg`.
- `bunx tsc --noEmit --pretty false` — OK.
- `bunx vitest run src/lib/demo-operable/__tests__/scenario-runner.test.ts --reporter=verbose` — 9/9 tests OK.
- `bun run build` — OK.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/15-demo-operable.spec.ts --project=chromium --reporter=list` — 7/7 tests OK.
- Grep focalizado en demo/presenter/e2e/docs para nombre real de cliente, secretos QTSP y operaciones Supabase prohibidas — sin hallazgos en rutas tocadas.

### M5 — Persistence decision and post-sprint closure

**Objetivo:** cerrar la decisión de persistencia sin introducir riesgo de schema.

**Estado 2026-04-29 — cerrado como decisión no destructiva**

La decisión queda documentada en `docs/superpowers/plans/2026-04-29-demo-operable-m5-persistence-decision.md`.

Para comercial v1, Demo-Operable permanece fixture-only, local y determinista. La persistencia Cloud-backed `demo_mode` queda diferida hasta aprobación explícita de gates de schema, tipos generados, RLS, evidencia, storage, audit/legal hold y frontera QTSP server-side.

**Decisiones M5**

| Área | Decisión |
|---|---|
| Persistencia comercial v1 | No persistir demo; mantener fixtures locales. |
| `run-scenario` futuro | Server-side orchestrator; no frontend direct writes. |
| QTSP real | Solo por proxy server-side; nunca `client_credentials` en browser. |
| Evidencia sandbox | Stub no productivo en v1; persistencia solo tras evidence finality gates. |
| GRC/AIMS v2 | Integrar por contratos cross-module, no por modelo paralelo del Shell. |
| Schema | No cambios hasta aprobación separada. |

**Verificación M5 ejecutada 2026-04-29**

- `bun run db:check-target` — OK.
- `bunx tsc --noEmit --pretty false` — OK.
- `bunx vitest run src/lib/demo-operable/__tests__/scenario-runner.test.ts --reporter=verbose` — 10/10 OK.
- `bun run build` — OK.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 bunx playwright test e2e/15-demo-operable.spec.ts --project=chromium --reporter=list` — 7/7 OK.

## Escenarios P0

| Scenario ID | Resultado esperado | Demuestra | Owner lógico |
|---|---|---|---|
| `JUNTA_UNIVERSAL_OK` | `ADOPTADO` | 100% capital presente, unanimidad de celebrar, mayorías superadas | Secretaría / Motor LSC |
| `JUNTA_UNIVERSAL_FAIL_99` | `BLOQUEADO` | Universal falla si no está el 100% del capital | Secretaría / Motor LSC |
| `VETO_BLOCK` | `BLOQUEADO` | Fundación ARGA ejerce veto pactado en operación estructural | Secretaría / Pactos |
| `DOBLE_UMBRAL_FAIL` | `BLOQUEADO` | Mayoría global OK, clase o umbral reforzado falla | Secretaría / Motor LSC |
| `CONFLICTO_EXCLUSION_OK` | `ADOPTADO` | Exclusión de voto conflictuado y denominador recalculado | Secretaría / Motor LSC |

## Contratos API Objetivo

Estos contratos son forma de producto. La implementación puede ser RPC, Edge Function, servicio frontend controlado o API backend, siempre que respete payload y ownership.

| Contrato | Owner | Sprint | Mutación | Estado en este roadmap |
|---|---|---:|---|---|
| `GET /api/v1/acuerdos/{id}/gate-preview` | Secretaría / Motor LSC | 2 | No | Contrato objetivo; runner in-memory primero |
| `POST /api/v1/demo/run-scenario` | Secretaría invocado por Shell | 2 | Futuro controlado | Contrato objetivo; sin Cloud write en este task |
| `GET /api/v1/acuerdos/{id}/explain` | Motor LSC | 2 | No | Contrato objetivo; payload fixture primero |
| `POST /api/v1/trust/simulate-signature` | Trust / Documental | 3 | No productiva | Sandbox aislado |

## Data Contract Posture

### Postura de esta tarea

| Aspecto | Estado |
|---|---|
| Tablas usadas | Ninguna |
| Source of truth | `none` para este documento |
| Migración requerida | No |
| Cloud writes | No |
| Tipos afectados | No |
| Cross-module contracts | Documentados, no implementados |
| Riesgo de paridad | Bajo para esta tarea; alto para implementación futura si se persiste demo sin reconciliar Cloud/local/types |

### Contratos futuros sujetos a gate

| Contrato / tabla | Uso futuro | Postura actual | Gate antes de runtime |
|---|---|---|---|
| `tenants.demo_mode` | Activar demo por tenant | Propuesto en PRD, no aplicado aquí | Cloud/local migration + generated types + probe |
| `convocatorias.demo_mode` | Marcar convocatoria demo | Propuesto en PRD, no aplicado aquí | Cloud/local migration + generated types + owner review |
| `meetings.demo_mode` | Marcar sesión demo | Propuesto en PRD, no aplicado aquí | Cloud/local migration + generated types + owner review |
| `agreements.demo_mode` | Marcar expediente/acuerdo demo | Propuesto en PRD, no aplicado aquí | Cloud/local migration + generated types + owner review |
| `evidence_bundles.sandbox` | Señalar evidencia sandbox | Propuesto en PRD, no aplicado aquí | Evidence spine review + Cloud/local/types + audit posture |
| `evidence_bundles.simulation_meta` | Metadata de simulación | Propuesto en PRD, no aplicado aquí | Payload versionado + schema probe |
| `governance_module_events` | Eventos cross-module | Requerido por arquitectura; no visible en tipos locales al 2026-04-27 | Paridad Cloud/local/types antes de writes |
| `governance_module_links` | Links persistentes entre owner records | Requerido por arquitectura; no visible en tipos locales al 2026-04-27 | Paridad Cloud/local/types antes de writes |
| `audit_log` | Audit reference / WORM | Existe, pero evidencia final sigue sensible | No reclamar finality sin cadena verificable |

## Reglas de no-go

La implementación de cualquier sprint se bloquea si aparece alguno de estos casos:

- Se intenta escribir en Cloud sin `bun run db:check-target`.
- Se añade una dependencia runtime a columna no confirmada en Cloud/local/types.
- El Shell empieza a evaluar reglas societarias o a generar documentos formales.
- Un flujo demo llama a QTSP productivo.
- Una evidencia sandbox se presenta como productiva.
- Se crea un modelo paralelo de Secretaría, GRC o AIMS en la consola.
- El resultado de un escenario no es determinista.
- La UI oculta que el modo es demo/sandbox.
- Se usa el nombre real del cliente en código, fixtures, datos o commits.

## DoD Global

- Demo-Operable visible como modo comercial controlado.
- 5 escenarios P0 ejecutables y deterministas.
- Resultado del gate preview consistente con resultado final.
- Explain panel con reglas, bases legales, umbrales, snapshot hash y ruleset hash.
- Evidence panel con sandbox, hash, bundle stub o postura explícita de no-finality.
- Banner `DEMO MODE` visible en todo el recorrido.
- No QTSP productivo en demo.
- No filing registral desde demo.
- Bounded contexts respetados: consola orquesta; owners mutan.
- Source posture visible para datos Cloud, local pending, legacy, generated types only, fixtures o none.
- E2E vertical completo pasa para los 5 escenarios.
- Documentación de uso demo y checklist comercial/legal disponibles.

## Verificación Recomendada Por Tanda

| Tipo | Comando / práctica | Cuándo |
|---|---|---|
| Target Supabase | `bun run db:check-target` | Antes de cualquier operación que pudiera tocar Supabase; no autoriza writes por sí solo |
| Typecheck | `bunx tsc --noEmit --pretty false` | Cada sprint con código |
| Build | `bun run build` | Cada sprint con código |
| Unit tests | Runner, gate preview, trust sandbox, guards | Sprints 2-3 |
| E2E | Playwright 5 escenarios | Sprint 4 |
| Grep legal | Buscar el nombre real del cliente en rutas tocadas | Cada sprint |
| Grep guardrails | Buscar llamadas QTSP productivas desde demo | Sprints 3-4 |
| Review UX | Banner, sandbox copy, presenter notes, failure-safe | Sprints 1 y 4 |
| Review legal | Explain, bases legales, validez vs pactos | Sprints 2 y 4 |

## Decisiones Pendientes

| Decisión | Owner | Momento |
|---|---|---|
| Persistencia real de `demo_mode` vs fixtures-only | Integration + Core + Secretaría | Decidido en `2026-04-29-demo-operable-m5-persistence-decision.md`: comercial v1 sigue fixtures-only. |
| Forma final de `run-scenario`: RPC, Edge Function o backend API | Integration + Secretaría | Decidido: futuro server-side orchestrator; no frontend writes. |
| Evidence sandbox persistida vs stub de presentación | Evidence + Trust | Decidido: comercial v1 mantiene stub; persistencia requiere evidence finality gates. |
| Alcance GRC/AIMS en demo comercial v1 | Producto + GRC + AIMS | Decidido: fuera de v1 persistida; v2 por contratos cross-module. |
| Uso de `governance_module_events/links` | Integration | Decidido: no writes hasta Cloud/local/types y ownership aprobados. |

## Cierre De Este Documento

Este roadmap fija una secuencia segura y registra la ejecución local completada: contratos, UI, fixtures deterministas, trust/evidencia sandbox, presenter mode y e2e comercial. La persistencia Cloud queda fuera hasta que exista paridad verificada y un plan de migración revisado.
