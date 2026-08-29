# Task 3 — informe de cierre

**Estado: COMPLETA.** Capital de la matriz FIRME en Cloud, con la regresión del acta verificada
contra la base de datos y no solo contra el módulo.

## Verificación en Cloud (controller)

```
PRE   clases=1 [A:1v]   holdings=347  titulos=710  suma_pct=100.000000  parte_votante=347
POST  clases=2 [A: 694tit 16000EUR 25v | B: 8tit 1EUR 1v]
POST  holdings=347  titulos=702  suma_pct=100.00000000
POST  FIRME=347  INFERIDO_asignacion=346        ← la autocartera no lleva asignacion_clase: es dato del acta
POST  REGRESION presenciales_votos=150          ← 150/16.900 = 0,887574 % = el 0,8875 % del acta
POST  parte_votante=347  autocartera_peso=0
RESIDUO titulares_multi_holding=0
RESIDUO ARGA_holdings=44  ARGA_clases_con_valor=0    ← intacta
```

**710 → 702 no es un descuadre nuevo: es la corrección.** El estado de G2 daba 2 títulos a los 346
socios (692 + 18 de autocartera = 710). El art. 7 da 2 títulos a los 338 socios de cuota y 1 a los 8 de
clase B (676 + 8 + 18 = 702). La diferencia son exactamente los 8 socios que pasan de 2 a 1 título.

## Review adversarial: 2 P1 + 9 P2, y 4 mutantes que escapaban

### P1-B — el guard de texto se derrota, y con él cae la regresión del usuario

El revisor escribió el mutante que rompe la fase entera **sin usar un solo literal prohibido**: deja
`void repartirCenso(...)` de señuelo para satisfacer el `grep`, arma el censo dentro del seed con
símbolos del propio módulo, y mete a un presencial en clase B. Los 3 presenciales pasan de **150 a 101
votos** — es decir, el 0,8875 % que el usuario confirmó explícitamente deja de cumplirse — y **pasa
todo**: el test de arista en verde, el dry-run imprimiendo la tabla correcta (694 A / 8 B / 347 filas /
Σ = 100) y la sonda Cloud ciega.

Es la lección de C3 aplicada a mi propio código: *un guard de texto es una carrera armamentística que se
pierde*. Corregido con tres capas, no una:

1. **Comportamiento sobre el censo real.** `filasMatrizDesdeCenso(presenciales, representados)` exportada
   del seed, y 4 casos que asiertan sobre el censo del acta: los 3 presenciales son clase A con 2 títulos
   y suman **150 votos**; el reparto es 338 A + 8 B; los títulos por clase son los del art. 7; los votos
   repartidos reconstruyen los 17.358.
2. **El guard de texto se conserva**, pero declarado como lo que es: capa débil que solo cubre el sitio
   de llamada.
3. **Backstop en Cloud.** La sonda mide lo que HAY en la base: junta `capital_holdings` con
   `share_classes` para los 3 presenciales y exige 150. Esa no se puede engañar desde el fuente. Fallaba
   antes de aplicar con `Expected: 150 / Received: 6` (la clase vieja tenía `votes_per_title: 1`).

### P1-A — `parte_votante_current` mide capital, no votos

Elevado al orquestador y **resuelto por la opción (1)**: se declara por escrito, sin tocar la RPC.
Registro en `docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md` §7, con la aritmética y con
la medida del riesgo de la alternativa.

**El número que decidía**, medido en solo lectura sobre ARGA: ponderar por títulos en vez de por
porcentaje de capital cambiaría **11 de 44** holdings de ARGA, con un delta relativo máximo de **0,2984**
(≈ 30 puntos porcentuales en un titular), y dejaría a **9 holdings con peso cero** por tener
`numero_titulos` NULL o 0 y ningún `share_class_id`. No es un arreglo limpio: es decisión del usuario y
queda fuera de este carril.

**Consecuencia vinculante para Task 5:** no se crea ningún `censo_snapshot` de la Junta mientras esto no
esté resuelto. Documentar una mezcla de magnitudes es aceptable en una proyección recalculable; no lo es
en un registro WORM que existe para que la Junta sea auditable.

### Prueba de mutación sobre el seed

Los 8 exigidos más 2 del revisor. Escapaban 4:

| Mutante | Antes | Ahora |
|---|---|---|
| `void repartirCenso(...)` de señuelo + censo propio | escapaba a todo | **cazado** por comportamiento + backstop Cloud |
| lo anterior con un presencial en clase B → 101 votos | escapaba a todo | **cazado** por los dos |
| `effective_from` a otra fecha | escapaba a todo (nadie lo asertaba) | **cazado** en arista y en la sonda |
| se omite `share_class_id` | escapaba al gate previo | **cazado** en arista (`classCode`) |

Los otros 6 —`voting_rights` en la autocartera, `is_treasury` siempre falso, `confianza` a INFERIDO,
preflight con tolerancia 1, pérdida de `asignacion_clase`, el `fail` del refresco degradado a
`console.warn`— ya morían.

### P2 corregidos

- **`.maybeSingle()` con el error descartado** en 4 sitios. Comprobado empíricamente: con varias filas
  devuelve `data: null, error: PGRST116`, y el seed lo leía como "no existe" → rama INSERT → `23505` a
  mitad del bucle. Ahora el error aborta con mensaje que nombra la causa.
- **`console.table` etiquetaba "capital derivado (€)"** un valor que era la constante, no un derivado.
  Renombrado a "capital escriturado art. 7 (€)". En una fase cuyo asunto es la procedencia, una etiqueta
  que afirma un cálculo que no se hace es exactamente el defecto que la fase persigue.

### P2 anotados, no corregidos

- **No hay UNIQUE en `share_classes(entity_id, class_code)`** — 0 hits en migraciones. Mismo hueco que
  `policies.policy_code` en G4: duplica en silencio y el `.maybeSingle()` falla después. Timestamp
  pedido al orquestador.
- **`entity_capital_profile.numero_titulos` sigue NULL**, así que `fn_capital_holdings_no_overassign` no
  bloquea. **Ahora sí se puede armar**: con 702 títulos el total cuadra; antes del seed, con 710, el
  primer UPDATE habría reventado con `23514`.
- **Tercera implementación de "peso de voto"** en `src/lib/rules-engine/capital-voting.ts:79-106`, hoy
  código muerto (0 llamadas fuera de sus tests), que mezcla `denominator_weight` con `títulos × votos`.
  Con clases heterogéneas las tres implementaciones ya no coinciden.
- **La sonda no tiene graceful-skip por diseño**, así que a partir de ahora el gate completo depende de
  red y credenciales. Es deliberado: es el ancla positiva de que Cloud responde.
- **`supabase/functions/_types/database.ts` está desactualizado**: no tiene `nominal_value` ni
  `total_titulos`.

### Cambios de comportamiento visibles, anotados y no ocultos

- Los 3 presenciales pasan de `porcentaje_capital` 0,29583 a **0,288184** (0,8646 % de capital entre los
  tres). Su **0,8875 % es de VOTO**. El seed anterior escribía el porcentaje de voto del acta en la
  columna de capital: **confundía las dos magnitudes**. Ahora están separadas.
- La autocartera pasa de 2,59 a **2,5936581 %** de capital; su 2,59 % del acta es de derechos de voto.
- `metadata.peso` desaparece de las 347 filas. Barrido: 0 lectores en `src`, `scripts` y `e2e`.
- La service-role key de este repo se llama **`SERVICE_ROLE_SECRET`** y no estaba en la lista de nombres
  del seed: `--commit` habría muerto con "Falta la service-role key". Añadida.

## Gates — dónde se corrieron

`/private/tmp/c1-secretaria`, worktree aislado con `version garrigues` enlazado y `.env` copiado.

```
bun test  capital-art7 + garrigues-capital-firme + garrigues-capital-seed-arista + garrigues-gobierno-seed
          46 pass / 0 fail
bun run lint       exit 0
bun run typecheck  exit 0
```

El gate G2 (`garrigues-gobierno-seed.test.ts`, "347 holdings que suman ~100") sigue verde **después** de
aplicar, que es cuando discrimina de verdad.
