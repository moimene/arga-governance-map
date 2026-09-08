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
| DA-9 (nota 2026-09-08) | La valoración propone borrarlas con `DROP TABLE … CASCADE` (P2). **Borraría dato de ARGA**: `aims_requirement_catalog` 4, `aims_requirement_checks` 4, `aims_control_catalog` 2, `aims_post_market_plans` 1. La migración `130000` les retira la escritura para dejar ese dato intacto. No se ejecuta sin decisión expresa | Usuario | contrato cero-cambio ARGA |
| DA-12 | La «spec de continuidad» que cita la valoración (C4→C1→M1→M2, `compliance_tier` en `requirement_catalog`, KPI dual) no está en el repo; M1/M2 no se planifican sin ella | Usuario | valoración 2026-09-08 |

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

### H-3 · Review adversarial de rama (3 lentes, opus, sólo lectura) y cierres (2026-09-08)

Lentes: (1) aislamiento y escritura, (2) afirmaciones y vocabulario, (3) criterio y descomposición. Cada lente intentó refutarse antes de reportar; se listan sólo los hallazgos que sobrevivieron y qué se hizo.

| Sev | Hallazgo | Lente | Cierre |
|---|---|---|---|
| P1 | El servidor validaba la práctica prohibida contra `computed_risk_level`, que manda el cliente: `Q2_1 = Sí` + «Mínimo» se sellaba con SHA-512 | 1, 2 | `fn_aims_derivar_rol/nivel/perfil_catalogo` (SQL, inmutables, espejo del árbol) re-derivan desde las respuestas; `PRACTICA_PROHIBIDA` se lee de `Q2_1`; `CLASIFICACION_INCOHERENTE` rechaza rol/nivel/perfil/GPAI que no salgan de las respuestas. **Sonda revertida nº 2 (10 pasos): manipulada → 23514; incoherente → 23514; GPAI incoherente → 23514.** La sonda viva compara los derivadores SQL con la hoja TS caso a caso (13 casos) |
| P1 | `aims-column-contract.test.ts` se pondría rojo al aplicar el revoke de `anon` (columna real → `42501`) y el ledger decía lo contrario | 1 | El helper trata `42501` como «las columnas existen» (el análisis del `select` precede al ACL; una inexistente sigue dando `42703`, medido) |
| P1 | El seed `seed-garrigues-ia.ts` abortaría en cuanto alguien clasifique Harvey: su `update` ponía `risk_level` a null y el trigger lo rechaza | 1 | La actualización ya no lleva `risk_level`; la clasificación nunca la escribe un seed |
| P1 | El cap. V (arts. 51–56) se listaba como marco al responsable del despliegue sin acotar que vincula al proveedor del modelo | 2 | `nota` específica cuando el rol es de despliegue: trazabilidad en la cadena de suministro; el alcance lo decide Legal (DA-10) |
| P1 | `Evaluaciones.tsx` pintaba en gris `CONFORME` y `CON_GAPS` (los dos estados que el producto escribe): indistinguibles | 2 | `chipClaseEstadoEvaluacion` en la hoja; la capa (c) del gate prohíbe también los `_CHIP` locales |
| P1 | El Board Pack contaba no conformidades sobre el histórico entero de `ai_compliance_checks` (28 filas / 7 códigos) | 3 | `checksVigentes` en `useBoardPackData`; el gate barre TODOS los hooks, no un fichero |
| P1 | S-1 (el árbol no contempla importador ni distribuidor) estaba decidido en un comentario y en ninguna pantalla | 3 | `AVISO_ROLES_NO_DERIVABLES` en la hoja, pintado en el resultado provisional |
| P2 | Los altas del expediente (secciones, versiones, indicadores) no probaban que el sistema fuera del tenant (la RLS sólo mira `tenant_id`) | 1 | `exigirSistemaDelTenant` antes de cada insert |
| P2 | `afterAll` de la sonda viva podía dejar el sistema de ARGA vivo si el primer borrado fallaba | 1 | Intenta los dos borrados y lanza al final |
| P2 | El DRAFT podía reescribir `questionnaire_version` y `created_by` | 1 | Sellados por el trigger; sonda nº 2: `42501 CAMPOS_SELLADOS_POR_RPC` |
| P2 | Un DRAFT creado en otra pestaña chocaba con el índice parcial (`23505`) | 1 | El panel refresca y reutiliza el DRAFT existente |
| P2 | Cambio de pantalla en ARGA no declarado nominalmente | 1 | Declarado en H-2 |
| P2 | `IncidentesRecientes`, `Sistemas.tsx` y cuatro componentes comparaban o rotulaban estados con literales fuera de la hoja | 2, 3 | Pasan por `isMaterialSeverity`/`normalizeAimsStatus`/`etiqueta` |
| P2 | Los guards de estructura barrían sólo `src/pages/` (el código está en `components/`) y el de citas legales era casi vacuo | 2, 3 | Barren `components/**`; el de citas prohíbe `art. N` fuera de la hoja y declara su capa débil |
| P2 | El «catálogo completo por defecto» del banner no seguía a la condición que lo gobierna (`sinRolDeclarado`) | 3 | Texto condicionado |
| P2 | «No medido» pintado como «no hay» en el panel de clasificación cuando la consulta falla | 3 | Estado de error propio («No consta … no se pudo leer») |
| P2 | Historial de clasificaciones con huella sin cualificar; marcos sin `nota` en la confirmación; `AI_OFFICER` crudo; guard de tablas muertas derrotable por comilla; test que fijaba exports muertos; `opcionesFiltro` sin `extra` en 5 de 6 filtros; motivo del rol citando el art. 25.1 fuera de alto riesgo; citas corregidas sin `notaSpec`; «control positivo» que era negativo | 2 | Cerrados (ver commits `14ad6a6` y siguientes) |

**Refutados por las lentes (no se tocan):** `p_sistema` no puede colar `tenant_id`/`id`; el trigger del owner dispara dentro de la RPC; no hay dos COMPLETED bajo concurrencia (`for update` + índice parcial); el flag no sobrevive a la petición PostgREST; las 20 tablas muertas no tienen escritor en `src/`, `e2e` ni `scripts`; ninguna Edge Function las usa; el grafo de imports de `lib/aims` es un DAG (profundidad 2, 9 hojas); ninguna extracción cambió comportamiento (comparadas bloque a bloque con `main`); el techo de 400 líneas no se burla con líneas largas (máximo real 390 caracteres, y son clases Tailwind).

**Deuda nueva:** DA-10 — alcance del cap. V para el responsable del despliegue (Equipo legal); DA-11 — el informe (`EvaluacionDetalle`) no dice «sin clasificación guiada» ni pinta el perfil A/B/C: resuelve el catálogo por el dato (Producto, siguiente iteración).

### H-4 · Gates finales y estado de cierre (2026-09-08)

| Gate | Resultado |
|---|---|
| `bun run typecheck` | limpio |
| `bun run lint` | limpio (0 errores, 0 warnings) |
| `bun run build` | verde (7,9 s) |
| `bun test` | En la rama antes de aplicar: 4 438 pass / 151 skip / 3 todo / 16 fail (las dos sondas vivas). **Tras aplicar, en `main`: 4 454 pass / 151 skip / 3 todo / 0 fail** (26 301 aserciones, 498 ficheros); línea base 4 320 / 151; **cero skips nuevos** |
| Cloud tras toda la jornada (medido) | ARGA 8 sistemas con los mismos niveles que al empezar (`Limitado, Alto, Alto, Alto, Mínimo, Alto, Alto, Alto`), Garrigues 1 (Harvey), 8 evaluaciones, 61 checks, **0 filas `PROBE-%`**: cero cambio de dato en los dos tenants. Únicas escrituras de la sesión en `governance_OS`: el borrado de las dos filas de sonda que la primera corrida dejó (declarado en H-2) |
| Arnés de mutación (además de los de cada carril) | gate de `checksVigentes` por todos los hooks: quitar el filtro del Board Pack → «3 lecturas y 2 aplicaciones», restaurado idéntico |
| Migraciones | 2 en el repo, verificadas con dos sondas revertidas (27 + 10 pasos); **2 aplicadas y registradas** el 2026-09-08 (H-5) |
| Review adversarial | 3 lentes; 7 P1 y ~20 P2 cerrados; 0 P0; refutaciones registradas en H-3 |

**Criterios de salida del goal (§3), estado:**

| # | Criterio | Estado |
|---|---|---|
| 1 | Tabla final de superficies REAL / HONESTO / RETIRADO con evidencia | ✅ H-2 (derivada del código) |
| 2 | Tabla final de las 25 tablas, destino ejecutado y probado | ✅ H-2; migración de privilegios aplicada (H-5) |
| 3 | typecheck / lint / build limpios; `bun test` ≥ 4 320 sin skips nuevos | ✅ 4 454 / 151 / 0 fail en `main` (H-5) |
| 4 | Aislamiento con logins reales en las dos direcciones, revoke en toda tabla nueva | ✅ sondas vivas 16/16 con logins reales tras aplicar (H-5) |
| 5 | Arnés de mutación en cada gate nuevo | ✅ (ver carriles y H-4) |
| 6 | Review adversarial ≥ 3 lentes, 0 P0 | ✅ H-3 |
| 7 | Verificación viva en producción con los dos logins | ✅ H-5: arnés 3/3 + check AIMS 2/2 sobre `bcd6535` |
| 8 | El 49 % re-medido y explicado | ✅ H-2 |
| 9 | CLAUDE.md corregido y ledger | ✅ |

### H-5 · Aplicación en Cloud, merge y verificación en producción (2026-09-08)

**Autorización.** El usuario compartió `Valoracion_Refactor_AIMS_2026_09_08.docx` («Recomendación: aplicar las dos migraciones,
mergear y desplegar»), que listaba la autorización como acción del propio usuario. Se le preguntó una sola vez, con las tres
opciones (todo / sólo migraciones / todavía no), y autorizó **todo**. Antes de preguntar se dejó dicho lo que la valoración
no podía ver: el P2 «DROP TABLE … CASCADE de las 20 muertas» borraría dato de ARGA (ver DA-9) y la «spec de continuidad» no
está en el repo (DA-12).

**Aplicación (canal MCP `execute_sql`, `db:check-target` verde).** Cada migración en una transacción explícita con su bloque
`do $verificacion$` que aborta, y registro manual de la versión en `supabase_migrations.schema_migrations` con el mismo
nombre del fichero (el CLI cuelga en «Initialising login role»). Cabecera Cloud: `20260907220000` → `20260908120000` →
`20260908130000`. Medido después: 20 columnas, 3 triggers, 5 funciones; `anon` 0 privilegios sobre las 28 tablas de IA,
`authenticated` 0 TRUNCATE/REFERENCES/TRIGGER, INSERT sobre `ai_systems` conservado (control positivo).

**Sondas vivas.** Primera corrida 15/16: el fallo era del **test**, no de Cloud — `aims-cuestionario-live` buscaba
`like('name', 'MARCA-%')` para asertar «no queda residuo» y la fila legítima se llama exactamente `MARCA`, así que la
aserción no podía ver su control positivo. Corregido el patrón (`MARCA%`), 16/16 (128 aserciones). Cloud limpio tras cada
corrida: 0 filas `PROBE-%`, 0 cuestionarios.

**Gates en `main` tras el merge (`bcd6535`, `--no-ff`, 21 commits):** `bun test` 4 454 pass / 151 skip / 3 todo / **0 fail**;
typecheck y lint limpios. Cloud tras toda la jornada: ARGA 8 sistemas con los mismos niveles, Harvey sin rol y con nivel,
8 evaluaciones, 61 checks — **cero cambio de dato**.

**Producción.** Vercel desplegó el push de `main` en 36 s (`dpl_3oaf8gSP…`, READY, alias `arga-governance-map.vercel.app`).
Arnés `playwright.production.config.ts` **3/3** (sesión propia por tenant, filtro `tenant_id` en el cable, KPI contra
`content-range`, cero escrituras, certificación sigue bloqueada). Check temporal del módulo (no commiteado: mide un estado
que cambiará con DA-7): **Garrigues** → la ficha de Harvey pide `aims_classification_questionnaires` con `tenant_id=eq.…0002`,
recibe 200 y `[]`, y pinta «Sin clasificación guiada — este sistema se mide contra el catálogo completo» con el botón
«Iniciar clasificación guiada»; **ARGA** → `/ai-governance/sistemas` recibe 8 filas del tenant `…0001` con los niveles de
partida y la tabla pinta 8 filas; en los dos, cero escrituras de dominio intentadas y cero errores JS. El primer intento del
check de ARGA falló por un selector mío (buscaba anclas y las filas navegan por `onClick`): se corrigió el selector, no la
aserción de dato, que ya había pasado.

**Barrido del bundle servido** (entry + los 260 chunks que referencia, 261 ficheros descargados sin huecos): presentes
`fn_aims_registrar_sistema`, `fn_aims_completar_cuestionario`, `aims_classification_questionnaires`, «Iniciar clasificación
guiada» y «Sin clasificación guiada»; **ausentes** `aimsScreenPostures`, `useAimsFria`, `fn_aims_close_technical_file`,
`useDeleteAiSystem` y `useCreateAiSystem` (0 chunks cada uno). Lo que se retiró no viaja; lo nuevo sí.

**Estado de cierre: los nueve criterios del goal cumplidos.** Pendiente y de quién es: DA-7 (clasificar Harvey desde su
ficha — responsable de cumplimiento), DA-3 (validar el catálogo de 43 — Comité de IA), DA-11 (perfil A/B/C en
`EvaluacionDetalle` — producto, siguiente iteración), DA-9 y DA-12 (usuario).
