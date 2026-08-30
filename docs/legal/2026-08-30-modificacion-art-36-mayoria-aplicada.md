# Mayoría aplicada a la modificación del art. 36 de los Estatutos (punto 1.1 de la Junta de Socios de 06/05/2026)

**Fecha:** 2026-08-30 · **Decisor:** el usuario (OF COUNSEL de Garrigues) · **Ejecuta:** carril C1 (Secretaría), Task 6-bis.
**Procedencia de la regla:** `INFERIDO` — **subsunción, no cita directa**. La lectura alternativa está nombrada en el §4 y viaja dentro del propio expediente.
**Alcance:** reconstrucción demo sin efecto jurídico. El expediente real consta en el Registro Mercantil de Madrid.

---

## 1. Por qué existe este registro

Task 6 materializó **9 de los 10** acuerdos de la Junta. El punto 1.1 —modificación del art. 36 de los Estatutos— se quedó fuera con este motivo escrito en el código:

> «El acuerdo real modificó el **artículo 36** de los Estatutos, y ese artículo **no existe en el texto entregado**: la numeración salta de 35 a 37. […] Sin artículo que cotejar no hay mayoría que citar, y afirmar una sería inventarla.»

De ese motivo, **la primera mitad era falsa y se podía comprobar sin fuente nueva** (§2). La segunda era correcta: la mayoría no salía de ninguna cita. Lo que ha cambiado el 2026-08-30 no es el dato, sino que **ahora hay una decisión** — fechada, atribuida y con su lectura alternativa al lado.

## 2. Qué regula el art. 36, y de dónde se sabe

Dos fuentes independientes, las dos ya en el repositorio antes de esta tarea:

| Fuente | Qué dice | Dónde |
|---|---|---|
| **BORME**, anuncio **338618/2026**, `S 8, H M-190538, I/A 960` (13/07/2026) | «Se modifica el artículo 36 de los estatutos sociales, **por el cambio del plazo de duración de los administradores**» | `scripts/garrigues/borme/jya-garrigues-slp.json`, `provenance: "BORME_CITADO"` |
| **Cotejo del Comité Legal sobre el texto vigente de los Estatutos (2026-08-05)** | «**Mandato administradores (art. 36, Insc. 960ª): 6 años reelegibles** ✓ (coincide con el dato G2: Vives 2026→2032)» | `docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md` |

El mismo anuncio del BORME inscribe el cese y la reelección de Fernando Vives como Administrador Único hasta el 30/06/2032 — seis años—, que es el punto 1.2 y el otro acuerdo del mismo apartado del orden del día.

**Conclusión de este apartado:** el art. 36 existe, consta en la copia registral que el usuario aportó (cabecera hasta la Insc. 960ª) y su objeto está documentado por partida doble. La afirmación de Task 6 de que «no existe en el texto entregado» queda **rectificada aquí**, no en aquella migración, que no se toca por ser forward-only.

## 3. La decisión: 2/3 por el art. 30.2.a)

**Decisión del usuario:** el art. **30.2.a)** de los Estatutos —«el nombramiento, reelección y separación de los administradores»— **alcanza** a modificar el artículo que regula su plazo. La modificación del art. 36 se adopta, por tanto, por la **mayoría reforzada de dos tercios** del art. 30.2.

En el modelo:

```
votacion.mayoria.SL = {
  fuente:      "ESTATUTOS",          ← la mayoría SALE de los Estatutos
  formula:     "favor >= 2/3_votos_totales",
  referencia:  "art. 30.2.a) Estatutos",
  baseComputo: "VOTOS_DE_LAS_PARTICIPACIONES_EN_QUE_SE_DIVIDE_EL_CAPITAL",
  procedenciaDeLaRegla: "INFERIDO"   ← lo inferido es el PASO, no la fuente
}
```

`Fuente` es un tipo cerrado (`LEY | ESTATUTOS | PACTO_PARASOCIAL | REGLAMENTO | OVERRIDE_INTERNO | SISTEMA`) y **no tiene `INFERIDO`**. Forzarlo ahí habría roto el contrato y, peor, habría mentido sobre la fuente: la mayoría es estatutaria. Lo etiquetado como `INFERIDO` es **la subsunción**, y por eso vive en clave propia (`reglaEspecifica.subsuncionArt36`), que ningún motor lee: es registro, no comportamiento.

## 4. La lectura alternativa, que sigue siendo defendible

> El art. **30.2.f)** tasa **quince artículos** cuya modificación exige los 2/3 — **1, 2, 9, 10, 11, 12, 13, 17, 18, 19, 20, 21, 26, 42 y 47** — y **el 36 no figura** entre ellos. Si la modificación de estatutos se encauza por esa letra, y la lista es tasada, la modificación del art. 36 iría por la **mayoría general del art. 30.1** (voto favorable de la mayoría de los votos correspondientes a las participaciones en que se divide el capital social).

Las dos lecturas son razonables y compiten: la aplicada mira **el objeto** del acuerdo (el régimen de los administradores, letra a); la alternativa mira **el instrumento** (una modificación estatutaria, letra f, con lista cerrada).

**Por eso la etiqueta.** Si el Comité Legal acoge mañana la lectura alternativa, basta cambiar la mayoría del rule pack: **no hay captura emitida que rectificar**, porque la ficha del acuerdo enseña las dos lecturas desde el primer día y `required_majority_code` se ha dejado en NULL (§6).

## 5. Consecuencia declarada y NO aplicada: el gate del informe preceptivo

El art. **39.5.b.i** obliga al Consejo de Socios a informar preceptivamente a la Junta sobre «los acuerdos previstos en los **apartados 2 y 3 del artículo 30**». Bajo la lectura aplicada, este acuerdo entra en el apartado 2 y, por tanto, **entraría también en ese perímetro**.

**El gate demo no se amplía.** Razones:

1. Su configuración (`governing_bodies.config.informe_preceptivo_de` del órgano `garrigues-junta-socios`) son **4 materias con `firmeza: "FIRME"`**, y el propio dictamen de 2026-08-04 dice que ese gate es «un **subconjunto correcto** del perímetro real».
2. Ampliarlo aquí convertiría una subsunción etiquetada `INFERIDO` en un **bloqueo operativo** (`blocking_policy = BLOCKING`, fase `PRE_CONVOCATORIA`). Un requisito que bloquea no puede descansar en un razonamiento marcado como revisable.

La consecuencia queda escrita en el pack, en el `compliance_explain` del acuerdo y aquí. **Ampliar el gate es decisión del Comité Legal**, y la sonda vigila que hoy siga disparando en **4** y no en 5.

## 6. Qué NO se afirma

- **`required_majority_code` queda NULL**, como en los otros nueve acuerdos, pero por un motivo distinto que se escribe aparte: la escalera `SIMPLE < REFORZADA_2_3 < UNANIMIDAD` **sí sabe decir «dos tercios»**, pero (a) no expresa la base de cómputo y (b) escribir la mayoría en una columna estructurada la presentaría como **FIRME** cuando se aplica por subsunción etiquetada.
- **La disposición transitoria de conversión a Consejo** que enuncia el título del punto 1.1 **no está acreditada** por ninguna de las dos fuentes del §2. El texto del acuerdo lo dice y no la reconstruye.
- **El plazo de inscripción se declara en 30 días (art. 83 RRM)** porque aquí no hay la discrepancia que obligó a dejarlo `NO_COTEJADO` en Task 6: `materia_catalog` dice 30 y los packs SLP hermanos del tenant dicen 30. El pack homónimo de **ARGA** dice 60 (art. 19 RRM) y **no es fuente de este tenant**: queda anotado, no aplicado.
- **`publicacionRequerida` se fija en `false`** siguiendo a `materia_catalog` (`publication_required = false`). El pack hermano `NOMBRAMIENTO_ADMINISTRADOR_UNICO` dice `true`: divergencia anotada dentro del pack, **no dirimida por ingeniería**. El anuncio del BORME 338618/2026 es publicidad registral de la inscripción, no prueba de una publicación exigida como requisito del acuerdo.
- **El art. 287 LSC sí se declara** en la documentación obligatoria (derecho de examen del texto íntegro de la modificación) y **eso no es subsunción**: es cita directa de ley, aplicable porque esta materia sí es modificación de estatutos —a diferencia de las tres materias de la migración `20260829170000`, donde deliberadamente no se puso.

## 7. Dónde queda escrito

La etiqueta `INFERIDO` **y** la lectura alternativa constan en **tres sitios**, y una sonda contrasta que no divergen:

| Sitio | Qué contiene | Fichero |
|---|---|---|
| **El dato** | `reglaEspecifica.subsuncionArt36` del pack `GARR_MODIFICACION_ESTATUTOS`, con aserción en la propia migración | `supabase/migrations/20260830120000_c1_pack_modificacion_estatutos_junta.sql` |
| **El expediente** | `SUBSUNCION_ART36` → `compliance_explain.c1_junta_socios_2026.subsuncion` del acuerdo, más la etiqueta en el `decision_text` | `scripts/garrigues/junta-2026/orden-del-dia.ts`, `scripts/seed-garrigues-junta-2026.ts` |
| **El registro legal** | este documento | `docs/legal/2026-08-30-modificacion-art-36-mayoria-aplicada.md` |
