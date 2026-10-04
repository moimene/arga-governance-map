// scripts/aims/harvey/__tests__/enviar-lote.test.ts — MOI-169.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { construirPrompt, ENCABEZADO_COMUN, extraerPuntos, RUTA_SPEC, RUTA_VERIFICACION, textoArt213 } from "../enviar-lote";

const SPEC_FIJA = [
  "**H-99 — Caso fijo**",
  "- Tarea: x",
  "- Prompt:",
  "  > P1. Primer punto.",
  "  > P2. Segundo punto.",
  "- Qué se hace: nada",
  "",
  "**H-98 — Otro**",
  "- Prompt: «Una sola pregunta».",
].join("\n");

describe("enviar-lote", () => {
  it("caso fijo: encabezado + preámbulo + puntos literales, y SHA estable", () => {
    const r = construirPrompt("H-99", SPEC_FIJA.replace("H-99", "H-99"), {});
    expect(r.prompt).toContain(ENCABEZADO_COMUN);
    expect(r.prompt.endsWith("P2. Segundo punto.")).toBe(true);
    expect(r.sha256).toHaveLength(64);
    expect(construirPrompt("H-99", SPEC_FIJA, {}).sha256).toBe(r.sha256);
  });

  it("una pregunta en línea se extrae sin las comillas angulares", () => {
    expect(extraerPuntos(SPEC_FIJA, "H-98")).toEqual(["Una sola pregunta"]);
  });

  it("los lotes reales salen sin huecos y con el literal de art-2-13 en H-02/P10", () => {
    const spec = readFileSync(RUTA_SPEC, "utf8");
    const art213 = textoArt213(readFileSync(RUTA_VERIFICACION, "utf8"));
    const h02 = construirPrompt("H-02", spec, { art213 });
    expect(h02.prompt).toContain(art213);
    expect(h02.prompt).not.toMatch(/\[texto/);
    expect(extraerPuntos(spec, "H-02")).toHaveLength(10);
    expect(extraerPuntos(spec, "H-09")).toHaveLength(4);
    expect(construirPrompt("H-17", spec).prompt).toContain("art. 60.5");
  });

  it("H-14 sin lista de marco operativo falla en vez de enviar un hueco", () => {
    expect(() => construirPrompt("H-14", readFileSync(RUTA_SPEC, "utf8"))).toThrow();
  });
});
