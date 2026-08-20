# G5 — Núcleo penal evaluado del tenant Garrigues (mapa de riesgos, hallazgos y seguimiento)

- **Fecha:** 2026-08-20
- **Fase:** G5 del programa del tenant Garrigues (`00000000-0000-0000-0000-000000000002`)
- **Precede:** G4 (sistema normativo interno + PBC/FT), merge `f306a2a`
- **Contrato heredado e innegociable:** cero cambio para ARGA (`…0001`)

---

## 1. Propósito

Sembrar el **mapa de riesgos penales evaluado 2025** del despacho como dato de primera
clase del tenant Garrigues, de forma que la evaluación que el despacho ya hizo sea
navegable en el módulo GRC sin que el producto afirme, en ningún punto, más de lo que
la fuente dice.

Es la primera vez en el programa que se siembra **dato evaluado** —no normativo—, y por
eso el eje del diseño no es el modelo de datos sino **qué se puede afirmar**.

---

## 2. Decisiones cerradas antes de escribir este documento

| # | Decisión | Quién |
|---|---|---|
| D-1 | Alcance = núcleo penal + hallazgos + seguimiento. ESG y conflictos quedan fuera | Usuario |
| D-2 | La escala es **ordinal y sin nombres**; la procedencia declara que la fuente no publica leyenda | Usuario |
| D-3 | Granularidad = **un riesgo por delito** (enfoque A), con el desglose por columna como detalle | Usuario |
| D-4 | `probability`/`impact` quedan **NULL a propósito**; no se fabrican para alimentar el mapa de calor | Usuario |
| D-5 | Los hallazgos se **derivan** de la banda alta del propio mapa; `severity` queda NULL | Usuario |

ESG queda fuera por una razón material, no de prioridad: **el Informe de Sostenibilidad
no está en la carpeta fuente ni en ninguno de los seis zips**. No hay de dónde sembrarlo.

---

## 3. Hechos verificados (no inferidos)

Todo lo de esta sección se comprobó abriendo el fichero o el DDL, no de memoria.

**Sobre las fuentes**

1. `Mapa-evaluado-areas-de-negocio-Garrigues-2025.pdf` — 3 páginas A3 (1190,52 × 841,92 pts).
2. `Mapa-evaluado-departamentos-internos-Garrigues-2025.pdf` — 2 páginas A3.
3. **Los dos mapas comparten exactamente la misma taxonomía de filas.** Verificado
   contrastando las cabeceras y las primeras 25 filas de ambos: mismos artículos, mismas
   familias, mismo orden. Difieren solo en las columnas.
4. Estructura de fila en dos niveles: familia (`257 y siguientes — Frustración de la
   ejecución`) con delitos hoja debajo (`257. Alzamiento de bienes`, `258. …`, `258 bis. …`).
5. Columnas — 9 áreas de negocio: Laboral, Fiscal, Reestructuraciones e insolvencias,
   Litigación y arbitraje, IP, Administrativo, Mercantil, G-advisory, GLS. 9 departamentos
   internos: Intangibles, Servicio Médico, Fundación Garrigues, RRHH, Asesoría jurídica,
   Servicios Generales, Tecnología, Knowledge, Financiero. **Total: 18 columnas evaluadas.**
6. **El nivel evaluado es exclusivamente color.** No hay ningún score textual en ninguna
   celda de ninguno de los dos PDF, y **no hay leyenda en ninguna página**.
7. Paleta de dato, por muestreo de píxel: gris (217,217,217), verde claro (146,208,80),
   verde intenso (0,176,80), amarillo (255,255,0), naranja (255,192,0), rojo (255,0,0).
   El verde de marca (0,154,119) **no es dato**: es la banda de cabecera.
8. `PPD-01. Manual del Sistema de Gestión de Riesgos Penales.md` **no documenta la escala**:
   ni leyenda, ni criterio de bandas, ni umbrales.

**Sobre la extracción — probada de extremo a extremo antes de escribir este documento**

Las celdas son bloques de color 100 % uniformes, así que la matriz es extraíble sin OCR:
`pdftoppm -r 100` → PPM crudo → muestreo de píxel, y `pdftotext -bbox-layout` para alinear
la etiqueta de cada fila por su banda vertical (100/72 pt→px).

- **82 delitos hoja × 9 columnas en cada mapa.** Los dos mapas se extrajeron por separado
  y **ambos dan exactamente 82 filas**: es la validación cruzada del hecho 3.
- 82 × 18 = **1476 celdas**, de las cuales **436 evaluadas** y 1040 en gris.
- Áreas de negocio: 454 gris · 223 verde claro · 40 amarillo · 13 verde intenso · 7 naranja · **1 rojo**.
- Departamentos internos: 586 gris · 105 verde claro · 43 verde intenso · 4 amarillo · 0 naranja · 0 rojo.
- **Banda alta (naranja + rojo) = 8 celdas.** No es una estimación: es el recuento.
- El único rojo del corpus es **«Delito de contrabando» (Ley de represión del contrabando)
  en el área Fiscal**.
- Cobertura de etiquetas 43/43 en la página 1, 0 filas sin etiqueta.

Dos trampas de la extracción, ya identificadas y resueltas en la prueba:

- **Umbral relativo = truncamiento silencioso.** Detectar filas con `max(cuenta)*0.6`
  hacía que la página 2 —que solo tiene 2 filas reales— se midiera contra su propio máximo.
  El criterio tiene que ser absoluto: una fila es una `y` donde **todas** las columnas de
  datos tienen color de celda en su centro.
- **La columna de etiquetas del mapa de departamentos tiene fondo gris**, y se colaba como
  una décima columna de datos. Se descarta por ancho: las celdas miden 72-96 px y la
  columna de etiquetas 537 px.

**Sobre el esquema**

9. `risks.inherent_score INTEGER GENERATED ALWAYS AS (probability * impact) STORED`
   (`20260417161453_grc_schema_002.sql:30`) — **no es escribible**.
10. `risks.probability` e `impact` son `INTEGER CHECK (… BETWEEN 1 AND 5)`, nullables.
11. `risks.code` es `TEXT NOT NULL` **sin unicidad de ningún tipo**. No hay índice único
    ni por tenant ni global.
12. `findings.code` es `TEXT NOT NULL UNIQUE` — **unicidad GLOBAL, no por tenant**
    (`20260417121410_001_core_schema.sql:164`). Los códigos de Garrigues no pueden
    colisionar con los de ARGA.
13. `findings.severity TEXT CHECK (severity IN ('Crítico','Alto','Medio','Bajo'))` —
    nullable; un CHECK no rechaza NULL.
14. `action_plans.finding_id UUID NOT NULL REFERENCES findings(id)` y la tabla **no tiene
    `tenant_id`**: se scopea únicamente a través del hallazgo. Sin hallazgos no hay planes,
    estructuralmente.
15. `fn_sync_risk_to_backbone` (`20260521140000_grc_legacy_sync_triggers.sql:79`) replica
    cada `risks` a `grc_risks` y **traduce el score a una banda con nombre**:
    `>= 15 → 'Critico'`, `>= 10 → 'Alto'`, `>= 5 → 'Medio'`, **`ELSE → 'Bajo'`**.
    Con los scores en NULL cae al `ELSE`.
16. G4 ya sembró el módulo `risk` de Garrigues en `grc_modules`, con owner
    *Comité de Prevención de Delitos* (`20260813120000`). La FK
    `grc_risks(tenant_id, module_id)` encuentra destino y el fallback del trigger no revienta.
17. Garrigues tiene **0 filas** en `risks`, `findings`, `action_plans`,
    `conflicts_of_interest` y `attestations`. ARGA tiene 167 / 5 / 8 / 1 / 27.

**Sobre la superficie**

18. `src/pages/grc/Risk360.tsx:40` — `Math.max(1, risk.probability ?? 1) * Math.max(1, risk.impact ?? 1)`.
19. `Risk360.tsx:148` — la ficha imprime literalmente `Prob. {risk.probability ?? 1} · Impacto {risk.impact ?? 1}`.
20. `Risk360.tsx:238` — `grid[5 - impact][probability - 1].push(risk)` con los mismos
    defaults, de modo que **todo riesgo sin P/I cae en la casilla inferior izquierda**.
21. `RiskEditor.tsx:85-86` — `probability: risk.probability ?? 3, impact: risk.impact ?? 3`.
    El editor **pre-rellena un 3×3 inventado** y `:117-118` lo envía en el `update`.
    `Risk360.tsx:184` enlaza cada ficha a ese editor: está a un clic.
22. **No existe `/grc/risk-360/:id`.** Las únicas rutas son `/nuevo` y `/:id/editar`
    (`App.tsx:316-318`), las dos servidas por `RiskEditor`. No hay pantalla de detalle
    de riesgo: hay que crearla.

---

## 4. Las cuatro afirmaciones falsas que el diseño tiene que evitar

Sembrar el mapa con el modelo tal cual está produciría, sin que nadie lo escribiera a
propósito, cuatro afirmaciones falsas sobre un despacho real:

| Dónde | Qué diría | Por qué es falso |
|---|---|---|
| Ficha de riesgo (hecho 19) | «Prob. 1 · Impacto 1» en **todos** los riesgos penales | La fuente no descompone en probabilidad × impacto. El `?? 1` no es un dato ausente: es un dato inventado |
| Mapa de calor (hecho 20) | Todos los riesgos penales apilados en la esquina de menor exposición | Mismo origen. Visualmente es la afirmación más fuerte de las tres |
| `grc_risks` (hecho 15) | `inherent_severity = 'Bajo'` y `residual_severity = 'Bajo'` | Invisible desde la pantalla, y por eso la más peligrosa |
| Editor de riesgo (hecho 21) | Pre-rellena «probabilidad 3, impacto 3» y al guardar **los persiste** | Las otras tres solo se muestran; esta escribe el dato inventado en la base |

Ninguna de las cuatro se corrige con cuidado al sembrar: las cuatro las produce el código
al leer NULL. Se corrigen en el código.

---

## 5. Modelo de datos

### 5.1 Columnas nuevas (todas nullable — ARGA en NULL = cero cambio)

Mismo patrón que `entities.data_provenance` (G1) y `policies.owner_body_id` /
`content_outline` (G4): la columna nueva es opcional y su ausencia deja el producto
exactamente como estaba.

```sql
ALTER TABLE risks
  ADD COLUMN IF NOT EXISTS assessed_level      smallint,   -- 1..5, ordinal, SIN nombre
  ADD COLUMN IF NOT EXISTS assessment_breakdown jsonb,     -- desglose por las 18 columnas
  ADD COLUMN IF NOT EXISTS assessment_provenance jsonb;    -- fuente, método, límites
```

`assessed_level` es `smallint` y **no** se llama `score`, `severity` ni `nivel_riesgo`:
el nombre tiene que impedir que alguien lo confunda con la escala 1-25 de `inherent_score`
o con las cuatro bandas con nombre de `grc_risks`.

**Restricción explícita:** ninguna migración de G5 escribe en `probability`, `impact` ni
`residual_score` para el tenant Garrigues. Se deja constancia con un CHECK de coherencia
o, como mínimo, con un test de contrato que falle si aparecen valores.

### 5.2 Forma de `assessment_breakdown`

Un riesgo = un delito hoja. El desglose lleva las 18 columnas, con el nivel de cada una y
la marca de las no evaluadas:

```jsonc
{
  "areas_negocio": {
    "Laboral": { "nivel": 3 },
    "Fiscal":  { "nivel": null, "motivo": "NO_EVALUADA" },   // celda gris
    "…": {}
  },
  "departamentos_internos": { "…": {} }
}
```

`nivel: null` + `motivo: "NO_EVALUADA"` y **no** `nivel: 0`: el cero es un valor de la
escala y la celda gris no lo es.

### 5.3 Forma de `assessment_provenance`

```jsonc
{
  "fuente": "Mapa de riesgos penales evaluado 2025 — áreas de negocio y departamentos internos",
  "metodo_extraccion": "muestreo de píxel sobre render pdftoppm; el nivel es color, no texto",
  "escala": {
    "tipo": "ORDINAL_SIN_NOMBRES",
    "bandas": 5,
    "orden_inferido_de": "degradado cromático",
    "leyenda_en_fuente": false,
    "advertencia": "La fuente no publica leyenda ni criterio de bandas. PPD-01 tampoco los documenta. El orden es inferido; los nombres no se atribuyen."
  },
  "firmeza": "DEMO_PILOTO"
}
```

`firmeza: "DEMO_PILOTO"` es el mismo token que G4 usa para las obligaciones cuyo criterio
está pendiente de confirmación, y se extrae del título con el helper compartido
`splitFirmeza` para que el token interno no llegue nunca a la pantalla.

---

## 6. La escala: ordinal, sin nombres, y con un tramo indeterminado

Hay cinco colores evaluados más el gris. Nombrarlos («Crítico», «Alto»…) sería inventar
una leyenda que la fuente no tiene, y el usuario ya cerró que no se hace (D-2).

Se sirven por tanto **cinco bandas ordinales**, presentadas con el color del propio mapa y
una nota de procedencia visible que dice, sin rodeos, que la fuente no publica leyenda.

**Corrección obligada por la extracción:** el orden **no es derivable por completo**. Hay
dos verdes, y ninguna evidencia del corpus resuelve cuál va antes:

- **Determinado:** amarillo < naranja < rojo, y los dos verdes por debajo del amarillo.
  Solo 5 de las 82 filas usan los dos verdes a la vez, y una sola —«282 Publicidad
  engañosa»— los usa junto al amarillo, que en esa fila queda por encima de ambos.
- **Indeterminado:** verde intenso vs verde claro. Ni la frecuencia ayuda: en áreas de
  negocio el verde claro es 17 veces más frecuente que el intenso, y en departamentos
  internos la proporción se invierte casi por completo.

Por tanto las dos bandas verdes se presentan **adyacentes en la parte baja, con su orden
relativo marcado como no publicado**, y la procedencia lo declara en vez de esconderlo
detrás de un número. Nada del diseño depende de resolverlo: los hallazgos salen de la
banda alta (§8), que está en el tramo determinado.

Consecuencia deliberada: **`findings.severity` queda NULL**. El CHECK solo admite cuatro
nombres castellanos, y mapear cinco bandas anónimas a cuatro nombres es exactamente lo
que D-2 prohíbe. Un CHECK no rechaza NULL (hecho 13), así que la fila es válida.

**Punto abierto para el Comité Legal (no se resuelve aquí):** si el despacho puede
facilitar la leyenda real del mapa, las bandas pasan de anónimas a nombradas y
`firmeza` sube de `DEMO_PILOTO` a `FIRME`. Hasta entonces no se nombra.

---

## 7. Risk 360: el mapa de calor P×I no aplica a este dato

No es una limitación del dato, es una incompatibilidad de modelo: la fuente da **un nivel
compuesto por celda** y no lo descompone. Un mapa de calor de probabilidad × impacto no
puede representar eso sin inventar los dos ejes.

**Lo que se hace:**

- Los riesgos **sin** `probability`/`impact` no entran en la rejilla 5×5 y **no** imprimen
  «Prob. X · Impacto Y». Se agrupan en una **tira por bandas ordinales** con el color del
  mapa.
- Los riesgos **con** `probability`/`impact` —los 167 de ARGA— siguen exactamente igual:
  misma rejilla, misma ficha, mismos KPI. La rama nueva se activa por la forma del dato,
  no por el tenant, de modo que ARGA no atraviesa código nuevo.
- El desglose por las 18 columnas vive en el **detalle del riesgo**, que es la pantalla
  donde un abogado lee «este delito, en estas áreas, a este nivel».

**Lo que NO se hace:** ocultar Risk 360 a Garrigues con D-5. Sería lo barato, pero
esconder el mapa penal en la demo cuyo núcleo es precisamente el mapa penal se contradice
a sí mismo.

**El trigger.** Con `inherent_score` y `residual_score` en NULL, `fn_sync_risk_to_backbone`
escribe `'Bajo'` en `grc_risks` (hecho 15). Hay que decidir en el plan entre: (a) ampliar
la función para que propague `NULL` cuando no hay score —`grc_risks.inherent_severity` es
`NOT NULL DEFAULT 'Medio'`, así que exigiría DDL—, o (b) añadir una banda `'No evaluado'`
al dominio. **Lo que no vale es dejarlo escribiendo `'Bajo'`.** Es la afirmación falsa
número 3 y no se ve desde la pantalla.

---

## 8. Hallazgos: derivados, no inventados

Un hallazgo cuyo título es «Nivel máximo evaluado: *delito* en *área*» **no es dato
fabricado**: es la evaluación del propio despacho reformulada, con `origin` apuntando al
mapa. Se derivan de la banda alta.

- `severity`: **NULL** (§6).
- `status`: `'Abierto'`, que es el default del esquema y es lo que corresponde a una
  exposición evaluada sin evidencia de cierre.
- `due_date`, `owner_id`, `closed_at`: **NULL**. La fuente no los da y no se inventan.
- `code`: prefijo propio del tenant, por la unicidad global de `findings.code` (hecho 12).

**Son 8 hallazgos**, no una estimación: es el recuento de celdas en naranja y rojo sobre
las 1476 celdas de los dos mapas (7 naranja + 1 rojo, todas en áreas de negocio; los
departamentos internos no alcanzan la banda alta). El único rojo es «Delito de contrabando»
en el área Fiscal. El gate de extracción tiene que volver a dar 8: si da otro número,
algo cambió en la fuente o en el extractor y hay que mirarlo antes de sembrar.

---

## 9. Planes de acción: no hay fuente, y se dice

PPD-01 §246 describe el mecanismo —el Comité de Práctica Profesional «planteará, en su
caso» nuevas medidas de tratamiento— pero **no publica la lista resultante**. No hay Plan
de acción que sembrar sin inventarlo.

Lo que sí está literal es el **Plan de seguimiento** (PPD-01 §350-356), con cuatro
actividades nombradas:

1. Seguimiento del desarrollo del Plan de acción
2. Seguimiento del desarrollo del Plan de formación
3. Seguimiento de la aplicación de controles ya establecidos
4. Seguimiento de los objetivos establecidos en relación con el PPD

Esas cuatro **no están** entre los 23 controles que sembró G4 (verificado uno a uno sobre
`scripts/garrigues/normativo/obligaciones-pbcft.ts`), y son actividades de supervisión
recurrentes con órgano responsable identificado —las reuniones de coordinación del PPD—,
que es exactamente la definición de un control.

**Por tanto:** las cuatro entran como **controles** `CTR-GARR-25…28`, y `action_plans`
queda **vacío** para Garrigues, con un estado vacío honesto que diga que la fuente
documenta el mecanismo y no la lista. Colgarlas de `action_plans` exigiría fabricar antes
un hallazgo del que colgarlas (hecho 14).

También es literal y aprovechable la definición de «no conformidad» de §357 —el
incumplimiento de un requisito establecido en el PPD, tratado en las reuniones de
coordinación, con valoración de acciones correctivas—, que da el copy del estado vacío
sin inventar nada.

---

## 10. Cero cambio ARGA

| Superficie | Garantía |
|---|---|
| `risks` | Las 3 columnas nuevas son nullable; las 167 filas de ARGA quedan en NULL |
| Risk 360 | La rama nueva se activa por **forma del dato** (sin P/I), no por tenant. Con P/I → código idéntico |
| KPI Crítico/Alto | Se calculan sobre score; los riesgos sin score no entran ni suman |
| `fn_sync_risk_to_backbone` | El cambio solo afecta a la rama de score NULL, que ARGA no ejerce |
| `findings` | Códigos con prefijo propio; unicidad global respetada |
| `action_plans` | Sin filas nuevas |

Prueba, no promesa: el gate de aislamiento cross-tenant se amplía de 7 a 9 tablas
(`risks`, `findings`), **comprobando antes contra Cloud que ambos tenants tienen filas
reales** para que las aserciones no pasen de forma vacua. Es el error que G4 documentó y
que hay que no repetir.

---

## 11. Gates y criterios de salida

1. `bun run db:check-target` contra `governance_OS`.
2. `bun test` sin regresión sobre la línea base de G4 (**3307 pass / 152 skip / 0 fail**).
3. `typecheck`, `lint`, `build` verdes.
4. **Contrato de extracción:** un test que falle si el extractor topa el número de filas o
   de columnas. Es el P0 nº2 de G4 —índice topado en 40 y pintado como completo— y no se
   repite: cualquier límite duro tiene que romper el gate, no degradar en silencio.
5. **Contrato anti-fabricación:** un test que falle si alguna fila de `risks` del tenant
   Garrigues tiene `probability`, `impact` o `residual_score` distintos de NULL.
6. **Contrato de arista, no de rótulo:** el detalle del riesgo tiene que *leer* el desglose
   y las bandas, con un test que falle si se deja de leer. Leer el nivel correcto en
   pantalla **no** prueba que la relación exista — es literalmente el P0 nº1 de G4.
7. **Verificación viva con control discriminante:** medir Garrigues y ARGA en la misma
   pantalla, comprobando el email del token **en la misma llamada que mide** (dos pestañas
   comparten `localStorage` y la `storageKey` de Supabase).
8. Aislamiento cross-tenant 9/9 tablas, con filas reales en ambos lados.
9. Review adversarial de rama antes del merge, **con modelo medio como suelo**. Una
   re-review en haiku devolvió en G4 un informe con cero llamadas a herramientas.

---

## 12. Riesgos y salvaguardas

| Riesgo | Salvaguarda |
|---|---|
| Inventar la leyenda al nombrar las bandas | D-2: ordinal sin nombres + procedencia que declara que no hay leyenda |
| El `?? 1` de Risk 360 afirma «Prob. 1 · Impacto 1» | §7: los riesgos sin P/I no entran en la rejilla ni imprimen ejes |
| El editor pre-rellena 3×3 y lo persiste | §7: con banda, los ejes no se ofrecen ni se envían; el CHECK de §5.1 es la red |
| El trigger escribe `'Bajo'` sin que se vea | §7: se corrige la función; gate que lo comprueba en `grc_risks` |
| El extractor topa filas y se pinta como completo | Gate 4, heredado del P0 nº2 de G4 |
| Verificar un rótulo y creer probada la relación | Gate 6, heredado del P0 nº1 de G4 |
| Colisión de `findings.code` con ARGA | Prefijo propio; unicidad global verificada (hecho 12) |
| Caché entre tenants por `queryKey` sin `enabled` | Todo hook nuevo con `enabled: !!tenantId`; el botón «Cerrar sesión» sigue sin handler y mantiene la fuga latente |
| Contaminar ARGA | §10 + gate 8 con filas reales en ambos lados |

---

## 13. Fuera de alcance

- **ESG / Informe de Sostenibilidad** — no está en la carpeta fuente ni en los seis zips.
- **Conflictos de interés** — diferido por D-1.
- **Nombrar las bandas** — requiere la leyenda real del despacho.
- **Planes de acción con contenido** — requiere el Plan de acción real, que la fuente no publica.
- **Ciberseguridad, NIS2 y certificaciones** — alcance añadido por el usuario el 2026-08-20,
  con exploración y verificación adversarial en curso. Documento propio.
- **Cablear «Cerrar sesión»** — deuda pre-existente detectada en G4, fuera de esta fase.
