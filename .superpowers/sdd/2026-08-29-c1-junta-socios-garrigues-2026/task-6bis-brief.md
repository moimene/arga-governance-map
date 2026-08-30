# Task 6-bis — El décimo acuerdo: `MODIFICACION_ESTATUTOS` (punto 1.1)

Cierra el hueco que Task 6 dejó declarado. El caso canónico pasa de **9 a 10 acuerdos**.

## La decisión legal, del usuario (2026-08-30)

El punto 1.1 modifica el **art. 36** de los Estatutos. Lo que se sabe y de dónde:

- **Qué regula el art. 36:** «el plazo de duración de los administradores». Fuente: BORME, anuncio
  338618/2026, `S 8, H M-190538, I/A 960`, ya en el repo en
  `scripts/garrigues/borme/jya-garrigues-slp.json:46` con `provenance: "BORME_CITADO"`.
- **El art. 36 NO figura** entre los quince que el art. 30.2(f) tasa para la mayoría de 2/3
  (1, 2, 9, 10, 11, 12, 13, 17, 18, 19, 20, 21, 26, 42, 47).
- **Decisión del usuario: mayoría de 2/3 por el art. 30.2(a)** — «el nombramiento, reelección y
  separación de los administradores» **alcanza** a modificar el artículo que regula su plazo.

**Y va etiquetada `INFERIDO`, NO `FIRME`.** Es una subsunción, no una cita directa: el 30.2(a) habla de
nombrar administradores, no de modificar el artículo de su plazo. **La lectura alternativa tiene que
ir nombrada dentro del propio registro**: que la lista del 30.2(f) es tasada y el 36 no está, de modo
que la modificación iría por la general del art. 30.1. Si el Comité Legal discrepa mañana, la etiqueta
ya lo dice y **no hay que rectificar una captura**.

## Cómo se modela la etiqueta — importa

`Fuente` es un tipo cerrado y **no tiene `INFERIDO`**: es `LEY | ESTATUTOS | PACTO_PARASOCIAL |
REGLAMENTO | OVERRIDE_INTERNO | SISTEMA`.

- `fuente: "ESTATUTOS"` es **correcto**: la mayoría sale de los Estatutos.
- **Lo `INFERIDO` no es la fuente, es la SUBSUNCIÓN.** Va en una clave propia dentro de
  `reglaEspecifica` (que es `Record<string, unknown>` y ningún engine lee), y en el
  `compliance_explain` del acuerdo. **No fuerces `INFERIDO` dentro de `fuente`.**

## Qué produces

1. **`supabase/migrations/20260830120000_c1_pack_modificacion_estatutos_junta.sql`** — pack del tenant
   Garrigues para `MODIFICACION_ESTATUTOS`. **Timestamp asignado por el orquestador; no lo cambies.**
   Patrón exacto: `supabase/migrations/20260829170000_c1_packs_materias_junta.sql`, que escribiste tú.
   - `id`: sigue la convención de esa migración (los homónimos de ARGA ya ocupan la PK global).
   - Mayoría SL: `favor >= 2/3_votos_totales`, `fuente: "ESTATUTOS"`,
     `referencia: "art. 30.2.a) Estatutos"`.
   - `reglaEspecifica.subsuncionArt36`: `{ procedencia: "INFERIDO", decididoPor: "el usuario, 2026-08-30",
     objeto: "el art. 36 regula el plazo de duración de los administradores (BORME 338618/2026, I/A 960)",
     lecturaAplicada: "…", lecturaAlternativa: "el art. 30.2.f) tasa quince artículos y el 36 no figura;
     por esa vía la modificación iría por la mayoría general del art. 30.1" }`.
   - Bloque `DO $assert$` con control discriminante, como el de la 20260829170000.
2. **`scripts/garrigues/junta-2026/orden-del-dia.ts`** — retirar el bloqueo del punto 1.1
   (`PUNTO_BLOQUEADO` / `puntosConAcuerdo`) **sin romper el contrato de Task 4**: `ORDEN_DEL_DIA` sigue
   con 14 entradas y `puntosQueMaterializan()` sigue devolviendo 10. Deja escrito **por qué** se
   desbloqueó y con qué decisión, no solo que se desbloqueó.
3. **`scripts/seed-garrigues-junta-2026.ts`** — el décimo acuerdo, con su `agenda_items` (ordinal 1,
   que es el hueco que Task 6 dejó a propósito) y `compliance_explain` llevando la subsunción y la
   lectura alternativa.
4. **`src/test/schema/garrigues-junta-2026-seed.test.ts`** — ampliar. Hoy 42 casos verdes que **no
   debes romper**; varios pinan 9 y pasan a 10.
5. **`docs/legal/2026-08-30-modificacion-art-36-mayoria-aplicada.md`** — registro canónico con la
   aritmética del razonamiento: qué dice el BORME, qué dice el 30.2(a), qué dice el 30.2(f), cuál se
   aplicó, cuál es la alternativa, quién decidió y cuándo.

## Lo que un revisor adversarial va a intentar romper

1. **Que la etiqueta `INFERIDO` se pierda por el camino** o acabe presentada como `FIRME`. Debe estar en
   el pack, en `compliance_explain` y en `docs/legal/`, y **la lectura alternativa nombrada en los tres**.
2. **Que el ordinal del punto 1.1 no sea 1**, o que renumeres los otros nueve. Task 6 dejó los ordinales
   **2, 3, 4, 5, 7, 8, 11, 12, 13** con huecos a propósito: el ordinal apunta al elemento del array de la
   convocatoria. El 1.1 es el **primer** elemento → ordinal **1**.
3. **Que algún test que pinaba 9 se actualice a 10 a mano sin mirar si el 9 significaba algo.** Mismo
   criterio que ya aplicaste al conteo de packs: **inventario no es invariante.**
4. **Que el gate `INFORME_PRECEPTIVO_ORGANO` cambie.** Debe seguir disparando en **4** y no en 5:
   `MODIFICACION_ESTATUTOS` **no** está entre las materias configuradas. Control discriminante obligatorio.
5. **Que la sonda pase en vacío.** Anon key `VITE_SUPABASE_ANON_KEY || ANON_PUBLIC || <literal>`,
   `{ auth: { persistSession: false } }`, **prohibido** `if (!cliente) return;` dentro de un `it`.
   **Mira antes cómo ha quedado el helper de sesión compartida** que C3 acaba de introducir
   (`src/test/schema/sesion-compartida.test.ts` y `src/test/helpers/`): si el patrón del repo ha
   cambiado, **súmate a él** en vez de abrir dos logins más.
6. **Que verificar el «2/3» sea leer un rótulo.** Un test que solo compruebe el texto pasaría igual si el
   seed lo escribiera y la regla no se leyera nunca. **La prueba es la arista**: que la mayoría venga del
   pack resuelto, y un caso que caiga si deja de leerse.

## Límites

- **NO escribes en Cloud.** Dry-run y `bun test` **de ficheros sueltos** sí. **NO corras la suite
  completa**: la ventana de medición la despeja el orquestador y hay otro carril midiendo.
- **NO toques** `scripts/garrigues/capital/**`, `seed-garrigues-capital.ts`, ni nada de ARGA, ni
  `src/test/helpers/**` si es superficie de C3 — si necesitas algo de ahí, dilo en el informe.
- **NO hagas commit** ni `git add`.
- Trabajas en `/private/tmp/c1-secretaria`, rama `feature/c1-secretaria-caso-canonico`, al día con `main`.
