import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/TramitadorLista.tsx"),
  "utf8",
);

describe("Tramitador registral — contrato visible previo a nuevos escritores", () => {
  it("mantiene vistas exactas para ELEVADA y DENEGADA", () => {
    expect(source).toContain('elevadas: { label: "Elevadas", estado: "ELEVADA" }');
    expect(source).toContain('denegadas: { label: "Denegadas", estado: "DENEGADA" }');
    expect(source).toContain('ELEVADA: "elevadas"');
    expect(source).toContain('DENEGADA: "denegadas"');
    expect(source).toContain('requestedEstado ? null : "todas"');
    expect(source).toContain("Filtro de estado no reconocido");
  });

  it("presenta el expediente como multisoporte sin prometer un único título", () => {
    expect(source).toContain("escritura, instancia o certificación");
    expect(source).not.toContain("Elevación a público, presentación en BORME");
  });
});
