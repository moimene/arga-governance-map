# Auditoría de brechas — Rediseño UX/copy del módulo Secretaría

**Fecha:** 2026-06-20
**Ámbito:** módulo Secretaría Societaria (`/secretaria/*`) de TGMS
**Tipo:** auditoría de brechas (gap analysis) propuesta-vs-código, read-only
**Origen de la propuesta:** `docs/superpowers/reviews/2026-06-20-informe-ux-redesign-copy-legal.md` (informe revisado por el Comité Legal)
**Método:** lectura directa del código actual con evidencia `archivo:línea`. Cinco barridos paralelos (navegación, pantallas operativas, certificaciones autónomas, datos maestros/reglas, copy/móvil) + verificación puntual de las afirmaciones de mayor impacto.
**Cliente demo:** Grupo ARGA Seguros (pseudónimo operativo)

---

## 0. Cómo leer este documento

El informe del 2026-06-20 propone un rediseño UX y un catálogo de copy para `/secretaria`. Este documento **no** repite la propuesta: mide **cuánto de ella ya está en el código y qué falta**, pantalla por pantalla, con cita `archivo:línea`.

Leyenda de veredictos: **✅ Cumple** · **🟡 Parcial** (existe pero diverge en copy, estructura o profundidad) · **❌ Falta**.

Clasificación de esfuerzo, usada en §5:
- **Copy-only** — cambiar un string o añadir una clave de traducción.
- **Superficie UI** — montar un componente/sección sobre datos o lógica que ya existen en backend.
- **Estructural** — rediseñar un flujo o pantalla.
- **Datos/motor** — requiere campo nuevo, RPC, RLS o lógica de dominio.

---

## 1. Veredicto global

**El módulo está bastante más avanzado de lo que el informe presupone.** El informe está escrito como si Secretaría fuera una colección de tablas técnicas; en realidad ya existen el traductor central de estados, la separación de señales externas, la jerarquía normativa de 7 capas calculada, el modelo de datos completo de certificaciones autónomas con su auditoría WORM, layout móvil dedicado en varias listas, y paneles de "qué bloquea / qué falta / qué puedo hacer" en el expediente.

**La brecha dominante no es de motor: es de superficie (UI) y de copy.** El patrón se repite en casi todas las áreas: la lógica de dominio está construida y testada, pero la pantalla **no la consume** o la muestra con vocabulario técnico crudo. El caso más claro es certificaciones autónomas: el backend cubre ~90 % del informe (modelo de datos, hashing, autoridad fail-closed, evento `STANDALONE_CERT_EMITIDA`, gate sandbox), pero la UI sigue siendo un formulario plano de UUIDs.

**Hay un riesgo legal concreto y una palanca de alto ROI, ambos en copy:**
- **Riesgo P0:** el disclaimer "Entorno de validación funcional — sin eficacia jurídica cualificada productiva" **tiene 0 apariciones en la UI** (`src/pages` + `src/components`). Las listas de informes y certificaciones muestran el token `DEMO_OPERATIVA` crudo. El control de riesgo sandbox existe en el motor y en el DOCX generado, pero no en la celda que ve el secretario — justo el criterio de aceptación nº 1 y el no-objetivo de §13.
- **Palanca de mayor ROI:** faltan ~11 claves en `status-labels.ts`. Añadirlas (un solo archivo) traduce de golpe los estados del pipeline documental en las páginas que ya llaman a `statusLabel()`.

---

## 2. Resumen por área

| Área (sección informe) | Madurez | Brecha dominante | Esfuerzo del grueso |
|---|---|---|---|
| Navegación e IA (§5) | 🟡 Alta | Falta área "Expedientes"; 9 renombrados de label; "Mesa/Sesiones/Calendario" pendientes | Copy-only + 1 estructural |
| Mesa / Dashboard (§6.1) | 🟡 Media-alta | Falta bloque "Documentos pendientes" y CTA "Revisar documentos" | Estructural ligero + copy |
| Expediente 360 (§6.2) | ✅ Alta (mejor que el informe) | Empty states ocultos; H1/subcopy; tecnicismos en superficie | Copy-only |
| Informes y anexos (§6.3) | ❌ Baja | No hay flujo por fuente canónica; `source_ref` libre | Estructural |
| Revisión documental (§6.5) | ✅ Alta | Copy literal; toasts genéricos; tooltip sustituir | Copy-only |
| Registro y libros (§6.6) | 🟡 Media-alta | Libros ✅ (con móvil); Tramitador sin CTAs de fase ni móvil | Estructural ligero + copy |
| Certificaciones autónomas (§6.4) | 🟡 Backend ✅ / UI ❌ | Formulario de UUIDs en vez de wizard; no consume su propio motor | Estructural (UI sobre piezas existentes) |
| Sociedades / Personas (§6.7) | ✅ Alta | Avisos "censo pendiente" y "sin voto computable"; copy RM | Superficie + copy |
| Configuración / reglas (§6.8) | ✅ Alta | "Parámetros normativos" no nominal; avisos "plantilla sin regla" y "decisión legal pendiente" | Superficie + copy |
| Jerarquía normativa (§6.9) | 🟡 Backend ✅ / UI parcial | Chip imperativa/dispositiva; "¿Por qué esta regla?"; aviso snapshot desfasado | Datos/motor + superficie |
| Plantillas / cohortes (§6.10) | 🟡 Media | Estados de cohorte (upgrade/firma); aviso metadatos incompletos; filtros | Superficie |
| Copy / términos (§7) | 🟡 Infra ✅ / catálogo ❌ | 11 claves ausentes; 2 pantallas bypassean el diccionario; términos a evitar en uso | Copy-only (alto ROI) |
| Microcopy (§8) | ❌ Baja | Sin catálogo de carga/tooltips; empty states no cumplen patrón de 3 partes | Copy-only |
| Matriz móvil (§6.11) | 🟡 Media | M1 Expediente y M2 Certs/Revisión sin layout móvil ni confirmación 2 pasos | Superficie |

---

## 3. Las tres conclusiones que cambian el plan

1. **No es una reescritura, es completar superficie.** El plan del informe (UX-0…UX-7) sigue siendo válido, pero el coste real está sesgado hacia "montar UI sobre lógica existente" y "alinear copy", no hacia "construir motor". Esto abarata UX-4 (certificaciones), UX-6 (datos maestros) y UX-7 (reglas) respecto a lo que el informe deja entrever.

2. **El copy prioritario (UX-0) tiene un componente de riesgo legal que debe ir primero y solo.** El disclaimer de evidencia y la traducción de estados crudos son los cambios con mayor riesgo/beneficio y los más baratos. Deben ejecutarse antes que cualquier rediseño de pantalla, como el propio informe recomienda (§14).

3. **La jerarquía normativa es trabajo de superficie, no de motor.** `normative-framework.ts` ya calcula las 7 capas con prioridad, plano y estado. Las tres brechas (chip imperativa/dispositiva, "¿Por qué esta regla?", aviso de desfase) son: un campo nuevo en el modelo de fuentes + dos componentes de presentación sobre datos ya disponibles.

---

## 4. Hallazgos por área

### 4.1 Navegación e información (§5)

**Veredicto:** 🟡 mayormente copy. De las 7 áreas propuestas, **4 ya coinciden** (Adopción, Documentación, Sociedades y personas, Configuración y reglas). La taxonomía real en modo sociedad es de 8 secciones (`navigation.ts:122-321`).

Áreas con brecha:
- **"Mesa"** existe como "Inicio/Dashboard" (`navigation.ts:123-139`) — rename trivial, pero convertirla en mesa de trabajo es trabajo de la página (§6.1).
- **"Expedientes"** ❌ **no existe como área de navegación.** El expediente solo es página (`/secretaria/acuerdos/:id`), sin entrada de sidebar ni índice. Es la mayor brecha de IA del §5.
- **"Registro y libros"** está partido en dos secciones ("Registro público" + "Libros y registros sociales", `navigation.ts:246-298`) por decisión deliberada del 2026-05-12 (CLAUDE.md). Fundirlas choca con esa decisión: requiere acuerdo antes de tocar.

Sidebar (§5.2, 20 filas, modo sociedad): **8 ✅ ya iguales**, **9 🟡 solo copy**, **3 ❌ renombrados de fondo**.

| Veredicto | Ítems |
|---|---|
| ✅ ya iguales | Convocatorias, Acuerdos sin sesión, Actas, Certificaciones autónomas, Subsanaciones, Sociedades, Materias y reglas, Catálogo de órganos |
| 🟡 copy-only | "Board Pack"→"Board pack"; "Certificaciones vinculadas"→"Certificaciones de acuerdos"; "Informes preceptivos"→"Informes y anexos"; "Documentos en revisión"→"Revisión documental"; "Presentaciones"→"Presentaciones registrales"; "Personas y cargos"→"Personas, cargos y representantes"; "Plantillas"→"Plantillas documentales"; "Gestor plantillas"→"Gobierno de plantillas"; ítem "Tramitador registral"→"Registro" |
| ❌ renombrado de fondo | "Dashboard"→"Mesa" (`navigation.ts:125`); "Reuniones"→"Sesiones" (`:156`, pendiente validación legal); "Procesos"→"Calendario societario" (`:290`, deuda intencional con 3 señales contradictorias) |

**Cautelas:**
- Cualquier rename debe aplicarse en **`GRUPO_NAV_GROUPS` y `SOCIEDAD_NAV_GROUPS`** (ambas en `navigation.ts`) para no dejar inconsistencia grupo/sociedad.
- "Procesos" usa selector E2E estable `[data-sidebar-item="Procesos"]` — actualizar tests al renombrar.
- El informe §5.2 **ignora 5 ítems ya existentes**: Actas pendientes, Comunicaciones, Libro de socios, Libros obligatorios, Multi-jurisdicción. Si la sidebar se reescribe desde la tabla del informe, hay riesgo de perderlos.

**Header/scope (§9.1):** ✅ ya cumple y en parte supera. `SecretariaHeader.tsx` muestra sociedad + forma social + jurisdicción + modo, con breadcrumb de 3 niveles (`:38-63`). Diferencias solo de copy (`modeLabel` más largo que lo propuesto) y de ubicación (textos de scope repartidos entre header y `ScopeSwitcher.tsx:88-90`). No incluye "fecha de corte".

---

### 4.2 Pantallas operativas (§6.1, 6.2, 6.3, 6.5, 6.6)

#### Mesa (§6.1) — 🟡 estructura alineada, falta un bloque

La estructura conceptual ya existe (mejor punto de partida del que asume el informe): bloque de prioridad (`Dashboard.tsx:767` "Prioridad ahora"), próximos hitos (`:1067`), accesos frecuentes (`:808` "Empezar un flujo"), panel plegado de contratos técnicos (`:936-1056`), y separación de señales externas con disclaimer honesto (`AgendaDraftInbox.tsx:43-46`). Copy distinto del literal §9.2.

- ❌ **Falta el bloque "Documentos pendientes"** en la Mesa y el CTA "Revisar documentos" en accesos frecuentes. La pantalla destino (`DocumentosPendientesRevision`) existe; falta el bloque/acceso desde Mesa.
- 🟡 H1 "Mesa de trabajo del secretario" (`:735`) vs propuesto "Mesa de Secretaría".
- 🟡 Header sin jurisdicción/modo/fecha de corte.

#### Expediente 360 (§6.2) — ✅ la más alineada (mejor que el informe)

Cubre las 8 secciones. `LegalControlPanel` ya implementa "Qué puedo hacer / Qué falta / Qué bloquea / Próximos pasos" (`ExpedienteAcuerdo.tsx:858-863`), más completo que lo planteado. Badge "Verificación OK" honesto solo con checks reales (`:621`). Timeline de 8 estados en español (`:97-120`).

- 🟡 H1 "Expediente del acuerdo · {kind}" (`:320`) vs "Expediente societario"; sin subcopy de módulo.
- 🟡 Secciones Documentos y Certificaciones **se ocultan cuando vacías** en vez de mostrar empty state (§8.5).
- 🟡 Tecnicismos en superficie que el informe relegaría a detalle avanzado: `profile_hash`, `snapshot_id`, `agreement_kind` crudo (`:320,968-972`).

#### Informes y anexos (§6.3) — ❌ mayor brecha estructural del lote

`InformesPreceptivos.tsx` es hoy un formulario con un **campo libre "Referencia/hash fuente"** (`:138-146`), justo el antipatrón que §6.3/§4.1.2 quiere eliminar.

- ❌ No hay **selector de fuente canónica** (acuerdo/convocatoria/acta/certificación/libro/manual). La fuente solo llega por query param `?agreement=`.
- ❌ No hay **detección/visualización de requisitos documentales** por materia.
- ❌ Botón "Crear" se deshabilita **sin explicar el requisito** (`:150`), violando §4.2.3.
- ❌ Estados crudos en tabla: `status.replace(/_/g," ")` muestra `APPROVED`/`ARCHIVED`/`FAILED` en inglés (`:22`) — no usa `statusLabel()`.
- ❌ Empty "No hay informes registrados." (`:195`) — solo "qué pasa".

#### Revisión documental (§6.5) — ✅ bien estructurada, brechas de copy

Cola pendientes/cerrados + CTAs aprobar/archivar/sustituir presentes. Usa `statusLabel()` (`:240`). Explica el bloqueo por rol (`:127-134`) — cumple §4.2.3.

- 🟡 Toasts genéricos "Estado actualizado" (`:69`) en vez de los textos de trazabilidad §9.5 ("Conservamos su huella y versión").
- 🟡 Subcopy arrastra "archivados como evidencia operativa" (`:88-90`) — roza presentar demo como evidencia (§7.3/§13).
- ❌ Sin tooltip "Marcar como sustituido".

#### Registro y libros (§6.6) — mixto

- **Libros** ✅: máquina de estados de legalización con CTAs reales (`LibrosObligatorios.tsx`, `LibroLegalizacionActions:25-93`) y **layout móvil dedicado** (`:397` `lg:hidden`). Mejor que lo que asume el informe.
- **Tramitador** 🟡: estados presentado/inscrito/subsanación presentes y traducidos; pero **falta vista "Denegadas"**, los CTAs de fase (elevar/presentar/subsanar) viven en el stepper y no en la lista, y la lista es **tabla pura sin variante móvil** (`TramitadorLista.tsx:132`) — incumple M2.

---

### 4.3 Certificaciones autónomas (§6.4) — área crítica

**Veredicto: backend maduro (✅ ~90 %), UI ausente (❌).** Existe una capa de dominio bien construida y testada (`standalone-certifications/index.ts`: `resolveCertificationAuthority`, `buildStandaloneCertificationExplainNodes`, `computeSourceHash`) que **la página apenas consume** — aparece sobre todo en los tests. Cerrar §6.4 es, en su mayoría, **construir la UI del wizard sobre piezas que ya existen**, no crear backend.

#### Lo que YA está (no rehacer)

| Requisito | Estado | Evidencia |
|---|---|---|
| Modelo de datos separado (tabla `standalone_certifications`) | ✅ | `migration 20260620045834:210-291` — `source_hash` propio, sin `gate_hash`/`minute_id`/`agreements_certified[]` |
| 17 campos mínimos del §6.4.4 | ✅ | `migration:241-281` |
| Índices recomendados (por sociedad/tipo y por fuente) | ✅ | `migration:283,286,289` |
| Evento auditoría `STANDALONE_CERT_EMITIDA` (+ `SOURCE_LOCKED`, `SUPERSEDED`) | ✅ | `migration:1366-1380,1213,1417` |
| Autoridad fail-closed (capacidad CERTIFICATION + AE vigente + ref. RM + Vº Bº por efecto) | ✅ backend | `migration:1085,1100-1153` |
| Hash de fuente SHA-256 estable | ✅ | `migration:634-641`; cliente `index.ts:117-126` |
| Gate sandbox (impide sellar demo como SEALED) | ✅ | `evidence-sandbox-gate.ts:48-69` |
| Capa 3 NO reescribe datos certificables (invariante de datos) | ✅ | `capa3_payload` JSONB separado de `source_payload` (`migration:249-255`) |

#### Lo que FALTA (la UI)

| Requisito §6.4 | Estado | Evidencia |
|---|---|---|
| Wizard guiado de 5 pasos | ❌ | Pantalla única con dos rejillas de inputs (`CertificacionesAutonomas.tsx:285-374`). No hay stepper. |
| Selector/buscador de fuente | ❌ | **7 inputs de UUID con `placeholder="UUID opcional"`** (`:342-373`) — el antipatrón §3. |
| Campo de fecha de corte + recálculo de huella | ❌ | `cutoffAt` existe en el hook (`useStandaloneCertifications.ts:167`) pero la página nunca lo expone; cae a `now()` del RPC. |
| Paso de fuente solo-lectura (datos canónicos antes de confirmar) | ❌ | `fn_prepare…` devuelve `source_payload`/`source_summary` (`migration:1031-1049`) pero la UI solo pinta `source_hash` (`:411-422`). |
| Detección de fuente incompleta/duplicada/discrepante-legacy | ❌ | El RPC solo aborta si la fuente queda **vacía** (`migration:1027`); no hay noción de "inconsistente". |
| Plantilla de 3 capas (`Capa3Form` cableado) | ❌ | `Capa3Form.tsx` existe completo (obligatoriedad, readonly, validación) pero la página **no lo importa**; manda un único input "Destinatario" (`:333-341`). |
| Previsualización del DOCX antes de generar | ❌ | El texto se compone solo dentro del archivado (`document.ts:122-170`); nunca se muestra como preview. |
| Confirmación final no colapsable (9 campos) | ❌ | No existe panel de confirmación; "Crear"→"Emitir" sin resumen. |
| Mostrar bloqueos de autoridad ANTES de emitir | 🟡 | El backend bloquea (fail-closed correcto), pero la UI lo muestra como `toast.error` **después** de intentar (`:209-213`), no como confirmación previa. La página no invoca `resolveCertificationAuthority` (existe, sin usar). |
| Botón "Marcar como sustituida" + estado `SUPERSEDED` accesible | ❌ | `useSupersedeStandaloneCertification` existe (`:207`) pero no hay acción en la página. |
| Traducir `legal_effect` y avisos por efecto (§6.4.1) | ❌ | `{cert.legal_effect}` crudo (`:448`); ninguno de los 5 avisos §6.4.1. |
| Disclaimer sandbox en pantalla (§6.4.3 / §7.3) | ❌ | La página muestra `evidence_status` crudo (`:455`); el nodo `EVIDENCE_DEMO` con el texto correcto existe en `index.ts:259-265` pero no se pinta. |

**Gaps de backend (menores):** RLS de lectura es tenant-scoped genérica (`migration:409-412`) — AUDITOR/COMPLIANCE leen por tenant, no por policy nombrada; la no-emisión sí está garantizada por capacidad de escritura. Decidir si se formaliza.

---

### 4.4 Datos maestros, reglas y jerarquía normativa (§6.7–§6.10)

**Veredicto: el área más madura del módulo.** Sociedades es ficha maestra real (`SociedadDetalle.tsx`, 8 tabs); Personas es modelo canónico visible con CTAs de certificación de cargo/titularidad gateados por capability; el aviso PJ-sin-representante cita LSC art. 212 bis (`PersonaDetalle.tsx:283-315`).

#### §6.9 Jerarquía normativa — brecha de superficie de alto valor

`buildEntityNormativeProfile()` (`normative-framework.ts:269-490`) **ya calcula las 7 capas exactas** del informe (LEY, REGISTRO, ESTATUTOS, PACTO_PARASOCIAL, REGLAMENTO, POLITICA, SISTEMA) con prioridad, plano y estado, y se renderizan en ficha societaria, expediente y rule manager.

Las tres brechas son de superficie sobre datos ya disponibles:
- ❌ **Chip imperativa/dispositiva**: 0 apariciones en UI; `NormativeSource` (`normative-framework.ts:28-40`) **no modela imperatividad**. Requiere campo nuevo + UI. Es el punto más señalado por Legal (criterios de aceptación nº 12 y 19).
- ❌ **Enlace "¿Por qué esta regla?"**: las fuentes concretas ya se computan y se muestran como chips; falta el componente de explicación dinámica nominal.
- ❌ **Aviso de snapshot normativo desfasado**: el `profile_hash` congelado existe (`ExpedienteAcuerdo.tsx:968`, `FrozenRuleSnapshotCard:1071`); falta **comparar con el perfil vigente** y emitir el aviso "el marco ha cambiado desde que se documentó".

#### §6.7 / §6.8 / §6.10 — avisos y nominalización

| Brecha | Estado | Evidencia |
|---|---|---|
| Aviso "censo pendiente" | ❌ | No superficiado en ficha de sociedad/persona |
| Aviso "participación sin derechos de voto computables" | 🟡 | Dato presente (`SociedadDetalle.tsx:1170`), aviso ausente |
| Aviso "plantilla sin regla" (inverso de "regla sin plantilla", que ✅ existe `:790`) | ❌ | No existe la alerta de plantilla huérfana |
| Aviso "decisión legal pendiente antes de activar bloqueo" (criterio nº 11) | ❌ | No existe |
| Sub-área nominal "Parámetros normativos" | 🟡 | La función vive en `RuleManagerPage` (GovernedMaintenanceCard `:815-936`) y `ActivarMarcoNormativo`, sin H1/copy propio |
| Estados de cohorte de plantilla ("pendiente de upgrade", "pendiente de firma/revisión") | ❌ | No existen como estado UI |
| "Activa con metadatos incompletos" | 🟡 | Datos presentes (`Plantillas.tsx:961-971`), falta badge/aviso/filtro nominal |
| Copy "Pendiente RM"→"Pendiente de referencia registral…" | 🟡 | `RmStatusChip.tsx:20` |
| CTA nominal "Revisar autoridad certificante" | 🟡 | Función en tab Autoridad (`SociedadDetalle.tsx:1386`), falta botón con ese label |

---

### 4.5 Sistema de copy y matriz móvil (§7, §8, §6.11)

**Infraestructura ✅, catálogo ❌.** El traductor central `statusLabel()` (`status-labels.ts`) existe y lo usan ~21/28 páginas. La brecha no es "no hay diccionario", sino que **(a) faltan claves, (b) el diccionario no usa el copy legal del informe, y (c) dos pantallas clave lo bypassean.**

#### §7.2 — claves ausentes (verificado contra el archivo)

`status-labels.ts` tiene `DRAFT`, `APPROVED`, `SIGNED`, `SEALED`, `PENDING`, `ISSUED` y la familia del expediente/tramitador. **Faltan 11 claves** que el pipeline documental emite y que hoy se renderizan crudas (en inglés):

`SOURCE_LOCKED` · `GENERATED` · `IN_REVIEW` · `EMITTED` · `ARCHIVED` · `ATTACHED` · `SUPERSEDED` · `REVOKED` · `FAILED` · `WAIVED_WITH_OVERRIDE` · `VERIFIED`

> Nota de verificación: `SUPERSEDED` **no** está en el diccionario (la línea 90 es `LEIDO`, no `SUPERSEDED`). Por tanto, aunque `DocumentosPendientesRevision.tsx:240` llama a `statusLabel()`, ese estado sale crudo igualmente. `statusLabel()` hace fallback al valor raw (`status-labels.ts:96`).

Añadir estas 11 claves es **un cambio de un solo archivo** y arregla de golpe todas las páginas que ya usan `statusLabel()`. Es la palanca de mayor ROI: convierte la mayor parte de la brecha §7.2 de "grande" a "pequeña". El equipo ya hizo esto antes (ITEM-070 añadió SIGNED/APPROVED/…), así que el patrón está establecido.

#### §7.3 — estados de evidencia (riesgo legal)

| Estado | Estado | Evidencia |
|---|---|---|
| `DEMO_OPERATIVA`→"Entorno de validación funcional" | ❌ crudo | `CertificacionesAutonomas.tsx:455`, `InformesPreceptivos.tsx:183` muestran el token literal |
| Disclaimer "sin eficacia jurídica cualificada productiva" | ❌ **0 en UI** | verificado: 0 resultados en `src/pages`+`src/components` |
| `VERIFIED`→"Verificada" | ❌ sin clave | ausente en `status-labels.ts` |
| `SEALED`→"Sellada" | 🟡 etiqueta sin disclaimer de producción | `status-labels.ts:74` |

El concepto de riesgo (sandbox ≠ producción) **sí está gobernado** en motor (`evidence-sandbox-gate.ts`) y en el DOCX (`document.ts:131`, `index.ts:263`) y en `GenerarDocumentoStepper.tsx:1496`. Pero **el copy legal no llega al chip** de las listas. Técnicamente seguro; textualmente no honesto en la superficie. **Es el P0.**

#### §7.1 — términos a evitar en uso

"artefacto/artefactos documentales" (`DocumentosPendientesRevision.tsx:89`, `InformesPreceptivos.tsx:78`) en vez de "Documento"; "Hash fuente"/"Hash" (`CertificacionesAutonomas.tsx:438`, `InformesPreceptivos.tsx:172`) en vez de "Huella de fuente". Bien resuelto: "Estado operativo" (`SociedadDetalle.tsx:538-544`).

#### §8 — microcopy

- **Carga** ❌ y **tooltips** ❌: dispersos/inexistentes; inputs con `placeholder="UUID opcional"` en vez de ayuda legal.
- **Error/éxito** 🟡: patrón `toast` consistente pero textos cortos y dispersos, menos ricos que el catálogo (p. ej. "Informe creado" vs "Informe creado y pendiente de revisión").
- **Empty states** ❌: ninguno de los muestreados cumple el patrón de 3 partes "qué pasa + por qué importa + qué puedo hacer". La forma es correcta (sobria, centrada); falta la capa de orientación.

#### §6.11 — matriz móvil

El patrón de tarjetas móviles (`lg:hidden`) ya existe en **4 listas**: Sociedades, Libros, Personas, Plantillas. La arquitectura responsive está; falta extenderla.

| Pantalla | Nivel | Estado | Evidencia |
|---|---|---|---|
| Mesa | M1 | 🟡 grids responsive, agenda sin tarjeta vertical dedicada | `Dashboard.tsx` |
| Expediente | M1 | ❌ sin layout móvil dedicado | `ExpedienteAcuerdo.tsx` |
| Certificaciones | M2 | ❌ solo scroll horizontal; **emitir sin confirmación 2 pasos** | `CertificacionesAutonomas.tsx:432,464` |
| Revisión documental | M2 | ❌ acciones aprobar/archivar/sustituir directas | `DocumentosPendientesRevision.tsx:257-277` |
| Libros / Personas / Sociedades / Plantillas | M2/M3 | ✅ tarjetas móviles | `LibrosObligatorios.tsx:397`, etc. |

El patrón `window.confirm` ya se usa en otras pantallas (`SociedadDetalle.tsx:1286`, `Plantillas.tsx:351-353`) — falta portarlo a las dos acciones M2 irreversibles más sensibles (emitir certificación, cerrar documento).

---

## 5. Brechas priorizadas (backlog consolidado)

Mapa de fases del informe: **UX-0** lenguaje/estados · **UX-1** shell/nav · **UX-2** Mesa · **UX-3** Documentación · **UX-4** Certificaciones · **UX-5** Expediente · **UX-6** Sociedades/personas · **UX-7** Config/reglas.

### P0 — riesgo legal (hacer primero, copy/superficie)

| # | Brecha | Fase | Esfuerzo |
|---|---|---|---|
| P0-1 | Disclaimer "Entorno de validación funcional — sin eficacia jurídica cualificada productiva" en el chip de evidencia de Certificaciones e Informes (el texto ya existe en `index.ts:263`, falta pintarlo) | UX-0 | Copy-only |
| P0-2 | Traducir `DEMO_OPERATIVA`/`SEALED`/`VERIFIED` con su copy de riesgo (§7.3) | UX-0 | Copy-only |
| P0-3 | Routear `InformesPreceptivos.tsx:22` y `CertificacionesAutonomas.tsx:76` por `statusLabel()` (hoy muestran `EMITTED`/`FAILED`/`ARCHIVED` crudos) | UX-0 | Copy-only |
| P0-4 | Quitar de subcopy de Revisión "archivados como evidencia operativa" (`:88-90`) | UX-0 | Copy-only |

### P1 — alto ROI / estructural

| # | Brecha | Fase | Esfuerzo |
|---|---|---|---|
| P1-1 | Añadir las 11 claves ausentes a `status-labels.ts` | UX-0 | Copy-only (1 archivo) |
| P1-2 | Wizard de certificaciones autónomas (5 pasos) sobre RPCs ya segmentados: selector de fuente, paso solo-lectura, fecha de corte, `Capa3Form` cableado, preview, confirmación reforzada, invocar `resolveCertificationAuthority` antes de emitir | UX-4 | Estructural (UI sobre piezas existentes) |
| P1-3 | Flujo por fuente canónica en Informes y anexos (selector + requisitos por materia + enviar a revisión) | UX-3 | Estructural |
| P1-4 | Bloque "Documentos pendientes" + CTA "Revisar documentos" en la Mesa | UX-2 | Estructural ligero |
| P1-5 | Jerarquía normativa: chip imperativa/dispositiva (campo nuevo en `NormativeSource` + UI) + "¿Por qué esta regla?" + aviso de snapshot desfasado | UX-7 | Datos/motor + superficie |

### P2 — superficie UI

| # | Brecha | Fase |
|---|---|---|
| P2-1 | Confirmación de 2 pasos en acciones M2 irreversibles (emitir cert / cerrar documento) | UX-4/UX-3 |
| P2-2 | Layout móvil dedicado para Expediente (M1) y Certificaciones/Revisión (M2) | UX-3/UX-5 |
| P2-3 | Empty states con patrón de 3 partes en todas las pantallas (§8.5) | UX-2/UX-3 |
| P2-4 | Botón "Marcar como sustituida" en Certificaciones (`useSupersede…` ya existe) | UX-4 |
| P2-5 | Estados de cohorte de plantilla + aviso "activa con metadatos incompletos" + filtros | UX-7 |
| P2-6 | Avisos "censo pendiente", "sin voto computable", "plantilla sin regla", "decisión legal pendiente" | UX-6/UX-7 |
| P2-7 | CTAs de fase (elevar/presentar/subsanar) + variante móvil en lista del Tramitador | UX-3 |

### P3 — copy-only

| # | Brecha | Fase |
|---|---|---|
| P3-1 | 9 renombrados de label de sidebar (en ambas taxonomías grupo/sociedad) | UX-1 |
| P3-2 | H1/subcopy de Mesa, Expediente, Informes, Revisión, Tramitador, Libros (§9) | UX-2…UX-6 |
| P3-3 | "artefacto"→"Documento"; "Hash"→"Huella de fuente"; "Pendiente RM"→"Pendiente de referencia registral" | UX-0 |
| P3-4 | Toasts de trazabilidad en Revisión; razón visible en botón "Crear" de Informes | UX-3 |
| P3-5 | Decisiones de marca pendientes de validación legal: "Reuniones"→"Sesiones", "Procesos"→"Calendario societario" | UX-1 |

---

## 6. Palancas de mayor ROI (orden sugerido para UX-0)

1. **11 claves en `status-labels.ts`** (P1-1) — un archivo, arregla estados crudos en todo el módulo.
2. **Disclaimer de evidencia en el chip** (P0-1/P0-2) — el texto ya existe en el motor; es pintar el nodo `EVIDENCE_DEMO`.
3. **Routear las 2 pantallas que bypassean el diccionario** (P0-3) — dos cambios de una línea.
4. **Renombrados de label** (P3-1) — edición de strings en `navigation.ts`.

Estos cuatro cierran casi todo el riesgo legal de copy y la mayor parte de §7.2 antes de tocar ninguna pantalla.

---

## 7. Lo que YA está mejor que el informe (no rehacer, reconocer)

- **Header** muestra forma social + jurisdicción además de sociedad y modo (§9.1 pedía menos).
- **Sidebar** tiene visibilidad declarativa por contexto (`sidebar-visibility.ts`: capabilities, tipo_social, readiness, colegiado/unipersonal) — resuelve "configuración fuera del flujo" mejor que una reordenación de labels.
- **Expediente** cubre "Qué bloquea / Qué falta / Qué puedo hacer" y badge de verificación honesto.
- **Libros** ya tiene máquina de estados de legalización + layout móvil (M2).
- **Certificaciones autónomas (backend)**: modelo de datos, hashing, autoridad fail-closed, auditoría WORM propia y gate sandbox completos y testados — el informe los pide y ya existen.
- **Jerarquía normativa (cálculo)**: las 7 capas con prioridad/plano/estado ya se computan.
- **`statusLabel()` + tarjetas móviles** son infraestructura ya construida; el trabajo es extenderla, no crearla.

---

## 8. Correcciones al informe (cosas que asume mal o ignora)

- El informe §5.2 **omite 5 ítems de sidebar ya existentes** (Actas pendientes, Comunicaciones, Libro de socios, Libros obligatorios, Multi-jurisdicción). Reescribir la sidebar desde la tabla del informe los perdería.
- "Registro y libros" como **área única** contradice la decisión deliberada del 2026-05-12 (dos secciones separadas). Requiere reabrir esa decisión, no solo implementar.
- Buena parte del §6.4, §6.7, §6.8 y §6.9 **ya está implementada**; el informe los presenta como trabajo nuevo. El plan debe re-presupuestar UX-4/UX-6/UX-7 como "completar superficie".

---

## 9. Mapa informe → código (referencia rápida)

| Sección informe | Archivos clave |
|---|---|
| §5 Navegación | `components/secretaria/shell/navigation.ts`, `lib/secretaria/sidebar-visibility.ts`, `SecretariaSidebar.tsx`, `SecretariaHeader.tsx`, `ScopeSwitcher.tsx` |
| §6.1 Mesa | `pages/secretaria/Dashboard.tsx`, `hooks/useDashboardData.ts`, `lib/secretaria/mesa-control-societaria.ts`, `components/secretaria/AgendaDraftInbox.tsx` |
| §6.2 Expediente | `pages/secretaria/ExpedienteAcuerdo.tsx`, `lib/secretaria/agreement-360.ts`, `expediente-state-machine.ts` |
| §6.3 Informes | `pages/secretaria/InformesPreceptivos.tsx`, `lib/secretaria/document-requirements/` |
| §6.4 Certificaciones | `pages/secretaria/CertificacionesAutonomas.tsx`, `lib/secretaria/standalone-certifications/`, `hooks/useStandaloneCertifications.ts`, `components/secretaria/{StandaloneCertificationActions,Capa3Form}.tsx`, `lib/secretaria/evidence-sandbox-gate.ts`, migración `20260620045834_secretaria_informes_certificaciones.sql` |
| §6.5 Revisión | `pages/secretaria/DocumentosPendientesRevision.tsx` |
| §6.6 Registro/libros | `pages/secretaria/{TramitadorLista,TramitadorStepper,LibrosObligatorios}.tsx` |
| §6.7 Sociedades/Personas | `pages/secretaria/{SociedadesList,SociedadDetalle,PersonasList,PersonaDetalle}.tsx`, `components/secretaria/RmStatusChip.tsx` |
| §6.8/§6.9/§6.10 Reglas/plantillas | `pages/secretaria/{CatalogoMaterias,CatalogoOrganos,ReglasAplicables,ActivarMarcoNormativo,RuleManagerPage,Plantillas,GestorPlantillas}.tsx`, `lib/secretaria/{normative-framework,normative-governance}.ts`, `hooks/{useRuleResolution,useRuleManager}.ts` |
| §7 Copy/estados | `lib/secretaria/status-labels.ts` |
| §6.11 Móvil | listas con `lg:hidden`: `LibrosObligatorios.tsx:397`, `PersonasList.tsx:291`, `SociedadesList.tsx:151`, `Plantillas.tsx:662` |

---

## 10. Próximos pasos sugeridos

1. **Validar este reparto P0…P3** con Legal y Producto y congelarlo como alcance de la iteración (el informe pide un acta de aprobación, §2.1).
2. **Ejecutar UX-0 (P0 + P1-1 + P3-1)** como primer PR de bajo riesgo: copy de evidencia, 11 claves, routeo del diccionario, renombrados de sidebar. Cierra el riesgo legal sin tocar pantallas.
3. **Abrir UX-4 (certificaciones)** como pieza de mayor valor estructural, reutilizando el motor ya existente (RPCs segmentados, `Capa3Form`, `resolveCertificationAuthority`, gate sandbox).
4. **Reabrir explícitamente** las dos decisiones de marca/arquitectura que el informe toca: "Registro y libros" como área única, y "Reuniones→Sesiones"/"Procesos→Calendario".

---

*Auditoría read-only. No se modificó código. Evidencia citada como `archivo:línea` sobre el árbol de trabajo `main` (HEAD `9d7480a`).*
