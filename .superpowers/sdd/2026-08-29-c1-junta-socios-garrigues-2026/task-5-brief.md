# Task 5 — Reunión, asistencia real del acta y censo WORM

Pasos y aserciones: sección `## Task 5` de `docs/superpowers/plans/2026-08-29-c1-junta-socios-garrigues-2026.md`.

## Contexto que ha cambiado desde que se escribió el plan

Task 5 **estuvo bloqueada** y ya no lo está. Lo que cambió:

1. **`parte_votante_current` ya se pondera por votos** (migración `20260829150000`). El ratio clase A /
   clase B es 50, el del art. 7. Ya no hay mezcla de magnitudes en `voting_weight`.
   `denominator_weight` sigue siendo capital **a propósito**, y `capital_total_base` del snapshot lo
   agrega — el nombre del campo dice «capital» y lo que guarda es capital: es coherente, no mixto.
2. **Decisión del usuario (2026-08-29): el voto de la Junta va por el camino de CLIENTE.**
   `fn_secretaria_evaluate_meeting_vote` rechaza `JUNTA` por lista de tipos **y** exige que cada asiento
   pese exactamente 1: una Junta ponderada por capital no puede pasar por ahí. El motor TS evalúa y el
   resultado se persiste, **y la ficha tiene que decir que la evaluación no está sellada en servidor**.
   Eso es Task 7; aquí solo hay que no dejar el expediente en un estado que lo contradiga.

## Estado real de Cloud, medido

- `meetings` del tenant Garrigues: **0**. `censo_snapshot`: **0**. `convocatorias`: **1** (Task 4,
  `BORRADOR`, `fecha_1 = 2026-05-06 00:00:00+00`, 14 entradas de orden del día).
- `capital_holdings` de la matriz: 347 filas, 702 títulos, procedencia `FIRME`.
- `parte_votante_current` de la matriz: 347 filas `CAPITAL` con `body_id IS NULL`,
  Σ `voting_weight` = 100,000000 y Σ `denominator_weight` = 97,406342.
- Órgano: `garrigues-junta-socios`, `body_type='JUNTA'`. **Resuélvelo por slug, nunca por UUID.**

## Lo que un revisor adversarial va a intentar romper

1. **Que crees el `censo_snapshot` con un INSERT.** Es `AUTHORITATIVE_WRITE_RPC_REQUIRED` incluso con
   service_role, y la tabla es **INMUTABLE**: un snapshot mal creado **no se puede borrar**. Va por
   `fn_crear_censo_snapshot` y **con dry-run revisado antes**.
2. **Que la asistencia no sea la del acta.** 3 presenciales + 343 representados, **todos por la misma
   persona** (Roberto Delgado exhibió las cartas de delegación a la Presidenta). Si salen 2 representantes
   distintos, está mal.
3. **Que la mesa no sea la real.** Preside **Rosa Zarza** como socia y senior partner (art. 29.2
   Estatutos); **Roberto Delgado**, Secretario elegido por unanimidad de los asistentes.
4. **Que inventes la hora.** No consta. `scheduled_start` hereda el criterio de Task 4: mira
   `FECHA_1_ISO` en `scripts/garrigues/junta-2026/orden-del-dia.ts` y **lee su comentario entero antes de
   tocar nada** — ahí está escrito el intento con `+02:00` que rompía la fecha, para que no se repita.
   **GOTCHA:** `normalizeStart` de `meeting-scheduler.ts` mete `T10:00` por defecto si recibe una fecha
   sin `T`. Comprueba qué hace con la tuya.
5. **Que `quorum_data` mezcle magnitudes sin decirlo.** Debe llevar `base_computo`,
   `base_votos = 16900`, y los porcentajes tomados de `estructura-art7.ts`, **nunca escritos a mano**.
   Y debe dejar constancia de que la proyección normaliza sobre 16.908 y da 0,887154 %, mientras el
   criterio declarado del acta es sobre 16.900 y da 0,8875 % (ver `docs/legal/2026-08-29-base-computo…`).
6. **Que el test pase en vacío.** Anon key `VITE_SUPABASE_ANON_KEY || ANON_PUBLIC || <literal>`,
   `{ auth: { persistSession: false } }`, y **prohibido** `if (!cliente) return;` dentro de un `it`.
7. **Que la reunión quede en un estado que afirme más de lo que hay.** La convocatoria está en
   `BORRADOR` porque la plataforma no sabe emitir Juntas. La reunión no puede presentarse como
   convocada en forma si su convocatoria no lo está: **decide el `status` con ese dato delante y
   justifícalo**, no lo copies del plan sin pensarlo.

## Límites

- **NO escribes en Cloud.** Dry-run y `bun test` sí. El controller aplica.
- **NO toques** `scripts/garrigues/capital/**`, `scripts/seed-garrigues-capital.ts`, ni nada de ARGA.
- **NO crees `agreements` ni `meeting_resolutions`** — son Tasks 6 y 7.
- **NO hagas commit** ni `git add`.
- Trabajas en `/private/tmp/c1-secretaria`, rama `feature/c1-secretaria-caso-canonico`.
