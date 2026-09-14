# Backlog para consolidar AIMS y poder probarlo — análisis medido (2026-09-14)

Objetivo: saber qué queda entre `main` `c0e7073` y «el módulo AIMS está consolidado y un
responsable de cumplimiento de Garrigues puede probarlo de punta a punta sin que la pantalla
le mienta». No es una lista de deseos: cada punto lleva evidencia `archivo:línea` o SQL de
sólo lectura, y cada uno pasó por tres refutadores (realidad / prioridad / acción mínima).

## 0. Veredicto en cuatro líneas

1. **Nada bloquea la prueba.** Los ocho tramos del recorrido (dashboard → clasificar → evaluar
   → informe → expediente → incidente → alta → edición) están trazados en código y funcionan
   sobre el dato real. Cero hallazgos «BLOQUEA» de 60.
2. **El módulo nunca se ha visto con un sistema clasificado.** Cloud tiene 0 cuestionarios en
   los dos tenants. El primer acto del tester es clasificar a Harvey, y en ese instante afloran
   seis incoherencias latentes (bloque B1): los 12 checks del proveedor siguen contando, el
   informe del 49 % no dice contra qué catálogo se midió, el stepper dice «84 MGs» sobre 43,
   la ficha afirma «Riesgo Limitado» y «Sin clasificación guiada» a tres líneas, y la
   Declaración art. 47 nombra a Garrigues como PROVEEDOR de Harvey.
3. **Un tramo no lo ha recorrido nadie:** congelar → revisar. 0 evaluaciones congeladas y 0
   revisadas en todo el histórico de los dos tenants; ningún test cita las dos RPC. La traza
   estática es favorable, pero es el mismo patrón que el 09-06 destapó en la certificación.
4. **El dato de partida es 1 de 6 sistemas** y el seed que los siembra pisa `owner_id`/`status`
   en su segunda corrida. Se endurece primero, se siembra una vez con autorización, y el resto
   del dato lo crea la prueba (que para eso es la prueba).

## 1. Estado de partida, medido hoy

| Qué | Medida | Fuente |
|---|---|---|
| `main` | `c0e7073` (2026-09-08); **sin commits desde el merge** `bcd6535` | `git log` |
| Gates | `bun test` **4 454 pass / 151 skip / 3 todo / 0 fail** (498 ficheros); 0 skips ni todos en `src/test/aims` | corrida de hoy, 69 s |
| e2e AIMS (lote pequeño) | `e2e/16`, `e2e/23`, `e2e/aims-evaluaciones`, `e2e/19`: **17/17 verdes**, todos como ARGA | lente TEST, ejecutado hoy |
| Producción | `latestDeployment` READY del 2026-09-08 sobre `main`; el check versionado sólo visita `/ai-governance` y lee el rótulo | Vercel `get_project`; `e2e/production/ambos-tenants.check.ts:77` |
| Migraciones | cabecera Cloud `20260908130000`; las **22** de `202609*` del repo están registradas (paridad exacta en septiembre) | `schema_migrations` |
| Tablas | **26** `aims_*` (25 + `aims_classification_questionnaires`) + 4 `ai_*`; RLS habilitada en todas; `anon` 0 grants; `authenticated` 0 TRUNCATE/REFERENCES/TRIGGER | `information_schema`, `pg_class` |
| Dato ARGA | 8 sistemas (estados: ACTIVO 4, EN_EVALUACION 1, `Conforme` 1, `Pendiente` 1, `En revision` 1), 7 evaluaciones (APROBADO 5, BORRADOR 1, EN_REVISION 1), 49 checks, 1 incidente; `aims_technical_file_sections` 5, `aims_system_versions` 3, `aims_monitoring_indicators` 1 | SQL sólo lectura |
| Dato Garrigues | **1** sistema (Harvey `2f877e8c…`: rol NULL, perfil NULL, `risk_level` `Limitado`, `owner_id` NULL), 1 evaluación (`fdcccf9e…`, score 49, CON_GAPS, sin hash), 12 checks (códigos del proveedor), 0 incidentes; **0 filas en las 26 `aims_*`** | SQL sólo lectura |
| Congelación / revisión | 8 evaluaciones en total: **0 congeladas, 0 revisadas, 0 con `content_hash`** | SQL sólo lectura |
| Cuentas | Garrigues: `demo@` SECRETARIO y `admin@` ADMIN_TENANT (uid distintos, **`person_id` NULL** en las dos); ARGA: 1 sola cuenta | `user_profiles` ⋈ `auth.users` |
| Residuo de sondas | 0 filas `PROBE-%`/`MARCA-%`; 2 objetos `<tenant>/__sonda__/aislamiento.txt` en `aims-evidence` desde el 09-07 | SQL; lente TEST |

## 2. Cómo se midió

Siete lentes en paralelo (flujo de prueba humano trazado en código, código, tests/e2e, Cloud
en `BEGIN…ROLLBACK`, docs y memoria, UX Garrigues, dato y siembra) → **60 candidatos**. Cada
uno juzgado por tres refutadores con lente distinta (¿es cierto hoy en `c0e7073`? ¿la
prioridad y el dueño son los correctos para *poder probar*? ¿la acción es la mínima y de raíz?)
→ **0 refutados, 60 reformulados** (un refutador de UX-9 cayó por límite de sesión: ese
hallazgo tiene 2 votos). Un crítico de completitud verificó cinco dudas por su cuenta,
**reabrió dos** (FLUJO-5 y FLUJO-6, ver B3 y B2) y ejecutó `e2e/16 -g AIMS` (3/3). Lo que las
lentes no pudieron medir está en §6.

Regla de lectura: «DEGRADA» = el tester completa el flujo pero la pantalla le engaña o le
hace perder tiempo; «NO_BLOQUEA» = deuda que no cambia lo que el tester ve hoy. Ningún
hallazgo es «BLOQUEA».

## 3. Backlog por bloques

Cada entrada: qué está mal · evidencia · acción mínima (ponytail: reutilizar la hoja que ya
existe) · gate que lo fija · dueño · esfuerzo. Los ids son los del workflow; `DA-n` remite al
ledger `docs/superpowers/plans/2026-09-08-ledger-refactor-aims.md`.

### B1 · Coherencia tras clasificar — el módulo no sabe convivir con un sistema clasificado

Es el bloque que importa. Todo lo de aquí es **latente**: hoy no se ve porque nadie ha
completado un cuestionario; se ve en cuanto el tester clasifica a Harvey (DA-7), que es lo
primero que va a hacer.

| Id | Qué | Evidencia | Acción mínima | Dueño · esf. |
|---|---|---|---|---|
| **FLUJO-1** | Tras reclasificar a perfil C, los **12 checks del catálogo del proveedor** (QUALITY_MGMT, RISK_MGMT, …) siguen «vigentes» y alimentan los monitores del Dashboard junto a los 7 códigos del desplegador; 10 son NO_CONFORME | `checks-vigentes.ts:42-49` elige por `requirement_code`; `readiness.ts:319-325,420-449` casa por keywords sin mirar catálogo; Cloud: 12 códigos del proveedor en Garrigues | `codigosDelPerfil(sistema, catálogo)` en `perfil-aplicabilidad.ts` (una línea sobre `perfilAplicable`); `buildAimsComplianceMonitors` acota a ese set **sólo si `regulatory_profile.cuestionario_id` existe** y expone `otroCatalogo` como cifra aparte (no se borra histórico). Sin cuestionario sigue el fail-open (ARGA cero cambio) | PRODUCTO · S |
| **FLUJO-2 / DATA-2** (= DA-11) | El informe del 49 % resuelve el catálogo **por los findings** y no dice que se midió contra el proveedor ni que el sistema ya tiene otro perfil; `useAssessmentById` no trae `regulatory_role` | `EvaluacionDetalle.tsx:73-79`, `CabeceraInforme.tsx:249-262` (aviso sólo cuando el catálogo ES el del desplegador), `useAiAssessments.ts:84,103` | Añadir `regulatory_role` a los dos selects; `evaluadaContraOtroCatalogo(findings, sistema, catálogo)` en la hoja; aviso «evaluada contra el catálogo del proveedor (84); el sistema está clasificado como responsable del despliegue: reevaluar contra las 43» en `CabeceraInforme` y `TabEvaluaciones`. Sin recalcular score; con perfil NULL no se pinta nada | PRODUCTO · S–M |
| **FLUJO-3 / UX-8** | El stepper rotula «Evaluación 84 MGs» mientras el banner del mismo paso dice «43 medidas» | `EvaluacionNueva.tsx:52` (`PASOS` constante) vs `PerfilAplicabilidadBanner.tsx:62` | `PASOS` dentro del componente con `allMeasures.length` (ya calculado en l.105); «medida» en vez de «MG» en rótulos; quitar «— 12 requisitos» del label EU_AI_ACT (l.45) | PRODUCTO · S |
| **UX-5** | La ficha afirma «Riesgo Limitado» (chip amarillo desde `risk_level` sembrado) y tres líneas abajo «Sin clasificación guiada». El Dashboard lo cuenta como clasificado y la tarjeta de clasificación como sin clasificar | `CabeceraSistema.tsx:110-115`; `Sistemas.tsx:178-198`; Harvey: `risk_level` `Limitado`, perfil NULL | `tieneClasificacionGuiada(s)` de una línea en `cuestionario-calificacion.ts` (lee `regulatory_profile?.cuestionario_id`), reutilizada por el banner (`:47`), la cabecera y el chip del inventario: sin cuestionario, chip neutro «nivel declarado en ficha, sin cuestionario» | PRODUCTO · S |
| **CODE-5 / UX-6** | «Declaración de Conformidad UE (art. 47)» se ofrece a **todo** sistema y el `.txt` descargable dice «PROVEEDOR RESPONSABLE: Garrigues» con «arts. 9 a 17, 72 y 73» y «catálogo de 84 medidas». Para Harvey (despliegue, limitado) es una afirmación de rol falsa que el aviso «Borrador» no corrige | `CabeceraSistema.tsx:64-73` sin condición; `DeclaracionConformidadModal.tsx:64-66,180`; el criterio ya vive en `derivarMarcos` (`RIA_ARTS_17_47` sólo proveedor+Alto) | `vinculaArt47(rol, nivel)` junto a `vinculaArt11` en `expediente-tecnico.ts` (mismo tri-estado); el **modal** (raíz, no el botón) devuelve aviso cuando `null`/`false` («Sin clasificación guiada: el art. 47 no se afirma» / «no vincula a este rol y nivel») y sólo genera documento con `true`; gate en `no-fabricated-claims` | PRODUCTO · S |
| **TEST-3** | `e2e/aims-evaluaciones.spec.ts:84` exige ver «Sistema de gestión de riesgos» (art. 9, catálogo del proveedor) sobre «el primer sistema de ARGA»: **se pondrá rojo** cuando alguien clasifique ese sistema, que es exactamente probar el módulo | el spec elige `#eval-system` por posición | Asertar la invariante: banner «Perfil de aplicabilidad:» visible + `Requisitos RIA (N)` con N ≥ 1; sistema por nombre, no por índice | PRODUCTO · S |

Salida verificable del bloque: unitarios con **doble control** — 12 checks del proveedor +
sistema RESPONSABLE_DESPLIEGUE/Limitado → 0 sumadas y `otroCatalogo = 12`; el mismo sistema
con rol NULL → cuentan 12 (fail-open intacto); `vinculaArt47` PROVEEDOR/Alto → true, despliegue
→ false, null → null; gate de texto sin `\b84\b` renderizado fuera del catálogo A.

### B2 · Dato de partida y persistencia de Garrigues

| Id | Qué | Evidencia | Acción mínima | Dueño · esf. |
|---|---|---|---|---|
| **FLUJO-6** (reabierto por el crítico → DEGRADA) | El seed de IA **pisa dato sembrado** en su segunda corrida: la rama `actualiza` hace `UPDATE` con todo `aFila` salvo `risk_level` → `owner_id: null`, `status` y `description` del catálogo sobre lo que el tester haya cambiado. Hoy Harvey cae en `adopta` (segura); a partir del primer `--commit` todos caen en `actualiza`. Contradice la orden vigente y la propia cabecera del script («no borra nunca lo que no creó») | `scripts/seed-garrigues-ia.ts:102-114` (`aFila` con `owner_id: null`), `:268-274` (`.update(sinClasificacion)`) | Eliminar la rama de escritura de `actualiza` y enrutarla por el bucle «rellenar sólo vacíos» de `adopta` (`:281-289`); ampliar `seed-ia-siembra-progresiva.test.ts` con `sinComentarios`: ningún `.update(` de fila completa. **Antes del primer `--commit`** | PRODUCTO · S |
| **DATA-6 / CLOUD-3** | El catálogo siembra `status: 'PLANIFICADO'` (GARR-IA-201, «plan, no desplegado») y ese valor no está en `ESTADOS_SISTEMA`: chip crudo, y el modal de edición lo reescribiría | `catalogo-ia.ts:44,173`; `vocabulario.ts:16`; `ai_systems.status` sin CHECK | Añadir `PLANIFICADO` a `ESTADOS_SISTEMA` / etiqueta «Planificado» / plural «Planificados» / chip neutro (honesto para un plan). **No** mapearlo a EN_EVALUACION: un roadmap presentado como sistema en evaluación es una afirmación falsa. Antes del `--commit` | PRODUCTO · S |
| **DATA-1 / TEST-8 / CODE-9** | El inventario es **1 de 6**. Dry-run ejecutado hoy: **5 altas + 1 adopción** (Harvey recibe `GARR-IA-002` sin pisar estado ni clasificación), 0 problemas, tabla 9→9. El trigger `ALTA_SOLO_POR_CUESTIONARIO` sólo rechaza `auth.role()='authenticated'`: `service_role` pasa (probado en ROLLBACK) | `20260908120000:222-231`; `seed:263` | Tras FLUJO-6 y DATA-6: `bun run db:check-target` y **una** corrida `bun run scripts/seed-garrigues-ia.ts --commit` desde el árbol canónico, con autorización expresa. No sembrar evaluaciones, evidencias ni incidentes: se crean desde la app durante la prueba. Los 5 nacen «Sin clasificación guiada» hasta que se clasifiquen (DA-7 ampliado a 6) | USUARIO autoriza · S |
| **FLUJO-4 / DATA-4** | **Ningún sistema existente puede recibir responsable**: el selector sólo está en el alta; Harvey y los 5 sembrados llevan `owner_id` NULL; el cuestionario avisa «no tiene propietario asignado» de forma permanente (aviso, no bloqueo) | `SistemaNuevo.tsx:216-233` vs `EditarSistemaModal.tsx:40-50`; el trigger `fn_ai_systems_owner_mismo_tenant` ya protege | Copiar el `<select>` de responsable (`usePersonasCanonical({person_type:'PF'})`, opción «Sin asignar») al modal y enviar `owner_id` en `updates`; `useUpdateAiSystem` ya acota por tenant | PRODUCTO · S |
| **CLOUD-2** | **Un usuario demo de Garrigues borra desde PostgREST todo el dato IA del tenant en tres llamadas**: probado en ROLLBACK como `demo@garrigues-demo.dev` → DELETE `ai_compliance_checks` 12 filas, `ai_risk_assessments` 1, `ai_systems` 1; y el borrado del sistema arrastra **en cascada** el cuestionario «inmutable» (su trigger es sólo BEFORE UPDATE). `authenticated` conserva DELETE en 8 tablas; ninguna pantalla lo usa | `role_table_grants`; políticas FOR ALL por tenant; las sondas `aims-cuestionario-live:76,92` y `garrigues-ia-owner-write:74,89,177` borran PROBE como `authenticated` | Migración (patrón `20260908130000`, verificación que aborta, control positivo): `REVOKE DELETE` en las 7 sin uso (`ai_incidents`, `ai_risk_assessments`, `ai_compliance_checks`, `aims_system_versions`, `aims_incident_regimes`, `aims_monitoring_indicators`, `aims_technical_file_sections`). **Para `ai_systems` decide el usuario**: revocarlo exige mover la limpieza de PROBE de las dos sondas a un cliente `service_role`. Se versiona ya; se aplica sólo con autorización | PRODUCTO redacta · USUARIO autoriza · S |
| **CLOUD-4** | **Seis políticas RLS sin espejo en el repo** (`ai_risk_assessments_tenant_{select,insert,update}` y las tres homólogas de checks) coexisten con las FOR ALL de `20260521150000`: mismo predicado, permisivas, redundantes → sin cambio de comportamiento, pero drift schema↔repo en la superficie del módulo | `pg_policies` hoy; `grep` de sus nombres en `supabase/migrations` = 0 | Migración de reconciliación (`DROP POLICY IF EXISTS` ×6 + bloque que aborta si no queda exactamente una por tabla), versionada como deuda hasta autorización | PRODUCTO · S |
| **CLOUD-5** | `ai_systems.tenant_id` **sin FK** a `tenants` y `status` **sin CHECK**: tres filas de ARGA llevan `Conforme`/`Pendiente`/`En revision`, fuera del vocabulario | `pg_constraint`; SQL de estados | Deuda a ledger. La FK es aditiva y segura (las 9 filas resuelven); el CHECK exige decidir qué hacer con las 3 grafías de ARGA (cero-cambio) → decisión del usuario, no ahora | USUARIO · M |

### B3 · El tramo que nadie ha recorrido: congelar → revisar

| Id | Qué | Evidencia | Acción mínima | Dueño · esf. |
|---|---|---|---|---|
| **FLUJO-5** (reabierto → no verificado) | La traza dice que funciona: `fn_aims_freeze_assessment` escribe `frozen_by_id = auth.uid()`, `fn_aims_review_assessment` rechaza `MISMO_EVALUADOR` si `auth.uid() = frozen_by_id` y no exige rol; Garrigues tiene dos uid distintos. Pero **0 congeladas / 0 revisadas en todo el histórico** y **0 tests** citan las RPC (`grep` en `src/test` y `e2e`) | `20260907210000:143,168,195-201`; SQL | Sonda viva en `src/test/schema` (patrón `aims-cuestionario-live`): registrar PROBE por RPC como `demo@`, insertar evaluación CON_GAPS, congelar con `demo@`, revisar con `demo@` (espera `MISMO_EVALUADOR`), revisar con `admin@` (espera `reviewed_by_id ≠ frozen_by_id`); barrido `PROBE-%` en `beforeAll` y `afterAll` | PRODUCTO · S |
| **UX-2** | «Revisar y aprobar» se pinta activo para la **misma cuenta que congeló**: el tester descubre la regla en un toast rojo. En ARGA (1 cuenta) el tramo **no se puede completar nunca** y la pantalla no lo dice | `CabeceraInforme.tsx:220-229` (`disabled={revisando}`), sin `useAuth` | `mismaCuenta = user.id === assessment.frozen_by_id` → `disabled` + `title` «La revisa una persona distinta de quien la congeló: entra con otra cuenta». No tocar la RPC | PRODUCTO · S |
| **DATA-5** | La custodia pinta fechas («Congelada el…») pero **no quién**; `frozen_by_id`/`reviewed_by_id` no se muestran, y los dos perfiles de Garrigues tienen `person_id` NULL, así que no hay nombre que resolver | `CabeceraInforme.tsx:189-193`; `user_profiles` | (1) Sólo código: pintar `frozen_by_id`/`reviewed_by_id` de la fila con la convención `id.slice(0,8)…`; (2) decisión del usuario: enlazar `person_id` de las dos cuentas demo a dos `persons` del censo para que salga el nombre | PRODUCTO · S / USUARIO |

### B4 · Defectos de pantalla que el tester va a pisar

| Id | Qué | Evidencia | Acción mínima | Dueño · esf. |
|---|---|---|---|---|
| **CODE-1** | Wizard: cambiar de **marco** tras contestar convierte el BORRADOR EU_AI_ACT en ISO con findings vacíos por `UPDATE` de la misma fila; cambiar de **sistema** deja el autoguardado en error permanente (`draftId` no se reinicia) | `EvaluacionNueva.tsx:227,253-272,259-260` | Un `cambiarParametros()` que resetea `draftId`, `borradorCargado`, `evaluations`, `additionalMeasures`, `planEditado`, `notes`, `sucioRef`; cableado a los dos `onChange` del paso 1; `.eq("framework")` en el UPDATE. Test: dos autoguardados con marcos distintos → dos filas BORRADOR | PRODUCTO · S |
| **CODE-6** | Un **BORRADOR** cuenta como «Requieren GRC» (KPI rojo) y ofrece «Abrir GRC» al intake de Risk 360; el Dashboard lo arrastra al monitor «Expediente técnico» | `readiness.ts:137-146`; `Evaluaciones.tsx:54,275-284` | `if (normalizeAimsStatus(status) === "BORRADOR") return false;` **antes** de los tres ramales (el score 0 del borrador lo reincluiría). **Cambia un KPI de ARGA** (1 BORRADOR + 1 EN_REVISION): declararlo en el ledger como corrección de defecto probado | PRODUCTO · S |
| **CODE-2** | Cuatro páginas y las cinco pestañas de la ficha convierten un **error de lectura en «no hay datos»** (`isError` ignorado): con un 403 el tester lee «Sin inventario registrado» | `Dashboard.tsx:212-213`, `Sistemas.tsx:155-160`, `Evaluaciones.tsx:193-197`, `Incidentes.tsx:172-177`, `SistemaDetalle.tsx:44-48` | Leer `isError` y pintar «No se pudo leer (motivo)»; KPIs en neutro con «—». Gate: queryFn que rechaza → no aparece el literal de vacío | PRODUCTO · S+ |
| **CODE-3 / UX-7 / FLUJO-7** | Incidentes: el alta persiste `ria_severity = ORDINARY_SERIOUS` **por defecto** aunque el tipo quede «Sin clasificar»; en la ficha el valor guardado manda, así que el desplegable de edición («Recalcula el plazo del art. 73») **es inerte** y `handleSave` no lo envía; dos textos afirman «no hay columna» | `IncidenteNuevo.tsx:36,79`; `IncidenteDetalle.tsx:56-65,124`; `EdicionIncidente.tsx:157-175`; `RelojesRegulatorios.tsx:72-77` | Opción «No declarado» (`""`) en `GRAVEDAD_RIA` y arranque en `""`; `handleStartEdit` inicializa desde `incident.ria_severity`; `handleSave` envía `ria_severity: v || null`; reloj usa el borrador cuando `isEditing`; flag `severityPresumed` en `incident-clocks` (patrón `highRiskUnconfirmed`); retirar los dos textos; gate invertido en `no-fabricated-claims:940` | PRODUCTO · S |
| **CODE-4** | «Fecha de conocimiento» pinta `reported_at` mientras los relojes se calculan desde `knowledge_at`: dos cifras contradictorias en la ficha | `EdicionIncidente.tsx:188-192` vs `IncidenteDetalle.tsx:117` | Pintar `knowledge_at`, y si es NULL «(no declarada; se usa la de reporte)»; test que falle si el rótulo se alimenta de `reported_at` | PRODUCTO · S |
| **UX-1** | Los **códigos crudos de las RPC llegan al toast**: «CLASIFICACION_INCOHERENTE: …», «MISMO_EVALUADOR: …», «ART63_MOTIVACION_OBLIGATORIA» | 0 mapeos en `src/`; `ClasificacionVigentePanel.tsx:44` ya tiene un helper local `mensaje` | Moverlo a la hoja `src/lib/aims/errores-rpc.ts` como `mensajeUsuario(err)` (separa `CODIGO: texto`, texto principal, código como detalle) y usarlo en los catch de clasificación, informe, evidencia y expediente | PRODUCTO · S |
| **UX-3** | `CON_GAPS` y `EN_EVALUACION` **en crudo** en el chip grande del informe y en la ficha resumen del paso 1 (fuera de las 7 pantallas del gate) | `CabeceraInforme.tsx:125-133`; `PasoParametros.tsx:103` | `chipClaseEstadoEvaluacion` + `etiqueta("estadoEvaluacion", …)`; `etiqueta("estadoSistema", …)`; añadir los dos ficheros a `PANTALLAS` del gate | PRODUCTO · S |
| **UX-4 / CODE-7 / CLOUD-5(código)** | Dos modales declaran **listas de estado a mano** con rótulos crudos y un valor (`SUSPENDIDO`) que no existe en el vocabulario; el gate no los barre | `EditarSistemaModal.tsx:143-148`; `EdicionIncidente.tsx:147-149` | `ESTADOS_SISTEMA.map(...)` / `ESTADOS_INCIDENTE.map(...)` como `SistemaNuevo.tsx:279-281`; el valor actual como opción extra si no está en el vocabulario (grafías viejas de ARGA); quitar `SUSPENDIDO` (0 filas, ningún camino lo escribe); extender el barrido de `<option>` del gate | PRODUCTO · S |
| **UX-10** | Un **borrador de reclasificación no se puede descartar** («Cancelar» sólo oculta; sin DELETE y con índice parcial de un DRAFT por sistema, el botón queda en «Continuar borrador» para siempre), y su bloqueo por art. 5 dice «No puede **registrarse**» sobre un sistema ya registrado | `ClasificacionVigentePanel.tsx:72-87`; `cuestionario-calificacion.ts:435-443` | `bloqueosParaConfirmar(…, modo)` con copy de reclasificación («No puede confirmarse esta clasificación: revise la respuesta del art. 5»); texto «El borrador se conserva hasta que se confirme» junto al botón. Descartar borradores exige decisión aparte (trigger/grant) | PRODUCTO · S |
| **UX-9** (2 votos) | **Jerga de desarrollador al usuario**: chip «legacy_write · ai_incidents», nombres de tablas en `<code>` dentro de ayudas, «Readiness de demo AIMS» / «Standalone-ready» / «Demo con gaps», `AIMS_TECHNICAL_FILE_GAP` y `NOT_EVIDENCE` en tarjetas, placeholder en inglés | `IncidenteNuevo.tsx:120-126`; `TabExpedienteTecnico`, `ReadinessDomains.tsx:198`; `HandoffAffordances`; `PrioridadAhora` | Borrar el chip; «registro interno sin hash de integridad» sin nombrar tablas; «Estado del módulo» con «Operable / Con carencias»; ocultar `contractEvent`, traducir la postura; placeholder en castellano. **Coordinar con TEST-7** (los e2e fijan «Readiness de demo AIMS») | PRODUCTO · S |
| **CODE-8** | `readiness.ts` compara `status` con literales sin normalizar (`=== 'ACTIVO'`, `'ABIERTO'`) mientras Dashboard y chips normalizan: dos predicados de «activo» sobre la misma columna | `readiness.ts:342,458,466-467` vs `Dashboard.tsx:122-141` | `normalizeAimsStatus(...)` en las cuatro comparaciones (misma forma que la l.152 del propio fichero); test con una fila «Activo» que exija igualdad KPI = dominio | PRODUCTO · S |
| **UX-11** | Evidencia y controles de medida **sin label visible asociada** (solo placeholder + aria-label); error L8 con `aria-invalid` sin `aria-describedby`. Es el control que más veces se toca (43–84 medidas) | `EvidenciaDeMedida`; `ControlesDeMedida.tsx:108` | `useId()` + `htmlFor`/`id` por medida; `aria-describedby` al `<p>` de error (patrón `FormularioIncidente.tsx:81`); `<label>` en vez de aria-label en evidencia | PRODUCTO · S |
| **UX-12** | El vacío del inventario dice «Ajusta búsqueda, riesgo o estado» aunque no haya ningún sistema | `Sistemas.tsx:155` | Rama `systems.length === 0` → «Sin sistemas registrados en el inventario» (copy de `PrioridadAhora.tsx:68`) | PRODUCTO · S |

### B5 · Red de pruebas: lo que hoy no vigila nadie

| Id | Qué | Evidencia | Acción mínima | Dueño · esf. |
|---|---|---|---|---|
| **TEST-2** | **Ningún e2e AIMS corre como Garrigues**: `setup` autentica siempre con `loginAsDemo(page,'arga')`; sólo `01-auth` y el check de producción nombran a Garrigues. El estado real del tenant (1 sistema, 0 cuestionarios, 0 evidencias) no lo recorre nadie | `e2e/fixtures/demo-credentials.ts:24`; `grep garrigues e2e/*.spec.ts` | Sin tocar `auth.setup.ts` ni `playwright.config.ts`: `for (const entorno of ['arga','garrigues'])` con `test.use({ storageState: { cookies: [], origins: [] } })` + `loginAsDemo(page, entorno)` en `e2e/23` y `aims-evaluaciones` (sólo lectura en Garrigues), asertando `tenant_id=eq.…0002` en el cable | PRODUCTO · S |
| **TEST-1** | **Ningún e2e abre una ficha de detalle** (`/sistemas/:id`, `/evaluaciones/:id`, `/incidentes/:id`) ni recorre el cuestionario, el expediente, la vigilancia o los subexpedientes: todo lo que el 08 construyó con escritura real sólo lo cubren gates de arista y la sonda SQL | `grep` de rutas en `e2e/` | Spec «aims-cuestionario-golden-path» como Garrigues: alta por cuestionario (despliegue·limitado), ficha con clasificación vigente, reclasificación v2 con motivación art. 6.3, sección del expediente, indicador, régimen de incidente. Espécimen `PROBE-E2E-<uuid>`, barrido por prefijo en `beforeAll` **y** `afterAll` con cliente Node logueado como Garrigues (patrón `aims-cuestionario-live.test.ts:24,90-92`) | PRODUCTO · M |
| **TEST-4** | El check de producción **sólo lee el rótulo** de `/ai-governance`; el check de la ficha de Harvey del 08 fue temporal y no está en el repo: la verificación de producción del módulo no es reproducible | `e2e/production/ambos-tenants.check.ts:76-77` | Dentro del `try` por tenant que ya existe: capturar el GET a `aims_classification_questionnaires` con `tenant_id=eq.<tenant>` (200), abrir la primera ficha y asertar el estado de clasificación **por concepto** (con o sin fila COMPLETED), no por frase | PRODUCTO · S |
| **TEST-7** | `e2e/23:41,53` y `e2e/16:124` **fijan rótulos de demo** («Readiness de demo AIMS», «Demo AIMS conectada»): se pondrán rojos al retocar el copy (UX-9) sin que nada se rompa | los tres literales | `getByLabel('Estado del inventario AIMS')` (aria-label ya existente en `Sistemas.tsx:83`); `aria-label="Readiness AIMS"` en la raíz de `ReadinessDomains` y asertar por label. **Mismo commit que UX-9** | PRODUCTO · S |
| **TEST-6** | Las sondas vivas escriben en Cloud en cada `bun test` (también un PROBE en ARGA para la dirección inversa); un kill antes del `afterAll` deja residuo (ya pasó el 08); y `aims-evidence-tenant-isolation` dejó **2 objetos permanentes** en el bucket (sin DELETE en storage) | `aims-cuestionario-live.test.ts:65-67`; bucket | Barrido `PROBE-CUESTIONARIO-%` en `beforeAll` por cada cliente (cada tenant lo suyo por RLS); declarar en el ledger los 2 objetos `__sonda__` como residuo conocido (borrado puntual como `service_role` = decisión del usuario) | PRODUCTO · XS |

### B6 · Documentación y memoria desfasadas (un solo commit)

| Id | Dónde | Dice | Debe decir |
|---|---|---|---|
| **DOCS-1 / TEST-5 / FLUJO-8** | `CLAUDE.md:238` | «`/ai-governance/evaluaciones/nuevo` no se activa aún: el probe de INSERT falla por RLS 42501» | owner-write sobre `ai_risk_assessments` + `ai_compliance_checks` (sin `tenant_id` propio; RLS por join a `ai_systems` desde `20260521150000`, `useAiAssessments.ts:220-238` comprueba pertenencia); congelación por `fn_aims_freeze_assessment`; e2e `aims-evaluaciones` verde. Ya lo marcó la revisión del 09-02 (§2.3 ítem 5) y no se corrigió |
| **DOCS-2** | `CLAUDE.md:236` y tabla de ownership `:218` | alta = `legacy_write` INSERT directo «sin usar `aims_*`» | alta = cuestionario guiado + RPC `fn_aims_registrar_sistema` (escribe `ai_systems` + `aims_classification_questionnaires`); INSERT directo como `authenticated` → `ALTA_SOLO_POR_CUESTIONARIO`. Contradice `CLAUDE.md:436` |
| **DOCS-3** | `CLAUDE.md:331,424-425`; `frontera-backbone.test.ts:5`; cierre 09-07 `:21,173`; memoria 09-07 | 28 / 25 / «25 (6+20)» | **26** `aims_*` (25 el 08 + la nueva); el «28» del 09-02 sumaba las 4 `ai_*`. El gate cuya lista ES la decisión tiene una cabecera que contradice sus propios arrays |
| **DOCS-5** | `CLAUDE.md:113` | «`branding.scopes` sembrado con 8 ámbitos» | **NULL en los dos tenants** (SQL hoy); `scopesForTenant` cae a defaults y `filterSystemsByScope` queda inerte. Un tester que busque el selector de 8 ámbitos lo reportará como regresión |
| **DOCS-6** | `CLAUDE.md:321` | «Le falta la aserción de tenant» a `fn_aims_close_technical_file` | aplicada en `20260906101036` (no medida en vivo); desde `20260908130000` sin EXECUTE para `authenticated` y sin llamador en UI. **CLOUD-6**: no abrir migración de DROP; es código muerto declarado (DA-9) |
| **DOCS-4** | memoria `project_c2_ai_governance_auditoria.md` y `MEMORY.md:58` | «fachada contra 10 tablas inexistentes», «fabrica sellos QSEAL», «persiste CONFORME sin contestar» | cabecera «SUPERADA el 2026-09-08 salvo el punto 3 (scopes NULL)»; no borrar el histórico del P0 |
| **DOCS-7** | `reviews/2026-09-02-revision-profunda-carriles-garrigues.md` §2.3 y §6.2 | ≥5 P1/P2 de AIMS listados como abiertos y ya cerrados (`/nueva`, «Precintar», FRIA, e2e muerto) | una nota tras el blockquote de la l.3: «informe HISTÓRICO, superado; lista viva = ledgers 09-05 / 09-06 / 09-08» |

### B7 · Lo que NO es backlog de producto (reservado o ya decidido)

- **DA-7 es la prueba, no un pendiente:** clasificar a Harvey (y a los 5 sembrados) desde su
  ficha lo hace el responsable de cumplimiento. El producto no lo rellena por él.
- **Comité de IA:** DA-2 (catálogo del perfil B), DA-3 (validar las 43). **Equipo legal:** DA-1
  (importador/distribuidor), DA-4 (art. 27), DA-5 (Q1.2), DA-10 (cap. V para despliegue). Hasta
  entonces: perfil B falla abierto y lo dice; perfil C «cobertura provisional».
- **DATA-7:** en Garrigues ningún sistema saldrá PROVEEDOR+Alto, así que el expediente técnico
  se prueba como **marco operativo** («el art. 11 no vincula a este rol y nivel»). El gate del
  art. 11 se prueba en ARGA. No sembrar un proveedor ficticio de alto riesgo.
- **DATA-3:** las notas de la evaluación de Harvey (1 500 chars) **no** contienen afirmaciones
  fabricadas: son un plan de adaptación de 6 acciones en prosa (art. 50, art. 4, art. 28 RGPD,
  ISO 42001) coherente con un despliegue limitado; `action_plan` es NULL, así que el PDA
  estructurado pinta «0 acciones». No tocar la fila; se regenera al reevaluar contra las 43.
  Deuda aparte: `assessor_id` no lo escribe nunca el wizard.
- **CLOUD-1, cerrado sin defecto:** las políticas FOR ALL sin `WITH CHECK` de `ai_systems` /
  `ai_incidents` **sí** bloquean el cambio de `tenant_id` (Postgres reutiliza el USING para la
  fila nueva; probado en ROLLBACK → 42501). No abrir deuda.
- **DA-9 / DA-12:** las 20 tablas muertas y la «spec de continuidad» siguen donde estaban.

## 4. Orden de ataque

Cada paso con criterio de salida verificable. Cloud sólo se toca en los pasos 2 y 6, con
autorización expresa por cambio.

1. **Seed y vocabulario antes de sembrar** (FLUJO-6, DATA-6). Salida: `bun test src/test/garrigues
   src/test/aims src/lib/aims/__tests__` verde; dry-run sigue diciendo «5 altas, 1 adopción, 0
   actualizaciones»; mutación: reponer el `.update(sinClasificacion)` pone rojo el gate del seed.
2. **Sembrar una vez** (DATA-1) con autorización: `bun run db:check-target` → `--commit` desde el
   árbol canónico → segundo dry-run. Salida: «Discriminante OK»; SQL sólo lectura: Garrigues 6
   filas con 6 `aims_reference_code` distintos, ARGA 8 (mismos ids); un tercer `--commit` no
   cambia `owner_id`/`status`/`description` de ninguna fila.
3. **Sonda viva congelar → revisar** (FLUJO-5) + UX-2 + DATA-5(código). Salida: test verde con
   los dos logins de Garrigues (`persistSession: false`); aserción del 42501 `MISMO_EVALUADOR`
   con la misma cuenta como control positivo; 0 filas `PROBE-%` después; ARGA en 8/7/49.
4. **Defectos que gatean el guion** (B4 entero + FLUJO-4). Salida: `bun test` ≥ 4 454 / 0 fail,
   typecheck, lint y build limpios; ledger anota el delta de KPI en ARGA por CODE-6 (1 BORRADOR
   + 1 EN_REVISION) como corrección de defecto; por cada gate nuevo una mutación lo pone rojo.
5. **Coherencia post-clasificación** (B1 entero). Salida: los unitarios con doble control de
   §3-B1; `bun test` completo verde; fail-open intacto (rol NULL → cuentan 12).
6. **Persistencia en Cloud** (CLOUD-2, CLOUD-4): migraciones versionadas con verificación que
   aborta; sonda revertida; aplicar sólo con autorización. Salida: `authenticated` sin DELETE en
   las 7; `pg_policies` una política por tabla en assessments/checks; sondas vivas 16/16.
7. **e2e en los dos entornos y check de producción** (TEST-2, TEST-3, TEST-7, TEST-4, TEST-6;
   TEST-1 si hay tiempo). Salida: lote pequeño verde con las dos ramas de tenant asertando el
   tenant del perfil autenticado; el check de producción falla si la política responde 42501 o
   si la pantalla afirma clasificación sin fila COMPLETED.
8. **Docs en un commit** (B6) y **despliegue**: push, `latestDeployment` = HEAD, check de
   producción con sesión en los dos tenants, y entregar el guion (§5) al responsable de
   cumplimiento. Salida: `grep -n "no se activa aún" CLAUDE.md` → 0; tras la primera pasada
   humana, SQL: ≥ 1 COMPLETED en `aims_classification_questionnaires` de `…0002`, ≥ 1 evaluación
   con `content_hash` y `reviewed_by_id ≠ frozen_by_id`, 0 `PROBE-%`, ARGA 8/7/49 sin variación.

Estimación: pasos 1, 3, 4, 5 y 8 son código y tests de una sesión larga; 2 y 6 dependen de
dos autorizaciones; 7 es el que más tarda (Playwright en lotes pequeños, dos tenants).

## 5. Guion de la prueba humana (para cuando llegue el paso 8)

Como `demo@garrigues-demo.dev`:

1. `/ai-governance`: la tarjeta «Clasificación guiada» debe decir 0 de 6 (tras el seed).
2. Ficha de Harvey → «Iniciar clasificación guiada» → nueve preguntas (previsibles para un
   despacho que usa un asistente contratado: Q1.1–Q1.3 No, Q2.1 No, Q2.2 No, Q2.4 Sí, Q2.5 Sí)
   → confirmar. Esperado: Responsable del despliegue · Limitado · perfil C · GPAI; huella
   SHA-512 de 128 hex «calculada en servidor; no acredita fecha cierta».
3. Volver a la ficha: el chip de nivel y el panel de clasificación deben decir **lo mismo**
   (UX-5); el aviso de propietario desaparece tras asignar responsable en «Editar» (FLUJO-4).
4. `/evaluaciones/nuevo` para Harvey: banner «Perfil C · 43 medidas · cobertura provisional»;
   el stepper dice 43, no 84 (FLUJO-3). Contestar, marcar una L8 **sin** motivo → la medida no
   acredita y lo dice. Subir una evidencia a una medida → «huella de navegador».
5. Abrir el informe **antiguo** del 49 %: debe avisar «evaluada contra el catálogo del
   proveedor (84); reevaluar contra las 43» (FLUJO-2). El Dashboard no debe sumar sus 12
   checks como no conformidades del perfil vigente (FLUJO-1).
6. Informe nuevo → **Congelar** con `demo@`. Sin cerrar sesión, pulsar «Revisar y aprobar»:
   debe estar deshabilitado (UX-2); si estuviera activo y aprobara, la regla de cuatro ojos
   está rota. Cerrar sesión desde el menú de usuario, entrar como `admin@`, revisar. La
   custodia muestra dos identificadores distintos (DATA-5).
7. Expediente técnico: «Iniciar expediente (anexo IV)» → 9 secciones; editar una; registrar
   versión e indicador. La cabecera dice «marco operativo, no obligación» (DATA-7): correcto.
8. Incidente nuevo con tipo «No declarado» → la ficha no presume gravedad del art. 73
   (CODE-3); cambiar la tipología en edición **recalcula** el reloj y se guarda. Abrir
   subexpediente RIA con motivación ≥ 20 caracteres. Los escalados a GRC/Secretaría abren
   intakes de sólo lectura.
9. Alta de un séptimo sistema por cuestionario; editar uno existente sin ver rol ni nivel.
10. Control ARGA (`demo@arga-seguros.com`): 8 sistemas, mismos niveles, el informe BORRADOR ya
    no cuenta en «Requieren GRC» (CODE-6, declarado).

## 6. No medido, y se dice

- **Nada se recorrió en navegador ni se escribió en Cloud**: todo veredicto «FUNCIONA» es traza
  estática + lectura de políticas + sondas revertidas. Las tres sondas vivas no se relanzaron
  (escriben PROBE en ARGA y Garrigues); su verde es el del `bun test` de hoy.
- El par congelar/revisar, la subida real de un `File` desde el navegador al bucket y el
  `--commit` del seed no se ejecutaron (son escrituras). El seed sólo se probó por dry-run y
  reproduciendo sus sentencias en ROLLBACK.
- El check de producción no se lanzó contra Vercel; se juzgó por lectura.
- Supabase Auth «Allow new users to sign up» no es legible por API: señal indirecta, 4 cuentas
  en `auth.users` y ninguna creada desde el 2026-08-02.
- Grants de `service_role`/`postgres` y privilegios por columna no se auditaron; sólo `anon` y
  `authenticated`. Paridad global de migraciones anterior a septiembre: no comprobada (drift
  histórico conocido).
- Un lote largo de e2e no se corrió: el 17/17 vale para el lote pequeño.

## 7. Decisiones que se te piden

1. Autorizar **una** corrida de `seed-garrigues-ia.ts --commit` (tras el paso 1).
2. Autorizar la migración **REVOKE DELETE** en las 7 tablas sin uso, y decidir si también en
   `ai_systems` (obliga a mover la limpieza de PROBE de dos sondas a `service_role`).
3. Autorizar la migración de reconciliación de las **6 políticas** sin espejo (o dejarlas como
   deuda declarada).
4. `PLANIFICADO` entra en el vocabulario (propuesto) o se cambia el catálogo.
5. Enlazar `person_id` de las dos cuentas demo de Garrigues a dos personas del censo para que la
   custodia muestre nombres (opcional; sin ello se muestran identificadores).
6. CHECK de `ai_systems.status` y qué hacer con las tres grafías viejas de ARGA: se propone
   **aplazar** (cero-cambio ARGA).
