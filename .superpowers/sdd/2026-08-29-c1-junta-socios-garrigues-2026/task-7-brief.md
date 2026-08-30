# Task 7 — Votaciones: el motor evalúa de verdad, y se dice que no está sellado en servidor

## La decisión del usuario que enmarca la tarea (2026-08-29)

`fn_secretaria_evaluate_meeting_vote` —el camino de evaluación **sellado en servidor**— **rechaza
`JUNTA`** por lista de tipos de órgano **y** exige que cada asiento pese exactamente 1. Una Junta de 346
socios ponderada por capital no puede pasar por ahí ni añadiéndola a la lista.

**Decisión: el voto va por el camino de CLIENTE.** El motor de reglas TS evalúa la mayoría con los pesos
reales y el resultado se persiste. **Y la ficha tiene que decir que la evaluación no está sellada en
servidor** — eso es parte del entregable, no una nota al pie.

## El conflicto que tienes que resolver, y es el corazón de la tarea

- **El motor tiene que correr de verdad.** Escribir un resultado sin evaluar sería exactamente el
  «rótulo sin arista» que este carril lleva dos días retirando.
- **El acta NO transcribe el desglose nominal de votos.** Consta que los acuerdos se adoptaron; **no
  consta quién votó qué**. `meeting_votes` es por asistente (`resolution_id, attendee_id, vote_value`):
  escribir 3.460 filas nominales sería **fabricar atribución de voto a 346 personas identificadas**.

**Estas dos cosas tiran en direcciones opuestas y tú tienes que decidir cómo se concilian.** Lo que NO
vale: inventar el desglose, ni fingir que el motor evaluó cuando no lo hizo.

Direcciones legítimas que se me ocurren, y puede haber una cuarta mejor:
1. No escribir `meeting_votes` y persistir solo el resultado agregado + la evaluación del motor.
2. Escribir el voto del **representante único** (Roberto Delgado tenía las 343 delegaciones) y de los 3
   presenciales — 4 filas —, que es la mecánica real de la sesión: quien emite el voto es quien lo
   ostenta. Lo no documentado sería el sentido, no el emisor.
3. Otra cosa que se te ocurra al leer el contrato de `evaluarVotacion`.

**Si ninguna concilia las dos exigencias, PARA y repórtalo.** Es criterio, no ejecución.

## Lo que necesitas leer antes de decidir

- `src/lib/rules-engine/votacion-engine.ts:42` — `evaluarVotacion`, su input y su salida.
- `src/lib/rules-engine/majority-evaluator.ts` — cómo se evalúan las fórmulas.
- Los packs ya sembrados: las mayorías reales que hay que ejercitar son **80 %** (admisión, art. 30.3.b),
  **doble mayoría** (exclusión, arts. 30.2.g + 15 Ley 2/2007), **2/3** (varias) y la **general del
  art. 30.1** en tres.
- `src/lib/secretaria/meeting-census.ts` — de dónde salen los pesos (títulos × votos/título).
- `docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md`, **incluido el §7**: la base declarada
  es 16.900 y la proyección normaliza sobre 16.908. No las mezcles.

## Lo que un revisor adversarial va a intentar romper

1. **Que el motor no haya corrido.** La prueba no es que el resultado sea correcto: es que **cambie** si
   cambia la entrada. Un test de mutación —bajar los votos a favor por debajo del 80 % y ver que la
   admisión pasa a no adoptada— es lo que lo demuestra. Sin eso, es un rótulo.
2. **Que se haya fabricado el sentido del voto de alguien.** Ninguna persona identificada puede aparecer
   votando algo que el acta no dice.
3. **Que la ficha no diga que la evaluación no está sellada en servidor**, o que lo diga en un sitio que
   nadie lee. Va donde se ve el resultado, no en un tooltip.
4. **Que se mezclen las dos bases** (16.900 declarada vs 16.908 de la proyección).
5. **Que la sonda pase en vacío.** Súmate al patrón de sesión compartida que introdujo C3
   (`sesionDe`); **no abras logins nuevos**.
6. **Que algún conteo pinado se actualice a mano.** Inventario no es invariante — ya nos ha mordido dos
   veces en este carril.

## Límites

- **NO escribes en Cloud.** Dry-run y `bun test` de **ficheros sueltos** sí. **NO la suite completa**:
  la ventana la despeja el orquestador y hay otro carril midiendo.
- **NO toques** `fn_secretaria_evaluate_meeting_vote` ni ningún gate de servidor. Si tu diseño necesita
  tocar uno, **para y repórtalo**.
- **NO toques** `scripts/garrigues/capital/**`, `seed-garrigues-capital.ts`, ni nada de ARGA.
- **NO hagas commit** ni `git add`.
- Trabajas en `/private/tmp/c1-secretaria`, rama `feature/c1-secretaria-caso-canonico`.
