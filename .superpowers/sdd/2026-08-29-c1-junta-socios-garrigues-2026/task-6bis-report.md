# Task 6-bis — informe de cierre

**Estado: COMPLETA. El caso canónico llega a 10 de 10 acuerdos.**

## Cloud

```
GOAL: meetings=1 · agreements=10 · censo=1 · attendees=346 · convocatorias=1
PUNTO 1.1: MODIFICACION_ESTATUTOS → GARR_MODIFICACION_ESTATUTOS | ESTATUTARIA · inscribible | ordinal=1
ETIQUETA en el expediente: INFERIDO · lectura alternativa presente
ETIQUETA en el pack:       INFERIDO · favor >= 2/3_votos_totales · art. 30.2.a) Estatutos
CONTROL gate: dispara en 4 · SIN gate = 6 · MODIFICACION_ESTATUTOS con gate = 0
RESIDUO ARGA: packs=59 · agreements=46      ← intacta
```

`20260830120000` aplicada y registrada, verificada leyendo la fila por su `name`.
Sonda: **46 pass / 0 fail**. `lint` 0, `typecheck` 0.

El ordinal del 1.1 es **1** — el hueco que Task 6 dejó a propósito. Los otros nueve conservan
2, 3, 4, 5, 7, 8, 11, 12, 13, **sin renumerar**.

## La etiqueta, en los tres sitios y contrastada

`INFERIDO` y la lectura alternativa viajan en: (1) `reglaEspecifica.subsuncionArt36` del pack, aserido
por el `DO $assert$` de la propia migración; (2) `compliance_explain` y `decision_text` del acuerdo, con
preflight del seed que **falla cerrado** si la etiqueta se degrada a FIRME o si se pierde la alternativa;
(3) `docs/legal/2026-08-30-modificacion-art-36-mayoria-aplicada.md`.

Y la sonda **contrasta (1) contra (2)**: si el pack y el expediente divergieran, se ve.

## La decisión más fina de la tarea, y no la tomé yo

El art. 39.5.b.i lleva a informe preceptivo «los acuerdos previstos en los apartados 2 y 3 del art. 30».
**Si la subsunción en el 30.2(a) fuera FIRME, este acuerdo entraría en el gate.**

El implementador decidió **no ampliarlo**, y el argumento es el correcto: **un requisito `BLOCKING` no
puede descansar en un razonamiento marcado como revisable.** El config del órgano son 4 materias FIRMES
y sigue en 4. Queda escrito en los tres sitios y vigilado por el control 5 de la migración y por el test.

Es la consecuencia incómoda de haber etiquetado bien: la etiqueta **restringe** lo que el sistema puede
exigir, en vez de ser decorativa.

## 🔴 El motivo con el que Task 6 bloqueó este punto era falso

Task 6 lo bloqueó diciendo «el art. 36 no existe en el texto entregado: la numeración salta de 35 a 37».
**El objeto del artículo estaba documentado en el repo desde el 5 de agosto**, por dos vías
independientes:

- `docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md:93` — *«Mandato administradores
  (art. 36, Insc. 960ª): 6 años reelegibles»*.
- `scripts/garrigues/borme/jya-garrigues-slp.json:46` — *«Se modifica el artículo 36 … por el cambio del
  plazo de duración de los administradores»*, anuncio 338618/2026, `I/A 960`.

El hueco 35→37 del articulado y la cita «art. 36» del cotejo **nunca se contradijeron**: la segunda sale
de la **carátula registral** del PDF, que enumera inscripciones, no del cuerpo. Nadie leyó jamás un
art. 36 en el articulado, y nadie tenía por qué: su objeto constaba en el registro público.

**El bloqueo costó una tarea entera y la información estaba a un `grep`.** La pregunta se formuló sobre
el PDF y la respuesta vivía en el BORME. Rectificado en el módulo y en `docs/legal/`; la migración de
Task 6 no se toca (forward-only).

## Decisiones del implementador que quedan anotadas

- **`required_majority_code` sigue NULL**, pero con motivo distinto al de Task 6: allí la escalera no
  sabía expresar la base del art. 30.1; **aquí sí sabe decir `REFORZADA_2_3`**. Se deja NULL porque
  escribirlo presentaría como firme una mayoría aplicada por subsunción. **Es decisión suya y es
  revisable** — así está escrita.
- **`plazoInscripcion` sí se declara** (30 d, art. 83 RRM), al revés que en Task 6: aquí las dos fuentes
  del tenant concuerdan. El 60/art. 19 RRM del homónimo de ARGA queda anotado y no aplicado.
- **`art. 287 LSC` entra en la documentación obligatoria**: esta materia sí es modificación de estatutos
  y el 287 es cita directa, no subsunción.
- **La disposición transitoria de conversión a Consejo** que enuncia el título del punto **no está
  acreditada** por ninguna fuente. El texto lo dice y no la reconstruye.
- **El control discriminante del gate se derivó** (`acuerdos.length − CON_GATE.size`) en vez de
  actualizar un 5 a mano: inventario no es invariante.
