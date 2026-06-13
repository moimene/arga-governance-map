# Especificación Funcional — Módulo de Secretaría Societaria TGMS

## De prototipo operativo avanzado a plataforma productiva de gestión de sociedades

---

| | |
|---|---|
| **Versión** | 1.0 |
| **Fecha** | 13 de junio de 2026 |
| **Ámbito** | Módulo de Secretaría Societaria (`/secretaria/*`) de la plataforma TGMS — módulos Garrigues |
| **Tipo de documento** | Especificación funcional del **estado objetivo productivo** (target state), dual: funcional-jurídica + anexo técnico |
| **Cliente demostrador** | Grupo ARGA Seguros (pseudónimo de grupo asegurador cotizado) |
| **Insumos** | (1) `2026-06-13-referencia-modulo-secretaria.md` (descripción funcional verificada contra código + Cloud `governance_OS`); (2) revisión en profundidad del Comité Legal (gaps, valoración y hoja de ruta); (3) `CLAUDE.md` del repositorio `arga-governance-map` |
| **Fuente de verdad del estado actual** | Código del repo + BD `governance_OS` (`hzqwefkwsxopwrmtksbg`, eu-central-1), tal como las consolida el documento de referencia del 13-jun-2026 |
| **Destinatarios** | Comité Legal (despacho), Dirección de Producto e Ingeniería |
| **Confidencialidad** | Uso interno. Datos demo bajo pseudónimo. |

> **Propósito en una frase.** Convertir un prototipo operativo avanzado y demo-ready en una **plataforma productiva con plena eficacia jurídica probatoria y registral**, cerrando los seis gaps detectados por el Comité Legal **sin rediseñar** la arquitectura existente: la recomendación ejecutiva es **industrializar, no reescribir**.

---

## Control documental y relación con otros documentos

Esta especificación **no sustituye** al documento de referencia funcional del 13-jun-2026: lo presupone como descripción fiel del estado actual y se concentra en **qué debe cambiar y añadirse** para alcanzar producción. Cuando una capacidad ya existe y es correcta, esta spec la marca como **MANTENER** y solo fija el criterio de no regresión. Cuando falta o es sandbox/parcial, fija **requisitos funcionales nuevos** (`RF-*`) con sus **criterios de aceptación** (`CA-*`).

Relación con specs previas del repositorio (no se duplican; se referencian):

- `2026-04-19-motor-reglas-lsc-secretaria-design.md` — diseño del motor LSC.
- `2026-04-19-decisiones-legales-motor-lsc-resueltas.md` — DL-1…DL-6.
- `2026-05-11-procedimiento-plantillas-v2-design.md` y `2026-05-12-gestor-plantillas-sprint1-design.md` — plantillas y Gate PRE.
- `2026-05-12-personas-cargos-completitud-design.md` — datos maestros de personas/cargos.
- `2026-05-16-definer-threat-model.md`, `2026-05-16-g17-staging-provisioning.md`, `2026-05-16-g7-evidence-review-events-decision.md`, `2026-05-16-g11-integraciones-risk-register.md` — endurecimiento, staging y evidencia.
- `2026-05-17-governance-os-active-dev-environment-policy.md` — política de entorno activo.

---

# PARTE I — Propósito, alcance y método

## 1. Propósito de la especificación

El módulo de Secretaría Societaria cubre hoy el ciclo de vida completo de los actos societarios formales de un grupo asegurador multinacional y externaliza el conocimiento jurídico en datos versionables (rule packs, plantillas en tres capas, censo WORM, capability matrix). El Comité Legal lo valora como una base excepcionalmente sólida, pero concluye que **todavía no puede presentarse como plataforma productiva con plena eficacia jurídica probatoria o registral final**.

Esta especificación define el **estado objetivo productivo** del módulo y los requisitos para alcanzarlo. Su objetivo es que el producto pueda:

1. Demostrar y operar un **ciclo societario completo con cierre registral efectivo** (hasta inscripción o denegación con efectos incorporados al expediente).
2. Producir **evidencia electrónica cualificada productiva** (no sandbox/stub) con plenos efectos jurídicos.
3. Operar sobre una **única fuente de verdad de datos maestros** (modelo canónico como SSOT), sin convivencia ambigua con modelos legacy ni contaminación de artefactos de prueba.
4. Cubrir **multi-jurisdicción** más allá de la formalización: motores jurisdiccionales locales parametrizables (PT → BR/MX).
5. Especializar la **producción documental** por contexto societario cuando la redacción legal lo exija.
6. Convertir los **handoffs cross-módulo** en workflows gobernados, auditables y proactivos sin perder el control profesional del secretario.

## 2. Alcance funcional

**Dentro de alcance:** todas las superficies y procesos `/secretaria/*` descritos en el documento de referencia (convocatoria, reunión, actas, certificación, tramitación registral, acuerdos sin sesión, co-aprobación, solidario, decisiones unipersonales, generación documental, board pack, calendario, campañas de grupo, gestión societaria de sociedades/personas), el motor de reglas LSC, el sistema de plantillas, la cadena de evidencia QTSP/WORM, el modelo canónico de identidad, los libros y registros, y el modelo RBAC/SoD.

**Fuera de alcance (pero referenciado en interfaces):** la lógica interna de los módulos GRC Compass y AIMS 360 (solo se especifican los **contratos de handoff** con Secretaría); el backbone de evidencia GRC `000049` se trata únicamente en su intersección con la evidencia de Secretaría; la integración fiscal (retenciones IRRF/IOF/ISR/IRNR) se especifica como **dato y alerta**, no como motor de cálculo tributario.

**Principio de no segregación (vigente).** Conforme a `CLAUDE.md`, la segregación de los módulos Garrigues a repositorios independientes es trabajo futuro y **no** es objeto de esta spec. El módulo debe seguir funcionando tanto dentro del shell TGMS como producto Garrigues autónomo.

## 3. Audiencia dual y cómo leer este documento

Cada bloque funcional se estructura en dos planos claramente separados:

- **Plano funcional-jurídico** (para el Comité Legal): qué hace la función, su naturaleza y base normativa (LSC/RRM/CCom/LMV/eIDAS), y los **criterios de aceptación** verificables en lenguaje de negocio.
- **Plano técnico** (para Ingeniería): tablas, columnas, RPC, migraciones, máquinas de estado, contratos de datos y guardrails. Se consolida en el **Anexo Técnico T**, con referencias cruzadas `→ T.x` desde cada requisito.

El lector legal puede leer Partes I–II y los planos funcionales de III–VIII, e ignorar el Anexo T. El lector de ingeniería usa el Anexo T como contrato de implementación.

## 4. Convenciones

- **`RF-G{n}-{nn}`** — requisito funcional asociado al gap `G{n}`. **`RF-CORE-{nn}`** — requisito transversal de ciclo o de no regresión. **`RNF-{nn}`** — requisito no funcional.
- **`CA-…`** — criterio de aceptación (condición objetiva de "hecho"). Todo `RF` lleva al menos un `CA`.
- **Prioridad MoSCoW:** **M** (Must, bloquea producción), **S** (Should), **C** (Could), **W** (Won't-now / evolutivo).
- **Fase:** **F0** inmediato (pre-release + frontera probatoria), **F1** corto, **F2** medio, **F3** evolutivo. Detalle en Parte X.
- **MANTENER** — capacidad ya implementada y correcta; la spec solo fija no regresión.
- Los **gaps** se nombran G1…G6 + pista transversal **G0 (Endurecimiento a producción)**.

| Gap | Nombre | Bloque de requisitos | Severidad comité |
|---|---|---|---|
| **G0** | Endurecimiento a producción (entornos, migraciones, observabilidad, privilegios) | Parte IX (RNF) | Alta (habilitador) |
| **G1** | Frontera probatoria QTSP / evidencia cualificada productiva | Parte VII | **Bloqueante de venta productiva** |
| **G2** | Cierre registral efectivo (INSCRITA/DENEGADA/subsanación + integraciones) | Parte IV §20 | **Bloqueante de ciclo completo** |
| **G3** | Consolidación del modelo canónico como SSOT de datos maestros | Parte III §9 | **Bloqueante de fiabilidad** |
| **G4** | Multi-jurisdicción: de matriz a motores locales (PT→BR/MX) | Parte V §26 | Media (completitud horizontal) |
| **G5** | Especialización documental por contexto | Parte VI §28 | Media |
| **G6** | Automatización cross-módulo gobernada | Parte VIII §40 | Media |

---

# PARTE II — Visión de producto y modelo objetivo

## 5. De prototipo a plataforma productiva

El Comité Legal sitúa el módulo en **alto para prototipo avanzado, medio-alto para pre-release, insuficiente para producción jurídica** sin cerrar los gaps probatorio, registral y multi-jurisdiccional. La valoración cualitativa de partida (sobre 10) que esta spec asume como línea base:

| Área | Valoración base | Meta tras esta spec |
|---|---|---|
| Ciclo societario core | 8,5 | 9,5 (cierre registral terminal) |
| Motor jurídico LSC y materias | 8,5 | 9,0 (materias sin pack + multi-jurisdicción) |
| Gestión documental y plantillas | 8,0 | 9,0 (contexto + multi-jurisdicción) |
| Libros, capital y datos maestros | 7,5 | 9,0 (SSOT + legalización operativa) |
| Evidencia, firma y auditoría | 6,0 | 9,0 (QTSP productivo + backbone) |
| Registro público y formalización | 5,5 | 8,5 (cierre + integraciones) |
| Grupo y multi-jurisdicción | 6,0 | 8,0 (motores locales PT→BR/MX) |
| Seguridad, permisos, SoD | 8,0 | 9,0 (razón jurídica completa + revisión periódica) |
| Automatización cross-módulo | 5,5 | 8,0 (workflows gobernados) |

## 6. Principio rector

Toda la evolución se rige por un principio único, que el Comité Legal formula y esta spec adopta como invariante de diseño:

> **Verdad jurídica computable, documento como manifestación, secretario como garante.**

Consecuencias normativas vinculantes para todo requisito:

1. **La fuente de validez reside en el motor** (rule packs, versiones activas, overrides, snapshots), **nunca** en el texto libre de plantillas. Las plantillas son el vehículo documental controlado, no la fuente de quórums, mayorías, plazos o prerequisitos.
2. **El secretario puede avanzar con override informado** en gaps de riesgo, pero el sistema **bloquea (fail-closed)** cuando falta un presupuesto legal imprescindible (p. ej. autoridad certificante inscrita, acta aprobada y firmada para certificar, proxy QTSP para sellar evidencia).
3. **Invalidez societaria y breach contractual (pacto parasocial) viajan en canales separados y etiquetados.** Un incumplimiento de pacto nunca se presenta como invalidez societaria.
4. **La inteligencia se construye sobre evidencia y reglas confiables, no al revés.** Las capacidades de IA (Parte X, F3) son posteriores al cierre de fundamentos productivos.

## 7. Separación de entornos: demo / pre-release / producción

Requisito estructural transversal: el producto debe distinguir con precisión tres entornos, y la interfaz, el contrato y la documentación deben reflejar **sin ambigüedad** en cuál opera cada artefacto.

| Entorno | Firma/evidencia | Datos | Garantías exigidas |
|---|---|---|---|
| **Demo** | QES/QSeal/TSQ/ERDS en **stub/sandbox**; se admite, **siempre con aviso inequívoco** | Datos demo bajo pseudónimo; permitidos artefactos E2E **etiquetados** | Cadena WORM y censo inmutable operativos; ningún artículo presentado como evidencia cualificada |
| **Pre-release** | Sandbox controlado; **proxy QTSP conectado en staging** | **Staging Supabase separado**; sin artefactos E2E en el perímetro funcional | Migraciones versionadas, CI e2e no destructivo, hardening de privilegios, telemetría SIEM |
| **Producción** | **QTSP real EAD Trust** (QES/QSeal/TSQ/ERDS), evidencia **SEALED/VERIFIED** | SSOT canónico; sin legacy operativo | Proxy QTSP obligatorio (fail-closed), backbone de evidencia cerrado, retención + legal hold, verificación, trazabilidad de cambios |

**`RF-CORE-01` (M, F0).** La UI debe exponer en todo artefacto probatorio un **estado de evidencia explícito** ∈ {`DEMO_OPERATIVA`, `SEALED`, `VERIFIED`} y nunca etiquetar como firmado/cualificado un resultado sandbox.
**CA-CORE-01a:** un bundle generado en sandbox se muestra como `DEMO_OPERATIVA` (no-final) y no produce badge SEALED/QSeal ni contador de evidencia cualificada (`isFinalSealedEvidence` solo reconoce `SEALED`/`VERIFIED`). → T.7
**CA-CORE-01b:** la documentación de cliente y los contratos diferencian "demo operativa", "evidencia sellada" y "evidencia verificada".

## 8. Definition of Production-Ready (criterios de salida)

El módulo se considera **production-ready** cuando se cumplen, de forma verificable, los siguientes criterios de salida (checklist consolidado en Parte X §44):

- **DoPR-1 (Probatorio).** Existe proxy QTSP server-side operativo contra EAD Trust; toda firma/sello/timestamp/notificación de producción es real y verificable; el backbone de evidencia (`000049`) está fuera de HOLD; existe retención + legal hold operativos. *(G1)*
- **DoPR-2 (Registral).** El sistema demuestra y opera al menos un expediente `INSCRITA`, uno `DENEGADA` y uno `SUBSANACION` resuelto, con evidencia de asiento/publicación incorporada al expediente. *(G2)*
- **DoPR-3 (Datos maestros).** El modelo canónico es la única fuente operativa; `mandates` no alimenta flujos vivos; artefactos E2E aislados; NIF/CIF único; representantes de PJ y autoridad certificante completos. *(G3)*
- **DoPR-4 (Multi-jurisdicción).** Portugal opera como motor local completo (rule packs + plantillas + registro/autorizaciones); BR/MX con hoja de ruta activa. *(G4)*
- **DoPR-5 (Documental).** Cobertura sin P0; especialización por contexto donde el texto legal difiera; contrato de variables conciliado. *(G5)*
- **DoPR-6 (Cross-módulo).** Handoffs convertidos en workflows gobernados con recordatorios/escalados, sin escritura cruzada no gobernada. *(G6)*
- **DoPR-0 (Plataforma).** Staging separado, migraciones versionadas y reconciliadas, CI e2e no destructivo, telemetría SIEM activa, privilegios endurecidos. *(G0)*

---

# PARTE III — Modelo de dominio objetivo (qué se gobierna)

## 9. Modelo canónico de identidad como fuente única operativa (G3)

### 9.1 Plano funcional-jurídico

El núcleo de identidad societaria descansa en ocho tablas canónicas (`entities`, `entity_capital_profile`, `share_classes`, `condiciones_persona`, `capital_holdings`, `representaciones`, `parte_votante_current`, `censo_snapshot`) que ya operan y sostienen cap table vivo, censo WORM, derechos de voto y autoridad certificante. **El problema no es la ausencia de modelo, sino que el modelo aún no es la única fuente operativa.** Conviven con él el modelo legacy `mandates` (sigue siendo tabla, sin dual-write), variantes legacy de entidades (p. ej. `Cartera ARGA, S.A.` frente a la canónica `Cartera ARGA S.L.U.`), artefactos de prueba E2E (`PHASE-B*`, `Arga test A`, `PRUEBA`, `SEGUROS TEST`) y categorías de consejero parcialmente vacías. El motor LSC **todavía no lee exclusivamente de `censo_snapshot`**.

El estado objetivo es un **Single Source of Truth (SSOT) canónico**: personas, sociedades, socios, cargos, representantes, capital, censo y autoridad certificante alimentan un único modelo, y ningún flujo vivo depende de fuentes paralelas que puedan divergir. Un error de identidad (sociedad, socio, consejero, representante) se traslada a censos, acuerdos, certificaciones y documentos; por eso los datos maestros son **frente jurídico prioritario**, no solo deuda técnica.

### 9.2 Requisitos

**`RF-G3-01` Retirada operativa de `mandates` (M, F1).** Ningún flujo societario vivo (votación, censo, certificación, documental, libros) puede leer de `mandates`. La identidad de socios/órganos/cargos/representaciones/derechos de voto se resuelve exclusivamente desde las ocho tablas canónicas.
- **CA-G3-01a:** auditoría de código confirma 0 lecturas de `mandates` en hooks/engines de runtime de Secretaría. → T.3
- **CA-G3-01b:** `mandates` queda como VIEW read-only o tabla congelada documentada; cualquier acceso residual es de migración/histórico, no de runtime.
- **CA-G3-01c:** el motor LSC computa quórum y mayorías leyendo de `censo_snapshot` / proyecciones canónicas (`parte_votante_current`), no de fuentes paralelas.

**`RF-G3-02` Aislamiento de artefactos E2E y datos de prueba (M, F1).** Las entidades y personas de prueba (`PHASE-B*`, `Arga test A`, `PRUEBA`, `SEGUROS TEST`, holders `QA-*`, `FREE-FLOAT-*` cuando proceda) no aparecen en operaciones jurídicas ordinarias ni en demostraciones ante usuarios legales.
- **CA-G3-02a:** marca de entorno/etiqueta (`data_class ∈ {PROD, DEMO, TEST}`) en `entities`/`persons`; los listados operativos filtran `TEST`. → T.3
- **CA-G3-02b:** la separación no depende de la memoria del usuario: se aplica por filtro de entorno, no por convención de nombre.

**`RF-G3-03` Unicidad y consolidación de identidades (M, F1).** El NIF/CIF es un control de unicidad que bloquea duplicados reales y ofrece fusión auditable con el existente.
- **CA-G3-03a:** índice único parcial sobre `persons(tenant_id, tax_id)` que excluye placeholders (`PENDIENTE`, `E2E`, `FREE-FLOAT`). → T.3
- **CA-G3-03b:** alta/edición de persona con NIF existente ofrece "fusionar con existente" en lugar de crear duplicado; el merge migra referencias (cargos, holdings, representaciones, autoría) antes de archivar el duplicado y queda en `audit_log`.
- **CA-G3-03c:** se eliminan/consolidan los duplicados conocidos (p. ej. "Cartera ARGA"/"ARGA Seguros"); la cadena de control referencia exclusivamente la SLU titular del 69,69 %.
- **CA-G3-03d:** la consolidación es capacidad `PERSON_CONSOLIDATE` (solo SECRETARIO/ADMIN_TENANT), audit-logged.

**`RF-G3-04` Representantes de PJ y autoridad certificante completos (M, F1).** Todo consejero/administrador persona jurídica tiene representante persona física permanente vigente (art. 212 bis LSC) alimentado desde `representaciones` (`PJ_PERMANENTE`); toda emisión de certificación dispone de autoridad certificante y Vº Bº con referencia registral.
- **CA-G3-04a:** un consejero PJ sin `representative_person_id` vigente bloquea la generación documental que lo invoque, con mensaje accionable.
- **CA-G3-04b:** la certificación distingue **cargo vigente no inscrito** de **cargo vigente inscrito**: la eficacia interna no basta para certificar frente a terceros; se exige `inscripcion_rm_referencia` + `inscripcion_rm_fecha` en `authority_evidence` del certificante y del Vº Bº (RRM art. 109). → T.4, T.5
- **CA-G3-04c:** la UI muestra chips "Inscrito en RM" / "Pendiente inscripción" en cargos y autoridad.
- **CA-G3-04d:** categorías de consejero (independiente/ejecutivo/dominical, art. 529 duodecies LSC) completas en `condiciones_persona.metadata` para la estructura demo ARGA.

**`RF-G3-05` Motor LSC sobre censo canónico (M, F1).** Se ejecuta la transición a que el motor lea el estado societario exclusivamente del `censo_snapshot` congelado para la sesión (lo que el documento de referencia identifica como "Fase 3").
- **CA-G3-05a:** toda evaluación de votación/quórum referencia un `censo_snapshot` concreto (no recomputa desde tablas vivas en el momento del voto).
- **CA-G3-05b:** la certificación resuelve `snapshot_hash` desde `minutes.snapshot_id → censo_snapshot.audit_worm_id → audit_log.hash_sha512` (MANTENER); no se admite el sentinel `NO_SNAPSHOT_HASH` para actas nuevas creadas por el pipeline F5→F6→F7.

**MANTENER (no regresión):** inmutabilidad WORM de `censo_snapshot` (triggers `trg_block_*` + `trg_censo_snapshot_worm`); `persons.person_type ∈ {PF, PJ}`; una sola fila de capital `VIGENTE` por entidad; autocartera con `voting_weight = 0`.

## 10. Libros y registros sociales — de portfolio calculado a ciclo de legalización operativo

### 10.1 Plano funcional-jurídico

El módulo calcula el catálogo de libros exigibles por tipo social, forma jurídica, cotización, sector regulado y órganos vivos, distingue libros mercantiles legalizables de registros auxiliares, y pinta semáforos de plazo. Pero en el tenant demo solo **2 de 252 libros legalizables figuran como legalizados**: la legalización es **prospectiva**. Para una plataforma de gestión societaria completa, el módulo debe convertir ese portfolio calculado en un **ciclo operativo anual de legalización**: cierre de volumen, generación de fichero legalizable, presentación telemática (o evidencia de presentación), respuesta registral, rechazo y subsanación, con evidencia de legalización.

### 10.2 Requisitos

**`RF-CORE-10` Ciclo de legalización de libros (S, F1).** Cada libro mercantil legalizable soporta el flujo `PENDIENTE → PRESENTADO → LEGALIZADO | RECHAZADO` con artefactos reales.
- **CA-CORE-10a:** cierre de volumen (`closed_at`) y generación de fichero legalizable (formato telemático RM, Instrucción DGSJFP / Ley 14/2013 art. 18) o, en su defecto, registro de evidencia de presentación con su `legalization_evidence_url`. → T.2
- **CA-CORE-10b:** respuesta registral con estado `LEGALIZADO`/`RECHAZADO`; el rechazo abre subsanación con motivo y nuevo plazo.
- **CA-CORE-10c:** KPIs por sociedad (legalizados / pendientes / vencidos) y alertas de plazo (`≤ 30 días` ámbar, vencido rojo) sobre datos reales, no prospectivos.
- **CA-CORE-10d:** el Libro registro de socios (art. 104 LSC) y el de acciones nominativas (art. 116 LSC) se alimentan WORM append-only desde `capital_movements`/`capital_holdings`; en cotizadas, conciliación con Iberclear (dato/alerta). MANTENER lo ya implementado.

**MANTENER:** derivación del portfolio (`buildSocietaryBookPortfolio`), seccionado por órgano, registros auxiliares no legalizables, registros adicionales de asegurador cotizado (fit&proper, Solvencia II), `fn_upsert_mandatory_book_v2` con `REVOKE EXECUTE` a `authenticated`.

## 11. Estructura de grupo y perímetro multi-sociedad

El modelo de grupo (scope switcher Grupo/Sociedad, war room de campañas, descomposición automática por forma de administración y unipersonalidad) es un diferencial y se **MANTIENE**. El estado objetivo lo refuerza con dos requisitos de gobierno (detallados en Parte V §26 y Parte VIII §40): que las campañas incorporen **dependencias normativas y secuenciación registral** entre jurisdicciones, y que la matriz multi-jurisdiccional evolucione a **motores locales**. La estructura demo ARGA (dominante cotizada, cadena Fundación → Cartera S.L.U. 69,69 % → ARGA Seguros S.A., 12 órganos, CdA de 17 condiciones) se mantiene como dato canónico una vez saneados los duplicados (`RF-G3-03`).

---

# PARTE IV — Especificación funcional del ciclo societario (qué se hace)

El ciclo formal (convocatoria → sesión → acta → certificación → elevación a público → inscripción → publicación/archivo) y sus formas sin sesión están implementados y se **MANTIENEN**. Esta parte fija (a) los criterios de no regresión por proceso y (b) los requisitos de producción, con foco en el **cierre registral efectivo (G2)**, el único tramo del golden path que hoy no llega a estado terminal.

## 12. Agregado raíz `agreements` y máquina de estados terminal

**Plano jurídico.** El acuerdo social es el agregado raíz que traza el recorrido desde la propuesta hasta la publicación registral. La máquina de estados objetivo (MANTENER + completar tramo terminal):

`DRAFT → PROPOSED → ADOPTED → CERTIFIED → INSTRUMENTED → FILED → REGISTERED → PUBLISHED`, con rama terminal `REJECTED_REGISTRY` desde `FILED`/`REGISTERED`.

Hoy en Cloud los acuerdos llegan hasta `FILED` (1) e `INSTRUMENTED` (1); **no hay `REGISTERED` ni `PUBLISHED` ni `REJECTED_REGISTRY` poblados**. El cierre del ciclo (G2) puebla y opera esos estados terminales.

**`RF-CORE-12` Compliance snapshot inmutable (M, MANTENER+).** Al pasar a `ADOPTED`, el `compliance_snapshot` (resultado del motor: convocatoria/quórum/conflicto/mayoría/instrumento/registro/blocking) se congela y no se recomputa retroactivamente.
- **CA-CORE-12a:** el expediente muestra el snapshot congelado y la explicación nodo a nodo (`compliance_explain`); cualquier reevaluación posterior es un nuevo snapshot versionado, no una sobreescritura.

## 13. Convocatoria de órgano

**Naturaleza:** convocatoria de junta (arts. 166-176 LSC), consejo (art. 246 LSC) o comisión; ordinaria/extraordinaria/universal (art. 178 LSC). **MANTENER:** stepper de 8 pasos, doble evaluación de antelación (V1+V2), 2ª convocatoria SA (art. 177 LSC), clasificación de agenda por clase y por naturaleza del punto (`DECISORIO`/`INFORMATIVO`/…), advertencias LMV para cotizada, canales por jurisdicción/órgano, ERDS.

**`RF-CORE-13` Selección automática de plantilla de convocatoria por tipo social (M, MANTENER — DL-4).** SA → BORME + web (art. 173 LSC); SL → notificación individual certificada (art. 173.2 LSC). Override manual permitido pero audit-logged.
- **CA-CORE-13a:** el Gate PRE/motor selecciona la plantilla correcta por `tipo_social`; un override del secretario queda en `audit_log` con actor y motivo.

## 14. Reunión / sesión conectada

**Naturaleza:** celebración (constitución, quórum arts. 193-194/247 LSC, debate, votación, acta art. 202 LSC), incl. universal. **MANTENER:** stepper de 6 pasos, apertura de sesión como gate, asistentes con `attendance_type`, quórum con denominador ajustado por conflicto (art. 190.2 LSC), votaciones que materializan `agreements` y `meeting_resolutions`, cierre con `fn_generar_acta` vinculando `snapshot_id`, reanudación derivada del estado real, intake universal.

**`RF-CORE-14` Integridad de pertenencia de resoluciones (M, MANTENER).** Las resoluciones solo se persisten si pertenecen a la reunión indicada (`fn_save_meeting_resolutions` valida pertenencia — cierra escritura cruzada).
- **CA-CORE-14a:** intento de guardar una resolución de otra reunión es rechazado por la RPC. → T.A.2

## 15. Acuerdos sin sesión, co-aprobación y solidario

**Naturaleza:** votación por escrito sin reunión (art. 100 RRM / 248.2 LSC); co-aprobación k-de-n de administradores mancomunados; administrador solidario (art. 210 LSC). **MANTENER:** steppers (5/5/4 pasos), pipeline de 5 gates sin sesión, `evaluarCoAprobacion` (k≥2, n≤2 en SA, detección de firmas duplicadas), `evaluarSolidario`, auto-cierre de votaciones vencidas (`fn_cerrar_votaciones_vencidas`), materialización `ADOPTED` (`fn_no_session_close_and_materialize_agreement`), certificación de acuerdo sin sesión.

**`RF-CORE-15` Notificación fehaciente productiva en sin sesión (M, F0/F1 — depende de G1).** El gate 2 ("notificación fehaciente, todas ENTREGADA") debe apoyarse en ERDS **productivo** (no sandbox) para que el cómputo del plazo de respuesta tenga valor probatorio.
- **CA-CORE-15a:** en producción, la apertura de la ventana de consentimiento exige evidencia ERDS real de entrega; en demo se admite con aviso `DEMO_OPERATIVA`. → §7 (Parte VII)

## 16. Decisiones de socio único y administrador único

**Naturaleza:** decisión de socio único (art. 15 LSC) o administrador único (art. 210 LSC), con consignación en libro-registro de decisiones del socio único (art. 16 LSC). **MANTENER:** stepper de 3 pasos con cita de fundamento, derivación a Tramitador cuando es inscribible, materialización en `agreements` (`UNIPERSONAL_SOCIO`/`UNIPERSONAL_ADMIN`).

## 17. Actas

**Naturaleza:** acta de la sesión (art. 202 LSC; arts. 97-112 RRM), libro de actas por órgano. **MANTENER:** generación derivada del cierre (`fn_generar_acta` con `content_hash` + `snapshot_id`), `fn_aprobar_acta`, resolución de subtipo de libro (`fn_acta_book_kind_for_body`), botón de certificación gateado por capacidad+autoridad.

**`RF-CORE-17` Aprobación y firma del acta como presupuesto de certificación (M, MANTENER).** Solo se certifican acuerdos de actas **aprobadas y firmadas** (`minutes.signed_at` no nulo) — RRM art. 109.4, fail-closed.

## 18. Certificación de acuerdos (pipeline QTSP)

Se especifica en profundidad en **Parte VII §32** (frontera probatoria). **Plano jurídico (resumen):** certificación por el secretario con Vº Bº del presidente (RRM art. 109), pipeline de 3 RPC (`fn_generar_certificacion` → `fn_firmar_certificacion` → `fn_emitir_certificacion`) con `gate_hash` que ata censo↔acta↔acuerdos. **MANTENER** los controles de legitimación registral (RRM 109.1.a y 109.4). El salto a producción (G1) sustituye los tokens stub por QTSP real.

## 19. Generación documental con firma y archivado

**Naturaleza:** DOCX desde plantilla aprobada, firma QES y archivado SHA-512 con evidence bundle. **MANTENER:** stepper de 5 pasos, resolver de variables (capa 2), captura de capa 3, `archiveDocxToStorage` (SHA-512, idempotencia por contenido, bucket privado, `sign-evidence-url`), trust boundary (`QTSP_SIGNED_DOCX` solo si firma real). El salto a producción (G1) se trata en Parte VII.

## 20. Tramitador registral y CIERRE REGISTRAL EFECTIVO (G2)

### 20.1 Plano funcional-jurídico

El tramitador modela elevación a instrumento público e inscripción: selección de acuerdo inscribible certificado, vía de presentación, datos notariales (notario, fecha de escritura, protocolo), presentación, seguimiento y subsanaciones, con una máquina de estados en vocabulario español canónico (`PREPARADA → PRESENTADA → EN_TRAMITE → SUBSANACION → INSCRITA`, `ELEVADA`, `DENEGADA`). **El gap G2 es que el golden path se detiene antes del cierre:** no existe ningún expediente en estado terminal `INSCRITA` ni `DENEGADA`. El sistema puede preparar, presentar, seguir y subsanar, pero **no demuestra la recepción de una calificación registral final** ni la incorporación de sus efectos al expediente societario.

En un ciclo societario completo, el acuerdo inscribible **no termina** con la certificación ni con la elevación a público, sino con la **inscripción**, la **denegación motivada** o la **subsanación cerrada con resultado final**, con incorporación del **número de asiento, fecha de inscripción, defectos, publicación (BORME o equivalente)** y evidencia de asiento. El estado objetivo cierra este tramo.

### 20.2 Requisitos

**`RF-G2-01` Estados terminales operativos (M, F1).** El tramitador opera de extremo a extremo, poblando y transicionando hasta `INSCRITA`, `DENEGADA` y `SUBSANACION` resuelta, con propagación al agregado raíz (`agreements.status → REGISTERED | REJECTED_REGISTRY | PUBLISHED`).
- **CA-G2-01a:** existe y se demuestra un golden path completo de **modificación estatutaria** o **nombramiento** que llega a `INSCRITA`, con `inscription_number`, `inscription_date`, `borme_ref` (o equivalente local) poblados, y el acuerdo asociado en `REGISTERED` → `PUBLISHED`. → T.2, T.A
- **CA-G2-01b:** existe y se demuestra un caso `DENEGADA` con `defect_details` (calificación negativa motivada) y el acuerdo en `REJECTED_REGISTRY`.
- **CA-G2-01c:** existe y se demuestra un caso `SUBSANACION` que se resuelve y reingresa al trámite hasta `INSCRITA`, conservando trazabilidad del defecto y de su corrección.
- **CA-G2-01d:** la transición a estado terminal exige la evidencia correspondiente (asiento/calificación), fail-closed: no se marca `INSCRITA` sin referencia de asiento.

**`RF-G2-02` Trazabilidad registral completa (M, F1).** El expediente registral incorpora todos los campos del ciclo: vía (`filing_via`), número de presentación (`filing_number`), fecha de presentación, datos del instrumento (notario, protocolo, `deed_reference`, `elevated_at`), número de inscripción, fecha, referencias locales (`borme_ref`, `psm_ref`, `siger_ref`, `conservatoria_ref`, `jucerja_ref`, `diario_oficial_ref`), defectos y subsanaciones.
- **CA-G2-02a:** el detalle read-only muestra la línea temporal registral completa con su evidencia documental por hito.
- **CA-G2-02b:** los alias ingleses legacy (`SUBMITTED`/`INSCRIBED`/`ELEVATED`) se mantienen solo como lectura etiquetada "(legacy)"; ninguna escritura nueva los usa.

**`RF-G2-03` Gestión de defectos y subsanación como capacidad de primera clase (S, F1).** La subsanación es un sub-flujo con motivo de defecto, plazo, documento de subsanación y reingreso al trámite, no un cambio de estado plano.
- **CA-G2-03a:** desde `SUBSANACION` con `agreement_id`, el sistema ofrece reanudar la subsanación, adjuntar la corrección y reingresar a `EN_TRAMITE`.
- **CA-G2-03b:** la capacidad de resolver defectos registrales es trazable y queda como diferencial frente a gestores documentales simples.

**`RF-G2-04` Integraciones registrales y canales externos (S/C, F1→F2).** El sistema integra (o, en su defecto, mockea de forma controlada y verificable en sandbox registral) la presentación y el seguimiento ante el registro competente.
- **CA-G2-04a (F1):** España — presentación electrónica / NOTARIAL con captura de evidencia de presentación y referencia BORME; demostrable en sandbox registral controlado si no hay integración productiva.
- **CA-G2-04b (F2):** jurisdicciones extranjeras — Conservatória/IRN (PT), JUCESP/JUCERJA (BR), RPC vía notario (MX): seguimiento de formalización local con referencias locales; integración directa es **F2/evolutivo** (ver G4).
- **CA-G2-04c:** las autorizaciones sectoriales previas (SUSEP/CNSF/BdP/DGSFP) se modelan como **prerrequisito bloqueante** del trámite cuando aplican (ver §26), no como cálculo del motor.

**MANTENER:** stepper de alta de 5 pasos con motor de reglas, verificación de certificación previa (`useAgreementHasCertification`), detalle read-only, vínculo al expediente de acuerdo.

## 21. Board pack, calendario y campañas de grupo

**MANTENER:** Board Pack (9 secciones, advertencias LMV cotizada DL-2, voto de calidad DL-5, export PDF); Calendario de vencimientos (consolidación de 5 orígenes, navegación directa); War room de campañas multi-sociedad. Los requisitos de evolución de campañas (dependencias normativas, secuenciación registral) se especifican en Parte V §26 y la automatización proactiva del calendario en Parte VIII §40.

**`RF-CORE-21` Calendario proactivo de cumplimiento recurrente (S, F2).** El calendario evoluciona de vista consolidada a **motor de campañas anuales**: propone y prepara expedientes de cuentas, legalización de libros, renovación de auditores y de cargos, política de remuneración, reporting de cotizada y depósitos, en lugar de esperar a que el usuario recuerde el vencimiento.
- **CA-CORE-21a:** un vencimiento próximo (p. ej. legalización de libros, fin de mandato) genera una **propuesta de campaña/expediente** con owner sugerido y plazos, escalable si no se atiende, sin convertir el aviso en bloqueo indebido.

---

# PARTE V — Motor jurídico LSC y materias (el conocimiento)

## 22. Arquitectura del catálogo de reglas (MANTENER)

El conocimiento jurídico se externaliza en tres tablas (`rule_packs`, `rule_pack_versions` con `payload` JSONB inmutable por tipo social, `rule_param_overrides`) que permiten versionar la regla sin tocar código. **MANTENER:** payload por `SA`/`SL`/`CONSEJO` con cita de artículo; una sola versión `is_active`; `payload_hash` + `supersedes_version_id` para certificar contra qué redacción se evaluó; funciones puras con árbol de explicación trazable. Es el activo más fuerte del módulo y la base de la "verdad jurídica computable".

## 23. Cobertura de materias y completitud objetivo

**Estado base:** 58 rule packs / 57 materias distintas (único duplicado por órgano: `AUTORIZACION_GARANTIA`). Cobertura amplia: estructurales, estatutarias, especiales, ordinarias, consejo, socio único. Subsisten dos deudas: (a) **doble grafía / alias legacy** (p. ej. `MOD_ESTATUTOS` ↔ `MODIFICACION_ESTATUTOS`) reconciliados en runtime por `MATERIA_PACK_ALIASES`, con retirada física del pack legacy pendiente; (b) **materias sin pack propio** que el motor no debe aliar a otra distinta (p. ej. `DISTRIBUCION_RESERVAS` **no** se alía a `DIVIDENDO_A_CUENTA`, arts. 273 vs 277 LSC).

**`RF-CORE-23a` Retirada de packs legacy duplicados (S, F1).** Una vez verificado que el alias redirige el cómputo, se retira físicamente el pack legacy (`MOD_ESTATUTOS`) en una migración forward-only revisada, levantando el guardrail de operaciones destructivas con aprobación explícita.
- **CA-CORE-23a:** tras la retirada, `MODIFICACION_ESTATUTOS` es el único pack de la materia; el alias se conserva para entradas de agenda legacy; sin impacto funcional.

**`RF-CORE-23b` Cierre de materias sin pack (S, F1/F2).** El Comité Legal aprueba y se siembra pack propio para las materias hoy sin regla (p. ej. `DISTRIBUCION_RESERVAS`, y cualquier materia de agenda que resuelva a "sin pack").
- **CA-CORE-23b:** ninguna materia operable en agenda emite convocatoria/votación sin pack resuelto; el fallo silencioso histórico (materia sin pack → sin quórum/mayoría) está cubierto por test determinista.

**`RF-CORE-23c` Garantía de no confusión de materias (M, MANTENER).** Solo se alían grafías de la **misma** materia jurídica; materias distintas nunca se confunden (test de no-aliasing).

## 24. Pipelines de evaluación (MANTENER)

**MANTENER** íntegramente: jerarquía normativa LEY(100) → ESTATUTOS(80) → PACTO_PARASOCIAL(60) → REGLAMENTO(40) → OVERRIDE_INTERNO(20) → SISTEMA(0); regla "un override eleva, nunca rebaja el suelo legal"; tratamiento del pacto como capa contractual (no altera validez societaria, art. 29 LSC); pipeline de votación de 6 gates (enrutado por modo, conflicto art. 190.2, quórum, mayoría con `evaluarMayoria`, unanimidad, vetos, voto de calidad fail-closed DL-5); pipeline sin sesión de 5 gates; co-aprobación y solidario; orquestador transversal con perfil más exigente y canal separado de `pacto_blocking_issues`; 7 bordes no computables.

**`RF-CORE-24` Matriz de pruebas jurídicas deterministas firmada por release (M, F0+).** Cada release jurídico-funcional incluye una matriz de casos deterministas (materia × órgano × tipo social × modo de adopción × subtipo → resultado esperado + override esperado), ejecutada por Ingeniería y **firmada por Legal**.
- **CA-CORE-24a:** la suite cubre valores efectivos de rule packs, gates, prerequisitos, warnings, overrides, instrumento, plazos y edge cases; no solo lectura de plantillas.
- **CA-CORE-24b:** el proceso de release legal está institucionalizado (Legal aprueba reglas/plantillas, Ingeniería implementa, secretario conserva control operativo).

## 25. Decisiones legales DL-1…DL-6 (MANTENER)

**MANTENER:** DL-2 (cotizada: evaluar + advertir LMV/CNMV/MAR/IAGC, no bloquear; sin early return); DL-3 (pacto Fundación ARGA, 3 cláusulas VETO/MAYORIA_REFORZADA_PACTADA/CONSENTIMIENTO_INVERSOR); DL-4 (plantilla de convocatoria automática por tipo social); DL-5 (voto de calidad por órgano: habilitado CdA y Comité Ejecutivo; deshabilitado comisiones delegadas); DL-6 (retribución demo IAR 2025). DL-1 (alcance jurisdiccional) se amplía en §26.

## 26. Multi-jurisdicción: de matriz de formalización a motores locales (G4)

### 26.1 Plano funcional-jurídico

La matriz ES/PT/BR/MX y el war room de campañas son una base diferencial, pero **la cobertura jurídica efectiva es íntegramente española**: los 58 rule packs y las 110 plantillas son 100 % `ES`; PT es preview de overrides; BR/MX son post-GA. La matriz actual es una **herramienta de formalización y seguimiento** (la decisión sustantiva se adopta en España y las filiales 100 % dependientes formalizan localmente), pero **no** un motor de reglas extranjero: no valida quórum/mayorías de filial (irrelevante por socio único), no integra con JUCESP/IRN/RPC, ni gestiona autorizaciones SUSEP/CNSF/BdP.

Esta tesis (filial dependiente que ejecuta decisión española) es **razonable para ARGA** pero **insuficiente como plataforma multinacional generalista**: no cubre filiales con minoritarios, joint ventures, consejos locales con sustancia, pactos locales, capital regulatorio, notarios obligatorios ni reglas de representación específicas. El estado objetivo convierte la matriz en **motores jurisdiccionales parametrizables**, empezando por Portugal.

### 26.2 Requisitos

**`RF-G4-01` Motor jurisdiccional completo Portugal (S, F2).** PT pasa de preview de overrides a motor local completo: rule packs PT (CSC, DL 262/86), plantillas PT, formas de adopción y órganos locales, registro (Conservatória/IRN), traducción jurada y autorizaciones (BdP para aseguradoras).
- **CA-G4-01a:** existe rule pack PT para las materias de grupo nucleares (nombramiento/cese de administrador, modificación de estatutos, dividendos/reservas, operación estructural, garantía intragrupo) con cita de artículo CSC.
- **CA-G4-01b:** existe plantilla `PT` activa para esas materias (cobertura documental local).
- **CA-G4-01c:** el trámite local PT modela registro y autorización BdP como prerrequisitos.

**`RF-G4-02` Hoja de ruta BR/MX con prerrequisitos regulatorios (C, F2/F3).** Brasil (Lei 6.404/76 + CC, JUCESP/JUCERJA, SUSEP) y México (LGSM, RPC vía notario obligatorio, CNSF, dictamen actuarial) se incorporan como motores locales tras PT.
- **CA-G4-02a:** las autorizaciones sectoriales previas (SUSEP/CNSF) se modelan como **prerrequisito bloqueante** del trámite registral local cuando aplican; el bloqueo es trazable y no es cálculo del motor societario.
- **CA-G4-02b:** retenciones fiscales en remesas (IRRF/IOF/ISR/IRNR) se modelan como **dato y alerta** en el expediente, no como motor tributario.

**`RF-G4-03` Campañas de grupo con dependencias normativas y secuenciación (S, F2).** El war room incorpora dependencias entre jurisdicciones (aprobaciones previas, autorizaciones sectoriales, traducción jurada, notarización, secuenciación registral) además de la descomposición por forma de administración ya implementada.
- **CA-G4-03a:** una campaña multinacional ordena los hitos por dependencia (p. ej. decisión española → traducción jurada → autorización local → inscripción local) y bloquea hitos cuyas precondiciones no están cumplidas.

**MANTENER:** matriz de normalización jurisdiccional, scope switcher, descomposición automática por forma social/administración/unipersonalidad, datos normativos estáticos ES/PT/BR/MX, alertas de plazo de inscripción y control de traducción jurada.

---

# PARTE VI — Gestión documental y plantillas (cómo se producen)

## 27. Arquitectura de tres capas y Gate PRE (MANTENER)

**MANTENER:** plantillas protegidas en tres capas (capa 1 inmutable Handlebars ≥100 chars / capa 2 variables resueltas / capa 3 editables del secretario); renderizador aislado con helpers en castellano jurídico; resolver con `normalizeFuente` (dotted paths → namespaces canónicos); consola unificada `gestor-plantillas` por pestañas con RBAC; catálogo de uso `Plantillas.tsx` con CTA "Usar esta plantilla"; Gate PRE estructural + semántico P0; ciclo de vida `BORRADOR → REVISADA → APROBADA → ACTIVA → ARCHIVADA` con rollback compensatorio de changelog; importador JSON (schema Zod `secretaria.template_import.v1`); clave funcional y regla `DUP_ACTIVE_FUNCTIONAL_KEY`; lista P0 a cero. Estado base: 110 plantillas (75 ACTIVA, 35 ARCHIVADA), 74/75 ACTIVA exigen snapshot de rule pack.

**`RF-CORE-27` Gobernanza de ciclo de vida documental por release legal (M, MANTENER).** La gestión del ciclo de vida (revisar/aprobar/activar/archivar) queda reservada a `ADMIN_TENANT`; toda transición exige confirmación y queda auditada; warnings P0 exigen motivo ≥20 chars persistido como evidencia. El proceso de release legal se institucionaliza junto a `RF-CORE-24`.

## 28. Especialización documental por contexto (G5)

### 28.1 Plano funcional-jurídico

Las 110 plantillas tienen **`tipo_social` NULL**: la diferenciación SA/SL se aplica por el motor de reglas en el momento de uso, no mediante plantillas distintas. Este enfoque reduce duplicidad y es correcto cuando la redacción puede parametrizarse con seguridad, pero **es insuficiente cuando la redacción literal debe cambiar** por forma social, cotización, sector o órgano (condicionales por cotizada, referencias legales específicas, campos que solo aplican a un régimen). Un producto líder debe ir más allá de "no tener P0" y ofrecer **especialización contextual elegante**.

### 28.2 Requisitos

**`RF-G5-01` Política de desdoble vs parametrización (S, F2).** Se mantiene plantilla única cuando la redacción puede parametrizarse de forma auditable; se **desdobla** (o se condiciona explícitamente) cuando el condicional jurídico hace difícil auditar el texto final.
- **CA-G5-01a:** criterio documentado y aplicado por dimensión: SA/SL/SLU/SAU, cotizada/no cotizada, aseguradora/no aseguradora, socio único/no unipersonal, consejo/comisión, jurisdicción.
- **CA-G5-01b:** cuando se desdobla, la **clave funcional discrimina por `tipo_social`** (`buildFunctionalKey` deja de fijar `tipoSocial: null` para esas familias) y `DUP_ACTIVE_FUNCTIONAL_KEY` opera por contexto. → T.6
- **CA-G5-01c:** el Gate PRE y el snapshot de rule pack se conservan en todas las variantes.

**`RF-G5-02` Cobertura sin P0 y completitud de materias con modelo (M, MANTENER+).** La lista P0 permanece a cero; las materias nucleares mantienen modelo ACTIVA; las materias nuevas con pack (`RF-CORE-23b`) reciben su modelo de acuerdo.
- **CA-G5-02a:** no hay plantillas ACTIVA con `organo_tipo` alias no canónico (`CONSEJO_ADMINISTRACION`/`CONSEJO`); el Gate PRE lo bloquea.

## 29. Contrato de variables productivo

**Estado base:** el contrato `variables-plantillas-v1.1.yaml` define 49 variables, de las que **solo 6 están vivas** (referenciadas por plantillas ACTIVA); las otras 43 son cobertura prospectiva. Persisten 4 etiquetas de versión de contrato en Cloud (deuda de migración).

**`RF-G5-03` Conciliación del contrato de variables (C, F1/F2).** Se concilian las etiquetas de versión (canónica `variables-plantillas-v1.1`, deprecando `1.0.0`/`1.1.0` y registros sin etiqueta) y se activa progresivamente la cobertura prospectiva conforme las plantillas la usen.
- **CA-G5-03a:** una sola etiqueta de contrato canónica vigente en Cloud; las deprecadas marcadas como tales.
- **CA-G5-03b:** el resolver sigue siendo la fuente de verdad operativa; el contrato es documentación de cobertura; variables no resueltas se registran (`console.warn`) sin abortar el render (MANTENER).

## 30. Cobertura multi-jurisdiccional de plantillas

**`RF-G5-04` Plantillas locales por jurisdicción (S, F2 — ligado a G4).** Se pueblan plantillas `PT` (y después `BR`/`MX`) para las materias de grupo, validadas por Gate PRE con cita legal local.
- **CA-G5-04a:** el schema ya soporta `jurisdiccion ∈ {ES,BR,MX,PT,UK,FR,DE}`; el objetivo F2 es poblar PT con cobertura ACTIVA de las materias nucleares.

---

# PARTE VII — Frontera probatoria: QTSP, evidencia y auditoría (G1)

> **Gap bloqueante de venta productiva.** La firma cualificada y los servicios de confianza **no producen hoy evidencia cualificada final**: QES, QSeal, TSQ y ERDS operan en stub/sandbox. Ningún artefacto del prototipo constituye evidencia electrónica cualificada productiva con plenos efectos jurídicos. La arquitectura es sólida; el cierre productivo es lo que falta.

## 31. Marco y proveedor único de confianza: EAD Trust (MANTENER)

Todo el ciclo de confianza descansa en un único QTSP, **EAD Trust** (empresa tecnológica de Garrigues, g-digital), con cuatro servicios cualificados eIDAS/eIDAS 2: **QES** (firma de persona física), **QSeal** (sello de persona jurídica), **TSQ** (sello de tiempo cualificado) y **ERDS** (entrega electrónica certificada). **MANTENER:** proveedor único (no referenciar competidores); cliente `ead-trust-client.ts` con endpoints Evidence Manager + Signature Manager, OAuth `client_credentials` contra Okta; Trust Center de verificación posterior (`useQTSPVerification`).

## 32. Pipeline de certificación en producción

**MANTENER (controles jurídicos):** pipeline de 3 RPC con `gate_hash = SHA-256(snapshot_hash ‖ canonical_minutes_hash ‖ resultado_hash)`; exigencia de acta aprobada y firmada (RRM 109.4); Vº Bº del Presidente vigente (RRM 109.1.a); validación de autoridad certificante contra `authority_evidence` VIGENTE; doble verificación registral (bloqueo si falta `inscripcion_rm_referencia` en certificante o Vº Bº); exclusión de `CONSEJERO_COORDINADOR` como certificante (art. 109 RRM).

**`RF-G1-01` Sustitución de tokens stub por QTSP real (M, F0/F1).** Los pasos `fn_firmar_certificacion` / generación documental dejan de usar tokens stub deterministas y consumen el resultado real del QTSP (QES + TSQ reales) vía el proxy server-side (§33).
- **CA-G1-01a:** en producción, `signature_status = SIGNED` solo se alcanza con firma QES real y `tsq_token` cualificado real; el `hash_certificacion = SHA-256(gate_hash ‖ content ‖ tsq_token)` se ancla a artefactos reales.
- **CA-G1-01b:** la UI no etiqueta `QTSP_SIGNED_DOCX` ni "firmado por EAD Trust" si el resultado es sandbox (MANTENER trust boundary).

## 33. Proxy QTSP server-side productivo (núcleo de G1)

### 33.1 Plano funcional-jurídico

El flujo `client_credentials` de EAD Trust **debe ejecutarse en servidor** a través de un proxy QTSP: el secreto del QTSP no puede residir en el navegador. El cliente ya está diseñado fail-closed (`assertServerSideQTSPProxyConfigured()` lanza `QTSP_SERVER_PROXY_REQUIRED` si no hay proxy). Falta **implementar y operar** ese proxy.

### 33.2 Requisitos

**`RF-G1-02` Proxy QTSP server-side (M, F0).** Existe un proxy de confianza del lado servidor (Edge Function / servicio) que ejecuta el flujo `client_credentials` contra EAD Trust con gestión segura de secretos, OAuth productivo y orquesta QES/QSeal/TSQ/ERDS.
- **CA-G1-02a:** ningún secreto QTSP se expone al cliente (`clientSecret` vacío en el bundle del navegador — MANTENER); las credenciales viven solo en el servidor.
- **CA-G1-02b:** **fail-closed**: en producción, un fallo del proxy lanza error y **nunca** convierte un fallo en una "firma exitosa"; el fallback sandbox solo se activa con `import.meta.env.DEV` o `VITE_QTSP_ALLOW_SANDBOX === 'true'`. → T.7
- **CA-G1-02c:** el proxy implementa el flujo QES completo (crear Signature Request → SHA-256 del documento → registrar y subir a S3 prefirmado → `READY_TO_SIGN` → firmantes → activar) y el flujo ERDS (`generateEvidence` con testimonio TSP cualificado), con polling de estado.
- **CA-G1-02d:** verificación post-firma real vía Trust Center sobre los artefactos persistidos.

**`RF-G1-03` Verificación server-side de QTSP (S, F1).** La verificación de integridad de sellos/firmas se realiza también server-side (no solo cliente), cerrando la deuda server-side documentada (verificación QTSP + ownership polimórfico).
- **CA-G1-03a:** `fn_verify_audit_chain` y la verificación de artefactos QTSP son invocables server-side; la verificación no sintetiza hashes (artefacto sin `signature_hash` se marca FALLIDO fail-closed — MANTENER ITEM-107).

## 34. Estados de evidencia productiva y backbone (`000049`)

**`RF-G1-04` Backbone de evidencia fuera de HOLD (M, F1).** La migración `000049_grc_evidence_legal_hold` se promueve fuera de HOLD bajo paquete product-complete aprobado, habilitando la promoción de bundles a estados sellados verificables.
- **CA-G1-04a:** los `evidence_bundles` transicionan `OPEN → SEALED → VERIFIED` (CHECK `evidence_bundles_status_check`) y `signature_date` solo se fija en `SEALED`/`VERIFIED`. → T.4, T.7
- **CA-G1-04b:** `isFinalSealedEvidence(status)` reconoce solo `SEALED`/`VERIFIED`; un bundle sandbox se degrada a `OPEN` (MANTENER `evidence-sandbox-gate.ts`).
- **CA-G1-04c:** la promoción a SEALED/VERIFIED **solo** ocurre cuando existen QES/QSeal/TSQ + `manifest_hash` reales.

**MANTENER:** cadena de evidencia de 6 eslabones (censo WORM → `snapshot_hash` → `gate_hash` → QES+TSQ → archivado SHA-512 → manifest hash); archivado idempotente por contenido en bucket privado; provenance obligatoria; hardening multi-tenant (`fn_create_governance_evidence_bundle` con tenant-assert fail-closed `42501`, head Cloud `20260606165443`).

## 35. Retención y legal hold productivos

**`RF-G1-05` Políticas de retención y legal hold operativas (M, F1).** Producción exige gobernar quién puede sellar, verificar, retener, bloquear destrucción, exportar evidencias y responder ante auditoría o litigio.
- **CA-G1-05a:** `entities.legal_hold` y `retention_policy_id` operativos; un bundle bajo legal hold no puede destruirse y muestra badge `LEGAL HOLD`.
- **CA-G1-05b:** la retención aplica políticas por tipo de artefacto; la exportación de evidencias es trazable (quién, cuándo, qué) en `audit_log`.

## 36. Auditoría WORM (MANTENER)

**MANTENER:** cadena de hash SHA-512 en `audit_log` (`fn_audit_worm`, SECURITY DEFINER, encadenamiento `prev_hash|'GENESIS'`); `fn_verify_audit_chain` (recálculo y detección de manipulación a la primera divergencia); inmutabilidad de `censo_snapshot`; `EvidenceForenseSection` con "Verificar cadena". Es la pieza de cara al perito/auditor y **ya es operativa y verificable en vivo** — se presenta como tal incluso en demo.

## 37. Valor probatorio agregado (criterio de presentación)

**`RF-G1-06` Presentación honesta del valor probatorio (M, F0).** Hasta cierre de G1, la cadena criptográfica se presenta como **arquitectura probatoria y prueba de concepto**, no como evidencia cualificada emitida; la cadena WORM y la inmutabilidad del censo sí se presentan como operativas.
- **CA-G1-06a:** ninguna demo afirma "firma cualificada final" mientras el gate distinga sandbox de evidencia sellada; los tres estados (`DEMO_OPERATIVA`/`SEALED`/`VERIFIED`) son visibles y distintos (ver `RF-CORE-01`).

---

# PARTE VIII — Seguridad, control de acceso y automatización cross-módulo

## 38. RBAC, capacidades societarias y autoridad

**MANTENER:** tres capas complementarias — (1) roles/permisos RBAC (`useUserRole` contra `rbac_user_roles ⋈ rbac_roles`, 5 roles: `ADMIN_TENANT`/`SECRETARIO`/`COMPLIANCE`/`CONSEJERO`/`AUDITOR` con comodines `recurso:acción`); (2) `capability_matrix` (35 filas, 7 acciones: SNAPSHOT_CREATION, VOTE_EMISSION, CERTIFICATION, CARGO_MANAGEMENT, PERSON_WRITE, PERSON_CONSOLIDATE, REPRESENTATION_MANAGEMENT); (3) `authority_evidence` (cargo vigente, Vº Bº, un PRESIDENTE VIGENTE por órgano). Lectura jurídica: certificar y congelar censo reservados a Secretario/Admin; voto a Secretario(consejero)/Consejero/Admin; Compliance y Auditor excluidos de escritura societaria.

**`RF-CORE-38` Razón jurídica completa en la matriz de capacidades (S, F1).** La razón jurídica anotada se completa en las **siete** acciones, no solo en las tres nucleares del pipeline certificante (hoy `CARGO_MANAGEMENT`, `PERSON_WRITE`, `PERSON_CONSOLIDATE`, `REPRESENTATION_MANAGEMENT` tienen anotación parcial).
- **CA-CORE-38a:** las 35 filas de `capability_matrix.reason` están pobladas con fundamento jurídico.
- **CA-CORE-38b:** existe revisión periódica de roles y se auditan los overrides de permisos con el mismo rigor que los overrides normativos.

**`RF-CORE-39` Cargo societario ≠ rol RBAC (M, MANTENER).** El cargo societario (Presidente, Consejero Coordinador) se modela en `condiciones_persona`/`authority_evidence`, no en RBAC; `CONSEJERO_COORDINADOR` no es certificante (art. 109 RRM); el trigger `fn_sync_authority_evidence` no genera evidencia para ese cargo.

## 39. Segregación de funciones (SoD)

**MANTENER:** `SodGuard` + `fn_check_sod_violations` con pares tóxicos (ADMIN_TENANT×AUDITOR BLOCK, SECRETARIO×AUDITOR BLOCK, SECRETARIO×COMPLIANCE WARN, CONSEJERO×COMPLIANCE WARN).

**`RF-CORE-40` SoD extendido a todo acto con impacto jurídico (S, F1).** La evaluación SoD se aplica a la asignación de cualquier rol/capacidad con impacto societario, no solo en alta de rol.
- **CA-CORE-40a:** los pares BLOCK impiden la asignación; los WARN la permiten señalando deuda de control; ambos quedan en auditoría.

## 40. Workflows cross-módulo gobernados (G6)

### 40.1 Plano funcional-jurídico

Existen handoffs read-only desde GRC/AIMS hacia Secretaría (escalado de incidente, hallazgo de auditoría, incidente material de IA) que elevan a la agenda del órgano competente, **sin escritura cruzada** (no escriben en `governance_module_events`/`governance_module_links`). El diseño es prudente pero **limita la automatización proactiva**: Secretaría es transaccional y completa, mientras GRC/AIMS funcionan como postura/diagnóstico/handoff conceptual. El estado objetivo evoluciona los handoffs a **workflows gobernados, auditables y parametrizables**, sin perder el control profesional del secretario ni convertir warnings en bloqueos indebidos.

### 40.2 Requisitos

**`RF-G6-01` Propuesta de agenda gobernada desde GRC/AIMS (S, F2).** Un fallo recurrente de control (GRC) o un gap de technical file / incidente material (AIMS) puede **proponer** un punto de agenda con owner sugerido, evidencia adjunta (etiquetada por postura probatoria), recordatorios y escalado si no se atiende.
- **CA-G6-01a:** la propuesta es eso —propuesta—: la decisión de convocar/celebrar la conserva Secretaría (MANTENER contrato read-only de entrada); ninguna escritura cruzada no gobernada.
- **CA-G6-01b:** el workflow es auditable (origen, evento, owner, plazos, escalado) y parametrizable por tipo de evento.
- **CA-G6-01c:** se mantienen los contratos de handoff existentes (`cross-module-handoff.ts`, claves `source`/`event`/`source_id`) y las rutas de escalado read-only.

**`RF-G6-02` Recordatorios y escalados de firma/inscripción (S, F2).** Recordatorios de firma QES pendiente, escalados de firma y seguimiento post-generación e inscripción se automatizan como tareas programables.
- **CA-G6-02a:** un documento generado pendiente de firma, o un expediente registral en `SUBSANACION` con plazo, genera recordatorio/escalado sin bloquear indebidamente.

**MANTENER:** referencias de Secretaría a evidencia AIMS/GRC solo si la postura probatoria está etiquetada (`reference`/`pending`); rutas de escalado inverso read-only; no escribir en `governance_module_*`.

---

# PARTE IX — Requisitos no funcionales y endurecimiento a producción (G0)

El Comité Legal sitúa estos requisitos como **habilitadores inmediatos**: convertir la demo avanzada en pre-release controlado. La calidad de datos y la separación de entornos son requisito **jurídico**, no solo técnico.

**`RNF-01` Staging separado (M, F0).** Existe un Supabase de staging separado de `governance_OS`, con pipeline e2e no destructivo, para pruebas destructivas y validación sistemática sin tocar el entorno activo.
- **CA-RNF-01a:** `governance_OS` deja de ser el único entorno cuando el prototipo alcanza estabilidad pre-release; hasta entonces sigue siendo fuente de verdad de desarrollo/demo (política `2026-05-17-governance-os-active-dev-environment-policy.md`). → T.G0
- **CA-RNF-01b:** antes de cualquier trabajo Supabase se ejecuta `bun run db:check-target` y se confirma el target.

**`RNF-02` Migraciones versionadas y reconciliadas (M, F0).** Todo cambio Cloud tiene espejo en `supabase/migrations/`, forward-only, con `migration list --linked` alineado local/remoto y sin drift pendiente.
- **CA-RNF-02a:** 0 migraciones pendientes; los drifts DR1/DR2 reconciliados; head remoto documentado.

**`RNF-03` Telemetría y SIEM (M, F0).** Telemetría OTel activa con feed a Microsoft Sentinel (vía Edge Function), cubriendo eventos de firma, certificación, inscripción, cambios de rol y acceso a evidencia.
- **CA-RNF-03a:** los eventos críticos (CERT_EMITIDA, firma, legal hold, cambios RBAC) emiten telemetría correlacionable.

**`RNF-04` Hardening de privilegios (M, F0).** Privilegios endurecidos: RPC SECURITY DEFINER con tenant-assert; `REVOKE EXECUTE` a `authenticated` donde proceda; RLS por tenant en todas las tablas de dominio.
- **CA-RNF-04a:** MANTENER `fn_create_governance_evidence_bundle` tenant-assert (`42501`), `fn_upsert_mandatory_book_v2` revoke, `fn_save_meeting_resolutions` validación de pertenencia.
- **CA-RNF-04b:** modelo de amenazas DEFINER revisado (`2026-05-16-definer-threat-model.md`) sin hallazgos abiertos críticos.

**`RNF-05` Observabilidad de calidad de datos (S, F1).** Controles automáticos de integridad: 6 paridades del modelo canónico (entity→PJ, capital VIGENTE, mandates↔holdings, mandates↔condiciones, suma cap table 100 %) ejecutados en CI (`validate-model-bootstrap.ts`).
- **CA-RNF-05a:** el pipeline falla si una paridad se rompe; los artefactos E2E no cuentan en las paridades de producción.

**`RNF-06` Accesibilidad e i18n (S, MANTENER).** WCAG 2.1 AA (contraste, aria, focus); tokens Garrigues `--g-*`/`--status-*` sin violaciones; etiquetas de estado en castellano (`status-labels.ts`); preparación i18n para multi-jurisdicción.

**`RNF-07` Rendimiento y resiliencia (S, F1).** Code-splitting (React.lazy), ErrorBoundary global, empty/loading states, SLO dashboard (latencia, error rate, uptime) operativos.

---

# PARTE X — Hoja de ruta, trazabilidad y criterios de salida

## 41. Fases y secuenciación

La hoja de ruta prioriza cerrar **confianza, registro y datos maestros** antes de ampliar cobertura, y **deja la inteligencia para el final**: invertir en IA visible antes de cerrar fundamentos productivos es el principal riesgo estratégico.

| Fase | Horizonte | Objetivo | Requisitos principales |
|---|---|---|---|
| **F0** | Inmediato | Pre-release controlado + frontera probatoria | RNF-01..04, RF-CORE-01, RF-G1-01/02/06, RF-CORE-24 (arranque) |
| **F1** | Corto | Cierre registral + datos maestros SSOT + libros + evidencia productiva | RF-G2-01..03, RF-G3-01..05, RF-CORE-10, RF-G1-03/04/05, RF-CORE-38/40, RF-CORE-23a/b |
| **F2** | Medio | Motores jurisdiccionales + plantillas por contexto + cross-módulo | RF-G4-01/02/03, RF-G5-01/04, RF-G6-01/02, RF-CORE-21, RF-G2-04b |
| **F3** | Evolutivo | Inteligencia jurídica supervisada | RF-EVO-01..03 (§43) |

**Dependencias clave:** F1 (evidencia productiva) **depende de** F0 (proxy QTSP); el cierre registral terminal (G2) es independiente del proxy y puede demostrarse en sandbox registral controlado en F1; los motores locales (G4) **dependen de** datos maestros SSOT (G3) y del proceso de release legal (`RF-CORE-24`).

## 42. Matriz de trazabilidad gap → requisitos → fase

| Gap | Requisitos | Fase | DoPR |
|---|---|---|---|
| **G0** Endurecimiento | RNF-01..07 | F0/F1 | DoPR-0 |
| **G1** Probatorio QTSP | RF-G1-01..06, RF-CORE-01, RF-CORE-15 | F0/F1 | DoPR-1 |
| **G2** Cierre registral | RF-G2-01..04, RF-CORE-12 | F1 | DoPR-2 |
| **G3** Datos maestros SSOT | RF-G3-01..05 | F1 | DoPR-3 |
| **G4** Multi-jurisdicción | RF-G4-01..03 | F2/F3 | DoPR-4 |
| **G5** Documental por contexto | RF-G5-01..04, RF-CORE-23a/b/c | F1/F2 | DoPR-5 |
| **G6** Cross-módulo gobernado | RF-G6-01/02, RF-CORE-21 | F2 | DoPR-6 |
| **CORE** Ciclo/no regresión | RF-CORE-10/12/13/14/17/24/38/39/40 | F0/F1 | (transversal) |

## 43. Inteligencia jurídica supervisada (F3, evolutivo)

Posterior al cierre de fundamentos. Toda capacidad de IA exige **revisión legal y trazabilidad**.

- **`RF-EVO-01` (W/C, F3)** Redacción asistida de actas desde transcripciones, con revisión legal obligatoria.
- **`RF-EVO-02` (W/C, F3)** Extracción semántica de acuerdos y generación de board pack inteligente.
- **`RF-EVO-03` (W/C, F3)** Detección de gaps normativos sobre el catálogo de materias y plantillas.
- **CA-EVO:** ninguna salida de IA produce efecto jurídico sin validación humana; toda generación queda trazada.

## 44. Definition of Production-Ready — checklist de salida

El módulo se declara production-ready cuando **todos** los DoPR están verificados:

- [ ] **DoPR-0** Staging separado · migraciones reconciliadas (0 pendientes) · CI e2e no destructivo · SIEM activo · privilegios endurecidos.
- [ ] **DoPR-1** Proxy QTSP server-side operativo · QES/QSeal/TSQ/ERDS reales y verificables · backbone `000049` fuera de HOLD · retención + legal hold operativos · fail-closed verificado.
- [ ] **DoPR-2** Golden paths registrales demostrados: ≥1 `INSCRITA`, ≥1 `DENEGADA`, ≥1 `SUBSANACION` resuelta · evidencia de asiento/publicación incorporada · `agreements` en `REGISTERED`/`PUBLISHED`/`REJECTED_REGISTRY`.
- [ ] **DoPR-3** Modelo canónico = única fuente operativa · `mandates` sin lecturas de runtime · artefactos E2E aislados · NIF/CIF único · representantes PJ y autoridad certificante completos.
- [ ] **DoPR-4** Portugal motor local completo · BR/MX con hoja de ruta activa · prerrequisitos regulatorios modelados.
- [ ] **DoPR-5** Lista P0 a cero · especialización por contexto donde el texto difiere · contrato de variables conciliado · 0 plantillas ACTIVA con órgano alias no canónico.
- [ ] **DoPR-6** Handoffs convertidos en workflows gobernados con recordatorios/escalados · sin escritura cruzada no gobernada.
- [ ] **Transversal** Matriz de pruebas jurídicas deterministas firmada por Legal en cada release (`RF-CORE-24`).

## 45. Qué puede prometerse hoy vs. qué falta para ser "la más completa"

**Hoy puede prometerse** una plataforma demo-ready de altísima fidelidad para gestión societaria española de grupo (motor jurídico, plantillas protegidas, workflow transaccional, RBAC, libros, cap table, campañas de grupo, tramitación registral modelada y evidencia WORM), con arquitectura **preparada** para evidencia cualificada, aclarando que QES/QSeal/TSQ/ERDS operan en sandbox. **No** debe afirmarse producción con evidencia cualificada final ni cierre registral efectivo.

**Para ser "la más completa"** hay que cerrar tres completitudes: **vertical** (cada acto hasta inscripción/publicación/legalización/archivo verificable — G2, libros), **horizontal** (más jurisdicciones, formas sociales, materias, registros locales — G4, G5), y **operacional** (recordatorios, escalados, campañas, automatización sin perder control profesional — G6). Cerrados los fundamentos, TGMS se diferencia de los gestores documentales porque **no solo genera documentos: calcula validez, congela evidencia, coordina órganos, gestiona grupo y explica jurídicamente cada decisión.**

---

# ANEXO TÉCNICO T — Contratos de datos, RPC, estados y guardrails

> Plano de ingeniería. Todo cambio Cloud es **forward-only**, con espejo en `supabase/migrations/`, verificado con `bun run db:check-target` antes y después, y `migration list --linked` alineado (`RNF-02`). **MANTENER** = ya existe y no se toca salvo no regresión. **NUEVO** = a crear. Las operaciones destructivas (p. ej. retirada de pack legacy, congelar `mandates`) requieren aprobación explícita por el guardrail de BD compartida.

## T.1 Contratos de datos (tablas y columnas)

### T.1.1 Datos maestros — SSOT (G3) → RF-G3-01..04

| Objeto | Cambio | Detalle |
|---|---|---|
| `entities`, `persons` | **NUEVO** `data_class text CHECK (data_class IN ('PROD','DEMO','TEST'))` default `'PROD'` | Aísla artefactos E2E (`PHASE-B*`, `Arga test A`, `PRUEBA`, `SEGUROS TEST`, `QA-*`). Listados operativos filtran `TEST`. |
| `persons` | **NUEVO** índice único parcial `ux_persons_tax_id` sobre `(tenant_id, tax_id)` `WHERE tax_id NOT IN ('PENDIENTE') AND tax_id NOT LIKE 'E2E%' AND tax_id NOT LIKE 'FREE-FLOAT%'` | Unicidad NIF/CIF; bloquea duplicados reales. |
| `mandates` | **CAMBIO (requiere aprobación)** → VIEW read-only o tabla congelada | Tras `RF-G3-01`; sin lecturas de runtime. Fase 5 del plan canónico. |
| `condiciones_persona` | **MANTENER** + completar `metadata.categoria` (independiente/ejecutivo/dominical) | RF-G3-04d; `representative_person_id` para consejero PJ. |
| `authority_evidence` | **MANTENER** `cargo`, `estado='VIGENTE'`, `inscripcion_rm_referencia`, `inscripcion_rm_fecha` | RF-G3-04b; índice único parcial 1 PRESIDENTE VIGENTE por `body_id`. |

### T.1.2 Cierre registral (G2) → RF-G2-01..04

| Objeto | Cambio | Detalle |
|---|---|---|
| `registry_filings` | **MANTENER** `filing_via`, `filing_number`, `presentation_date`, `inscription_number`, `borme_ref`, `psm_ref`, `siger_ref`, `conservatoria_ref`, `jucerja_ref`, `diario_oficial_ref`, `defect_details`, `deed_reference`, `notary_name`, `protocol_number`, `elevated_at` | Cubre el ciclo; vocabulario español canónico (ITEM-102). |
| `registry_filings` | **NUEVO** `inscription_date date`, `qualification_result text`, `publication_ref text`, `subsanacion_deadline date` | Asiento final, calificación, publicación BORME/equivalente, plazo de subsanación. |
| `registry_filings` | **NUEVO** `regulatory_authorization jsonb` | Prerrequisito SUSEP/CNSF/BdP/DGSFP (RF-G4-02a) — dato/gate, no cálculo. |
| `agreements` | **MANTENER** `status` ampliado operativo a `REGISTERED`/`PUBLISHED`/`REJECTED_REGISTRY` | Propagación desde `registry_filings`. |

### T.1.3 Libros (legalización operativa) → RF-CORE-10

| Objeto | Cambio | Detalle |
|---|---|---|
| `mandatory_books` | **MANTENER** `legalization_status` (`PENDIENTE`/`PRESENTADO`/`LEGALIZADO`/`RECHAZADO`), `legalization_deadline`, `legalization_evidence_url`, `requires_legalization`, `closed_at` | Ciclo de legalización; KPIs y alertas sobre datos reales. |
| `mandatory_books` | **NUEVO** `legalization_filing_ref text`, `rejection_reason text` | Referencia de presentación telemática RM y motivo de rechazo. |

### T.1.4 Evidencia (G1) → RF-G1-04/05

| Objeto | Cambio | Detalle |
|---|---|---|
| `evidence_bundles` | **MANTENER** `status CHECK ('OPEN','SEALED','VERIFIED')`, `qseal_token`, `tsq_token`, `manifest_hash`, `hash_sha512`, `signature_date`, provenance (`source_module`/`source_object_type`/`source_object_id`) | `signature_date` solo en SEALED/VERIFIED. |
| `000049_grc_evidence_legal_hold` | **CAMBIO** salir de HOLD bajo paquete aprobado | Habilita backbone productivo (RF-G1-04). |
| `entities` | **MANTENER** `legal_hold`, `retention_policy_id` | Retención + legal hold operativos (RF-G1-05). |

### T.1.5 Plantillas por contexto (G5) → RF-G5-01

| Objeto | Cambio | Detalle |
|---|---|---|
| `plantillas_protegidas` | **MANTENER** `tipo_social` (hoy NULL) | Se puebla para familias que se desdoblan. |
| `functional-key.ts` `buildFunctionalKey` | **CAMBIO** dejar de fijar `tipoSocial: null` en familias desdobladas | `DUP_ACTIVE_FUNCTIONAL_KEY` opera por contexto. |
| `plantillas_protegidas` | **MANTENER** `jurisdiccion ∈ {ES,BR,MX,PT,UK,FR,DE}` | Poblar `PT` en F2 (RF-G5-04). |

## T.2 RPC — nuevas y modificadas

| RPC | Estado | Cambio |
|---|---|---|
| `fn_firmar_certificacion` | **CAMBIO (G1)** | Consumir QES/TSQ reales del proxy; mantener exigencia TSQ no nulo y `hash_certificacion`. |
| `fn_create_governance_evidence_bundle` | **MANTENER** tenant-assert `42501` (head `20260606165443`) | No regresión. |
| `fn_promote_evidence_bundle` | **NUEVO (G1)** | `OPEN→SEALED→VERIFIED` solo con QES/QSeal/TSQ + `manifest_hash` reales; SECURITY DEFINER + tenant-assert. |
| `fn_merge_persons` | **NUEVO (G3)** | Consolida duplicado: migra referencias (cargos/holdings/representaciones/autoría) y archiva; capacidad `PERSON_CONSOLIDATE`; audit-logged. |
| `fn_registrar_inscripcion` / `fn_registrar_denegacion` / `fn_resolver_subsanacion` | **NUEVO (G2)** | Transición a estados terminales con evidencia obligatoria (fail-closed); propagan `agreements.status`. |
| `fn_legalizar_libro` | **NUEVO (libros)** | Cierre de volumen + presentación + respuesta registral (`LEGALIZADO`/`RECHAZADO`). |
| `fn_verify_audit_chain` | **MANTENER** + exposición server-side (RF-G1-03) | No sintetiza hashes. |
| `fn_generar_acta`, `fn_generar_certificacion`, `fn_emitir_certificacion`, `fn_save_meeting_resolutions`, `fn_no_session_*`, `fn_cerrar_votaciones_vencidas`, `fn_upsert_mandatory_book_v2`, `fn_check_sod_violations`, `fn_sync_authority_evidence`, `fn_audit_worm`, triggers `censo_snapshot` | **MANTENER** | No regresión; controles RRM 109 y WORM intactos. |

## T.3 Máquinas de estado objetivo

| Dominio | Máquina objetivo | Cambio |
|---|---|---|
| `agreements` | `DRAFT→PROPOSED→ADOPTED→CERTIFIED→INSTRUMENTED→FILED→REGISTERED→PUBLISHED` · `REJECTED_REGISTRY` | Poblar/operar tramo terminal (G2). |
| `registry_filings` | `PREPARADA→PRESENTADA→EN_TRAMITE→SUBSANACION→INSCRITA` · `ELEVADA` · `DENEGADA` | Operar `INSCRITA`/`DENEGADA`; alias EN/legacy solo lectura. |
| `mandatory_books` | `PENDIENTE→PRESENTADO→LEGALIZADO` · `RECHAZADO` | Operar con artefactos reales. |
| `evidence_bundles` | `OPEN→SEALED→VERIFIED` | Promoción solo con artefactos QTSP reales. |
| `plantillas_protegidas`, `certifications`, `meetings`, `no_session_resolutions`, `unipersonal_decisions`, `communications` | **MANTENER** | Sin cambios. |

## T.4 Proxy QTSP server-side (G1) → RF-G1-02

- **NUEVO** Edge Function `qtsp-proxy` (o servicio equivalente): ejecuta OAuth `client_credentials` contra EAD Trust (Okta) con secreto **solo server-side**; orquesta QES (`executeQESSignFlow`), QSeal, TSQ y ERDS (`generateEvidence`).
- **MANTENER** `assertServerSideQTSPProxyConfigured()` → `QTSP_SERVER_PROXY_REQUIRED`; `clientSecret: ''` en cliente.
- **Fail-closed:** fallback sandbox solo con `import.meta.env.DEV` o `VITE_QTSP_ALLOW_SANDBOX==='true'`; en producción el fallo de proxy lanza error. `useQTSPSign` marca `sandbox: true` en fallback.
- **MANTENER** `evidence-sandbox-gate.ts`: `resolveSandboxSafeEvidencePersistence` degrada sandbox a `OPEN`; `isFinalSealedEvidence` solo `SEALED`/`VERIFIED`.

## T.5 Guardrails de no regresión (vigentes en `CLAUDE.md`)

No escribir en `governance_module_events`/`governance_module_links` (handoffs read-only); no mezclar `ai_*` con `aims_*` ni `grc_*` legacy sin contrato; tokens Garrigues `--g-*`/`--status-*` (sin Tailwind nativo) en componentes; Web Crypto (`globalThis.crypto.subtle`), no `crypto` de Node; TS relajado (`noImplicitAny:false`, `strictNullChecks:false`); `bun` como gestor; gate real de tipos `tsc -b` (`bun run typecheck`).

---

# ANEXO N — Base normativa por bloque

| Bloque | Base normativa principal |
|---|---|
| Convocatoria | LSC arts. 166-176 (junta), 177 (2ª conv. SA), 178 (universal), 173/173.2 (publicidad), 246 (consejo) |
| Constitución/quórum | LSC arts. 193-194 (SA), 198 (SL), 190.2 (conflicto/denominador), 247 (consejo) |
| Votación/mayorías | LSC arts. 198, 199.a/b, 200.1, 201.1/201.2, 247.1/248.1, 249.3; voto de calidad (DL-5) |
| Acuerdos sin sesión | RRM art. 100; LSC art. 248.2 |
| Co-aprobación/solidario | LSC arts. 210, 233.2.c |
| Decisiones unipersonales | LSC arts. 15, 16, 210 |
| Actas | LSC art. 202; RRM arts. 97-112 |
| Certificación | RRM art. 109 (109.1.a Vº Bº, 109.4 acta firmada) |
| Tramitación registral | RRM (inscripción, calificación, subsanación); BORME; equivalentes PT/BR/MX |
| Materias estructurales/estatutarias | LSC arts. 285, 295-316, 346, 360-400, 401-418; RDL 5/2023 (fusiones) |
| Pactos parasociales | LSC arts. 29, 530-535 (cotizadas) |
| Cotizada (DL-2) | LMV/LMVSI (Ley 6/2023), MAR art. 17, LSC art. 540 (IAGC), art. 231 (vinculadas) |
| Firma/evidencia | Reglamento (UE) 910/2014 (eIDAS) y eIDAS 2 (QES/QSeal/TSQ/ERDS) |
| Libros | CCom arts. 25 y ss.; LSC arts. 104, 116; art. 16; Ley 14/2013 art. 18 |
| Asegurador cotizado | Solvencia II; Ley 20/2015 (LOSSEAR); RD 1060/2015; supervisión DGSFP/BdP/SUSEP/CNSF |

---

# ANEXO R — Riesgos, deuda conocida y su tratamiento

Las 13 limitaciones del Anexo C del documento de referencia, con el requisito que las cierra:

| # | Limitación conocida | Tratamiento en esta spec |
|---|---|---|
| 1 | Evidencia QES/QSeal/TSQ/ERDS no productiva (sandbox) | **RF-G1-01..06** (proxy QTSP, backbone, retención) — DoPR-1 |
| 2 | Modelo canónico convive con `mandates`; motor no lee solo de `censo_snapshot` | **RF-G3-01/05** — DoPR-3 |
| 3 | Sin `INSCRITA`/`DENEGADA`; golden path no llega a inscripción | **RF-G2-01..03** — DoPR-2 |
| 4 | Cobertura jurídica 100 % ES; matriz no es motor extranjero | **RF-G4-01..03**, **RF-G5-04** — DoPR-4 |
| 5 | Comisión de Riesgos Regulada ≠ Comité de Riesgos | Documentado; ambos órganos se mantienen con base legal distinta (sin cambio funcional) |
| 6 | Rol RBAC ≠ cargo societario; `CONSEJERO_COORDINADOR` no certificante | **RF-CORE-39** (MANTENER) |
| 7 | Conflicto de interés se computa en votación, no es expediente propio | MANTENER; ownership de riesgo de conflicto en GRC |
| 8 | Incongruencia "Procesos"/Calendario | Deuda de marca; reconciliar en rework de procesos (selector estable `[data-sidebar-item="Procesos"]`) |
| 9 | `capability_matrix` con razón jurídica parcial (4 de 7 acciones) | **RF-CORE-38** — DoPR (transversal) |
| 10 | Datos demo incompletos en categorías de consejero; artefactos E2E | **RF-G3-02/04d** — DoPR-3 |
| 11 | Origen del pacto demo Fundación ARGA | MANTENER (seed `PACTO_FUNDACION_ARGA_2024`, DL-3) |
| 12 | `tipo_social` NULL en plantillas | **RF-G5-01** (desdoble por contexto) — DoPR-5 |
| 13 | Doble grafía y alias de materia; pack legacy `MOD_ESTATUTOS` sin retirar | **RF-CORE-23a/c** — retirada forward-only aprobada |

**Riesgo estratégico de secuenciación.** Invertir en inteligencia jurídica visible (F3) antes de cerrar fundamentos productivos (F0/F1) erosiona credibilidad. La plataforma gana más demostrando **inscripción real, evidencia real y datos maestros limpios** que con redacción asistida sobre un núcleo aún ambiguo. **La inteligencia se construye sobre evidencia y reglas confiables, no antes.**

---

*Especificación funcional del estado objetivo productivo del Módulo de Secretaría Societaria TGMS. Basada en la descripción funcional verificada del 13-jun-2026 y la revisión del Comité Legal. Las capacidades marcadas MANTENER reflejan el estado verificado en `governance_OS`; las marcadas NUEVO/CAMBIO son requisitos de evolución forward-only sujetos a los guardrails del repositorio. Documento de continuidad: punto de entrada para conversaciones de ejecución por fase (F0→F3).*

