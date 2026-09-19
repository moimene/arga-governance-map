// src/test/aims/evaluacion-enlaces-arista.test.ts
//
// M01 (F1.T14) — la arista, no el rótulo.
//
// El criterio vive en dos hojas: `checksDeLaEvaluacion` (evaluacion-payload.ts)
// decide QUÉ se escribe —sistema y evaluación, nunca la autoría, que resuelve el
// servidor (enmienda E-01)— y `checksVigentes` decide CUÁL manda, para lo que
// necesita saber de qué evaluación sale cada comprobación. Probar las hojas no
// basta: si el alta deja de pasar por la primera, o una lectura deja de embeber
// la evaluación, la segunda vuelve en silencio al «manda la más reciente» y un
// borrador vuelve a tapar a una evaluación revisada.
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));
const ALTA = "src/hooks/useAiAssessments.ts";
const WIZARD = "src/pages/ai-governance/EvaluacionNueva.tsx";

/**
 * Todo el código de la aplicación, no solo `src/hooks`: una lectura nueva en un
 * componente o en `src/lib` también tiene que embeber la evaluación. Fuera los
 * tests, que escriben a propósito lo que la aplicación no debe.
 */
const FUENTES = (readdirSync("src", { recursive: true }) as string[])
  .map((f) => `src/${f}`)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/(\/test\/|__tests__|\.test\.)/.test(f));

/** Toda mención de la tabla en un `.from(…)`, con cualquier comilla. */
const FROM_CHECKS = /\.from\((["'`])ai_compliance_checks\1\)/g;

/** Cada `.from(<tabla>)` con lo que le sigue hasta el cierre de la llamada encadenada. */
function accesos(src: string): string[] {
  return [
    ...src.matchAll(/\.from\((["'`])ai_compliance_checks\1\)\s*\.(select|insert|update|upsert)\(([^;]*?)\)\s*[.;\n]/g),
  ].map((m) => `${m[2]}(${m[3]})`);
}

/** Cada acceso, por fichero. Falla si hay un `.from(<tabla>)` que `accesos` no sabe leer: universo cerrado. */
function accesosDe(ficheros: string[]): { fichero: string; acceso: string }[] {
  return ficheros.flatMap((f) => {
    const src = leer(f);
    const menciones = (src.match(FROM_CHECKS) ?? []).length;
    const leidos = accesos(src);
    expect(leidos.length, `${f}: ${menciones} accesos a ai_compliance_checks y el gate solo sabe leer ${leidos.length}`).toBe(menciones);
    return leidos.map((acceso) => ({ fichero: f, acceso }));
  });
}

describe("M01 — el instrumento", () => {
  it("control positivo: el patrón ve las tres comillas y el universo incluye el alta y el Board Pack", () => {
    for (const q of [`"`, `'`, "`"]) {
      const muestra = `supabase\n  .from(${q}ai_compliance_checks${q})\n  .select(${q}id${q})\n`;
      expect((muestra.match(FROM_CHECKS) ?? []).length, `comilla ${q}`).toBe(1);
      expect(accesos(muestra), `comilla ${q}`).toEqual([`select(${q}id${q})`]);
    }
    expect(FUENTES).toContain(ALTA);
    expect(FUENTES).toContain("src/hooks/useBoardPackData.ts");
    expect(FUENTES.some((f) => /\.test\./.test(f)), "los tests no forman parte del universo").toBe(false);
  });
});

describe("M01 — el alta de comprobaciones pasa por el constructor del enlace", () => {
  it("toda escritura de ai_compliance_checks en src/ recibe checksDeLaEvaluacion(…)", () => {
    const escrituras = accesosDe(FUENTES).map((a) => a.acceso).filter((a) => !a.startsWith("select"));
    // Universo cerrado: si el alta desapareciera o cambiara de forma, el bucle
    // de abajo asertaría sobre nada.
    expect(escrituras.length, "no se encuentra ninguna escritura de ai_compliance_checks").toBeGreaterThan(0);
    for (const e of escrituras) {
      expect(e, `escritura que no pasa por el constructor: ${e}`).toMatch(/^insert\(checksDeLaEvaluacion\(/);
    }
  });

  it("el hook importa la hoja, no la reimplementa", () => {
    const src = leer(ALTA);
    expect(src).toMatch(/import \{[^}]*\bchecksDeLaEvaluacion\b[^}]*\} from "@\/lib\/aims\/evaluacion-payload"/);
    // La declaración de tipo (`assessment_id: string | null`) no cuenta; un
    // valor asignado a mano, sí.
    expect(src, "el hook vuelve a enlazar a mano").not.toMatch(/\bassessment_id:\s*(?!string\b)\w/);
  });

  it("el wizard pasa la evaluación que acaba de cerrar, no otra", () => {
    const src = leer(WIZARD);
    expect(src).toMatch(/createChecks\.mutateAsync\(\{[^}]*assessmentId:\s*createdAssessment\.id/);
    // Control positivo: la evaluación cerrada existe en el mismo manejador.
    expect(src).toMatch(/const createdAssessment = await saveAssessment\.mutateAsync/);
  });
});

describe("M01 — toda lectura embebe la evaluación para que checksVigentes pueda aplicarse", () => {
  it("cada select de ai_compliance_checks en src/ trae ai_risk_assessments!assessment_id(status, reviewed_at)", () => {
    // `reviewed_at` no lo lee `checksVigentes` (su criterio es «cerrada»): viaja
    // para F1.T4, `legado.ts`, que acredita solo lo congelado y revisado.
    const lecturas = accesosDe(FUENTES)
      .filter((a) => a.acceso.startsWith("select("))
      .map((a) => `${a.fichero}: ${a.acceso}`);
    // Dos en useAiAssessments y una en el Board Pack, a 2026-09-19: si una deja
    // de encontrarse, la regla dejaría de vigilarla sin avisar.
    expect(lecturas.length, lecturas.join("\n")).toBeGreaterThanOrEqual(3);
    for (const l of lecturas) {
      expect(l, `lectura sin la evaluación embebida — un borrador vuelve a tapar a una cerrada: ${l}`).toMatch(
        /evaluacion:ai_risk_assessments!assessment_id\(status, reviewed_at\)/,
      );
    }
  });
});

describe("M01 — el error de una lectura se propaga, no se traga como 0", () => {
  // La lectura depende de la relación ai_risk_assessments!assessment_id: sin
  // M01 aplicada, o con la caché de esquema de PostgREST sin recargar, falla.
  // Tragarse ese error pintaba 0 no conformidades en el Board Pack (regla del
  // read model: un error es «no medido», nunca 0).
  const DESESTRUCTURA = /const \{([^}]*)\} = [^;]*?\.from\((["'`])ai_compliance_checks\2\)/g;

  it("cada acceso desestructura el error y lo lanza", () => {
    let vistos = 0;
    for (const f of FUENTES) {
      const src = leer(f);
      const menciones = (src.match(FROM_CHECKS) ?? []).length;
      const asignaciones = [...src.matchAll(DESESTRUCTURA)];
      expect(asignaciones.length, `${f}: ${menciones} accesos y ${asignaciones.length} desestructurados`).toBe(menciones);
      for (const [, campos] of asignaciones) {
        const err = campos.match(/\berror\b(?:\s*:\s*(\w+))?/);
        expect(err, `${f}: acceso que no recoge el error: {${campos}}`).not.toBeNull();
        const nombre = err![1] ?? "error";
        expect(src, `${f}: el error «${nombre}» no se lanza`).toMatch(new RegExp(`if \\(${nombre}\\) throw ${nombre}\\b`));
        vistos += 1;
      }
    }
    // Dos lecturas y un alta en useAiAssessments y la lectura del Board Pack.
    expect(vistos, "el gate no ve los accesos que debe vigilar").toBeGreaterThanOrEqual(4);
  });

  it("control positivo: el patrón caza el Board Pack de antes, que se tragaba el error", () => {
    const antes = `const { data: checks } = systemIds.length\n  ? await supabase\n      .from("ai_compliance_checks")\n      .select("id")`;
    const [m] = [...antes.matchAll(DESESTRUCTURA)];
    expect(m, "el patrón no reconoce la asignación").toBeDefined();
    expect(m[1].match(/\berror\b/)).toBeNull();
  });
});
