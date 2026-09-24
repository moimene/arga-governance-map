# Solape entre AIMS 360 y GRC Compass, según el criterio del experto RIA

*20 de septiembre de 2026 · medido, no supuesto*

**Encargo.** El usuario pidió consolidar AIMS y analizar su solape con GRC «según el experto».
El criterio, por tanto, es el del análisis `docs/superpowers/reviews/2026-09-19-vision-ria-experto-vs-aims.md`
(§2, §6.4 y §7, puntos 5 y 6), no uno propio. Lo que aquí se añade es la **medición**: qué hay
de verdad hoy en el dato y en el código, porque el experto describió la dirección y no el estado.

**Fuentes de la medición.**
- **Cloud** (`governance_OS`, 20-09-2026, solo SELECT): recuentos, columnas, claves ajenas y el
  cuerpo vivo de `fn_sync_obligation_to_backbone`.
- **Código**: barrido de solo lectura sobre el worktree `aims/cobertura-ria-2026-09-19`.
- **Derecho**: Reglamento (UE) 2024/1689 modificado por el Reglamento (UE) 2026/1744.

---

## 1. Lo que dice el experto, en una frase

> La matriz del experto es un **catálogo de obligaciones**; AIMS es un **inventario de sistemas**;
> y el registro que el RIA exige —obligación imputada a una persona jurídica, sobre un sistema, en
> un rol, con estado, responsable, plazo y evidencia— no está en ninguno de los dos.

De ahí sale su regla de reparto, que es la que gobierna este análisis (§7, puntos 5 y 6):

| Objeto | Dueño | AIMS | Por qué |
|---|---|---|---|
| Obligaciones de **organización** (art. 4, art. 17, protocolos del art. 26) | **GRC** (`obligations`, `controls`, `policies`) | **lee, no escribe** | Ya existe el contenedor, con órgano responsable, referencia legal y ámbito territorial. Se usa para PBC/FT, ciber, DORA y RGPD |
| **Riesgo** inherente → residual del sistema de IA | **GRC** (`risks`) | **lee, no escribe** | `risks` ya tiene probabilidad, impacto, inherente, residual, sociedad, responsable y obligación. Duplicarlo en AIMS sería un segundo registro de riesgos |
| **Plan de acción** | **GRC** (`action_plans`) | **lee, no escribe** | La fila del Excel del experto ES una fila de `action_plans`: responsable, fecha, estado y % |
| Obligaciones de **sistema** (clasificación, documentación técnica, EIDF, registro, logs) | **AIMS** | escribe | Cuelgan del sistema, no de la organización |

Y su diagnóstico cruzado, que es el que duele: **cada lado coloca mal un tipo de obligación**.
Nosotros las de organización —el art. 4 se mide dentro de cada evaluación de sistema, y por eso hoy
no se mide en ninguno de los 14—; él, las de sistema, que lleva con un único estado para toda la
organización.

---

## 2. El estado medido: los dos módulos no se tocan

**Dato transversal, y es el que explica todo lo demás: no existe ni un solo import cruzado** entre
`src/pages/ai-governance/*`, `src/components/ai-governance/*`, `src/lib/aims/*` y `src/lib/grc/*` o
los hooks de GRC, en ninguna de las dos direcciones. Las dos únicas piezas compartidas de verdad son
`src/hooks/useBodies.ts` (el órgano) y `src/lib/secretaria/cross-module-handoff.ts` (navegación).

No hay ninguna clave ajena entre las tablas `ai_*`/`aims_*` y `obligations`, `controls`, `risks` o
`action_plans`. La frontera no es un contrato: es **ausencia de cable**.

Recuento en Cloud, 20-09-2026:

| Tabla | ARGA | Garrigues | Nota |
|---|---|---|---|
| `obligations` | 5 | 28 | **0 del RIA en los dos tenants** |
| `controls` | 8 | 34 | |
| `policies` | 25 | 39 | Incluye PI-30 (Garrigues, publicada) y PR-024 (ARGA, borrador) |
| `risks` | 167 | 82 | 3 de ARGA hablan de IA; **ninguno enlaza a un sistema** |
| `action_plans` | 8 | 0 | Todas cuelgan de un hallazgo |
| `findings` | 5 | 8 | |
| `incidents` (GRC) | 4 | 0 | |
| `ai_systems` | 8 | 6 | |
| `ai_incidents` | 1 | 1 | |
| `grc_modules` | 13 | 5 | **Ningún tenant tiene el módulo `ai`** |

---

## 3. Solape concepto a concepto

### 3.1 Solapes REALES — dos implementaciones vivas de la misma cosa

| # | Concepto | En AIMS | En GRC | Qué manda el experto |
|---|---|---|---|---|
| 1 | **Plan de acción** | `src/lib/aims/plan-adaptacion.ts:87`, persistido como **jsonb** en `ai_risk_assessments.action_plan` | tabla `action_plans`, `src/pages/grc/modules/audit/ActionPlans.tsx` | §7.6: usar `action_plans`. **Bloqueo medido:** `action_plans.finding_id` es NOT NULL y su única FK útil es a `findings`; no hay `obligation_id` ni `system_id`. Hay que relajar el NOT NULL o fabricar un hallazgo por brecha |
| 2 | **Criterio de acreditación** | `src/lib/aims/conformidad.ts:47`: madurez `L5`/`L8` **más** evidencia o justificación | `src/lib/grc/obligation-coverage.ts:27`: agrega `controls.status` → CUBIERTA / EN REMEDIACIÓN / EN PROCESO / SIN CONTROL | El experto no lo trata: es **nuestro** problema. Dos motores responden «¿esto está cubierto?» con entradas y salidas incompatibles, y ninguno consulta al otro |
| 3 | **Incidente** | `ai_incidents` (20 columnas, `ria_severity`, `knowledge_at`) | `incidents` (28 columnas, `obligation_id`, `is_major_incident`) | Sin FK entre ellas. **Dos escalas de estado**: 3 valores en AIMS (`ABIERTO`/`EN_INVESTIGACION`/`CERRADO`) contra 5 en GRC (añade `En contención` y `Resuelto`) |
| 4 | **Relojes regulatorios DORA y RGPD** | `src/lib/aims/incident-clocks.ts:144,186` | `src/lib/grc/regulatory-clocks.ts:50,124` | **Dos cálculos independientes del mismo plazo legal.** Si divergen, dos pantallas dan dos fechas para la misma brecha |
| 5 | **Vocabulario de estado** | `src/lib/aims/vocabulario.ts` (6 dominios, normaliza sin tildes y en mayúsculas) | `src/lib/grc/status-labels.ts` (10 dominios, compara literal, capitalizado y con tilde) | No son tres mapas: son **cinco o más**, contando Secretaría, el expediente técnico y la evidencia de GRC. Un valor pegado de un lado a otro cae al chip neutro sin avisar |
| 6 | **Catálogo de traspasos** | `src/lib/aims/handoffs.ts:33` | `GRC_HANDOFF_CANDIDATES`, `src/lib/grc/dashboard-readiness.ts:170` | Dos listas declarativas del mismo hecho |

### 3.2 Solapes APARENTES — parecen lo mismo y no lo son

- **Riesgo.** AIMS **no calcula riesgo inherente ni residual en ningún fichero**: mide madurez
  L1-L8, y lo que persiste como `score` es un porcentaje de madurez. Su `risk_level`
  (Inaceptable/Alto/Limitado/Mínimo) es una **categoría regulatoria del RIA**, no una severidad, y
  no es comparable con el Alto/Medio/Bajo de GRC. El método inherente → residual vive solo en GRC
  (`src/lib/grc/assessed-band.ts`). **Aquí no hay duplicación: hay un hueco**, que es justo lo que
  el experto señala en §6.4 («el método de riesgos» como algo que él hace mejor).
- **`evidence_bundles`.** No es el backbone de GRC ni AIMS lo toca: es de Secretaría y la consola.
  El homólogo real de `aims_evidence_items` es **`evidences`** (colgada de `control_id`) — y ese
  lado está medio muerto: se lee y **no hay ni un `insert` en toda `src/`**.
- **Hallazgo.** GRC tiene la tabla `findings` con `obligation_id`; AIMS llama «findings» a un
  **jsonb** dentro de `ai_risk_assessments`. Mismo nombre, dos cosas sin relación.
- **Política.** Solo GRC. AIMS no menciona `policies` en ningún fichero, pese a que PI-30 y PR-024
  son las políticas de IA de los dos tenants.
- **Órgano responsable.** No es solape: es la **única implementación de verdad compartida**. Los dos
  leen `governing_bodies` por `src/hooks/useBodies.ts`.

---

## 4. Los seis bloqueos medidos

Lo que impide hoy ejecutar la convergencia que el experto propone, con su medición:

1. **No existe el módulo `ai` en GRC.** `grc_modules` tiene 13 ids en ARGA y 5 en Garrigues, y `ai`
   no está en ninguno. Sin él no hay dónde colgar una obligación del RIA.
2. **`fn_sync_obligation_to_backbone` no tiene rama de IA, y además tiene un defecto vivo.** Su rama
   de PBC dice `OBL-GARR-PBC-%` y los códigos reales de Garrigues son `OBL-PBC-%`: **las 21
   obligaciones PBC/FT de Garrigues están hoy clasificadas como «Riesgos penales» (`module_id =
   'risk'`) en vez de PBC/FT (`'aml'`), que existe en su tenant.** Medido fila a fila. Las 3 de ARGA
   que caen en el `ELSE` (LGPD, ORSA, SFCR) sí están ahí por falta de módulo propio, no por defecto.
3. **`risks` no tiene ninguna columna que apunte a un sistema de IA.** Tiene `entity_id`,
   `obligation_id`, `finding_id`, `module_id` y `owner_id`, y ninguna FK hacia `ai_systems`. La
   propuesta §7.6 del experto («con una referencia al `ai_system`») exige una columna nueva.
4. **`action_plans.finding_id` es NOT NULL**, así que una acción no puede colgar de una obligación,
   que es de donde cuelga la fila del experto.
5. **`grc_obligations` no es un espejo: es un superconjunto.** Lo destapó el gate nuevo al
   ponerse en rojo, no la lectura del esquema. Ocho filas de ARGA —`OBL-IIA-2024-QAIP`,
   `OBL-NIS2-021`, `OBL-DORA-017`, `OBL-LEY2-009`, `OBL-GDPR-012`, `OBL-GDPR-033`,
   `OBL-ERM-APPETITE` y `OBL-EIOPA-CLOUD`— **no tienen obligación detrás**: se sembraron
   directamente en el espejo, con el código como `id` en vez de un UUID. Nadie las sincroniza y el
   trigger no las gobierna. Quien lea `grc_obligations` como «lo que hay en `obligations`» se
   equivoca en 8 de 13 filas de ARGA.
6. **El traspaso AIMS→GRC pierde el identificador.** El enlace de incidentes viaja con
   `?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=<id>`, pero `src/pages/grc/IncidentesList.tsx`
   **solo lee `source` y `handoff`**: el id del incidente llega y se descarta. Risk360 tampoco lee
   ningún id. El traspaso es navegación con un banner, no una arista.

---

## 5. Lo que el dato de IA que ya hay en GRC dice de nosotros

ARGA tiene tres riesgos de IA dados de alta, y los tres están **huérfanos**: sin obligación, sin
responsable y **sin residual calculado**.

| Código | Título | Módulo | Inherente | Residual | Sistema |
|---|---|---|---|---|---|
| `RSK-TECH-005` | AI Act sistemas no clasificados | `tech` | 12 | **NULL** | ninguno |
| `RSK-TECH-006` | Shadow IT uso GenAI sin gobierno | `tech` | 9 | **NULL** | ninguno |
| `RSK-STRA-005` | Pricing automatizado ML modelo único | `strategic` | 9 | **NULL** | ninguno |

Tres cosas que salen de aquí:

- **El error de derecho del experto se confirma en el literal de nuestro dato.** La descripción de
  `RSK-STRA-005` dice: «Modelo ML pricing **automóvil** … regulación AI Act **alto riesgo**». El
  anexo III, punto 5 c) solo alcanza a los seguros de **vida y salud**. Es un error nuestro, en
  nuestro dato demo, no del experto.
- **El traspaso ya está documentado… en texto libre.** `RSK-TECH-005` termina su descripción con
  «Handoff AIMS». Es exactamente el síntoma del bloqueo 5: la relación existe en la cabeza de quien
  la escribió y no en el modelo.
- **`risks.module_id` es un vocabulario distinto del de `grc_modules`, y no hay FK.** De los 167
  riesgos de ARGA, **122 usan módulos que no existen en `grc_modules`** (`compliance`, `fraud`,
  `governance`, `idd`, `labor`, `penal`, `reporting`, `reputational`, `solvency2`, `strategic`,
  `tech`). Antes de meter `ai` como módulo de riesgo conviene saber que hay dos taxonomías vivas.

---

## 6. Qué converge, en qué orden, y qué hay que decidir

El orden es el del experto (§7). Lo que aquí se añade es la precondición medida de cada paso.

| Orden | Paso | Precondición medida | Quién escribe |
|---|---|---|---|
| 1 | ~~**Corregir el defecto vivo del sync**~~ · **HECHO 20-09** (`20260920120000`) | Ninguna | GRC |
| 2 | ~~**Módulo `ai` en GRC** y rama `OBL-RIA-%`~~ · **HECHO 20-09** (`20260920130000`) | Paso 1, misma función | GRC |
| 3 | ~~**Obligación de organización del art. 4**~~ · **HECHO 20-09** (`20260920140000`) | El órgano existe en los dos tenants, medido: `garrigues-comite-gobernanza-ia` y, en ARGA, `comite-tecnologia` = «Comité Asesor de Tecnología e Innovación (CATIT)», que es la decisión D-U2 ya aceptada | GRC escribe · **AIMS lee** |
| 4 | **Riesgo del sistema de IA en `risks`** | Columna nueva hacia `ai_systems` (bloqueo 3) y enlazar los tres riesgos huérfanos | GRC escribe · AIMS lee |
| 5 | **Plan de acción único** | Relajar `finding_id` NOT NULL o crear un hallazgo por brecha (bloqueo 4) | GRC escribe · AIMS lee |
| 6 | **Un solo vocabulario y un solo reloj** | Nada técnico: es una decisión de producto | Compartido |

**Lo que hay que decidir, y no decide el controlador:**

- **D-G1. El criterio de acreditación (solape real 2).** Una medida `L5` con evidencia en AIMS y un
  control `Efectivo` en GRC son dos formas de decir «cubierto». ¿Se unifican, o se declara que miden
  cosas distintas (madurez frente a efectividad) y se pintan las dos? Recomendación del controlador:
  **declarar que son dos**, porque lo son —el propio producto ya lo hizo con la doble lectura de
  riesgo—, y ponerles nombres distintos en pantalla.
- **D-G2. El plan de acción (solape real 1).** Relajar `finding_id` toca una tabla compartida y
  afecta a los 8 planes de ARGA. La alternativa —un hallazgo automático por brecha— ensucia
  `findings` con filas que nadie ha hallado. Es del Comité de IA y de GRC.
- **D-G3. Los relojes duplicados (solape real 4).** Hoy hay dos cálculos del plazo DORA y del
  plazo RGPD. Unificar es barato y evita que dos pantallas den dos fechas. Sin obstáculo conocido.
- **D-G4. `risks.module_id` frente a `grc_modules`.** Dos taxonomías vivas y 122 riesgos de ARGA
  apuntando a módulos inexistentes. Conciliarlas no es del programa RIA, pero meter `ai` sin saberlo
  sería añadir una fila a un solar.

---

## 7. Límites de este análisis

- **Solo lectura.** Cero escrituras en Cloud para producirlo.
- **No juzga el material del experto**: eso está en el análisis del 19-09. Aquí se usa su criterio
  como dado, que es lo que el usuario pidió.
- **El barrido de código** cubrió las siete superficies del encargo (plan, control, riesgo,
  incidente, evidencia, traspasos y vocabulario). No es un inventario exhaustivo de todo el repo: un
  solape en una superficie no barrida no quedaría descartado por este documento.
- **Los recuentos son de su fecha.** Garrigues se siembra de forma progresiva desde el 2026-09-07:
  sus cifras crecerán, y eso no invalida el análisis salvo donde se diga lo contrario.
