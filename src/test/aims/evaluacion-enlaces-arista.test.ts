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
const HOOKS = readdirSync("src/hooks").filter((f) => /\.ts$/.test(f)).map((f) => `src/hooks/${f}`);
const ALTA = "src/hooks/useAiAssessments.ts";
const WIZARD = "src/pages/ai-governance/EvaluacionNueva.tsx";

/** Cada `.from("ai_compliance_checks")` con lo que le sigue hasta el cierre de la llamada encadenada. */
function accesos(src: string): string[] {
  return [...src.matchAll(/\.from\("ai_compliance_checks"\)\s*\.(select|insert|update|upsert)\(([^;]*?)\)\s*[.;\n]/g)].map(
    (m) => `${m[1]}(${m[2]})`,
  );
}

describe("M01 — el alta de comprobaciones pasa por el constructor del enlace", () => {
  it("toda escritura de ai_compliance_checks en src/hooks recibe checksDeLaEvaluacion(…)", () => {
    const escrituras = HOOKS.flatMap((f) => accesos(leer(f))).filter((a) => !a.startsWith("select"));
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
  it("cada select de ai_compliance_checks en src/hooks trae ai_risk_assessments!assessment_id(status, reviewed_at)", () => {
    const lecturas = HOOKS.flatMap((f) => accesos(leer(f)).map((a) => `${f}: ${a}`)).filter((a) => a.includes(": select("));
    // Dos en useAiAssessments y una en el Board Pack, a 2026-09-19: si una deja
    // de encontrarse, la regla dejaría de vigilarla sin avisar.
    expect(lecturas.length, lecturas.join("\n")).toBeGreaterThanOrEqual(3);
    for (const l of lecturas) {
      expect(l, `lectura sin la evaluación embebida — un borrador vuelve a tapar a una revisada: ${l}`).toMatch(
        /evaluacion:ai_risk_assessments!assessment_id\(status, reviewed_at\)/,
      );
    }
  });
});
