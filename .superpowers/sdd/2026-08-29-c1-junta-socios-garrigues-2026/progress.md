# Ledger SDD — C1 · Junta General de Socios de Garrigues (06/05/2026)

**Plan:** `docs/superpowers/plans/2026-08-29-c1-junta-socios-garrigues-2026.md`
**Rama:** `feature/c1-secretaria-caso-canonico` desde `1888aa0`
**Worktree aislado:** `/private/tmp/c1-secretaria` (autorizado por el usuario 2026-08-29 vía orquestador)

## Entorno de medición

`node_modules`, `version garrigues` y `supabase/.temp` **enlazados** desde el árbol compartido; `.env` **copiado**.
Consecuencia: el gate `g5-mapa-penal` SÍ corre aquí (encuentra los PDF) y `VITE_SUPABASE_ANON_KEY` está presente.
**Listón aplicable a este worktree: 0 fail, ≥ 3461 pass / 152 skip** (el lado "con carpetas fuente").

## Incidentes de proceso

| Fecha | Incidente | Resolución |
|---|---|---|
| 2026-08-29 | Creé `feature/c1-junta-garrigues-2026` con `checkout -b` **en el directorio compartido**, moviendo el HEAD de los tres carriles durante ~15 min. Lo cazó C3/GRC. | Revertido antes de cualquier commit (`checkout main` + `branch -D`). Cero commits, cero Cloud. Trabajo trasladado a este worktree aislado. |

## Decisiones del usuario consumidas por este carril

1. **Antelación del CdA de EAD Trust = 5 días, confirmados** como práctica de la entidad. No se convierte en cita legal de plazo. Sube versión de pack. (`docs/legal/2026-08-29-…`)
2. **Capital de la matriz → FIRME** por el art. 7 de los Estatutos. (ídem)
3. **Alcance del caso canónico = cobertura acreditada, 10 acuerdos** (2026-08-29, en esta sesión, con coste medido de las 4 opciones).
4. **Base de cómputo del voto en la Junta = votos de clase A no autocartera (16.900)** (2026-08-29). Ver "Parada" abajo.

## Parada reportada — la regresión del 0,8875 % no cuadra sobre la base completa

Verificado antes de escribir una línea de seed:

```
votos totales      = 694×25 + 8×1        = 17.358
autocartera        = 18×25               =    450   → 450/17.358 = 2,5925 %  ✓ (acta: 2,59 %)
base completa      = 17.358 − 450        = 16.908
base solo clase A  = (694−18)×25         = 16.900
3 presenciales     = 3 × 2A × 25         =    150
  150 / 16.908 = 0,887154 %  → 0,8872 %   ✗  (acta: 0,8875 %)
  150 / 16.900 = 0,887574 %  → 0,8875 %   ✓  (y complemento 99,1124 % ≈ 99,1125 % del acta)
```

La estructura de clases **no** es el problema: capital 11.104.008 € = registral, 338+8 = 346 = censo del acta, y autocartera 2,59 %. El residuo son exactamente los 8 votos de clase B (0,047 % de la base). El 2,59 % **no discrimina** entre las dos bases.

Reportado al orquestador y elevado al usuario, que decidió la base de clase A **documentada**, sin afirmar que la clase B carezca de voto.

## Trabajo transversal

| Qué | Estado |
|---|---|
| Opción (2) — `parte_votante_current` ponderada por títulos | **APLICADA** ([informe](task-formula-report.md)). ARGA ±0,0125 pp; ratio A/B de Garrigues 800.000 → 50; WORM de ARGA intacto y enseñado; rama CARGO sin tocar |

## Tareas

| # | Tarea | Estado | Review adversarial | Gates |
|---|---|---|---|---|
| 1 | `GARR_CONSEJO_EAD` → v1.1.0 | **COMPLETA** ([informe](task-1-report.md)) | 4 P1 + 9 P2; los 4 P1 corregidos | 3468/152/0 · lint 0 · tsc 0 · build OK, en `/private/tmp/c1-secretaria` con carpetas fuente |
| 2 | Estructura art. 7 como módulo puro + regresión | **COMPLETA** ([informe](task-2-report.md)) | 12 mutantes, 2 escapaban (ambos cerrados) + 1 P1 + 5 P2 | 20 pass / 0 fail en el fichero; suite completa en el reporte de merge |
| 3 | Capital de la matriz a FIRME en Cloud | **COMPLETA** ([informe](task-3-report.md)) | 2 P1 + 9 P2; 4 mutantes escapaban, los 4 cerrados | 46 pass / 0 fail en los 4 ficheros de capital; suite completa en el reporte de merge |
| 4 | Convocatoria 21/04 → 06/05 con los 12 puntos reales | **COMPLETA** ([informe](task-4-report.md)) — en `BORRADOR`: `fn_emit_convocatoria` es CDA-only | 4 P1 (todos de superficie) + 5 de 11 mutantes escapando | 15 pass / 0 fail en su sonda · lint 0 · tsc 0 · build OK |
| 5 | Reunión, asistencia y censo WORM | **COMPLETA EN LO APLICABLE** ([informe](task-5-report.md)): 1 reunión + 346 asistentes, 150 votos presenciales. **El censo WORM no se crea**: `fn_crear_censo_snapshot` lleva la fórmula vieja en línea y la tabla es inmutable | 4 errores del plan cazados antes de aplicar, uno de ellos irreversible | 25 pass / 0 fail · lint 0 · tsc 0 |
| 6-bis | El décimo acuerdo (`MODIFICACION_ESTATUTOS`, art. 36) | **COMPLETA** ([informe](task-6bis-report.md)). 2/3 por el art. 30.2.a, etiquetado `INFERIDO` con la lectura alternativa nombrada. **10/10 acuerdos** | — | 46 pass / 0 fail · lint 0 · tsc 0 |
| 6 | Los acuerdos con resolución por materia | **COMPLETA con 9 de 10** ([informe](task-6-report.md)). El décimo (`MODIFICACION_ESTATUTOS`) bloqueado: el art. 36 no existe en los Estatutos entregados | sin ronda separada, por instrucción de cierre — declarado en el informe | 42 pass / 0 fail en su sonda · lint 0 · tsc 0 |
| 7 | Resoluciones y evaluación del motor | **COMPLETA** ([informe](task-7-report.md)). Cuarta vía: `meeting_votes` vacía, el motor evalúa umbral y alcanzabilidad. **P0 destapado: el motor nunca supo evaluar una SLP** | control discriminante ARGA antes/después + positivo SLP | 62 pass / 0 fail · lint 0 · tsc 0 |
| 8 | Acta por RPC + certificación sin VºBº | pendiente | — | — |
| 9 | Ciclo registral | **COMPLETA** ([informe](task-9-report.md)). 3 acuerdos INSCRITA en 2 anuncios reales, 4 en PREPARADA sin fecha ni anuncio ni protocolo. Cero invención | controles de no-invención medidos en Cloud | 74 pass / 0 fail · lint 0 · tsc 0 |
| 10 | Verificación viva, control ARGA y cierre | pendiente | — | — |

## Ronda de fixes tras las tres lentes adversariales de rama (2026-08-30)

Tres lentes en paralelo sobre `2bbdbb6`. **Ninguna volvió limpia.**

| Lente | Qué atacaba | Resultado |
|---|---|---|
| A | El motor y el par ARGA/SLP | 2 P0 + 3 P1. Las 12 fórmulas previas byte-idénticas (1.012.320 comparaciones **con canario**) |
| B | El seed, los gates y las aserciones | 3 P1 + 7 P2. No pudo medir la suite: otro agente escribía en el worktree durante su ejecución |
| C | Qué **afirma** el expediente en pantalla | 1 P0 + 5 P1 + 4 P2, medidos en vivo con servidor propio de esta rama |

### Cerrados en esta ronda

| # | Hallazgo | Commit |
|---|---|---|
| A-P0-1 | Abrir la rama SL para las SLP convertía un fallo cerrado en **adopción** cuando el pack era el fallback de prototipo, que no trae la mayoría de nadie: la inventa (`favor > contra`) | `6727a13` |
| A-P1 | La rama nueva de 4/5 daba por alcanzado el 80 % con `capital_total = 0` | `6727a13` |
| B-P1 | `censoPrecondicion` **muestreaba** un socio por clase: con 344 de 345 mal sembrados devolvía `ok:true`, en el gate que existe para no congelar un peso contrario al art. 7 en un registro **inmutable** | `6727a13` |
| B-P1 | El rótulo del gate preceptivo decía menos de lo que se leía (ver abajo) | `2077524` |
| B-P1 | Tres aserciones pasaban en vacío (probado por mutación) | `2077524` |

**Sobre el discriminador del A-P0-1.** La orquestación refutó mi primera propuesta —bloquear si `fuente === 'SISTEMA'`— midiendo 6 packs reales del tenant con esa etiqueta. Al desglosar, `fuente` **no vive en `votacion.mayoria.fuente` sino por rama de tipo social**: las seis ramas `SL` son `LEY` (arts. 30.2/30.3 de los Estatutos) y las `SISTEMA` son ramas SA/CONSEJO rotuladas *«rama no aplicable»*, que la SLP nunca lee. La refutación medía la cadena en el payload, no el spec seleccionado. **Pero su razón de fondo es la correcta y se siguió**: `fuente` es una etiqueta que correlaciona; el hecho es «este pack es el fallback», y el hecho ya viaja en el propio pack (`reglaEspecifica.prototype_fallback`). Ponerlo ahí —y no en el call site del stepper, que era la alternativa propuesta— hace que la guarda valga para **todo llamante del motor**.

Medición con canario (el caso E prueba que el probe corrió en ambas versiones):

```
                                       origin/main                 HEAD
A prototipo + SLP ......... BLOCKING majority_spec_missing   BLOCKING (igual)
B pack REAL 30.3.b + SLP .. BLOCKING majority_spec_missing   OK ADOPTADO   ← ganancia
C 4/5 con base 0 .......... BLOCKING                          BLOCKING     ← guarda nueva
D control SL .............. OK                                OK
E canario SA .............. BLOCKING                          OK           ← prueba de ejecución
```

**El gate preceptivo era MAYOR de lo que reportó la lente B.** Medido en Cloud: `INFORME_PRECEPTIVO_ORGANO` en **4** acuerdos (BLOCKING · PRE_CONVOCATORIA) y `INFORME_PRECEPTIVO_MATERIA` en **6** (OVERRIDE_REQUIRED · CONVOCATORIA), con **3 acuerdos llevando los dos**. La lente reportó «el décimo acuerdo sí adquirió uno»: cierto, pero eran seis. Ninguno de los dos gates se medía solo.

### Escalados, NO cerrados

| # | Hallazgo | Por qué no lo cierro |
|---|---|---|
| C-P0 | `useAgreementCompliance.ts:580-605` compara `"convocatoria"` en minúscula contra `'CONVOCATORIA'` del motor: los tres `find` fallan siempre y caen al `?? true`. La ficha corona con **✓ verde en Convocatoria, Quórum y Mayoría** sobre una Junta con 0 votos, constitución BLOCKING y convocatoria en BORRADOR | `git diff origin/main..HEAD` de ese fichero está **vacío**: es de ARGA y anterior a mí. **Aviso de secuencia: arreglarlo solo empeora la pantalla** — hoy el `?? true` tapa que la rama de 2/3 da «alcanzada» con `0 >= 0`, y esa la usa ARGA en 7 packs |
| A-P0-2 | El stepper calcula la base de la mayoría desde los asistentes, no desde el censo | Medido por la orquestación: afecta a ARGA hoy. Escalado al usuario |
| C-P1 ×4 | «Estado instrumento: Inscrita» sin escritura · la hora fabricada 2:00 en cuatro sitios · «la lectura alternativa consta en el expediente» que ninguna pantalla lee · `base_votos 16900` y `concurrencia 16908` juntos sin decir que son bases distintas | Superficie pre-existente, pero es mi expediente el que los hace visibles. Pendiente de decisión |
| A-P1 / C-P2 | `favor > 1/3_capital` y `decision_unica` el motor no las evalúa. **No es latente**: `GARR_CONSEJO_EAD` v1.1.0 —el pack que versionó mi Task 1— lleva la primera, así que un acuerdo del CdA de EAD adoptado 6 de 7 se presenta como mayoría no alcanzada | ARGA la tiene en 4 packs. Anotado por instrucción expresa |
| — | Seis packs con las mayorías estatutarias literales del art. 30 llevan `fuente: 'SISTEMA'` en sus ramas de relleno, y el explain imprime la fuente | Procedencia mal etiquetada en el registro jurídico. Anotado, no tocado |

**Gates tras la ronda:** 76 pass / 0 fail en la sonda de la Junta · 819 pass / 144 skip / 0 fail en `src/test/schema/` · 729 pass / 0 fail en motor + sonda · lint 0 · typecheck 0. Medidos en worktree propio. `origin/main` ha avanzado con trabajo de C3: **hay que rebasar antes de la medición final de cierre**.
