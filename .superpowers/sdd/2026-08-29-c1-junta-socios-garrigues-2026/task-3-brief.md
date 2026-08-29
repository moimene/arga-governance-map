# Task 3 — El capital de la matriz pasa de INFERIDO a FIRME en Cloud

Los pasos y el código del test están en `docs/superpowers/plans/2026-08-29-c1-junta-socios-garrigues-2026.md`,
sección `## Task 3`. La decisión legal, en `docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md`.
El módulo que consumes, `scripts/garrigues/capital/estructura-art7.ts`, ya existe y está testeado
(`src/test/schema/capital-art7.test.ts`, 20 casos verdes) — **no lo modifiques**.

## Estado real de Cloud hoy (medido por el controller, no supuesto)

- `share_classes` de la matriz: **1 fila** (clase A genérica, `votes_per_title: 1`, sin nominal).
  Las columnas `nominal_value` y `total_titulos` **ya existen** (migración `20260829130000`, aplicada).
- `capital_holdings` de la matriz: **347 filas**, 710 títulos, `metadata.peso: "INFERIDO"`.
  Hoy los 346 socios llevan **2 títulos cada uno** pero con **dos porcentajes distintos** ajustados a mano
  (0,29583 los 3 presenciales, 0,28141 los 343 representados) para cuadrar los agregados del acta.
  Eso confunde **capital con voto** y es justo lo que esta tarea corrige.
- ARGA: 31 `share_classes`, **ninguna** con valor en las columnas nuevas.

## Lo que cambia y lo que NO

**Cambia:** 2 clases en vez de 1; 338 holdings de 2×A + 8 de 1×B + autocartera 18×A; `porcentaje_capital`
derivado del **nominal** (`pctCapital`), no ajustado a mano; `metadata.confianza: "FIRME"`.

**NO cambia:** el bloque de holdings de **filiales** (paso 4 del seed) se queda tal cual. Y ARGA no se toca.

**Consecuencia visible que hay que anotar, no ocultar:** los 3 presenciales pasan de `porcentaje_capital`
0,29583 a **0,288184** (3 × = 0,8646 % de capital). Su **0,8875 % es de VOTO**, no de capital, y ahora
esas dos magnitudes están separadas. El gate G2 existente `garrigues-gobierno-seed.test.ts:86` exige
"347 holdings que suman ~100" con tolerancia 0,01 y **sigue verde** (la suma es 100 con margen 4,4e-13),
pero compruébalo tú, no lo des por hecho.

## Lo que un revisor adversarial va a intentar romper

1. **Que el seed tenga su propia copia de la aritmética.** Es el fallo estructural de esta tarea. Hoy el
   seed calcula porcentajes a mano con constantes locales (`AUTOCARTERA_PCT`, `PRESENCIALES_PCT_TOTAL`,
   `TOTAL_TITULOS = 695`). **Las tres se borran.** Todo número sale del módulo. Y hace falta un
   **test de arista**: que falle si el seed dejara de consumir el módulo. Probar la función sola no basta
   — el mutante que deja de llamarla escapa igual.
2. **Que el refresco de `parte_votante` siga siendo un `console.warn`.** Hoy lo es
   (`scripts/seed-garrigues-capital.ts:152`). Si el refresco no corre, la proyección queda con los pesos
   viejos y el motor calcularía la Junta sobre el reparto anterior — exactamente el fallo que esta tarea
   existe para evitar. **Tiene que ser `fail(...)`.**
3. **Que el seed escriba sin comprobar antes que cuadra.** Preflight obligatorio: si
   `Σ porcentaje_capital ≠ 100 ± 1e-6`, abortar. Un cap table descuadrado en Cloud es peor que un seed que
   no corre.
4. **Que el seed no sea idempotente.** Dos ejecuciones deben dejar exactamente 347 holdings, no 694.
   Ojo: hoy hay filas con la clase A vieja; las 8 que pasan a clase B tienen que cambiar de
   `share_class_id`, no duplicarse.
5. **Que la sonda pase de forma vacua.** Anon key con la cadena
   `process.env.VITE_SUPABASE_ANON_KEY || process.env.ANON_PUBLIC || <literal real>`; cliente con
   `{ auth: { persistSession: false } }`; **nada de `if (!cliente) return;` dentro del `it`** — vitest
   ejecuta el cuerpo, no encuentra aserciones y reporta PASS. Si no hay sesión, que **reviente**.
6. **Que la autocartera quede computando.** `voting_rights: false`, `is_treasury: true`, y en
   `parte_votante_current` peso 0 y denominador 0.
7. **Que se hayan inventado números de participación por socio.** No los hay. `metadata.asignacion_clase`
   = `"INFERIDO"` en las 346 filas de socios.

## Límites

- **NO ejecutas NADA contra Cloud.** Ni `supabase db query`, ni el seed con `--commit`. **Sí** puedes correr
  el seed en **dry-run** (sin `--commit`) para ver la tabla que imprime, y **sí** puedes correr `bun test`.
  El pase a Cloud lo hace el controller tras revisar el dry-run.
- **NO modifiques** `scripts/garrigues/capital/estructura-art7.ts` ni `src/test/schema/capital-art7.test.ts`.
  Si necesitas algo que el módulo no expone, **dilo en el informe** en vez de duplicarlo en el seed.
- **NO hagas commit** ni `git add`.
- Trabajas en `/private/tmp/c1-secretaria`, rama `feature/c1-secretaria-caso-canonico` (al día con `main`).
