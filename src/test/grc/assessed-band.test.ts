import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ORDEN_BANDAS, ETIQUETA_BANDA, tieneEjes } from "@/lib/grc/assessed-band";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("G5 — bandas evaluadas", () => {
  it("el orden va de mayor a menor y los dos verdes están colapsados", () => {
    expect(ORDEN_BANDAS).toEqual(["ROJO", "NARANJA", "AMARILLO", "VERDE", "NO_EVALUADA"]);
  });

  it("ninguna etiqueta nombra un nivel que la fuente no publica", () => {
    const prohibidas = ["crítico", "critico", "alto", "medio", "bajo", "grave", "leve"];
    for (const t of Object.values(ETIQUETA_BANDA))
      for (const p of prohibidas)
        expect(t.toLowerCase(), `la etiqueta "${t}" nombra un nivel inventado`).not.toContain(p);
  });

  it("tieneEjes distingue el riesgo clásico del evaluado por banda", () => {
    expect(tieneEjes({ probability: 3, impact: 4 })).toBe(true);
    expect(tieneEjes({ probability: null, impact: null })).toBe(false);
    expect(tieneEjes({ probability: 3, impact: null })).toBe(false);
  });
});

describe("G5 — Risk 360 no inventa ejes", () => {
  const src = read("src/pages/grc/Risk360.tsx");

  it("ya no hay defaults que rellenen probability/impact con 1", () => {
    expect(src).not.toMatch(/probability\s*\?\?\s*1/);
    expect(src).not.toMatch(/impact\s*\?\?\s*1/);
  });

  it("la rama se decide por forma del dato, nunca por tenant", () => {
    expect(src).toContain("tieneEjes");
    expect(src).not.toMatch(/tenant_?[Ii]d\s*===/);
  });
});

describe("G5 — el editor no ofrece ejes que la fuente no publica", () => {
  const src = read("src/pages/grc/RiskEditor.tsx");

  it("ya no pre-rellena probability/impact con un 3 inventado", () => {
    expect(src).not.toMatch(/probability\s*\?\?\s*3/);
    expect(src).not.toMatch(/impact\s*\?\?\s*3/);
  });

  it("decide por la banda si los ejes se ofrecen", () => {
    expect(src).toContain("assessed_band");
    expect(src).toMatch(/assessed_band\s*(\?|&&|==|!=)/);
  });
});

describe("G5 — el detalle del riesgo lee el desglose, no solo la banda", () => {
  const src = read("src/pages/grc/RiskDetalle.tsx");

  it("consume assessment_breakdown con un guard vivo", () => {
    expect(src).toMatch(/assessment_breakdown\s*(\?|&&|\))/);
  });

  it("pinta las dos familias de columnas del mapa", () => {
    expect(src).toContain("areas_negocio");
    expect(src).toContain("departamentos_internos");
  });

  it("marca las celdas sin evaluar en vez de pintarlas como un nivel", () => {
    expect(src).toContain("NO_EVALUADA");
  });

  it("declara la limitación de la escala", () => {
    expect(src).toContain("NOTA_ESCALA");
  });
});
