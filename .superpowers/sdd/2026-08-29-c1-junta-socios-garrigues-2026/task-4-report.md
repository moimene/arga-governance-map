# Task 4 — informe de cierre

**Estado: COMPLETA.** Convocatoria de la Junta de Socios del 06/05/2026 en Cloud, en `BORRADOR`.

## El hallazgo de producto que domina la tarea

**La plataforma no sabe emitir la convocatoria de una Junta General.** Tres muros independientes,
leídos del `pg_get_functiondef` real:

1. `fn_convocatoria_emission_rpc_guard` rechaza con `42501` toda fila que quede en `EMITIDA` sin el
   flag de sesión que solo pone `fn_emit_convocatoria`; y `trg_convocatoria_manifest_required` exige
   manifiesto canónico con hashes coincidentes.
2. **`fn_emit_convocatoria` es CDA-only** (`CONVOCATION_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_CDA`), rechaza
   a `service_role`, exige plantilla `CONVOCATORIA_CDA` v1.1.0 ACTIVA, y valida el texto contra un
   prefijo literal que dice «SESIÓN DEL CONSEJO DE ADMINISTRACIÓN». `useCreateConvocatoria` llama a esa
   RPC y a ninguna otra.
3. `fn_convocatoria_authority_representation_guard` fuerza `fecha_emision := NULL` en toda fila no
   emitida y la sobrescribe con la fecha del servidor en la emitida. **El 21/04/2026 no cabe en esa
   columna por ninguna vía.**

**Decisión, aprobada por el orquestador:** la fila va en `BORRADOR` y el 21/04/2026 vive en el texto de
la carta, fechado «Madrid, 21 de abril de 2026». **No se fuerza `set_config` para colar un `EMITIDA`**:
sortear el gate de gobernanza para que la demo quede bonita es el peor precedente posible. La sonda
asierta `estado === 'BORRADOR'` con el comentario de que el día que la plataforma sepa emitir Juntas
esa línea cae y **hay que revisar el seed, no relajar el test**.

## Dos errores de MI PLAN que la implementación corrigió

- **Son 14 entradas de orden del día, no 13.** El punto 1 tiene subpuntos 1.1 y 1.2 con materias
  distintas que producen **dos** acuerdos. Fundirlos habría dejado el caso en 9 y roto el «10» del GOAL.
- **`rule_trace` queda NULL a propósito.** Mi plan pedía copiar su forma de ARGA; la forma real es la
  traza del motor evaluando, y **aquí el motor no ha corrido**. Rellenarla sería fabricar una evaluación
  inexistente, y `meeting-scheduler.ts:164` propaga `rule_trace_present` a `quorum_data`.

## Review adversarial: 4 P1, 5 de 11 mutantes escapando

Los cuatro P1 son de **superficie**: lo que el dato afirma en pantalla, no lo que guarda.

| Sev | Hallazgo | Corrección |
|---|---|---|
| **P1** | **La hora «no acreditada» se pintaba como las 02:00.** `fecha_1 = 00:00Z` con `toLocaleString('es-ES')` en `Europe/Madrid` da «6/5/2026, 2:00:00», propagado a `hora`, `hora_junta`, `hora_sesion` y `hora_primera_convocatoria`. El módulo decía «no se inventa» y la pantalla fabricaba una hora de madrugada — **un dato preciso a partir de la ausencia de dato**. | Ver abajo: el primer intento de arreglo fue peor y se revirtió. |
| **P1** | **La carta renumeraba el orden del día.** Se pintaba por posición, así que el punto **2** del certificado salía como «3.» y todo lo posterior desplazado. Una certificación que diga «punto 2» no casaría con el documento — incoherencia que un registrador ve. | Se numera por `p.numero` en la carta y en la ficha (`item.numero ?? index + 1`, así ARGA no cambia). |
| **P1** | **`tipo` e `inscribible` omitidos** de los `agenda_items` (sí están en la forma canónica de ARGA). La UI caía al literal **«Ordinaria»**: 6 de los 10 acuerdos etiquetados como ordinarios, incluida la integración de BSVV que es **ESTRUCTURAL**; y el generador documental clasificaba como ORDINARIA **los 3 puntos sin materia**, justo la clase que el plan prohíbe inventarles. | Se escriben desde `materia_catalog` (nunca a mano) y quedan **ausentes** en los 3 sin materia. |
| **P1** | **`kind: null` no sobrevivía a sus consumidores** y **`nota` no la leía ninguna superficie**: la ficha pintaba los 4 no-decisorios como «Punto informativo · sin acuerdo ni votación», que es lo que el propio módulo dice que sería deshonesto. El requisito se cumplía en BD y se incumplía en pantalla — patrón `owner_body_id` de G4 por tercera vez. | La ficha pinta `item.nota` cuando existe. Tipo ampliado con `numero` y `nota` en los dos sitios donde se declara. |

## El arreglo de la hora: dos intentos, y el segundo era peor

1. `00:00:00+02:00` — arregla el renderizado (sale `0:00`) y **rompe la fecha**: se almacena como
   `2026-05-05 22:00:00+00`, así que cualquier consumidor que corte la cadena UTC lee **5 de mayo**.
   Lo cazó el propio test, que ya comparaba `slice(0,10)`.
2. Vuelta a `00:00:00.000Z` **y se corrige la afirmación en vez del valor**: la hora que se ve es un
   artefacto de renderizado, no un dato del expediente, y el texto de la carta lo dice. El módulo lleva
   escrita la historia de los dos intentos para que nadie repita el segundo. El test ahora exige que la
   fecha sea correcta **tanto en la cadena UTC como en hora local de Madrid**.

**Efecto colateral, y es un hallazgo:** cambiar `fecha_1` cambió la clave de idempotencia del seed
(`tenant, body_id, fecha_1`), así que la segunda ejecución **creó una fila nueva en vez de actualizar**.
Se retiró la obsoleta con un `DELETE` acotado por id + tenant + estado + la `fecha_1` equivocada. Es la
materialización del P2 del revisor: **no hay índice único sobre esa terna** y la idempotencia es un
read-then-write de cliente que solo funciona mientras la clave no cambie.

## Cloud

```
PRE   convocatorias GARR=0  | ARGA=59
POST  convocatorias GARR=1  | RESIDUO ARGA=59
POST  estado=BORRADOR  fecha_emision=NULL  fecha_1=2026-05-06 00:00:00+00
POST  agenda=14 entradas · con_tipo=10 · con_nota=4
```

`bun test src/test/schema/garrigues-junta-2026-seed.test.ts` → **15 pass / 0 fail**.

## Elevado y pendiente

- **4 de las 10 materias no tienen rule pack visible para el login Garrigues.** `rule_packs` es
  tenant-scoped: **no existen packs genéricos**. Ver la respuesta del cotejo estatutario en el reporte
  al orquestador.
- **`fn_emit_convocatoria` CDA-only** es limitación de producto, no del caso canónico.
