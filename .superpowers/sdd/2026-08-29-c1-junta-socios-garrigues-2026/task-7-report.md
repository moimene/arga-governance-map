# Task 7 — informe de cierre

**Estado: COMPLETA.** Las 10 resoluciones y las 10 evaluaciones del motor están en Cloud.

## Cloud

```
GOAL: meetings=1 · agreements=10 · resoluciones=10 · evaluaciones=10 · meeting_votes=0
SELLO: NO_SELLADO_EN_SERVIDOR · severidades OK y WARNING
required_majority_code de las 10: NULL      ← la columna tiene DEFAULT 'SIMPLE'; omitirla habría escrito una mayoría falsa
RESIDUO ARGA: resoluciones=21 · votos=128 · evaluaciones=8      ← intacta
```

Sonda **62 pass / 0 fail**. `lint` 0, `typecheck` 0.

## 🔴 El P0 que la tarea destapó: el motor nunca supo evaluar una SLP

Desde G3, tres semanas:

- **`votacion-engine.ts` no contemplaba `SLP`** en la selección de `majoritySpec`: solo `SA/SAU/SL/SLU`.
  `majoritySpec` quedaba `undefined` → `majority_spec_missing` en **BLOCKING** para toda sociedad
  profesional. Camino vivo: `meeting-adoption-snapshot.ts:324` ← `ReunionStepper`.
- **Y ninguna de las cuatro fórmulas de la SLP era evaluable.** Las trece que `evaluateFormula`
  reconocía se miden sobre `_emitidos`, `_capital_presente`, `_capital_total_con_voto` o `_miembros`:
  **ninguna sobre votos totales**. No faltaba una entrada en una tabla — **faltaba la unidad de medida**.

G3 escribió las mayorías estatutarias reales del despacho —su entregable estrella— y el motor no tenía
con qué leerlas.

Arreglo autorizado nominalmente por el orquestador, **solo dos ficheros**, aditivo: una rama
`|| tipoSocial === 'SLP'` (mismo criterio que `effective-rule.ts:89`), tres alias hacia ramas que ya
existían, y una rama nueva para `4/5`.

## El control discriminante, y las dos veces que salió vacuo antes de salir bien

El orquestador exigió medir la salida de ARGA antes y después, no fiarse de «655 tests verdes» — que
prueban que nada rompió, no que la salida sea idéntica. Tenía razón, y el propio control falló dos veces
antes de servir:

1. **Primera versión: `Cannot find module`.** Comparé dos mensajes de error idénticos y salió
   «IDÉNTICOS». Un control que compara dos fallos siempre pasa.
2. **Segunda: `TypeError: input.materias.some is not a function`.** Me había inventado la forma del
   input. Otro par de crashes idénticos, otro «IDÉNTICOS».
3. **Tercera, leyendo `VotacionInput` y `VotosInput` de verdad:** 143 líneas de salida real, cuatro
   escenarios con veredictos distintos —tres `OK` y un `BLOCKING` legítimo—, y ahí el diff ya significa
   algo.

**Resultado del par:**

```
NEGATIVO (ARGA)     4 escenarios · 143 líneas · diff vacío — ni un carácter cambia
POSITIVO (SLP)      mismo input, admisión 80 %:
                    ANTES   severity=BLOCKING · proclamable=false · mayoriaAlcanzada=false
                    DESPUÉS severity=OK       · proclamable=true  · mayoriaAlcanzada=true
```

**El negativo solo vale porque el positivo demuestra que el parche hace algo.** Un diff vacío sin control
positivo no distingue «no cambia nada» de «no se ejecutó nada» — que es exactamente lo que me pasó dos
veces seguidas.

## La cuarta vía: `meeting_votes` queda VACÍA

El acta certifica **que los acuerdos se adoptaron** y **que concurrió el censo íntegro**. No transcribe
el escrutinio. Así que el motor no evalúa quién votó qué: evalúa **qué mayoría exigía la regla y si era
alcanzable con la concurrencia certificada**. Entrada 100 % acreditada, y respuesta no trivial porque
estas mayorías se miden sobre **votos totales**, no sobre emitidos.

Descartada la opción de escribir 4 filas (el representante + los 3 presenciales) por tres razones, y la
tercera no la había visto nadie: **`meeting_votes` no tiene columna de peso**, así que esas 4 filas
contarían 4 votos y no 16.900. No era una opción peor: era **aritméticamente falsa**.

Y la ausencia no queda muda: el motivo viaja en `explain.desglose_nominal` de las 10 evaluaciones, el
seed comprueba tras escribir que la tabla sigue a 0 y **falla si alguien la rellenó**, y la sonda lo
asierta con control discriminante.

**Prueba de que el motor corre:** el veredicto de la admisión vuelca entre concurrencia 13.520 y 13.519
—**por un voto**— mientras la de 2/3 aguanta. Decide la fórmula, no la etiqueta del acuerdo.

## La doble mayoría: NO EVALUADA, con WARNING

La exclusión exige doble mayoría (arts. 30.2.g Estatutos + 15 Ley 2/2007): mayoría de votos **y** mayoría
de socios profesionales. **No se aliasa a la rama de 2/3**, porque eso evaluaría la primera condición y
dejaría caer la segunda en silencio.

Se persiste como **NO EVALUADA / `WARNING`**, no `BLOCKING`: el motor no dice que el acuerdo falle, dice
que **no puede pronunciarse**. Es el principio de `INFERIDO` en otro eje — el sistema no afirma más
certeza de la que tiene, ni a favor ni en contra.

## Declarado pendiente, no presentado como hecho

- **La verificación viva del aviso «Evaluación no sellada en servidor» NO está hecha.** La arista está
  pinada por un test de contrato sobre el fuente —que asierta que la página compara
  `explain.sello === "NO_SELLADO_EN_SERVIDOR"` y que el componente cuelga de esa tarjeta—, pero la
  comprobación visual va con la ventana de medición.
- **Desviación de la vía gobernada:** no se usa `fn_save_meeting_resolutions`, por tres razones medidas y
  escritas en el código (borra y reinserta todo en cada ejecución; exige un `ruleset_snapshot_id` que
  aquí no existe; su `vote_summary` es el escrutinio que el acta no transcribe). **Merece la mirada del
  revisor.**

## Anotado

- **`meeting_votes.tenant_id` con DEFAULT al tenant de ARGA** — cuarta tabla con la misma mina.
- **`meeting_resolutions.required_majority_code` con DEFAULT `'SIMPLE'`**: omitir la columna **no deja
  NULL, escribe una mayoría**. En un acuerdo que exige 80 % o 2/3, eso sería una afirmación jurídica
  falsa puesta por un default que nadie decidió.
- **`rule_evaluation_results` es WORM append-only sin índice único**: una segunda ejecución apilaría
  evaluaciones irretirables. El seed compara `evaluation_hash` y **para** si difiere.
- **`fn_secretaria_evaluate_meeting_vote` no existe**; la sellada es
  `fn_secretaria_server_resolution_evaluation`, y son **tres** muros, no dos: rechaza `JUNTA`, exige peso
  1 por asiento, **y exige censo `POLITICO` WORM** cuando el de esta Junta es `ECONOMICO`. Ese tercero
  hace la Task 8 más difícil de lo planteado.
