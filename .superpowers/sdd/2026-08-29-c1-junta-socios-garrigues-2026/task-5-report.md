# Task 5 — informe de cierre

**Estado: COMPLETA EN LO APLICABLE.** La reunión y la asistencia real están en Cloud. **El censo WORM
NO se ha creado, a propósito**, y la razón está medida y gateada.

## El GOAL, medio cumplido

```
PRE   meetings GARR=0 | attendees GARR=0 | censo GARR=0
POST  meetings GARR=1 | slug=garrigues-junta-socios-06-05-2026 | status=DRAFT
POST  attendees GARR=346 | PRESENCIAL=3 | REPRESENTADO=343 | representantes_distintos=1
POST  REGRESION votos presenciales en la reunión = 150
RESIDUO ARGA meetings=27 attendees=119   ← intacta
```

**El tenant deja de tener 0 reuniones.** Y la regresión del acta se reproduce **dentro del expediente**,
no solo en el cap table: los 3 socios presenciales suman **150 votos** en `meeting_attendees.voting_rights`,
que es 0,887574 % sobre la base declarada de 16.900 — el 0,8875 % del acta.

## 🔴 El hallazgo: `fn_crear_censo_snapshot` lleva la fórmula vieja EN LÍNEA

La migración `20260829150000` corrigió `fn_refresh_parte_votante_entity`. **No llegó a esta RPC**, que no
lee la proyección: lleva su propia copia de `voting_weight = porcentaje_capital × votes_per_title`.
Medido replicando su query:

```
total_partes = 347 | capital_total_base = 97,406341926…
vw_A = 7,20460576   vw_B = 0,000009005757   ratio A/B = 800.000,00   (art. 7 dice 50)
```

**Y no es decorativo:** `fn_secretaria_build_minute_legal_manifest` suma ese `voting_weight` para el
quórum del acta autoritativa. `censo_snapshot` es **inmutable**: crearlo hoy congelaría para siempre un
peso que contradice el art. 7 — exactamente lo que `docs/legal/2026-08-29-base-computo…` §7 prohíbe.

Es la misma clase de defecto que la (2) resolvió: **una fórmula duplicada en dos sitios y corregida en
uno**. Merece un barrido de `porcentaje_capital *` sobre `pg_proc`, no solo el parche de esta RPC.

**El seed mide la proporción antes de llamar y se planta.** El gate vive en el propio seed, no en un
comentario.

## Cuatro errores de MI PLAN en un paso irreversible

El implementador los cazó antes de aplicar. Tres habrían petado en seco; **el cuarto habría entrado y no
se puede borrar**:

| Lo que decía el plan | Lo que es |
|---|---|
| `status = 'CLOSED'` | **No existe.** El CHECK es `DRAFT/CONVOCADA/EN_CURSO/CELEBRADA/CANCELADA` |
| `p_session_kind: 'JUNTA'` | Viola el CHECK: `MEETING/NO_SESSION/UNIPERSONAL` |
| `p_body_id: null` | `CENSUS_SOURCE_SCOPE_MISMATCH`: la RPC exige el `body_id` de la reunión |
| `snapshot_type: 'UNIVERSAL'` | **Afirma una junta universal que no hubo.** Esta se convocó con 15 días de antelación (art. 178 LSC: universal es *sin previa convocatoria*). Que asistiera el 100 % del censo no la hace universal. El tipo correcto es `ECONOMICO`, confirmado por tres lecturas independientes del propio código. |

## El `status`: `DRAFT`, por dos razones independientes

1. **Jurídica.** La convocatoria está en `BORRADOR` porque la plataforma no sabe emitir Juntas. Una
   reunión en `CONVOCADA` afirmaría que fue convocada en forma y **su propia fuente no lo sostiene**.
2. **Técnica.** `trg_00_meeting_open_insert_guard` obliga a que toda reunión nazca en `DRAFT`, salvo una
   excepción que exige `current_user='postgres'` y una convocatoria `EMITIDA` e inmutable. No se cumple
   ninguna condición.

## Tercer muro CDA-only, y toca a Task 8

`fn_generar_acta` delega en el manifest builder, que tiene **tres gates seguidos**: rechaza universal,
**rechaza `JUNTA`** (*«economic Junta quorum requires the dedicated capital evaluator»*) y exige
`snapshot_type='POLITICO'`. Además pide `authority_evidence` de la mesa **en el órgano de la reunión**,
que aquí no existe **por diseño**: la Presidenta lo es por ser socia y senior partner (art. 29.2) y el
Secretario fue elegido en la propia sesión. **No se fabrica una evidencia de autoridad.**

Es una brecha de modelo, no de dato: el patrón «cargo permanente inscrito» no cubre a una mesa que se
constituye en la sesión.

## El gate del censo, escrito para romperse

El test que sustituye a los dos que dependían del censo asierta **dos hechos medidos**: que no hay
`censo_snapshot` del tenant, y que la RPC **sigue** dando un ratio A/B por encima de 1.000. Lleva escrito
que el día que la RPC se corrija **este test fallará**, y entonces hay que crear el censo y sustituirlo —
**no relajarlo**. Es un recordatorio que se rompe solo, no una nota.

## Otros dos hallazgos anotados

- **`meeting_attendees.tenant_id` tiene `DEFAULT` el tenant de ARGA.** Cualquier inserción que lo omita
  mete filas de un tenant en otro y RLS luego las esconde del dueño legítimo. Es una mina.
- **`censo_snapshot` no tiene unicidad por `meeting_id`.** Si Task 8 fuera por
  `fn_secretaria_close_meeting_and_generate_minute` (que crea el suyo), habría **dos censos inmutables**
  de la misma Junta y ninguno se podría retirar.

## Gates

`bun test src/test/schema/garrigues-junta-2026-seed.test.ts` → **25 pass / 0 fail**, 214 aserciones.
`lint` 0, `typecheck` 0.
