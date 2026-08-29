# Carril C3 — GRC, ESG y Canal Interno del tenant Garrigues

> **Para trabajadores agénticos:** SUB-SKILL OBLIGATORIA: usar `superpowers:subagent-driven-development`
> para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.
> Ledger: `.superpowers/sdd/2026-08-29-c3-grc-esg-sii-garrigues/progress.md`.

**Goal:** completar el perímetro de cumplimiento del despacho más allá del penal —ESG de gobernanza,
hallazgos y planes etiquetados, conflictos de interés y Canal Interno de Información (Ley 2/2023)—
**después** de saldar la deuda de proceso que G5 y G6 dejaron en la superficie que este carril hereda.

**Architecture:** tres bloques en orden de dependencia. (1) Saneamiento de lo heredado: los gates de
G5/G6 no asertan nada en el entorno por defecto, así que **nada de lo que construyamos encima sería
verificable** hasta arreglarlo. (2) Aislamiento y veracidad del módulo SII, que hoy filtra denuncias
entre tenants y afirma sellado QTSP inexistente. (3) Contenido nuevo: ESG, hallazgos/planes,
conflictos y canal, todo con procedencia declarada y lo simulado etiquetado como simulado.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui · Supabase JS v2 ·
TanStack Query v5 · bun (test runner y gestor) · Supabase Cloud `governance_OS`.

**Spec:** `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` (§4 G5-G6),
`docs/superpowers/specs/2026-08-20-g5-nucleo-penal-garrigues-design.md`,
`docs/superpowers/specs/2026-08-20-g6-ciberseguridad-nis2-garrigues-design.md`,
`docs/superpowers/reviews/2026-08-29-estatus-programa-garrigues-y-relevo.md`,
`docs/legal/2026-08-29-tsl-ead-trust-servicios-cualificados.md` (producido por este carril).

---

## Global Constraints

Valores exactos, copiados literalmente. Todo requisito de cada tarea los incluye implícitamente.

- **Worktree:** `/private/tmp/c3-grc`, rama `feature/c3-grc-esg-sii` desde `1888aa0`. Enlaces
  simbólicos a `version garrigues/`, `DOC GRC/` y `node_modules`; `.env` copiado. **El árbol
  compartido `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map` no se toca**: lo comparten
  C1 y C2.
- **Línea de no-regresión:** **0 fail SIEMPRE**. Pass ≥ **3461** midiendo con las carpetas fuente
  presentes (`152 skip`, 3613 tests); pass ≥ **3457** midiendo sin ellas (`157 skip`, 3614 tests).
  **Decir siempre en cuál se midió.** La diferencia la produce `src/test/schema/g5-mapa-penal.test.ts:12`
  (`describe.skip`, que se cuenta a sí mismo como una entrada más: 4 `it` → 5 skips).
- **Cero cambio ARGA (`00000000-0000-0000-0000-000000000001`)**, con **una excepción arbitrada**: el
  banner de `PenalAnticorrupcion.tsx` (Tarea 3), porque afirma algo verificadamente falso y conservar
  un defecto no es «no cambiar».
- **Tenant Garrigues:** `00000000-0000-0000-0000-000000000002`.
- **`git add` solo con rutas específicas. NUNCA `-A`.**
- **Superficie de escritura:** `src/pages/grc/**`, `src/pages/sii/**`, `src/lib/grc/**`,
  `src/lib/sii/**`, `src/hooks/useWhistleblowing.ts`, `src/hooks/useExceptions.ts`,
  `src/pages/Conflictos.tsx`, `scripts/garrigues/**`, `src/test/**` (solo ficheros propios).
  Cloud: `risks`, `findings`, `conflicts_of_interest`, `action_plans`, `sii.*` (**solo lectura de
  schema**), y `grc_modules` **solo** la fila `esg` de `…0002`.
- **Congelado salvo autorización nominal:** `obligations`, `controls`, `policies`, el resto de
  `grc_modules`, `CLAUDE.md`, `src/components/shell/**`, `src/components/garrigues-shell/**`.
- **`sii.*` no se modifica** (restricción histórica del proyecto). La identidad de marca va **solo en
  UI**. Todo lo que necesite persistencia nueva va a tablas de `public` con `tenant_id` + RLS.
- **Todo INSERT lleva `tenant_id` explícito.** `action_plans.tenant_id` se añadió con
  `DEFAULT '00000000-0000-0000-0000-000000000001'` (ARGA): un INSERT sin tenant aterriza en ARGA.
- **`findings.code` es UNIQUE GLOBAL**, no por tenant. Prefijos propios (`FND-GARR-*`).
- **Cloud:** `bun run db:check-target` antes de nada. Canal `supabase db query -f <fichero> --linked`,
  **jamás** `"$(cat …)"`. Registrar la versión a mano en `supabase_migrations.schema_migrations`.
  Head remoto actual: `20260820130000`. **Nunca service-role para sondas; residuo 0.**
- **Escala del mapa penal: ORDINAL Y SIN NOMBRES** (decisión D-2 del diseño de G5). Prohibido
  aplicar «Crítico/Alto/Medio/Bajo» al dato de bandas. `NO_EVALUADA` **no es una banda baja**.
- **Citas de la Ley 2/2023 verificadas contra el consolidado del BOE (BOE-A-2023-4513) el
  2026-08-29** — usar exactamente estas:
  - **art. 26** «Registro de informaciones» ← el Libro-Registro. **NO el art. 34**, que es «Delegado
    de protección de datos».
  - **art. 36** «Prohibición de represalias» ← **la cita actual del código es CORRECTA, no tocarla.**
    El art. 35 es «Condiciones de protección».
  - **art. 25** «Información sobre los canales interno y externo de información».
  - **art. 9.2.c** (acuse 7 días naturales) y **art. 9.2.d** (respuesta 3 meses + prórroga).
- **Nada de lo que no dice la fuente se afirma.** Lo simulado se etiqueta como simulado, en pantalla.

---

## File Structure

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `src/test/schema/g5-mapa-penal.test.ts` | Añadir fallback de anon key + asertar no-vacuidad | T1 |
| `src/test/schema/g6-ciberseguridad.test.ts` | Ídem | T1 |
| `src/pages/grc/Risk360.tsx` | Sacar las bandas de filtros y KPI de score | T1 |
| `src/lib/grc/assessed-band.ts` | Ya correcto: **no se toca**. Es la referencia | T1 |
| `src/test/grc/assessed-band.test.ts` | Vigilar **la superficie**, no la constante | T1 |
| `src/lib/sii/tenant-scope.ts` | **Nuevo.** Clave de almacén y de query por tenant | T2 |
| `src/hooks/useWhistleblowing.ts` | Scoping por tenant en almacén y queryKeys | T2 |
| `src/App.tsx` | Envolver `/sii/*` en `RequireModule` | T2 |
| `src/lib/sii/whistleblowing-engine.ts` | Retirar hash y sellado falsos; citas | T3 |
| `src/pages/sii/*.tsx` | Retirar afirmaciones no sostenidas; copy | T3 |
| `src/pages/grc/PenalAnticorrupcion.tsx` | Banner: retirar «ACTIVO»/«oficial» | T3 |
| `scripts/garrigues/esg/plan-sostenibilidad.ts` | **Nuevo.** Única fuente de verdad ESG | T4 |
| `src/pages/grc/modules/esg/` | **Nuevo.** Superficie ESG | T4 |
| `scripts/seed-garrigues-penal.ts` | Enlazar `risks.finding_id` | T5 |
| `scripts/garrigues/hallazgos/` | **Nuevo.** Hallazgos y planes simulados etiquetados | T5 |
| `scripts/garrigues/conflictos/` | **Nuevo.** Conflictos declarados y etiquetados | T6 |
| `src/pages/Conflictos.tsx` | Conectar el tenant Garrigues | T6 |
| `src/test/schema/tenant-isolation.test.ts` | **Solo aditivo, y DESPUÉS del merge de C2** | T8 |

---

## Task 1: Saldar los tres P0 heredados de G5/G6

**Por qué va primero:** los gates Cloud de G5 y G6 no ejecutan ninguna aserción en el entorno por
defecto. Mientras eso siga así, **cualquier cosa que construyamos encima es inverificable** y
cualquier regresión pasa en verde.

**Criterio de aceptación** (acordado con la orquestación, tres condiciones):
1. La corrida por defecto deja de perder 1213 aserciones en G5 y de correr G6 con 0 expect().
2. Ningún fichero de `src/pages/grc/**` mapea una banda del mapa penal a un nombre castellano.
3. **El test vigila la superficie que comete el defecto, no la de al lado.**

**Files:**
- Modify: `src/test/schema/g5-mapa-penal.test.ts:110`
- Modify: `src/test/schema/g6-ciberseguridad.test.ts:10`
- Modify: `src/pages/grc/Risk360.tsx:43-48,84-91,303-310`
- Modify: `src/test/grc/assessed-band.test.ts`

**Interfaces:**
- Consume: `ETIQUETA_BANDA`, `ORDEN_BANDA` de `src/lib/grc/assessed-band.ts` (sin cambios).
- Produce: `SCORE_FILTERS` deja de aplicarse a riesgos con `assessed_band`; los KPI
  `criticalCount`/`highCount` vuelven a calcularse **solo sobre score**, como promete §10 del diseño.

- [ ] **Step 1: Escribir el test que falla — la superficie no debe nombrar bandas**

En `src/test/grc/assessed-band.test.ts`, añadir al final:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("D-2 — ninguna superficie GRC nombra las bandas del mapa penal", () => {
  const RISK360 = readFileSync(join(process.cwd(), "src/pages/grc/Risk360.tsx"), "utf8");

  it("Risk360 no asocia assessed_band con un nombre castellano de severidad", () => {
    // El defecto real de G5: `risk.assessed_band === "ROJO"` dentro de la rama
    // del filtro "criticos", y NO_EVALUADA contada como "bajos".
    const lineas = RISK360.split("\n");
    const infractoras = lineas.filter(
      (l) =>
        /assessed_band/.test(l) &&
        /"?(criticos|altos|medios|bajos)"?|Crítico|Alto|Medio|Bajo/.test(l),
    );
    expect(infractoras).toEqual([]);
  });

  it("NO_EVALUADA no se agrupa nunca con una banda evaluada", () => {
    expect(/NO_EVALUADA[^\n]*\|\|/.test(RISK360)).toBe(false);
    expect(/\|\|[^\n]*NO_EVALUADA/.test(RISK360)).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutarlo y verlo fallar**

```bash
cd /private/tmp/c3-grc && bun test src/test/grc/assessed-band.test.ts
```
Esperado: FAIL. La primera aserción devuelve las 4 líneas de `Risk360.tsx:87-90`; la segunda, `true`
por `assessed_band === "VERDE" || risk.assessed_band === "NO_EVALUADA"`.

- [ ] **Step 3: Sacar las bandas de los filtros de score**

En `src/pages/grc/Risk360.tsx`, `matchesScoreFilter`: eliminar por completo la rama
`else if (risk.assessed_band)`. Un riesgo con banda y sin score **no participa** del filtro de score:

```ts
  } else if (risk.assessed_band) {
    // Los riesgos evaluados por banda ordinal NO entran en el filtro de score.
    // La escala de la fuente es ordinal y SIN NOMBRES (D-2): mapearla a
    // Crítico/Alto/Medio/Bajo inventaría la leyenda que la fuente no publica,
    // y agrupaba NO_EVALUADA con las bandas bajas, que es afirmar que un
    // delito no evaluado es de riesgo bajo. Se filtran por su propia tira.
    return filter === FILTER_ALL;
  }
```

- [ ] **Step 4: Sacar las bandas de los KPI**

En el mismo fichero, `criticalCount` y `highCount` vuelven a depender **solo** del score:

```ts
  const criticalCount = risksForContext.filter((risk) => {
    const s = riskScore(risk);
    return s !== null && s >= 20;
  }).length;
  const highCount = risksForContext.filter((risk) => {
    const s = riskScore(risk);
    return s !== null && s >= 15 && s < 20;
  }).length;
```

- [ ] **Step 5: Verificar que el test pasa y que ARGA no cambia**

```bash
cd /private/tmp/c3-grc && bun test src/test/grc/assessed-band.test.ts
```
Esperado: PASS. **ARGA no atraviesa código nuevo:** sus 167 riesgos tienen score, luego la rama
`assessed_band` no se evalúa para ellos y los KPI dan exactamente lo mismo que antes.

- [ ] **Step 6: Añadir el fallback de anon key en los dos ficheros de G5/G6**

`.env` define `ANON_PUBLIC` y `PUBLISHABLE_KEY`; **`VITE_SUPABASE_ANON_KEY` no existe en este repo**.
Aplicar el patrón ya usado en `tenant-isolation.test.ts:17-18` y `garrigues-obligaciones-seed.test.ts:12-13`.

En `src/test/schema/g5-mapa-penal.test.ts:110` y `src/test/schema/g6-ciberseguridad.test.ts:10`:

```ts
// `.env` nombra la clave ANON_PUBLIC/PUBLISHABLE_KEY, no VITE_SUPABASE_ANON_KEY.
// Sin este fallback el bloque Cloud entero pasa en verde sin asertar nada:
// medido en G5, 1213 de 1807 aserciones desaparecían en silencio.
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.ANON_PUBLIC ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
```

- [ ] **Step 7: Hacer que la vacuidad ROMPA el gate, no lo degrade**

En el `beforeAll` de ambos ficheros, después de resolver los clientes, sustituir el retorno silencioso
por una aserción. En `g5-mapa-penal.test.ts` y `g6-ciberseguridad.test.ts`:

```ts
    // Fallar aquí es lo correcto: si no hay sesión no se puede afirmar nada de
    // Cloud, y un gate que "pasa" sin poder mirar es peor que uno rojo.
    expect(garr, "sesión Garrigues no disponible: el gate Cloud sería vacuo").not.toBeNull();
    expect(arga, "sesión ARGA no disponible: el control discriminante sería vacuo").not.toBeNull();
```

- [ ] **Step 8: Medir la diferencia y dejar constancia**

```bash
cd /private/tmp/c3-grc && bun test src/test/schema/g5-mapa-penal.test.ts src/test/schema/g6-ciberseguridad.test.ts
```
Esperado: sube muy por encima de las **594 + 15** aserciones medidas antes del arreglo. Anotar la
cifra exacta en el ledger. Si no sube, el arreglo no ha funcionado y **no se continúa**.

- [ ] **Step 9: Suite completa en los dos modos**

```bash
cd /private/tmp/c3-grc && bun test 2>&1 | tail -6
```
Esperado: 0 fail, pass ≥ 3461 (con fuentes; los symlinks las hacen visibles).

```bash
cd /private/tmp/c3-grc && mv "version garrigues" _src_off && bun test 2>&1 | tail -6; mv _src_off "version garrigues"
```
Esperado: 0 fail, pass ≥ 3457. **Restaurar el enlace pase lo que pase.**

- [ ] **Step 10: Commit**

```bash
cd /private/tmp/c3-grc
git add src/test/schema/g5-mapa-penal.test.ts src/test/schema/g6-ciberseguridad.test.ts src/pages/grc/Risk360.tsx src/test/grc/assessed-band.test.ts
git commit -m "fix(g5,g6): los gates Cloud vuelven a asertar y Risk360 deja de nombrar las bandas"
```

---

## Task 2: El SII deja de filtrar denuncias entre tenants

**Por qué va segunda:** es fuga de dato sensible **en vivo**. Un usuario de Garrigues abre `/sii` y
ve las tres denuncias de ARGA, con cabecera «SII · Garrigues» encima.

**Criterio de aceptación:** con sesión de Garrigues, `/sii` no muestra ni un solo expediente de ARGA;
un test falla si la clave de almacén o alguna queryKey del módulo deja de llevar el tenant.

**Files:**
- Create: `src/lib/sii/tenant-scope.ts`
- Create: `src/test/sii/sii-tenant-scope.test.ts`
- Modify: `src/hooks/useWhistleblowing.ts:26,385-427`
- Modify: `src/App.tsx:221-227`

**Interfaces:**
- Produce: `siiStorageKey(tenantId: string): string` y `siiQueryKey(tenantId: string, ...parts: string[]): unknown[]`.

- [ ] **Step 1: Escribir el test que falla**

`src/test/sii/sii-tenant-scope.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siiStorageKey, siiQueryKey } from "@/lib/sii/tenant-scope";

const ARGA = "00000000-0000-0000-0000-000000000001";
const GARR = "00000000-0000-0000-0000-000000000002";

describe("SII — scoping por tenant", () => {
  it("dos tenants nunca comparten bucket de almacén", () => {
    expect(siiStorageKey(ARGA)).not.toBe(siiStorageKey(GARR));
  });

  it("dos tenants nunca comparten queryKey", () => {
    expect(siiQueryKey(ARGA, "reports", "list")).not.toEqual(siiQueryKey(GARR, "reports", "list"));
  });

  it("el hook no conserva ninguna clave literal sin tenant", () => {
    const src = readFileSync(join(process.cwd(), "src/hooks/useWhistleblowing.ts"), "utf8");
    expect(src.includes('"arga_sii_whistleblowing_cases_v1"')).toBe(false);
    expect(/queryKey:\s*\["whistleblowing"/.test(src)).toBe(false);
  });

  it("toda query del módulo se inhabilita sin tenant", () => {
    const src = readFileSync(join(process.cwd(), "src/hooks/useWhistleblowing.ts"), "utf8");
    const queries = (src.match(/useQuery\(/g) ?? []).length;
    const enabled = (src.match(/enabled:\s*!!tenantId/g) ?? []).length;
    expect(enabled).toBeGreaterThanOrEqual(queries);
  });
});
```

- [ ] **Step 2: Ejecutarlo y verlo fallar**

```bash
cd /private/tmp/c3-grc && bun test src/test/sii/sii-tenant-scope.test.ts
```
Esperado: FAIL — el módulo `tenant-scope` no existe.

- [ ] **Step 3: Crear el módulo de scoping**

`src/lib/sii/tenant-scope.ts`:

```ts
// Scoping por tenant del módulo SII.
// El almacén vivía en una única clave literal ("arga_sii_whistleblowing_cases_v1")
// compartida por todos los tenants: un usuario de Garrigues veía las denuncias
// de ARGA. Es el dato más sensible del producto, así que la clave lleva tenant
// y no hay camino que la construya sin él.
export function siiStorageKey(tenantId: string): string {
  if (!tenantId) throw new Error("siiStorageKey exige tenantId: sin él, el almacén se comparte");
  return `sii_whistleblowing_cases_v2:${tenantId}`;
}

export function siiQueryKey(tenantId: string, ...parts: string[]): unknown[] {
  return ["whistleblowing", tenantId, ...parts];
}
```

- [ ] **Step 4: Cablear el hook**

En `src/hooks/useWhistleblowing.ts`: importar `useTenantContext`, sustituir la constante
`SII_STORAGE_KEY` por `siiStorageKey(tenantId)` en lectura y escritura, sustituir las 4 queryKeys
literales por `siiQueryKey(tenantId, …)` y añadir `enabled: !!tenantId` a cada `useQuery`.

- [ ] **Step 5: Cerrar la puerta de la ruta**

En `src/App.tsx:221-227`, envolver las cinco rutas `/sii/*` en `RequireModule moduleKey="sii"`, como
ya se hace en `:284-286` y `:317-318`. Hoy la whitelist `branding.modules` del tenant es decorativa
para este módulo.

- [ ] **Step 6: Verificar**

```bash
cd /private/tmp/c3-grc && bun test src/test/sii/ && bun run typecheck
```
Esperado: PASS y exit 0.

- [ ] **Step 7: Verificación viva con control discriminante**

Arrancar el preview, entrar como `demo@garrigues-demo.dev` en `/login?tenant=garrigues`, abrir `/sii`
y **comprobar el email de la sesión en la misma medición** (dos pestañas comparten `localStorage` y
la `storageKey` de Supabase). Esperado: cero expedientes de ARGA. Repetir con ARGA: sus tres casos
siguen ahí. Guardar captura de ambas en el ledger.

- [ ] **Step 8: Commit**

```bash
cd /private/tmp/c3-grc
git add src/lib/sii/tenant-scope.ts src/test/sii/sii-tenant-scope.test.ts src/hooks/useWhistleblowing.ts src/App.tsx
git commit -m "fix(sii): el canal interno deja de compartir expedientes entre tenants"
```

---

## Task 3: Retirar del SII y del banner penal lo que no se sostiene

**Criterio de aceptación:** ninguna superficie afirma sellado QTSP, SHA-512, cifrado extremo a
extremo, anonimato técnico ni admisión a trámite; la cita del Libro-Registro es el **art. 26**; un
test fija las cuatro cosas. **La redacción exacta del banner la firma la orquestación antes de
escribirla** (condición 2 de su arbitraje).

**Files:**
- Modify: `src/lib/sii/whistleblowing-engine.ts:210,467-496,659,672-678`
- Modify: `src/pages/sii/SiiCaseDetalle.tsx`, `SiiPortalIntake.tsx`, `SiiSafeInbox.tsx`, `SiiLibroRegistro.tsx`, `SiiDashboard.tsx`, `SiiLayout.tsx`
- Modify: `src/pages/grc/PenalAnticorrupcion.tsx:337-366`
- Create: `src/test/sii/sii-afirmaciones.test.ts`

- [ ] **Step 1: Escribir el test que fija las retiradas**

`src/test/sii/sii-afirmaciones.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIRS = ["src/pages/sii", "src/lib/sii"];
const fuentes = DIRS.flatMap((d) =>
  readdirSync(join(process.cwd(), d))
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => [join(d, f), readFileSync(join(process.cwd(), d, f), "utf8")] as const),
);

describe("SII — no se afirma lo que no se sostiene", () => {
  const prohibido: [RegExp, string][] = [
    [/QSeal|sellado QTSP|Sellado QTSP/, "sellado QTSP inexistente: no hay artefacto ni proveedor"],
    [/SHA512:|SHA-512/, "no hay hash SHA-512: era Math.random() con un prefijo"],
    [/[Cc]ifrado de extremo a extremo|[Cc]ifrad[ao]\b.*bidireccional/, "los mensajes viven en claro"],
    [/100% anónimo|anonimato técnico/, "PI-31 §3.c sólo reconoce el anónimo por vía postal"],
    [/admitid[oa] a trámite/, "no existe fase de admisión: el estado escrito es RECIBIDO"],
    [/Art\. 34\b/, "el Libro-Registro es el art. 26; el art. 34 es Delegado de protección de datos"],
  ];

  for (const [re, motivo] of prohibido) {
    it(`no aparece ${re} — ${motivo}`, () => {
      const infractores = fuentes.filter(([, src]) => re.test(src)).map(([f]) => f);
      expect(infractores).toEqual([]);
    });
  }

  it("la cita del art. 36 (prohibición de represalias) SE CONSERVA: es correcta", () => {
    // Verificado contra BOE-A-2023-4513 el 2026-08-29: art. 36 = "Prohibición de
    // represalias". Un auditor propuso cambiarlo a 35 ("Condiciones de
    // protección") y habría introducido un error. Este test lo impide.
    const hay = fuentes.some(([, src]) => /Art\. 36/.test(src));
    expect(hay).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutarlo y verlo fallar**

```bash
cd /private/tmp/c3-grc && bun test src/test/sii/sii-afirmaciones.test.ts
```
Esperado: FAIL en los 6 primeros casos; PASS en el séptimo.

- [ ] **Step 3: Retirar el hash y el sellado falsos del motor**

En `useWhistleblowing.ts:496-498` eliminar `hashSha512`, `qtspSealed` y `qtspSealedAt` del objeto de
evidencia. En `whistleblowing-engine.ts:672-678` sustituir el prefijo `SHA512:SII:` por
`HUELLA-DEMO:` y comentar que es un hash JS de 32 bits sin valor probatorio.

- [ ] **Step 4: Sustituir el copy por el disclaimer que ya existe en Secretaría**

Reutilizar el criterio de `src/lib/secretaria/evidence-status-labels.ts`: **«Entorno de validación
funcional — sin eficacia jurídica cualificada productiva»**. Sustituir «anonimato técnico» y «100%
anónimo» por **«confidencialidad reforzada»**, que es lo que el dictamen fuente exige cuando la
arquitectura no evita la identificación. Corregir `Art. 34` → **`Art. 26`** en las 8 ocurrencias.
Retirar «admitido a trámite» del paso 4 del intake y del acuse (el estado real es `RECIBIDO`).

- [ ] **Step 5: Proponer el texto del banner y ESPERAR firma**

Redactar el antes/después de `PenalAnticorrupcion.tsx:337-366` y **enviarlo a la orquestación**. No
escribirlo hasta recibir la firma. Se conserva lo que sí se sostiene (el Libro-Registro existe por
Ley 2/2023; `CLAUDE.md` admite custodia/e-archiving); se retira **«ACTIVO»** en verde (no hay ni un
expediente) y **«oficial»** aplicado a la custodia (la TSL acredita que EAD Trust **no** tiene
`PSES/Q`: 0 servicios de preservación cualificada frente a 22 de otros prestadores).

- [ ] **Step 6: Verificar y commitear**

```bash
cd /private/tmp/c3-grc && bun test src/test/sii/ && bun run typecheck && bun run lint
git add src/lib/sii src/pages/sii src/pages/grc/PenalAnticorrupcion.tsx src/hooks/useWhistleblowing.ts src/test/sii/sii-afirmaciones.test.ts
git commit -m "fix(sii,grc): el producto deja de afirmar sellado, cifrado y anonimato que no existen"
```

---

## Task 4: ESG de gobernanza, sin métricas (opción B autorizada)

**Decisión del usuario, 2026-08-29:** el *Informe de Sostenibilidad 2025* **no está en el corpus**
(verificado: 2 ocurrencias de «sostenib» en todas las fuentes, y una es una URL de SharePoint
inaccesible). Se construye ESG **de gobernanza**: órganos reales como owners, PI-22 como política
rectora, el Plan 2023-2025 nombrado con su periodo, y **estado vacío honesto** para los objetivos.

**Criterio de aceptación:** `/grc` de Garrigues muestra ESG con los dos órganos reales enlazados a su
ficha; **ninguna cifra, indicador ni porcentaje**; el estado vacío dice explícitamente que los
objetivos del Plan no constan en fuente disponible. Un test falla si aparece un número que pretenda
ser un indicador ESG.

**Files:**
- Create: `scripts/garrigues/esg/plan-sostenibilidad.ts`
- Create: `src/pages/grc/modules/esg/EsgGarrigues.tsx`
- Create: `src/test/garrigues/esg-catalogo.test.ts`
- Modify: `src/App.tsx` (ruta), Cloud: 1 fila en `grc_modules`

**Interfaces:**
- Produce: `ESG_ORGANOS` (los dos slugs reales), `ESG_POLITICA` (`PI-22`), `PLAN_SOSTENIBILIDAD`
  (`{ nombre, periodo, objetivos: null, motivo_ausencia }`).

- [ ] **Step 1: Escribir el test que impide inventar cifras**

`src/test/garrigues/esg-catalogo.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { PLAN_SOSTENIBILIDAD, ESG_ORGANOS, ESG_POLITICA } from "../../../scripts/garrigues/esg/plan-sostenibilidad";

describe("ESG Garrigues — gobernanza sin métricas", () => {
  it("los owners son los dos órganos reales de G2", () => {
    expect(ESG_ORGANOS.map((o) => o.slug).sort()).toEqual(
      ["comite-sostenibilidad", "comision-seguimiento-sostenibilidad"].sort(),
    );
  });

  it("la política rectora es PI-22", () => {
    expect(ESG_POLITICA).toBe("PI-22");
  });

  it("el Plan se nombra pero NO se le atribuye ningún objetivo", () => {
    expect(PLAN_SOSTENIBILIDAD.nombre).toBe("Plan de Sostenibilidad 2023-2025");
    expect(PLAN_SOSTENIBILIDAD.periodo).toBe("2023-2025");
    expect(PLAN_SOSTENIBILIDAD.objetivos).toBeNull();
    expect(PLAN_SOSTENIBILIDAD.motivo_ausencia).toMatch(/no consta en fuente disponible/i);
  });
});
```

- [ ] **Step 2: Ejecutarlo y verlo fallar** — `bun test src/test/garrigues/esg-catalogo.test.ts` → FAIL, módulo inexistente.

- [ ] **Step 3: Escribir el catálogo**

`scripts/garrigues/esg/plan-sostenibilidad.ts`. Contenido tomado **literalmente** de
`scripts/garrigues/gobierno/comites-2026.json:305-338`, ya sembrado en G2:

```ts
// Única fuente de verdad ESG del tenant Garrigues.
// El Informe de Sostenibilidad 2025 NO está en el corpus (verificado 2026-08-29):
// no hay de dónde sacar objetivos ni indicadores, y no se inventan.
// Lo que sí es real: los dos órganos, su misión literal y PI-22.
export const ESG_POLITICA = "PI-22";

export const ESG_ORGANOS = [
  {
    slug: "comite-sostenibilidad",
    nombre: "Comité de Sostenibilidad",
    mision:
      "Coordina la estrategia ESG y de sostenibilidad del despacho, como organización y como firma de servicios profesionales.",
  },
  {
    slug: "comision-seguimiento-sostenibilidad",
    nombre: "Comisión de Seguimiento del Plan de Sostenibilidad",
    mision:
      "Analiza el cumplimiento de los objetivos del Plan de Sostenibilidad 2023-2025 y evalúa la contribución de las actuaciones, con apoyo del Grupo de Trabajo de Medioambiente.",
  },
] as const;

export const PLAN_SOSTENIBILIDAD = {
  nombre: "Plan de Sostenibilidad 2023-2025",
  periodo: "2023-2025",
  objetivos: null,
  motivo_ausencia:
    "El Plan se nombra en la misión de la Comisión de Seguimiento, pero su contenido — objetivos, indicadores y grado de cumplimiento — no consta en fuente disponible.",
} as const;
```

- [ ] **Step 4: Sembrar la fila del módulo en Cloud (AUTORIZADA: una fila, un tenant)**

**Antes de sembrar nada que dependa de ella**, por el fallback de `tg_sync_obligation_to_backbone`
que no re-comprueba existencia. `bun run db:check-target` primero. Fichero
`supabase/migrations/20260829120000_c3_grc_module_esg_garrigues.sql`:

```sql
INSERT INTO grc_modules (tenant_id, id, name, description, owner)
VALUES (
  '00000000-0000-0000-0000-000000000002', 'esg',
  'Sostenibilidad y ESG',
  'Gobernanza de la sostenibilidad: Comité de Sostenibilidad, Comisión de Seguimiento del Plan 2023-2025 y PI-22. Sin indicadores: el Informe de Sostenibilidad no consta en fuente disponible.',
  'Comité de Sostenibilidad'
)
ON CONFLICT (tenant_id, id) DO NOTHING;
```

Aplicar con `supabase db query -f <fichero> --linked` y registrar la versión a mano.
**Verificar después que ARGA sigue con sus 13 filas de `grc_modules` y ninguna nueva.**

- [ ] **Step 5: Superficie**

`src/pages/grc/modules/esg/EsgGarrigues.tsx`: los dos órganos con su misión literal, **enlazados a
`/organos/:slug`** (la ruta resuelve por **slug**, no por UUID — `useBodyBySlug`), PI-22 enlazada a
su ficha, y el bloque del Plan con `motivo_ausencia` **visible**, no escondido. Tokens `--g-*`
exclusivamente. Ni un número.

- [ ] **Step 6: Verificar, verificación viva y commit**

Comprobar en vivo con sesión Garrigues que ESG aparece y que los enlaces **navegan de verdad** (leer
un rótulo no prueba la arista). Confirmar que ARGA no ve el módulo. Commit por rutas.

---

## Task 5: Hallazgos navegables y planes de acción etiquetados

**Criterio de aceptación:** desde un riesgo de banda alta se llega a su hallazgo y vuelta; el KPI «Con
hallazgo» deja de marcar 0 sobre 82; todo plan de acción sembrado lleva `tenant_id` explícito y
etiqueta visible de simulado.

**Files:** `scripts/seed-garrigues-penal.ts:78-101`, `scripts/garrigues/hallazgos/` (nuevo),
`src/pages/grc/RiskDetalle.tsx`, `src/test/garrigues/hallazgos-planes.test.ts` (nuevo).

- [ ] **Step 1:** Test que falla: `risks.finding_id` no es NULL para las 8 celdas de banda alta, y
      todo `action_plans` de Garrigues tiene `tenant_id = '…0002'`.
- [ ] **Step 2:** Verlo fallar (hoy `finding_id` es NULL en las 82 filas y `action_plans` está vacío).
- [ ] **Step 3:** En el seed, tras crear cada hallazgo, actualizar `risks.finding_id` del riesgo cuyo
      `code` corresponde a la celda. **Derivar el código del hallazgo de `codigo|columna`**, no del
      índice del array: hoy `FND-GARR-PEN-NN` se asigna por posición y un reordenado del catálogo
      cambiaría en silencio a qué celda se refiere cada hallazgo.
- [ ] **Step 4:** Planes de acción **simulados y etiquetados**. La fuente (PPD-01 §246) describe el
      mecanismo y **no publica la lista**, así que cada plan lleva `firmeza: "DEMO_PILOTO"` y la
      pantalla lo dice. **`tenant_id` explícito en todos los INSERT** (la columna tiene DEFAULT ARGA).
- [ ] **Step 5:** Verificar la arista con un render test sobre `RiskDetalle`, no con un grep del
      fuente: el gate 6 de G5 es hoy un grep que sobrevive a `{risk.assessment_breakdown && null}`.
- [ ] **Step 6:** Gates, verificación viva y commit.

---

## Task 6: Conflictos de interés declarados y etiquetados

**Criterio de aceptación:** `/conflictos` de Garrigues deja de estar vacío; **ningún conflicto real se
atribuye a una persona identificada**; cada fila lleva etiqueta visible de simulado; ARGA sigue viendo
exactamente lo que veía.

**Files:** `scripts/garrigues/conflictos/` (nuevo), `src/pages/Conflictos.tsx` (autorizado),
`src/test/garrigues/conflictos.test.ts` (nuevo). Cloud: `conflicts_of_interest` (autorizada).

- [ ] **Step 1:** Test que falla: hay filas de `conflicts_of_interest` para `…0002`, **ninguna con
      nombre de persona del censo real**, y todas con marca de procedencia simulada.
- [ ] **Step 2:** Verlo fallar (hoy 0 filas).
- [ ] **Step 3:** Catálogo de conflictos **tipológicos**, no nominales: las situaciones que PI-02
      (Política sobre conflicto de intereses) describe —doble representación, cliente adverso,
      interés personal del socio, incompatibilidad de asunto— **con la persona anonimizada por rol**
      («un socio del área Mercantil»), nunca con nombre. La fuente da la tipología; no da casos.
- [ ] **Step 4:** Sembrar con `tenant_id` explícito.
- [ ] **Step 5:** En `Conflictos.tsx`, el guard `branding ?` de `:127` hoy oculta el fixture de ARGA a
      todo tenant con branding: sustituirlo por lectura real del tenant, **conservando intacto el
      camino de ARGA** (`branding` NULL → fixtures como hasta ahora).
- [ ] **Step 6:** Gates, verificación viva en los dos tenants y commit.

---

## Task 7: Canal Interno con identidad Garrigues y procedimiento de PI-31

**Criterio de aceptación:** el canal de Garrigues nombra a sus órganos reales (Responsable = Senior
Partner, Instructor = Directora de Cumplimiento Normativo, según PI-31 §4 y Anexo §2.a), informa del
**canal externo (art. 25 Ley 2/2023 + PI-31 §3.2.d y §3.4: A.A.I. y SEPBLAC)**, y sus casos demo son
materia de despacho, no de aseguradora.

**Files:** `src/pages/sii/**`, `src/lib/sii/whistleblowing-engine.ts`, `scripts/garrigues/sii/` (nuevo).

- [ ] **Step 1:** Test que falla: la superficie SII menciona el canal externo y la A.A.I.; el rol del
      instructor no es un literal hardcodeado.
- [ ] **Step 2:** Verlo fallar (hoy: cero menciones a canal externo; instructor fijo `inv-001`).
- [ ] **Step 3:** Bloque visible de canales externos con la cita **art. 25**.
- [ ] **Step 4:** Roles por tenant: sustituir «Comisión de Auditoría y Control» —órgano que **en
      Garrigues no existe**— y el «Comité de Cumplimiento e Independencia» inventado por la cadena
      real de PI-31.
- [ ] **Step 5:** Tres casos demo de despacho (PBC/FT art. 26 bis Ley 10/2010, conflicto con cliente,
      acoso vía protocolo LGTBI ya sembrado en G4), **etiquetados como simulados**, elegidos por tenant.
- [ ] **Step 6:** Corregir el clasificador `text.includes("ia")` de `whistleblowing-engine.ts:396`,
      que abre un subexpediente AI Act en toda comunicación en castellano («famil**ia**»,
      «auditor**ía**», «denunc**ia**») y bloquea el cierre del expediente. Usar `\b…\b`.
- [ ] **Step 7:** Gates, verificación viva y commit.

---

## Task 8: Cierre — aislamiento cross-tenant, gates y verificación viva

**Criterio de aceptación:** los cuatro del estándar de cierre: ledger completo, review adversarial por
tarea, gates verdes en los dos modos de medición, y verificación viva con control discriminante.

- [ ] **Step 1: ESPERAR el merge de C2.** `src/test/schema/tenant-isolation.test.ts` lo amplían los dos
      carriles; **C2 va primero**. Integrar su merge antes de tocarlo.
- [ ] **Step 2:** Ampliar el gate **solo de forma aditiva**, en un `describe` propio, sin tocar
      aserciones de G0/G4: `conflicts_of_interest` y `action_plans`. **Comprobar antes contra Cloud
      que ambos tenants tienen filas reales**, o la aserción pasa vacua — el error que G4 documentó.
- [ ] **Step 3:** Hacer que la vacuidad **rompa** el gate. Hoy `tenant-isolation.test.ts:102-108`
      la declara con `console.warn` y no la asierta, y todo el describe se autodesactiva con
      `expect(true).toBe(true)` si el login falla.
- [ ] **Step 4:** Suite completa en los **dos modos** (con y sin carpetas fuente) + `typecheck` +
      `lint` + `build`. Anotar en qué árbol se midió cada cifra.
- [ ] **Step 5:** Medición de cierre sobre `HEAD` inmutable, no sobre el árbol de trabajo:
      `git archive HEAD | tar -x -C <tmp>` + symlink de `node_modules` + copia de `.env`.
- [ ] **Step 6:** Verificación viva con control discriminante ARGA en **cada** medición, comprobando
      el email del token **en la misma llamada que mide**.
- [ ] **Step 7:** Review adversarial de rama, **modelo medio como suelo**. Una re-review en haiku
      devolvió en G4 un informe con cero llamadas a herramientas.
- [ ] **Step 8:** Pedir turno de merge a la orquestación. **Los merges los ordena ella, uno cada vez.**

---

## Deuda declarada que este plan NO cierra

- **`procedencia_cualificacion` nace write-only**, como `prospectiva`, `sujeto_obligado` y `quote`:
  `seed-garrigues-ciber.ts:99-111` no los persiste. Hacerlos visibles exige tocar `obligations`,
  **congelada**. Pedir autorización nominal cuando toque.
- **NIS2 se presenta como deber del despacho** en `/obligaciones` (el prefijo `[Marco Prospectivo]` no
  lo entiende ningún código) y las dos fichas salen **en rojo como «SIN CONTROL»**. Requiere tocar
  `usePoliciesObligations.ts` y `ObligacionesList.tsx`, fuera de la superficie de C3.
- **`ISO/IEC 27001:2022`** fijado cuando la versión no consta; **art. 33 RD 311/2022** citado como
  «notificar a clientes» cuando obliga a notificar al CCN/INCIBE-CERT. Pendiente de los datos que el
  usuario dice tener.
- **Migración `20260820130000` reescribe una función compartida** y cambia enrutamientos ajenos a G6
  (`OBL-LEY2-%` de `'ethics'` a `'aml'`) pese a declarar «Cero cambio para ARGA».
- **`sii.*` sin RLS y sin políticas**, y `sii_cases_view` devuelve `42501` a `authenticated`.
  `useModuleStatus.ts:127` lo convierte en «0 casos» que parece un dato. Persistir el canal exigiría
  tablas nuevas en `public`; **no es necesario para la demo** y no entra aquí.
- **`useSii.ts` y `src/data/sii.ts` están muertos** (0 importadores) y describen un modelo distinto
  del que usa la UI: quien audite por nombres concluirá que el módulo lee de Cloud.
- **`CTR-008`** conserva su fallback declarado. **No se toca**: es decisión consciente del usuario.
- **El botón «Cerrar sesión» no tiene handler.** Pre-existente; mantiene latentes las fugas de caché
  entre tenants.
