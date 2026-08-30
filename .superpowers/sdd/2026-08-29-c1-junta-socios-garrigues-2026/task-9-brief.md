# Task 9 — Ciclo registral: elevación, inscripción y BORME

## Lo que está acreditado, y es poco

Del ciclo registral de esta Junta **solo hay dos anuncios confirmados**, ambos del **13/07/2026**
(spec §3.6 y `scripts/garrigues/borme/jya-garrigues-slp.json` — **léelo, es la fuente**):

- **Anuncio 338618/2026 · I/A 960** — cese + nombramiento de Vives como Adm. Único **y** modificación del
  art. 36. **Un solo anuncio que cubre DOS acuerdos** (`NOMBRAMIENTO_ADMINISTRADOR_UNICO` y
  `MODIFICACION_ESTATUTOS`). `registry_filings.agreement_id` es singular: mira cómo lo modelas.
- **Anuncio 338619/2026 · I/A 961** — alta del socio Silva Castañón (`ADMISION_SOCIO_CUOTA`).

**Hay 7 acuerdos inscribibles y solo 3 con inscripción confirmada.** Los otros cuatro —`EXCLUSION_SOCIO_ESTATUTARIA`,
`INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA`, `DELEGACION_FACULTADES`, `NOMBRAMIENTO_AUDITOR`— **no
tienen anuncio ni fecha en la fuente**.

**Comprueba el auditor antes de decidir:** la spec menciona una reelección de Lillo Auditores «inscrita
19/06/2026», que es **anterior** a la inscripción de la Junta y podría ser otro acto. Si el BORME del
repo lo aclara, úsalo; si no, trátalo como los otros tres.

## La regla dura de esta tarea

**No se inventa ni una fecha, ni un número de anuncio, ni un protocolo notarial.** Los cuatro sin
inscripción confirmada **no se dejan fuera en silencio** —eso escondería que el expediente está
incompleto— pero tampoco se les fabrica un ciclo. Decide cómo representarlos y **justifícalo**: un estado
previo a la inscripción sin fechas es una opción; otra es no crear la fila y que la ficha lo diga.

**Y ojo con la elevación a público:** no consta notario, ni protocolo, ni fecha de escritura para ninguno.
El art. 31.3 de los Estatutos dice que la elevación la puede hacer cualquier administrador **sin
necesidad de delegación expresa** — eso explica la *facultad*, no acredita *el acto*.

## Lo que un revisor adversarial va a intentar romper

1. **Que haya una fecha, un anuncio o un protocolo que no esté en la fuente.** Cualquiera. Es el fallo
   grave de esta tarea.
2. **Que los cuatro sin inscripción queden indistinguibles de los tres inscritos** en la ficha.
3. **Que el anuncio 338618 se duplique mal**: cubre dos acuerdos y comparte `inscription_number` e
   `borme_ref`. Que no parezcan dos inscripciones distintas.
4. **Que un `status` afirme más de lo acreditado.** Mira el CHECK real de `registry_filings.status` antes
   de elegir, y elige el que menos afirme.
5. **Que la sonda pase en vacío.** Súmate al patrón `sesionDe` de C3; no abras logins nuevos.
6. **Que algún conteo pinado se actualice a mano.** Inventario no es invariante.
7. **Que ARGA se mueva.** Tiene 8 `registry_filings`; control discriminante obligatorio.

## Límites

- **NO escribes en Cloud.** Dry-run y `bun test` de **ficheros sueltos** sí. **NO la suite completa.**
- **NO toques** `src/lib/rules-engine/**` (autorización agotada en Task 7), `scripts/garrigues/capital/**`,
  `seed-garrigues-capital.ts`, ni nada de ARGA.
- **NO crees `minutes` ni `certifications`** — son Task 8, que tiene diseño pendiente.
- **NO hagas commit** ni `git add`.
- Trabajas en `/private/tmp/c1-secretaria`, rama `feature/c1-secretaria-caso-canonico`.
