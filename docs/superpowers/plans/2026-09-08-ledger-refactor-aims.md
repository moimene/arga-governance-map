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

### H-1 · Tareas 1–4: vocabulario, motor puro, migraciones (2026-09-08)

**Cerrado con evidencia**

| Qué | Evidencia |
|---|---|
| Vocabulario único (`src/lib/aims/vocabulario.ts`, hoja) consumido por las 7 pantallas | `f04242d`; `vocabulario-unico.test.ts` (comportamiento + arista + capa débil); mutaciones: `SEVERITY_OPTIONS` local → cae (c); quitar `BORRADOR` → cae (a) |
| Motor puro del cuestionario (`cuestionario-calificacion.ts`, hoja, 0 imports) + `catalogProfile` en `perfilAplicable` | `d76746d`; 29 + 2 tests |
| Migración `20260908120000` (tabla, RLS sin DELETE, revoke explícito, versión por trigger, inmutabilidad, RPC completar + registrar con SHA-512 de servidor, trigger de `ai_systems`) | **Sonda revertida contra Cloud, 27 pasos**, `BEGIN … ROLLBACK`, cero residuo (comprobado: 0 sistemas `PROBE-%`, tabla inexistente después) |
| Migración `20260908130000` (anon fuera de 28 tablas, TRUNCATE/REFERENCES/TRIGGER fuera, escritura fuera en las 20 muertas, EXECUTE fuera de `fn_aims_close_technical_file`) | misma sonda: bloque de verificación OK; `anon` con columna inexistente → `42703`, con columna real → `42501` (el contrato de columnas sigue midiendo) |

Resultados de la sonda (sesiones simuladas con `set_config('request.jwt.claims')` + `set local role`):

| Paso | Resultado |
|---|---|
| INSERT directo en `ai_systems` como `authenticated` | `42501 ALTA_SOLO_POR_CUESTIONARIO` |
| `fn_aims_registrar_sistema` (ARGA) | sistema + cuestionario; hash 128 hex; `ai_systems` sincronizado (`RESPONSABLE_DESPLIEGUE`, `Limitado`, perfil C); flag `off` al volver |
| UPDATE de la COMPLETED por su dueño | `42501 CUESTIONARIO_COMPLETADO_INMUTABLE` |
| UPDATE directo de `risk_level` / `regulatory_role` | `42501 CLASIFICACION_SOLO_POR_CUESTIONARIO` (×2); `description` sí se edita |
| DRAFT v2 con anexo III + excepción, sin motivación → completar | `23514 ART63_MOTIVACION_OBLIGATORIA` |
| Misma con motivación ≥ 40 → completar | v2 COMPLETED, v1 SUPERSEDED, `ai_systems.regulatory_profile.exige_art63 = true`, `version = 2` |
| DRAFT con `Q2_1 = true` → completar | `23514 PRACTICA_PROHIBIDA_BLOQUEA` |
| Cliente pone `status = 'COMPLETED'` / `content_hash` a mano | `42501 COMPLETAR_SOLO_POR_RPC` / `42501 CAMPOS_SELLADOS_POR_RPC`; el resto del DRAFT sí se edita |
| DELETE | `42501 permission denied` |
| Garrigues lee cuestionarios y sistema de ARGA | 0 y 0; INSERT de DRAFT para un sistema de ARGA → RLS `42501` |
| Garrigues registra el suyo; ARGA lo lee | tenant `…0002`, hash 128; ARGA ve 0 suyos-ajenos y 3 propios |

**Refutado en la propia sonda (y corregido antes de commitear):** los dos triggers de `ai_systems`/inmutabilidad comparaban `current_setting('aims.clasificacion_rpc', true) = 'on'`; sin flag el `current_setting` devuelve **NULL**, `NULL = 'on'` es NULL y `if not v_rpc` no bloqueaba **nunca**. La primera pasada de la sonda lo mostró (`a_insert_directo` y `e_update_risk_level` en «NO BLOQUEO»). Corregido con `coalesce(…, '') = 'on'` y gate en el test de forma. Segundo hallazgo de la misma pasada: el flag, local a la transacción, seguía `on` tras la RPC y abría las puertas al resto de la transacción larga; ahora las dos RPC lo apagan al terminar (`b2_flag_tras_rpc = off`).

**Queda:** aplicar las dos migraciones (autorización del usuario), y los tests vivos de la Tarea 13.

### H-2 · Tareas 5–12: hook, componentes, cinco carriles de descomposición, frontera ejecutada (2026-09-08)

**Cerrado con evidencia**

| Qué | Evidencia |
|---|---|
| Hook `useAimsClasificacion.ts` (historial, vigente, borrador, iniciar, guardar acotado por tenant con `if (!data) throw`, completar y registrar por RPC) | `d9444c5`; entra en el gate de aislamiento de hooks por su ancla (10/10) |
| Componentes del cuestionario (`clasificacion/*`, 4 + resumen): pintan, no deciden | `b85d636`, `61b7c69`; `cuestionario-arista.test.ts` cae con bloqueos locales aunque el import siga |
| Alta por cuestionario (`SistemaNuevo` 569 → 392): sin `<select>` de nivel ni radio de rol, RPC sin `tenant_id` del cliente, submit sólo con clasificación confirmada | `61b7c69`; `sistema-nuevo-cuestionario.test.ts` cae con un `insert(` de señuelo y con el bloqueo retirado |
| Ficha del sistema (`SistemaDetalle` 1 387 → 167, 9 componentes): clasificación vigente/borrador/historial, reclasificación por RPC con autosave, modal sin rol ni nivel | `27ffba8` |
| Frontera (b): pestaña FRIA, `useAimsFria.ts`, «Modelos & Datasets», cierre del expediente, retirados; contrato de columnas y ancla del gate de hooks ajustados | `27ffba8`; `frontera-backbone.test.ts` (1) cae al reintroducir `from("aims_fria_assessments")` |
| Frontera (a): editar sección (acotado por tenant + `if (!data) throw`), iniciar expediente anexo IV (9 filas), registrar versión, registrar indicador, abrir subexpediente por régimen (pertenencia + `tenant_id` explícito + éxito sólo tras resolver) | `27ffba8`, `de90f2c`; gates (5) y `incidente-regimenes-escritura.test.ts` caen al quitar `tenant_id` o adelantar el toast |
| Wizard (`EvaluacionNueva` 1 360 → 395, 7 componentes) + banner de perfil A/B/C y aviso «Sin clasificación guiada» por `regulatory_profile.cuestionario_id` | `947f73b`; mutación por `regulatory_role` cae |
| Dashboard (1 022 → 384) sin catálogo de posturas; `handoffs.ts` hoja; tarjeta de clasificación guiada; `readiness.ts` 838 → 608 | `56cd2e8`; mutaciones (`aimsScreenPostures = []`, quitar el `Link` del órgano) caen |
| Informe e incidentes (`EvaluacionDetalle` 806 → 193, `IncidenteDetalle` 759 → 183, `IncidenteNuevo` 508 → 172) | `de90f2c` |
| `FilterGroup` compartido; gate §2.3 de 400 líneas con control positivo y arista de catálogo | `427e587` |
| Hooks muertos retirados: `useCreateAiSystem`, `useDeleteAiSystem`, `useDeleteAiIncident` | `61b7c69` (0 consumidores, medido) |

**Tamaño del módulo (antes → después):** páginas 7 660 → **2 897** líneas (10 ficheros, máximo 395); componentes 525 → 6 733 (41 ficheros, máximo 368); `src/lib/aims` 3 149 → 3 476 (+ `vocabulario`, `cuestionario-calificacion`, `expediente-tecnico`, `handoffs`; `readiness` −230); hooks 1 364 → 1 431 (− `useAimsFria` 209, + `useAimsClasificacion`).

**Refutado en la integración**

| Afirmación | Refutada por | Consecuencia |
|---|---|---|
| Plan T8: «corregir las tres rutas `/nueva` → `/nuevo`» | ya estaban corregidas en el árbol (revisión profunda P1 cerrada antes) | ninguna |
| Plan T10: extraer `KpiCards` | el gate «un cero sin dato no se pinta como un cero bueno» exige en la PÁGINA la clave `neutral:` y los rótulos a ≤ 500 caracteres de su `tone`; extraerlo habría exigido un señuelo | `KpiCard`/`RiskBadge` se quedan en la página; se extrajo `IncidentesRecientes` |
| Mi gate de catálogo (T12, primera versión): «ninguna página importa el catálogo» | `EvaluacionDetalle` importa los dos catálogos para pasárselos a `catalogoDeLosFindings` (criterio); `EvaluacionNueva` conserva `AESIA_RIA_REQUIREMENTS` porque otro gate lo exige | reformulado como arista: quien toca un catálogo llama a `perfilAplicable` o `catalogoDeLosFindings` |
| e2e/16 «AIMS declara postura por pantalla» | asertaba `Contexto técnico AIMS` y `solo lectura demo`, rótulos de la tabla borrada (gate que fija lo retirado) | reescrito: afirma los handoffs y la AUSENCIA de la tabla; **no ejecutado** en esta sesión |

**Cambio de pantalla en ARGA, declarado nominalmente (corrección de defecto probado):** las 8 fichas de ARGA pasan a mostrar el panel «Sin clasificación guiada — este sistema se mide contra el catálogo completo» (rol NULL en los 8, medido), y el modal de edición deja de ofrecer rol y nivel: hasta hoy cualquier usuario podía cambiar el nivel de riesgo de un sistema sin motivación ni rastro (era un `<select>` libre), que es el defecto A8 de la spec. El chip de nivel sigue pintando el `risk_level` sembrado; ningún dato de ARGA cambia.

**Incidencias de orquestación, declaradas:** (1) el carril de incidentes ejecutó un `git stash push --keep-index` prohibido y lo recuperó con `pop` en el mismo turno; verificado después por typecheck limpio, tests y presencia de todos los ficheros no versionados. (2) Dropbox revirtió una escritura del carril del Dashboard entre dos comprobaciones; el marcador `veredicto={readiness.standaloneReady …}` se reconfirmó antes de commitear. (3) Tres carriles tocaron tests fuera de su perímetro (repunte de 1–4 líneas cada uno, comentado); se revisó cada diff antes de commitear.

### Tabla final de superficies (derivada del código el 2026-09-08; regenerable con el script del hito)

Criterio: **REAL** = lee o escribe tabla/RPC con `tenantId` en la queryKey y `skipToken`; **HONESTO** = pinta sin dato propio y lo dice; **RETIRADO** = ya no existe.

| Superficie | Líneas | Hooks | Tablas / RPC | Escribe | Postura |
|---|---|---|---|---|---|
| `pages/Dashboard` | 384 | `useAllAssessments`, `useAllComplianceChecks`, `useAiSystemsList`, `useAiIncidentsList` | `ai_compliance_checks`, `ai_incidents`, `ai_risk_assessments`, `ai_systems` | no | REAL (lectura) |
| `dashboard/ClasificacionGuiadaCard` | 116 | `useCuestionariosVigentesDelTenant` | `aims_classification_questionnaires` | no | REAL; sin inventario «no consta» |
| `dashboard/ComplianceMonitorPanel`, `ReadinessDomains`, `PrioridadAhora`, `IncidentesRecientes` | 141 / 228 / 154 / 39 | props de la página | — | — | REAL (derivado de `buildAimsReadiness`) |
| `dashboard/HandoffAffordances` | 58 | `AIMS_HANDOFFS` (hoja) | — | — | HONESTO: rutas de sólo lectura, `evidence=REFERENCE` |
| `dashboard/OrganoRector` | 44 | (página: `useBodyBySlug`) | `governing_bodies` | no | REAL (arista FK → `/organos/{slug}`) |
| «Contrato por pantalla» (`ScreenPostureTable`) | — | — | — | — | **RETIRADO** (D-10) |
| `pages/Sistemas` | 284 | `useAiSystemsList` | `ai_systems` | no | REAL |
| `pages/SistemaNuevo` | 392 | `useRegistrarSistemaClasificado` | `fn_aims_registrar_sistema()` | sí | REAL (RPC; tenant de sesión) |
| `clasificacion/ClasificacionGuiada` + `PreguntaGuiada` + `ResultadoProvisional` + `ResumenClasificacionConfirmada` | 296 / 115 / 68 / 58 | — (hoja `cuestionario-calificacion`) | — | — | REAL (criterio en hoja; pinta) |
| `pages/SistemaDetalle` | 167 | `useAiSystemById`, `useAssessmentsBySystem`, `useAiIncidentsBySystem`, `useAimsTechnicalFileSections`, `useAimsSystemVersions`, `useAimsMonitoringIndicators` | `ai_systems`, `ai_risk_assessments`, `ai_incidents`, `aims_technical_file_sections`, `aims_system_versions`, `aims_monitoring_indicators` | no | REAL |
| `sistema/ClasificacionVigentePanel` + `clasificacion/HistorialClasificaciones` | 245 / 146 | `useCuestionariosDeSistema`, `useIniciarCuestionario`, `useGuardarBorradorCuestionario`, `useCompletarCuestionario` | `aims_classification_questionnaires`, `fn_aims_completar_cuestionario()` | sí | REAL; sin cuestionario: HONESTO («Sin clasificación guiada») |
| `sistema/EditarSistemaModal` | 200 | `useUpdateAiSystem` | `ai_systems` | sí | REAL; rol y nivel fuera (trigger) |
| `sistema/TabExpedienteTecnico` + `VersionesSistema` | 273 / 183 | `useUpdateTechnicalFileSection`, `useIniciarExpedienteTecnico`, `useRegistrarVersion` | `aims_technical_file_sections`, `aims_system_versions` | sí | REAL; cabecera HONESTA por `vinculaArt11` (true/false/null) |
| `sistema/TabVigilancia` | 206 | `useRegistrarIndicador` | `aims_monitoring_indicators` | sí | REAL |
| `sistema/TabEvaluaciones`, `TabIncidentes`, `CabeceraSistema`, `EscaladoSecretariaModal` | 98 / 77 / 167 / 164 | props | — | — | REAL (derivado) / handoff read-only |
| Pestaña FRIA (art. 27), «Modelos & Datasets», botón «Cerrar expediente», metadato PII | — | — | 7 `aims_fria_*`, `aims_model_registry`, `aims_dataset_registry`, `fn_aims_close_technical_file` | — | **RETIRADO** (D-1) |
| `pages/Evaluaciones` | 389 | `useAllAssessments` | `ai_risk_assessments` | no | REAL |
| `pages/EvaluacionNueva` | 395 | `useAiSystemsList`, `useDraftAssessment`, `useSaveAssessment`, `useCreateComplianceChecks`, `useEvidenceBySystem` | `ai_systems`, `ai_risk_assessments`, `ai_compliance_checks`, `aims_evidence_items` | sí | REAL |
| `evaluacion/PerfilAplicabilidadBanner` | 100 | (página: `perfilAplicable`) | — | — | HONESTO: perfil A/B/C, «cobertura provisional», «Sin clasificación guiada» |
| `evaluacion/PasoParametros`, `PasoMedidas`, `ControlesDeMedida`, `MedidasAdicionales`, `PasoRevision`, `PasoResultado` | 122 / 301 / 115 / 184 / 225 / 103 | props | — | — | REAL (derivado) |
| `EvidenciaDeMedida` | 268 | `useRegistrarEvidencia`, `useVincularEvidencia` | `aims_evidence_items` + bucket | sí | REAL; huella de navegador declarada |
| `pages/EvaluacionDetalle` | 193 | `useAssessmentById`, `useFreezeAssessment`, `useReviewAssessment` | `ai_risk_assessments`, `fn_aims_freeze_assessment()`, `fn_aims_review_assessment()` | sí | REAL |
| `evaluacion-detalle/CabeceraInforme`, `ChecklistMedidas`, `PlanYNotas` | 265 / 245 / 177 | props | — | — | REAL (derivado); huella de servidor declarada donde existe |
| `pages/Incidentes` | 348 | `useAiIncidentsList` | `ai_incidents` | no | REAL |
| `pages/IncidenteNuevo` + `incidente/FormularioIncidente` | 172 / 368 | `useCreateAiIncident` | `ai_incidents` | sí | REAL |
| `pages/IncidenteDetalle` | 183 | `useAiIncidentById`, `useUpdateAiIncident`, `useIncidentRegimes` | `ai_incidents`, `aims_incident_regimes` | sí | REAL |
| `incidente/SubexpedientesRegimen` | 311 | `useAbrirSubexpedienteRegimen`, `useUpdateIncidentRegime` | `ai_incidents`, `aims_incident_regimes` | sí | REAL; texto HONESTO («no notifica a ninguna autoridad») |
| `incidente/RelojesRegulatorios`, `CabeceraIncidente`, `EdicionIncidente` | 162 / 190 / 207 | props | — | — | REAL (derivado de `evaluateMultiregimeIncident`) |
| `DeclaracionConformidadModal` | 259 | — | — | — | HONESTO (sin firma, sin conformidad afirmada; gates A3) |
| `FilterGroup` | 44 | — | — | — | REAL (opciones del vocabulario) |

Ninguna fila «no verificada»: cada hook citado se lee en `src/hooks/useAi*.ts` con `tenantId` en la queryKey y `skipToken`, vigilado por `useAimsTenant.test.ts`.

### Tabla final de las 25 tablas `aims_*` (+1 nueva), ejecutada

| Tabla | Destino | Ejecución | Prueba |
|---|---|---|---|
| `aims_classification_questionnaires` (nueva) | (a) | alta por RPC, reclasificación desde la ficha | sonda revertida (H-1); `aims-cuestionario-live.test.ts` (roja hasta aplicar) |
| `aims_evidence_items` | (a) | ya existía | `aims-evidence-tenant-isolation.test.ts` |
| `aims_technical_file_sections` | (a) | editar sección, iniciar expediente | `frontera-backbone` (2)(5) |
| `aims_system_versions` | (a) | registrar versión | `frontera-backbone` (2)(5) |
| `aims_monitoring_indicators` | (a) | registrar indicador | `frontera-backbone` (2)(5) |
| `aims_incident_regimes` | (a) | abrir subexpediente | `incidente-regimenes-escritura`; `frontera-backbone` (2) |
| `aims_fria_assessments`, `_process_map`, `_use_profile`, `_affected_groups`, `_fundamental_rights_risks`, `_remediation_governance`, `_dpia_cross_references` | (b) | hook borrado, pestaña retirada, contrato de columnas sin sus tipos | `frontera-backbone` (1)(3); migración `20260908130000` revoca escritura |
| `aims_model_registry`, `aims_dataset_registry` | (b) | hooks y pestaña retirados | ídem |
| `aims_incident_reports`, `aims_regulatory_clocks`, `aims_incident_evidence_packs`, `aims_evidence_packs`, `aims_change_requests`, `aims_component_inventory`, `aims_control_tests` | (b) | sin código; escritura revocada | `frontera-backbone` (1); migración |
| `aims_requirement_catalog` (4 filas ARGA), `aims_requirement_checks` (4), `aims_control_catalog` (2), `aims_post_market_plans` (1) | (b) | 0 lectores (medido); ARGA no las ve en ninguna pantalla; dato intacto; escritura revocada | `frontera-backbone` (1); migración |

### El 49 % de Harvey, re-medido (§3.8 del goal)

Dato: 1 evaluación `EU_AI_ACT` (`fdcccf9e…`), `score = 49`, `CON_GAPS`, sin congelar, **84 findings con códigos `MG_*`** — el catálogo del proveedor de un sistema de alto riesgo (arts. 9–15, 17, 72, 73). Harvey no tiene cuestionario guiado (`regulatory_role` NULL, `regulatory_profile` NULL): la ficha y el wizard lo dicen ahora con el aviso «Sin clasificación guiada — catálogo completo por defecto». **El número no cambia hasta que el responsable de cumplimiento del despacho complete el cuestionario desde la ficha (DA-7); el producto no lo rellena por él.** Lo que sí queda fijado: si las respuestas fueran las previsibles para un despacho que usa un asistente contratado (Q1.1–Q1.3 «No», Q2.1 «No», Q2.2 «No», Q2.4 «Sí», Q2.5 «Sí»), el resultado sería Responsable del despliegue · Limitado · perfil C · GPAI, con marcos art. 4, art. 50, cap. V (51–56), RGPD y deontología; contra ese perfil el catálogo aplicable son las **43** medidas `MD_*`, de las que la evaluación existente **no responde ninguna** (0 de 43: los códigos son de otro catálogo). El «49 %» pasa a leerse como lo que es: la proporción de obligaciones del proveedor de alto riesgo que se acreditaron, sobre un sistema al que esas obligaciones previsiblemente no vinculan. El resultado nuevo será «sin evaluar contra su catálogo» hasta que se reevalúe.
