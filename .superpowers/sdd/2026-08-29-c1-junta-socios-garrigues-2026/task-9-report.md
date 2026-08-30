# Task 9 — informe de cierre

**Estado: COMPLETA.** El ciclo registral está en Cloud, y lo que no consta **no se inventó**.

## Cloud, con los controles de no-invención

```
filings GARR=7 · INSCRITA=3 · PREPARADA=4 · anuncios distintos=2 · inscripciones distintas=2
NADA INVENTADO en los 4 sin inscripción: con fecha=0 · con anuncio=0 · con protocolo=0 · con notario=0
LOS 3 INSCRITOS: 338618/2026→I/A 960 (2026-07-13) ×2 · 338619/2026→I/A 961 (2026-07-13)
ELEVACIÓN: filas con notario, protocolo o fecha de escritura = 0
RESIDUO ARGA filings=8      ← intacta
```

Sonda **74 pass / 0 fail**. `lint` 0, `typecheck` 0.

**`anuncios distintos = 2` con `INSCRITA = 3`** es la prueba de que el anuncio compartido está bien
modelado: tres acuerdos, dos inscripciones. Si se hubiera duplicado, saldrían 3 y 3.

## Los 3 con inscripción y los 4 sin ella

**Los 3** (puntos 1.1, 1.2 y 4): `INSCRITA`, con `borme_ref` verbatim, ordinal derivado del `registral`
por regex, y `registered_at = 2026-07-13`. Todo lo demás **NULL explícito**.

**Los 4** (`EXCLUSION`, `INTEGRACION`, `NOMBRAMIENTO_AUDITOR`, `DELEGACION_FACULTADES`): fila en
`PREPARADA` con anuncio, fecha, asiento y protocolo a NULL.

**Por qué fila y no omisión:** `ExpedienteAcuerdo.tsx:543` pinta el bloque registral con
`{registryFiling ? … : null}`. **Sin fila, esos cuatro serían indistinguibles de un acuerdo no
inscribible** — el expediente incompleto se vería completo. Con fila, la ficha los muestra «Preparada»
frente a «Inscrita» y el tramitador imprime *«Sin referencias registrales informadas»*.

**Por qué `PREPARADA`:** es el peldaño que menos afirma del CHECK v2. Aun así afirma algo, y la fila lo
acota: `procedure_snapshot` dice que describe el estado **de ese registro** —la plataforma reconstruyó
el expediente— y no un acto del mundo real.

## El anuncio del auditor: ni adoptado ni escondido

El BORME **sí** trae una reelección de Lillo (anuncio `304964/2026`, I/A 955, 19/06/2026), pero **el
vínculo con esta Junta no consta**: ese acto no lleva la nota de vínculo que sí llevan los tres del
338618, la captura del Carril B solo confirma dos anuncios, y el cargo reelegido es `Aud.C.Con.`
—cuentas consolidadas— mientras el punto 10 habla del auditor de la sociedad.

Se trata como los otros tres **y viaja en su fila como `candidato_descartado`**, con sus datos y el
motivo. Un dato que no se adopta pero tampoco se calla.

## La asimetría de las dos fuentes, declarada

Los tres actos del **338618** llevan nota explícita de vínculo con la Junta (*«acuerdo 1.1 de la Junta de
Socios de 06/05/2026»*). El acto del **338619 no lleva ninguna**: su vínculo lo afirma la spec del
Carril B, no el extracto. **Los dos se usan, etiquetados por separado**, y hay un caso de la sonda
dedicado a que esa asimetría siga siendo cierta.

## Lo que NO se escribió

**Elevación a instrumento público: cero filas con notario, protocolo o fecha de escritura.** No consta
ninguno. El art. 31.3 de los Estatutos explica la **facultad** —cualquier administrador puede elevar sin
delegación expresa— pero **no acredita el acto**.

**`qualification_outcome = 'POSITIVA'` descartado** en los 3 inscritos: una inscripción implica
calificación positiva, pero la calificación es un acto con fecha que la fuente no da. Deducirlo sería la
primera grieta.

**El depósito de cuentas del punto 7 no se crea:** `APROBACION_CUENTAS` no es inscribible en catálogo, es
otro procedimiento, y su presentación y fecha no constan. Se dice en el dry-run en vez de omitirse.

## Tercera mina del mismo patrón

**`filing_via` es NOT NULL con `DEFAULT 'NOTARIAL'`.** Omitirla **no deja NULL: afirma vía notarial** —
exactamente como `required_majority_code` con `'SIMPLE'` en Task 7. Se escribe `REGISTRO_MERCANTIL`, que
nombra el **destino** (que sí consta: RM de Madrid, hoja M-190538) y no dice nada del **camino**, que no
consta.

## Brecha de producto anotada, y no compensada

**`registered_at` no lo pinta ninguna superficie del Tramitador**: el detalle enseña `presentation_date`,
`deed_date` y `estimated_resolution`, pero no la fecha del asiento. **No se compensa metiendo el 13/07 en
una columna que sí se pinte** — sería el fallo grave de esta tarea. El dato vive en su columna semántica
correcta y la brecha queda escrita.

## Anotado

- **El ciclo gobernado v2 existe** (`fn_registry_prepare_filing` → … → `record_inscription`) y **no se
  recorre**: `fn_registry_record_inscription` exige `status='PRESENTADA'`, `qualification_outcome='POSITIVA'`
  y un artefacto de evidencia verificado. Recorrerlo obligaría a inventar fecha de presentación, asiento
  y calificación, y a tener un documento que no existe hasta Task 8. Por eso `workflow_version = 1`, con
  las tres razones escritas en la cabecera del builder.
- **`registry_filings` no tiene ningún trigger** ni índice único más allá de la PK: la idempotencia va por
  lookup y el seed **para** si encuentra más de una fila por acuerdo.
- **`registration_date`, la columna que proponía el plan, no existe.** Las reales son `registered_at`,
  `qualified_at`, `published_at` (timestamptz) y `presentation_date`, `deed_date` (date). Y `REGISTERED`,
  el status del plan, no está en ninguna escalera.
