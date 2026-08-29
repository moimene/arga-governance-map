# Cerrar el punto ciego del gate de tipos — `scripts/` y los tests

> **Para trabajadores agénticos:** SUB-SKILL OBLIGATORIA: `superpowers:subagent-driven-development`.
> Ledger: `.superpowers/sdd/2026-08-29-c3-grc-esg-sii-garrigues/progress.md`.

**Goal:** que `bun run typecheck` cubra **todo lo que escribimos** —`src` incluidos sus tests, y
`scripts/`— y esté verde, sin cambiar el comportamiento de nada.

**Architecture:** primero se amplía el alcance del proyecto de TypeScript y se resuelve `bun:test`
por el mismo mecanismo que ya usa vitest; eso deja 176 errores reales. De esos, **51 de los 53
`TS2739` tienen una sola causa** —tipos que crecieron y fixtures que no— y se saldan por familia, no
uno a uno. Después la cola. Al final se prueba que el gate **falla cuando debe**, con un control
negativo.

**Tech Stack:** TypeScript 5 (`tsc -b`) · bun como runner y gestor · vitest como runner alternativo
puenteado por `src/test/bun-test-shim.ts`.

**Spec:** este documento. El encargo llega del usuario a través de la orquestación tras cuatro
incidentes en una jornada cuya causa común fue código fuera del gate.

---

## Global Constraints

- **Worktree** `/private/tmp/c3-grc`, rama `feature/c3-grc-esg-sii`. **Árbol compartido quieto:**
  C1 y C2 parados de escritura mientras dure.
- **Base de no-regresión: la que fije la orquestación** tras los merges de C1 y C2. Última conocida:
  **3658 pass · 152 skip · 0 fail · 18.246 expects · 3810 tests**. Medir en **los dos modos** (con y
  sin las carpetas fuente) y **decir siempre en cuál**.
- **Ventana de medición en exclusiva.** Nadie más corre suite.
- **No se cambia comportamiento.** Un arreglo de tipos que altera semántica es peor que el hueco.
- **`git add` solo por rutas. Nunca `-A`.**
- **`package.json` NO se toca.** Los dos runners funcionan y están deliberadamente puenteados; el
  cambio del script `test` se propuso y **se retiró por premisa falsa**.
- **No se añaden dependencias.** `bun:test` se resuelve con `paths` al shim que ya existe.

---

## 🔴 Constraint de seguridad — leer antes de tocar una línea

`src/test/helpers/supabase-test-client.ts:20` lee **`SUPABASE_SERVICE_ROLE_KEY`**. Esa variable
**no existe**: el `.env` la llama **`SERVICE_ROLE_SECRET`**. Por eso `canCreate` es `false`,
`supabaseAdmin` es `null`, y **el cliente de service-role no se puede construir**.

**Ese desajuste es lo único que impide que una corrida de tests tenga acceso destructivo a
`governance_OS`.** La memoria del proyecto registra que vitest con service-role **borró perfiles de
ARGA** en una fase anterior.

> **PROHIBIDO** «corregir» esa resolución de nombres. Renombrarla arma el cliente admin y reactiva
> el camino que borró datos reales.

**Forma exacta que tendrá la tentación**, para reconocerla cuando lleve 150 errores arreglados y este
parezca uno más de la cola: un **`TS2339` / `TS18047` sobre `supabaseAdmin` siendo `null`**, con el
arreglo obvio a un renombrado de distancia. **Si aparece: parar y escalar a la orquestación.** No
resolverlo por cuenta propia ni siquiera «solo para que compile».

---

## Hechos medidos (no citados)

Medición con un tsconfig que extiende el real —mismas `compilerOptions`— e incluye `src` + `scripts`
sin exclusiones.

| | Valor |
|---|---|
| Errores con `bun:test` sin resolver | 216 |
| **Errores reales** (resuelto `bun:test`) | **176** en **45 ficheros** |
| Reparto | `src/` 141 · `scripts/` 32 · `supabase/` 3 |
| Naturaleza | 28 ficheros de test · 17 no-test |

**El planteamiento inicial estaba invertido:** se describió como «43 ficheros de `scripts/` fuera del
gate». El grueso está en **los tests de `src/`**, que es lo que excluye `tsconfig.app.json`.

**Concentración —cuatro ficheros suman 87 de 176:**

```
src/lib/rules-engine/__tests__/convocatoria-engine.test.ts      43
src/test/schema/agenda-item-kind.test.ts                        18
src/lib/rules-engine/__tests__/jerarquia-normativa.test.ts      17
src/lib/secretaria/template-admin/__tests__/…-rollback.test.ts   9
```

**Y 51 de los 53 `TS2739` tienen UNA sola causa:**

| Nº | Falta | Causa |
|---|---|---|
| 31 | `SLU, SAU, SLP` en `Record<TipoSocial, …>` | `TipoSocial` creció **dos veces** —`+SLU/SAU` en la Oleada 2 y `+SLP` en G3— y los literales exhaustivos de los tests no se actualizaron |
| 17 | `id, entity_id, materia, clave` en `RuleParamOverride` | el tipo ganó columnas; los fixtures se quedaron |
| 3 | `catch, finally, [Symbol.toStringTag]` | `mutate` declara `Promise` y recibe un `PostgrestFilterBuilder`, que es **thenable**: funciona en ejecución |

**Esto es el argumento de la tarea, no un detalle:** el punto ciego no escondía ruido de estilo.
Escondía **fixtures que dejaron de corresponderse con sus tipos en tres ampliaciones distintas**, una
de ellas la del propio SLP de G3. Con el gate puesto, se habría visto el día que se hizo.

---

## File Structure

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `tsconfig.app.json` | alcance del proyecto y resolución de `bun:test` | T1 |
| `src/lib/rules-engine/__tests__/*.test.ts` | fixtures `Record<TipoSocial,…>` y `RuleParamOverride` | T2 |
| `src/test/schema/agenda-item-kind.test.ts` | 18 errores, causa por determinar | T3 |
| `…/template-admin/__tests__/…-rollback.test.ts` | 9 errores, causa por determinar | T3 |
| `scripts/**` | 32 errores, incluida la firma de `mutate` | T4 |
| resto | cola de 41 | T5 |
| `src/test/typecheck-cobertura.test.ts` | **nuevo** — el gate cubre lo que dice cubrir | T6 |

---

## Task 1: Ampliar el alcance y resolver `bun:test`

**Criterio de aceptación:** `bun run typecheck` compila `src` **con sus tests** y `scripts/`, y los
40 `TS2307` de `bun:test` son **0**, sin dependencias nuevas.

**Files:** Modify `tsconfig.app.json`

- [ ] **Step 1: Medir el punto de partida y dejarlo escrito**

```bash
cd /private/tmp/c3-grc && bun run typecheck 2>&1 | grep -c "error TS"   # esperado: 0 (el hueco)
```
El cero de partida **es el defecto**: el gate no ve nada de lo que vamos a arreglar.

- [ ] **Step 2: Ampliar `include` y retirar las exclusiones**

En `tsconfig.app.json`:

```jsonc
"paths": {
  "@/*": ["./src/*"],
  // vitest.config.ts:22 aliasa `bun:test` a este mismo fichero. TypeScript
  // necesita el MISMO mapeo, no un paquete de tipos: así los tipos SON las
  // exportaciones del shim y no pueden divergir de él.
  "bun:test": ["./src/test/bun-test-shim.ts"]
},
"include": ["src", "scripts"],
"exclude": []
```

- [ ] **Step 3: Medir y confirmar la cifra**

```bash
bunx tsc -b --pretty false 2>&1 | grep -c "error TS"     # esperado: 176
bunx tsc -b --pretty false 2>&1 | grep -c "bun:test"     # esperado: 0
```
Si no da 176, **parar**: la configuración no es la que se midió.

- [ ] **Step 4: Commit** (el gate queda ROJO a propósito hasta T5; se dice en el mensaje)

---

## Task 2: Las tres familias de `TS2739` (51 errores)

**Criterio de aceptación:** los 51 caen, **ningún fixture cambia de significado**, y `bun test` sigue
dando el mismo número de tests que antes.

- [ ] **Step 1:** `Record<TipoSocial, …>` (31). Añadir `SLU`, `SAU` y `SLP` a cada literal
      exhaustivo. **Regla de contenido:** el valor de las claves nuevas se copia del que la propia
      prueba usa para su forma societaria equivalente —`SLU` de `SL`, `SAU` de `SA`— y **`SLP` se
      trae de los rule packs reales de G3**, no se inventa. Si para algún caso no hay valor
      defendible, **el fixture se marca y se pregunta a C1**, que es quien construyó SLP.
- [ ] **Step 2:** Ejecutar los tests de `rules-engine` y comprobar que **el resultado de cada
      aserción no cambia**. Un fixture ampliado que altere un veredicto es un cambio de semántica
      disfrazado de arreglo de tipos: si pasa, revertir y preguntar.
- [ ] **Step 3:** `RuleParamOverride` (17). Faltan `id`, `entity_id`, `materia`, `clave`. Añadirlos
      con valores de prueba explícitos. **Comprobar antes si el motor los LEE**: si alguno participa
      en la resolución, el valor no es libre.
- [ ] **Step 4:** Correr `bun test src/lib/rules-engine/` y comparar el recuento con la base.
- [ ] **Step 5:** Commit.

---

## Task 3: Los dos ficheros gordos restantes (27 errores)

- [ ] **Step 1:** `agenda-item-kind.test.ts` (18) — diagnosticar la familia antes de tocar.
- [ ] **Step 2:** `template-admin-service-rollback.test.ts` (9) — ídem.
- [ ] **Step 3:** Si la causa es un tipo mal declarado en origen, **arreglar el tipo**, no el fixture:
      arregla decenas de golpe y es el defecto de verdad.
- [ ] **Step 4:** Tests del dominio verdes con el mismo recuento. Commit.

---

## Task 4: `scripts/` (32 errores)

- [ ] **Step 1:** `mutate` en `secretaria-consolidate-arga-golden-path.ts:170`. **NO es un `await`
      olvidado** —verificado: `PostgrestFilterBuilder` es *thenable* y `await fn()` funciona—. El
      tipo del parámetro es demasiado estrecho: `Promise<…>` → **`PromiseLike<…>`**. Una línea, tres
      errores, cero cambio de comportamiento.
- [ ] **Step 2:** Los 29 restantes, por familias.
- [ ] **Step 3:** **Ningún script se ejecuta para probarlo.** Escriben en Cloud. La verificación es
      el tipo y la lectura, no la ejecución.
- [ ] **Step 4:** Commit.

---

## Task 5: La cola (41 errores) y los 20 `TS2578`

- [ ] **Step 1:** Los `TS2578` son `@ts-expect-error` que ya no aplican. Para **cada uno**,
      distinguir las dos causas posibles: **(a)** el error dejó de ocurrir porque se arregló → se
      retira la directiva; **(b)** el tipo se relajó y el error se dejó de detectar → **el
      `@ts-expect-error` estaba señalando algo real que ahora nadie vigila**, y retirarlo esconde el
      problema. **No borrar ninguno sin decir cuál de las dos es.**
- [ ] **Step 2:** Ninguno es de C2 —comprobado por él: cero `@ts-expect-error` en toda su
      superficie—. Los de superficie de C1, **preguntarle**.
- [ ] **Step 3:** El resto de la cola por familias.
- [ ] **Step 4:** `bunx tsc -b` → **0 errores**. Commit.

---

## Task 6: Probar que el gate falla cuando debe

**Criterio de aceptación:** un error deliberado en `scripts/` y otro en un test **rompen**
`typecheck`; el control negativo confirma que la medición distingue.

- [ ] **Step 1: El veneno, en TRES sitios.** Inyectar `const VENENO: number = "no soy un number";` en
      (a) un fichero de `scripts/`, (b) un fichero de test, y **(c) un fichero de `src/` que YA
      estaba cubierto** — este último es el **control negativo**: si el veneno de (c) no salta, el
      problema es la medición y no el gate, y hay que parar.
- [ ] **Step 2:** `bunx tsc -b` debe dar **3 errores `TS2322`**, uno por sitio. Anotar la salida.
- [ ] **Step 3:** Retirar los tres. `bunx tsc -b` → 0. **Comprobar que el árbol queda limpio**:
      `git status --porcelain` sin residuo.
- [ ] **Step 4: Test de cobertura permanente.** `src/test/typecheck-cobertura.test.ts`, que lee
      `tsconfig.app.json` y falla si alguien vuelve a excluir los tests o a sacar `scripts` del
      `include`. Sin esto, el hueco vuelve con el próximo que quiera acelerar `tsc`.
- [ ] **Step 5:** Gates en los dos modos, `lint`, `build`. Review adversarial. Turno de merge.

---

## Deuda que este plan NO cierra

- **El refactor de las 19 sondas** (sesión compartida, `storageKey` por cuenta, reintento
  discriminante). Va después, y no dentro: dos refactores grandes juntos son irrevisables.
- **`e2e/`** sigue fuera de todo tsconfig. No entra en este alcance; se declara.
- **Los `vite.config.ts.timestamp-*.mjs`** de la raíz, basura de ejecuciones viejas. No molestan al
  gate; no se tocan en esta tarea.
