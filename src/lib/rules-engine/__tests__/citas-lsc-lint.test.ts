import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ITEM-011/018/053 — lint jurídico de citas (loop estabilización 2026-06-11).
// Los explain nodes citaban artículos INEXISTENTES de la LSC (arts. 625 y 629;
// el texto consolidado RDLeg 1/2010 termina en el art. 541) además de 15+
// referencias equivocadas. Este test impide que vuelva a colarse una cita a un
// artículo de la LSC que no existe. (No valida que el artículo sea el
// CORRECTO para el contexto — eso es revisión legal — solo que exista.)
const LSC_MAX_ARTICLE = 541;
const ENGINE_DIR = join(process.cwd(), "src/lib/rules-engine");

function engineSourceFiles(): string[] {
  return readdirSync(ENGINE_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(ENGINE_DIR, f));
}

describe("Lint jurídico — citas a la LSC en el motor de reglas", () => {
  it(`ninguna cita 'art. N LSC' supera el art. ${LSC_MAX_ARTICLE} (último de la LSC)`, () => {
    const offenders: string[] = [];
    for (const file of engineSourceFiles()) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, idx) => {
        if (!/LSC/.test(line)) return;
        // Captura todos los números de artículo de la línea (arts. 196-197, art. 248.2...)
        const matches = line.matchAll(/art(?:s)?\.?\s*([\d]{1,4})(?:[.\-–]\d+)*/gi);
        for (const m of matches) {
          const n = Number(m[1]);
          if (Number.isFinite(n) && n > LSC_MAX_ARTICLE) {
            offenders.push(`${file.split("/").pop()}:${idx + 1} → "${line.trim().slice(0, 110)}"`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
