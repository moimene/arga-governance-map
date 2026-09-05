import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

/**
 * A1 — Contrato de aislamiento por tenant de los hooks AIMS.
 *
 * Estos hooks delegaban el aislamiento al 100 % en RLS y, en el caso de
 * `useAimsMultiregime`, escribían el tenant de ARGA en duro. Con el botón
 * "Cerrar sesión" sin handler, además, el caché sobrevive al cambio de tenant
 * dentro de la misma pestaña: `tenantId` tiene que estar en la queryKey.
 *
 * Es un test de contrato sobre el fuente a propósito: no necesita Cloud ni
 * render, así que falla ruidosamente en cualquier entorno, incluido CI sin claves.
 */
// Descubrimiento por glob, no lista fija: un `useAimsX.ts` nuevo queda cubierto
// desde el primer día en vez de nacer sin gate.
//
// AMPLIADO (2026-09-05) a los `useAi*.ts`: leen las MISMAS tablas del módulo
// (`ai_systems`, `ai_risk_assessments`, `ai_compliance_checks`, `ai_incidents`)
// y quedaban fuera del contrato sólo por el prefijo del nombre. Se han pasado a
// `skipToken` para que el invariante sea el mismo para todos.
const HOOKS = readdirSync("src/hooks")
  .filter((f) => /^useAi(ms)?[A-Z].*\.ts$/.test(f))
  .map((f) => `src/hooks/${f}`);

/**
 * ANCLA. Sin esto los seis `it` de abajo son bucles sobre una lista: si el glob
 * dejara de encontrar ficheros —un `readdir` sobre otro cwd, un renombrado, un
 * cambio en el patrón— los seis pasarían 6/6 sin asertar NADA. Se exige que la
 * lista tenga contenido Y que contenga exactamente los hooks que hoy existen:
 * un hook nuevo entra solo por el glob, pero uno que DESAPAREZCA de la lista
 * tiene que romper el gate en vez de reducirlo en silencio.
 */
const HOOKS_ESPERADOS = [
  "src/hooks/useAiAssessments.ts",
  "src/hooks/useAiIncidents.ts",
  "src/hooks/useAiSystems.ts",
  "src/hooks/useAimsFria.ts",
  "src/hooks/useAimsMultiregime.ts",
  "src/hooks/useAimsTechnicalFile.ts",
];

/**
 * `ai_risk_assessments` y `ai_compliance_checks` NO tienen columna `tenant_id`
 * (verificado en Cloud, 2026-09-05): su aislamiento va por el join
 * `ai_systems!inner(tenant_id)`, y sus altas no pueden escribir un `tenant_id`
 * que la tabla no tiene. Por eso los dos invariantes que hablan de la COLUMNA
 * aceptan también la forma del join, y el de las altas excluye este fichero —
 * con el motivo escrito, no por omisión.
 */
const SCOPING_POR_JOIN = new Set(["src/hooks/useAiAssessments.ts"]);

function read(f: string): string {
  return readFileSync(f, "utf8");
}

describe("A1 — hooks AIMS aislados por tenant", () => {
  it("el descubrimiento por glob encuentra los hooks que se quieren cubrir", () => {
    expect(HOOKS.length, "el glob no ha encontrado ningún hook: los demás tests serían vacuos")
      .toBeGreaterThan(0);
    for (const esperado of HOOKS_ESPERADOS) {
      expect(HOOKS, `${esperado} ha salido del gate sin que nadie lo note`).toContain(esperado);
    }
  });

  it("ningún hook AIMS hardcodea un UUID de tenant", () => {
    for (const f of HOOKS) {
      expect(read(f), `${f} hardcodea un UUID de tenant`).not.toMatch(
        /00000000-0000-0000-0000-00000000000[12]/,
      );
    }
  });

  it("el tenant PROVIENE del contexto, no solo se llama tenantId", () => {
    // Un hook que lea el tenant de la URL y llame `tenantId` a la variable
    // pasaría cualquier comprobación por nombre. Se exige el origen.
    for (const f of HOOKS) {
      const src = read(f);
      const origen = /const\s*\{\s*tenantId[^}]*\}\s*=\s*useTenantContext\(\)/g;
      const usos = (src.match(/useTenantContext\(\)/g) ?? []).length;
      expect(
        (src.match(origen) ?? []).length,
        `${f}: tenantId no se desestructura de useTenantContext()`,
      ).toBeGreaterThan(0);
      expect(usos, `${f} declara tenantId sin resolverlo del contexto`).toBeGreaterThan(0);
      // Ninguna otra fuente puede alimentar el tenant.
      expect(
        /tenantId\s*=\s*(?!useTenantContext)/.test(src.replace(/const\s*\{[^}]*\}\s*=\s*useTenantContext\(\)/g, "")),
        `${f}: tenantId asignado desde una fuente que no es el contexto`,
      ).toBe(false);
      expect(
        /(searchParams|URLSearchParams|localStorage|sessionStorage)/.test(src),
        `${f}: el tenant no puede venir de la URL ni del almacenamiento del navegador`,
      ).toBe(false);
    }
  });

  it("ninguna queryFn puede ejecutarse sin tenant, ni por refetch() manual", () => {
    // `enabled` NO protege del `refetch()` manual: TanStack v5 ejecuta la
    // queryFn aunque la query esté deshabilitada. El guard tiene que estar en
    // la propia queryFn (`skipToken`), no en `enabled`.
    for (const f of HOOKS) {
      const src = read(f);
      const queryFns = src.match(/queryFn:[^\n]*/g) ?? [];
      expect(queryFns.length, `${f} no declara queryFn`).toBeGreaterThan(0);
      for (const q of queryFns) {
        expect(q, `${f}: ${q.trim()} se ejecuta sin comprobar el tenant`).toMatch(
          // `tenantId ? …` o `tenantId && algo ? …`: lo que se exige es que el
          // tenant esté en la condición, no cuántas condiciones haya.
          /tenantId\s*(?:&&[^?]*)?\?/,
        );
      }
      expect(
        (src.match(/skipToken/g) ?? []).length,
        `${f}: ${queryFns.length} queryFn y menos skipToken que queryFn`,
      ).toBeGreaterThanOrEqual(queryFns.length);
    }
  });

  it("el tenant forma parte de toda queryKey de consulta", () => {
    for (const f of HOOKS) {
      const src = read(f);
      // Sólo las claves de LECTURA (las que van seguidas de su `queryFn`). Las
      // de `invalidateQueries` son prefijos a propósito: invalidan de más, que
      // es la dirección segura, y exigirles el tenant las haría más estrechas.
      const keys = (src.match(/queryKey:\s*\[[^\]]*\],\s*\n\s*queryFn:/g) ?? []).map((m) =>
        m.slice(0, m.indexOf("]") + 1),
      );
      expect(keys.length, `${f} no declara queryKey de consulta`).toBeGreaterThan(0);
      for (const k of keys) {
        expect(k, `${f}: ${k} no lleva tenantId`).toMatch(/tenantId/);
      }
    }
  });

  it("toda lectura y actualización filtra por tenant_id", () => {
    // Un `.eq()` detrás de un `.insert()` no filtra nada: en el alta el
    // aislamiento va en el payload, así que esas llamadas se cuentan aparte.
    for (const f of HOOKS) {
      const src = read(f);
      const accesos = (src.match(/\.from\(/g) ?? []).length;
      const altas = (src.match(/\.insert\(/g) ?? []).length;
      const filtros = (src.match(/\.eq\("(?:[a-z_]+\.)?tenant_id", tenantId!?\)/g) ?? []).length;
      expect(
        filtros,
        `${f}: ${accesos} accesos (${altas} altas) y solo ${filtros} filtros por tenant_id`,
      ).toBeGreaterThanOrEqual(accesos - altas);
    }
  });

  it("toda alta escribe el tenant del contexto en el payload", () => {
    for (const f of HOOKS) {
      // Excluido con motivo, no por olvido: la tabla no tiene la columna.
      if (SCOPING_POR_JOIN.has(f)) continue;
      const src = read(f);
      const altas = (src.match(/\.insert\(/g) ?? []).length;
      if (altas === 0) continue;
      expect(
        (src.match(/tenant_id: tenantId!?\s*[,}\n]/g) ?? []).length,
        `${f}: ${altas} altas sin tenant_id del contexto en el payload`,
      ).toBeGreaterThanOrEqual(altas);
    }
  });

  it("los errores se propagan en vez de devolver vacío en silencio", () => {
    // Un `console.warn` + `return []` convierte un fallo de RLS o una tabla
    // ausente en "no hay datos": la pantalla queda vacía y nadie se entera.
    for (const f of HOOKS) {
      const src = read(f);
      expect(
        /console\.(warn|log)\([^)]*(fallback|notice)/.test(src),
        `${f} sigue tragándose el error con console.warn`,
      ).toBe(false);
      expect(
        /if \(error\) throw error/.test(src),
        `${f} no propaga el error`,
      ).toBe(true);
    }
  });
});
