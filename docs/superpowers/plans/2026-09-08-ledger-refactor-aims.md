# Ledger — refactor total del módulo AIMS + cuestionario guiado de calificación (2026-09-08)

Documento de control del goal `docs/superpowers/prompts/2026-09-08-goal-refactor-total-aims.md`,
ejecutado sobre la spec del equipo legal validada en
`docs/superpowers/reviews/2026-09-08-validacion-spec-cuestionario-vs-refactor-aims.md` y con el plan
`docs/superpowers/plans/2026-09-08-refactor-total-aims-plan.md`. Cada decisión, refutación y deuda con dueño.

## 0. Estado de partida, medido (2026-09-08, `main` `083b757`)

| Superficie | Medida | Contradice a |
|---|---|---|
| Páginas | 10 ficheros, **7 660** líneas: `SistemaDetalle` 1 398, `EvaluacionNueva` 1 360, `Dashboard` 1 028, `EvaluacionDetalle` 806, `IncidenteDetalle` 759, `SistemaNuevo` 568, `IncidenteNuevo` 508, `Evaluaciones` 458, `Incidentes` 416, `Sistemas` 359 | — |
| `src/lib/aims/` | 10 módulos, **3 149** líneas; `readiness.ts` 892, de las que 223 (líneas 121–343) son `aimsScreenPostures` + `aimsReadOnlyHandoffs` a mano | — |
| Hooks | 7 ficheros, 1 364 líneas | — |
| Componentes | 2 (`DeclaracionConformidadModal` 258, `EvidenciaDeMedida` 267) | — |
| Tests | 15 en `src/lib/aims/__tests__/`, 2 en `src/test/aims/`, 3 sondas en `src/test/schema/` (`aims-evidence-tenant-isolation`, `aims-migration-shape`, `garrigues-ia-owner-write`) | el goal decía 2 sondas |
| Tablas Cloud | **25** `aims_*` + 4 `ai_*`; 32 políticas por `fn_current_tenant_id()`; `ai_risk_assessments` y `ai_compliance_checks` sin `tenant_id` | CLAUDE.md y el cierre del 07 decían 28 |
| Dato ARGA | 8 sistemas (rol NULL en los 8; `risk_level` en los 8), 7 evaluaciones, 49 checks (Motor de triaje: 28 filas / 7 códigos, 4 evaluaciones), 1 incidente; `aims_*`: `requirement_catalog` 4, `requirement_checks` 4, `control_catalog` 2, `system_versions` 3, `technical_file_sections` 5, `monitoring_indicators` 1, `post_market_plans` 1 | el goal no listaba `requirement_checks` ni `control_catalog` |
| Dato Garrigues | Harvey `2f877e8c…` (`aims_reference_code` NULL, rol NULL, perfil NULL, `Limitado`, owner NULL, `EN_EVALUACION`), 1 evaluación `fdcccf9e…` (score 49, `CON_GAPS`, sin congelar, 84 findings `MG_*`), 12 checks, 0 incidentes, **0 filas en las 25 `aims_*`** | — |
| Privilegios | `anon` con DELETE/INSERT/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE sobre las 4 `ai_*` y 24 `aims_*` (todas menos `aims_evidence_items`); `authenticated` con TRUNCATE/REFERENCES/TRIGGER sobre las mismas 28 | «RLS correctamente configuradas» de la spec |
| Baseline | `bun test` **4 320 pass / 151 skip / 3 todo / 0 fail** (4 474 tests, 485 ficheros, 38,6 s) | — |
| Head Cloud | `20260907220000` = head del repo | — |
| Árbol | material ajeno sin tocar: `Gobernanza ia/`, `docs/architecture*`, `DOC GRC/para tirar*`, `pkcs11.txt`, `scripts/*platform-architecture*`, hunks de `.gitignore`/`README.md`/`package.json` | — |

## 1. Decisiones

| # | Decisión | Fuente | Estado |
|---|---|---|---|
| D-1 | Frontera de las 25 tablas: 5 con destino (a) + 1 nueva; 20 con destino (b). Tabla completa en el plan | goal §2.1 | ejecutándose |
| D-2 | El cuestionario deriva rol y nivel; el `<select>` libre de nivel desaparece del alta y de la ficha; rol y nivel sólo cambian por RPC | spec §1.2, §3.3.1; S-12 | pendiente |
| D-3 | Vocabulario persistido intacto: `Inaceptable` (no `PROHIBIDO`), `RESPONSABLE_DESPLIEGUE` (no `DESPLEGADOR`) | S-2, S-3 | pendiente |
| D-4 | El árbol deriva sólo PROVEEDOR / RESPONSABLE_DESPLIEGUE; no se inventan preguntas para importador/distribuidor | S-1 | pendiente |
| D-5 | Marcos con numeración final del Reglamento (art. 95, cap. V arts. 51–56, art. 27 con nota del 27.1); la cita de la spec se conserva en `nota` | S-4, S-8 | pendiente |
| D-6 | Perfil B mide contra las 84 (falla abierto, se dice); perfil C usa el catálogo de 43 tal cual, provisional | S-6, S-7 | pendiente |
| D-7 | Alta = RPC atómica sistema + cuestionario; DRAFT sólo para reclasificar desde la ficha | S-10 | pendiente |
| D-8 | Preguntas, ayuda y reglas en catálogo TS versionado con `questionnaire_version` por fila; no tabla de configuración sin editor | S-11 | pendiente |
| D-9 | `completed_by uuid = auth.uid()` sin FK a `auth.users` | S-13 | pendiente |
| D-10 | Catálogo de posturas de pantalla: se **borra** (con su tabla en el Dashboard y los dos tests que lo fijaban); los 4 handoffs pasan a `handoffs.ts` como dato de navegación | goal §2.4 | pendiente |
| D-11 | `on delete cascade` del cuestionario respecto a `ai_systems`: sin cascade, un sistema con cuestionario sería imborrable (no hay DELETE sobre cuestionarios) y las sondas dejarían residuo | plan T3 | pendiente |
| D-12 | Migración de endurecimiento: `anon` fuera de las 28; TRUNCATE/REFERENCES/TRIGGER fuera de `authenticated`; escritura fuera de `authenticated` en las 20 (b); `fn_aims_close_technical_file` sin EXECUTE para `authenticated` | P9 | pendiente |

## 2. Refutaciones

| # | Afirmación previa | Refutada por | Consecuencia |
|---|---|---|---|
| R-1 | «28 tablas `aims_*`» (CLAUDE.md, cierre del 07, memoria) | `information_schema.tables` → 25 | Corregir CLAUDE.md |
| R-2 | «A8: desplegable libre sin motivación» (spec §1.1) | `SistemaNuevo.tsx:85-160, 420-540` desde `9f27a9b` | La spec añade derivación cerrada, versionado, hash, historial, ayuda; no «la primera motivación» |
| R-3 | «Harvey SYS-2F877E8C» | `aims_reference_code` NULL | Identificador inventado; no se siembra |
| R-4 | «RLS correctamente configuradas» ⇒ `anon` fuera | `role_table_grants`: `anon` con todo sobre 28 tablas | D-12 |
| R-5 | «CA-2: perfil A → 43 medidas» | 84 = proveedor de alto riesgo (perfil A); 43 = despliegue (perfil C) | CA-2 reformulado |
| R-6 | «2 sondas en `src/test/schema/`» (goal §1) | 3 ficheros | ninguna |

## 3. Deudas con dueño

| # | Deuda | Dueño | Motivo |
|---|---|---|---|
| DA-1 | Preguntas para IMPORTADOR / DISTRIBUIDOR (arts. 3.6, 3.7) | Equipo legal | S-1 |
| DA-2 | Catálogo de medidas del perfil B (responsable del despliegue de alto riesgo, arts. 26–27 + RGPD) | Comité de IA | S-6 |
| DA-3 | Validación del catálogo de 43 (perfil C) y su composición | Comité de IA | S-7 |
| DA-4 | ¿A quién alcanza el art. 27 (EIDF)? ARGA (anexo III 5 c)) y Garrigues | Equipo legal | S-8 |
| DA-5 | Separar Q1.2 en modificación sustancial / cambio de finalidad | Equipo legal | S-14 |
| DA-6 | Editor de preguntas con RBAC si Legal necesita cambiarlas sin despliegue | Producto (post-demo) | S-11 |
| DA-7 | Clasificar Harvey desde su ficha | Responsable de cumplimiento de Garrigues | goal §5 |
| DA-8 | El 403 silencioso en la carga del shell (`useModuleStatus`, `sii_cases_view` 42501, ya documentado en la revisión profunda P0 de consola) | Carril consola | fuera de AIMS |
| DA-9 | 20 tablas de esquema muerto siguen en Cloud (sin código ni lector); borrarlas exige decisión del usuario y no aporta al prototipo | Usuario | D-1 |

## 4. Hitos

(se rellena por tarea: qué se cerró con evidencia, qué se refutó, qué queda)
