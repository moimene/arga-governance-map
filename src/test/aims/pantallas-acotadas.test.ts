import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";

/**
 * Invariante §2.3 del refactor AIMS (2026-09-08): ninguna pantalla ni componente
 * del módulo por encima de 400 líneas.
 *
 * POR QUÉ. Con tres pantallas de más de mil líneas, una corrección llegaba a
 * una y sus hermanas seguían pintando lo contrario: el criterio vivía dentro
 * del JSX. El techo obliga a que el criterio se quede en `src/lib/aims/` y la
 * pantalla sólo pinte. Es un gate de tamaño, no de calidad — pero un fichero
 * que crece por encima del techo es la señal temprana de que el criterio ha
 * vuelto a entrar en la pantalla.
 *
 * Aplica también a los componentes: mover el problema de `pages/` a
 * `components/` no lo resuelve.
 */
const TECHO = 400;

function tsx(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = `${dir}/${e}`;
    if (statSync(p).isDirectory()) out.push(...tsx(p));
    else if (/\.tsx$/.test(e)) out.push(p);
  }
  return out;
}

const lineas = (f: string) => readFileSync(f, "utf8").split("\n").length;

describe("§2.3 — ninguna pantalla ni componente AIMS por encima de 400 líneas", () => {
  const paginas = tsx("src/pages/ai-governance");
  const componentes = tsx("src/components/ai-governance");

  it("el barrido encuentra las páginas y los componentes (control positivo)", () => {
    // Sin esto, un `readdir` sobre otro cwd dejaría los bucles vacíos y verdes.
    expect(paginas.length).toBeGreaterThanOrEqual(10);
    expect(componentes.length).toBeGreaterThanOrEqual(20);
    expect(paginas).toContain("src/pages/ai-governance/SistemaDetalle.tsx");
  });

  it("páginas ≤ 400 líneas", () => {
    const exceso = paginas.map((f) => [f, lineas(f)] as const).filter(([, n]) => n > TECHO);
    expect(exceso, `páginas por encima del techo: ${exceso.map(([f, n]) => `${f} (${n})`).join(", ")}`).toEqual([]);
  });

  it("componentes ≤ 400 líneas", () => {
    const exceso = componentes.map((f) => [f, lineas(f)] as const).filter(([, n]) => n > TECHO);
    expect(exceso, `componentes por encima del techo: ${exceso.map(([f, n]) => `${f} (${n})`).join(", ")}`).toEqual([]);
  });

  it("el criterio no vive en las pantallas: quien toca un catálogo lo pasa por perfilAplicable o catalogoDeLosFindings", () => {
    // Elegir el catálogo (84 vs 43) es criterio de `perfil-aplicabilidad`. Una
    // página puede importar los catálogos —para pasárselos al criterio— pero no
    // puede decidir con ellos por su cuenta: si los importa, tiene que llamar
    // al criterio.
    for (const f of paginas) {
      const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
      const tocaCatalogo = /\b(AESIA_RIA_REQUIREMENTS|DESPLIEGUE_REQUIREMENTS|ISO_42001_REQUIREMENTS|getRequirementsForFramework)\b/.test(src);
      if (!tocaCatalogo) continue;
      expect(
        /\b(perfilAplicable|catalogoDeLosFindings)\(/.test(src),
        `${f} toca un catálogo de medidas sin pasar por el criterio de perfil`,
      ).toBe(true);
    }
    // Control positivo: al menos una página toca el catálogo (si ninguna lo
    // hiciera, el bucle no asertaría nada).
    expect(paginas.some((f) => /AESIA_RIA_REQUIREMENTS/.test(readFileSync(f, "utf8")))).toBe(true);
  });
});
