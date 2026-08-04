# Decisiones del Comité Legal — motor Garrigues SLP (informe preceptivo + Ley 2/2007)

**Fecha:** 2026-08-04 · **Origen:** dos dictámenes aportados por el usuario (Downloads: `Decisiones_Jurídicas_para_Garrigues_SLP*.docx`) · **Consume:** plan `docs/superpowers/plans/2026-08-03-g3-motor-slp-garrigues.md` (Tasks 3, 4, 5, 7, 8, 9).

## Jerarquía de los dos dictámenes

1. **Dictamen general** (extenso): análisis mercantil completo — 7 atribuciones de informe, firmeza a dos niveles (`FIRME`/`ESTATUTARIO_A_VERIFICAR`), tres órganos informantes, consecuencias de implantación y riesgos.
2. **Decisión para el prototipo** (corta): revisa expresamente la anterior *bajo criterio de demo* — reduce la lista a **4 materias**, colapsa la firmeza a **un único nivel `DEMO_PILOTO`** y simplifica las citas a **nivel de artículo**. **Esta versión es la operativa para G3.** El dictamen general sigue vigente como base jurídica y en todas las consecuencias que la versión demo no contradice.

## Decisión 1 — `governing_bodies.config.informe_preceptivo_de` de la Junta de Socios (Task 7)

**Contenido exacto (4 entradas; slugs verificados en Cloud el 2026-08-04):**

```json
[
  { "materia": "ADMISION_SOCIO_CUOTA",             "organo_informante": "garrigues-consejo-de-socios",   "fuente": "ESTATUTOS_ART_21_1", "firmeza": "DEMO_PILOTO" },
  { "materia": "EXCLUSION_SOCIO_ESTATUTARIA",      "organo_informante": "garrigues-consejo-de-socios",   "fuente": "ESTATUTOS_ART_21_1", "firmeza": "DEMO_PILOTO" },
  { "materia": "CONTINUIDAD_SOCIO_POST_60",        "organo_informante": "garrigues-consejo-de-socios",   "fuente": "ESTATUTOS_ART_21_1", "firmeza": "DEMO_PILOTO" },
  { "materia": "NOMBRAMIENTO_ADMINISTRADOR_UNICO", "organo_informante": "garrigues-comite-nominaciones", "fuente": "ESTATUTOS_ART_21_1", "firmeza": "DEMO_PILOTO" }
]
```

- Dos órganos informantes distintos **a propósito**: demuestra que el motor resuelve informante variable, no un único órgano cableado.
- **Slug Nominaciones RESUELTO**: `garrigues-comite-nominaciones` (sin "de"; sonda Cloud). El protocolo del dictamen (reconducir a Consejo de Socios + incidencia si no existiera) no se activa.
- **Quedan fuera del gate demo** (dictamen prototipo): retribución de prestaciones accesorias y designación de senior partner (menos valor demostrativo, más superficie de error) y el aumento sin derecho de preferencia (su informe es **legal y del administrador único** — art. 308 LSC —, no estatutario del Consejo de Socios; mezclar ambas lógicas ensucia la demo). Las materias siguen existiendo en el catálogo; solo no disparan este gate.
- **Bloqueo real** (`blocking_policy='BLOCKING'`, fase `PRE_CONVOCATORIA`): el gate es lo que se enseña. Condición ineludible: debe existir **plantilla del informe** (5ª plantilla núcleo, Task 8) — sin ella el requisito bloquea sin salida (`template_binding_key='INFORME_PRECEPTIVO_ORGANO:'||agreement_kind`).
- **Ámbito: SOLO la Junta de la matriz** (`garrigues-junta-socios`). Las filiales SLP son unipersonales o de socio único y no tienen Consejo de Socios; G-Advisory (75%, con junta) tampoco lo tiene acreditado. No sembrar `informe_preceptivo_de` fuera de la matriz.
- El Consejo de Socios **conserva su badge** "Consultivo — no adopta acuerdos": informa, no acuerda. Los consultivos no deben aparecer como órgano de adopción en ningún selector (frontera de gobierno que el gate refuerza).
- Base jurídica (del dictamen general): autonomía estatutaria anclada en art. 21.1 Estatutos (única cita literal del expediente: 21.1.e, retiro a los 60); refuerzo sistemático art. 4.2 Ley 2/2007 (la mayoría de capital y votos debe pertenecer a socios profesionales → todo cambio del círculo de socios afecta a un requisito legal de composición) y art. 8 (el cambio de socios accede al Registro). Por eso el gate es bloqueante y pre-convocatoria: el informe debe estar a disposición **con la convocatoria**, no aportarse en la sesión.

## Decisión 2 — Citas Ley 2/2007 para el overlay SLP (Task 3)

**Sustituye el etiquetado `INFERIDO` por citas firmes a nivel de artículo:**

| Parámetro del overlay | Cita | Redacción para el sistema |
|---|---|---|
| Transmisión de participación de socio profesional | **Art. 13 Ley 2/2007** | La condición de socio profesional es intransmisible salvo consentimiento de todos los socios profesionales, salvo que el contrato social lo module a mayoría de ellos |
| Separación de socio profesional | **Art. 14 Ley 2/2007** | Separación libre en sociedad de duración indefinida, eficaz desde la notificación, conforme a la buena fe |
| Exclusión de socio profesional | **Art. 15 Ley 2/2007** (+ art. 16 reembolso) | Acuerdo motivado de la Junta, por causas legales o estatutarias; **doble mayoría** de capital y de socios profesionales |
| Mayoría de socios profesionales además de capital | **Art. 4 Ley 2/2007** (y art. 15 para la exclusión) | La mayoría del capital y votos ha de pertenecer a socios profesionales (4.2); el administrador único de una SLP ha de ser socio profesional (4.3); la doble mayoría se exige **señaladamente en la exclusión** |
| Inscribibilidad del cambio de socios | **Art. 8 Ley 2/2007** | Los cambios de socios y administradores constan en escritura pública y se inscriben → sostiene `postAcuerdo.inscribible` |

**Reglas transversales:**

- **Granularidad:** artículo en la interfaz ("art. 13 Ley 2/2007"); el apartado solo en comentario interno del payload (un error de numeración no se convierte en afirmación pública).
- **Corrección de cita obligada:** la antelación de 15 días **NO puede citar la Ley 2/2007** (no regula plazos de convocatoria). Cita correcta: **LSC supletoria** (el motor ya aplica 15 días a juntas no anónimas; el pack solo confirma — el foco real es el canal). "Es la que un mercantilista detecta en la demo."
- **La doble mayoría NO es requisito general** de todo acuerdo de Junta: el art. 4 es regla de **composición** (4.2/4.3 = invariantes sondables), no de mayoría de acuerdo. Reservar la doble mayoría a la **exclusión** (art. 15) y a lo que los Estatutos extiendan.
- **Canal de convocatoria:** cita = LSC supletoria + Estatutos (art. 27.3), no Ley 2/2007. Mantener la cautela EAD: el acuse no se afirma como capacidad probada.
- **Concentración de citas:** la rama SLP de `normative-framework` ("Ley 2/2007 + LSC supletoria") es el punto único; los packs remiten en lugar de repetir literales. El `referenciaLegal` del baseline SLP queda como está redactado.
- **No crear parámetros** sobre sucesión mortis causa ni régimen del socio no profesional (laguna documentada; no rellenar con regla plausible).

## Consecuencias sobre el plan G3 (aplicadas el 2026-08-04)

| Task | Cambio |
|---|---|
| 1 | Referencia de la antelación SLP: `"art. 176 LSC (supletoria)"` — se retira "Ley 2/2007 /" |
| 3 | Overlay con citas firmes (tabla anterior) + regla de granularidad + doble mayoría solo-exclusión + sonda art. 4.3 (Vives ADMIN_UNICO ∧ en censo de socios) |
| 4 | 5 → **6 materias** (+`NOMBRAMIENTO_ADMINISTRADOR_UNICO`, ORDINARIA/inscribible, punto 1.2 real Junta 2026, BORME I/A 960). Clasificación resuelta: las 4 de socio (admisión, exclusión, continuidad, retribución) = **ESTATUTARIA** (nunca ESPECIAL — las exiliaría del selector genérico y el gate produciría un falso negativo silencioso); integración = ESTRUCTURAL |
| 5 | Cita del canal: LSC supletoria + art. 27.3 Estatutos |
| 7 | JSONB exacto de 4 entradas (arriba); solo matriz; BLOCKING; copy que nombra al informante y explica que el informe acompaña a la convocatoria; sonda que discrimina por cada una de las 4 materias + negativa; exclusión de consultivos de los selectores de adopción |
| 8 | 4 → **5 plantillas** (+informe del órgano informante a la Junta, tri-capa, demo — el informe estatutario no tiene forma tasada) |
| 9 | Verificación viva añade: el gate discrimina y se satisface con la plantilla; la **mayoría de socios profesionales se muestra** en la ficha del acuerdo de exclusión (anida en `votacion.mayoria`; el extractor legacy no la lee — no tocarlo); consultivos no ofertados como órgano de adopción; ARGA sin requisito nuevo |

## Queda para el piloto (fuera de alcance G3)

1. **Texto vigente de los Estatutos** (art. 21.1 letras e/f y art. 29): convertiría las 4 entradas `DEMO_PILOTO` en firmes. Acción de la casa, no del sistema.
2. **Desglose por apartados** de los arts. 4 y 15 Ley 2/2007 contra el texto consolidado BOE, antes de mostrar apartados en la interfaz.
3. (Resuelto ya: slug del Comité de Nominaciones.)
