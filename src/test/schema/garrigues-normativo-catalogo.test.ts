// G4 Task 2 gate: el catálogo normativo es la única fuente de verdad del
// seed. Test puro sobre el JSON, sin red — patrón entities-catalog de G1.
import { describe, expect, it } from "vitest";
import {
  NORMATIVO_CATALOG as catalogo,
  type NormativoEntry as Entry,
} from "../../../scripts/garrigues/normativo/catalogo-normativo";

describe("G4 Task 2 — catálogo normativo Garrigues", () => {
  it("tiene 38 documentos", () => {
    expect(catalogo).toHaveLength(38);
  });

  it("incluye las 32 PI numeradas PI-01..PI-32 sin huecos", () => {
    const pis = catalogo
      .filter((e: Entry) => e.policy_code.startsWith("PI-"))
      .map((e: Entry) => e.policy_code)
      .sort();
    expect(pis).toHaveLength(32);
    for (let n = 1; n <= 32; n++) {
      expect(pis).toContain(`PI-${String(n).padStart(2, "0")}`);
    }
  });

  it("los códigos son únicos", () => {
    const codes = catalogo.map((e: Entry) => e.policy_code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("incluye los 6 documentos del núcleo", () => {
    const codes = catalogo.map((e: Entry) => e.policy_code);
    for (const c of ["CE-2023", "PPD-01", "PPD-02", "PBC-FT-10", "PPD-CAT", "LGTBI-01"]) {
      expect(codes).toContain(c);
    }
  });

  it("todo normative_tier es un valor admitido por el CHECK", () => {
    const ok = ["POLITICA", "NORMA", "PROCEDIMIENTO", "DOCUMENTO"];
    for (const e of catalogo as Entry[]) expect(ok).toContain(e.normative_tier);
  });

  it("PPD-02 y el Código de Conducta del Socio van etiquetados como no incorporados", () => {
    const ppd02 = (catalogo as Entry[]).find((e) => e.policy_code === "PPD-02");
    expect(ppd02?.provenance).toBe("CITADO_NO_INCORPORADO");
    expect(ppd02?.summary).toBeNull();
  });

  it("todo lo extraído de PDF trae objeto e índice no vacíos", () => {
    const extraidos = (catalogo as Entry[]).filter((e) => e.provenance === "PDF_EXTRAIDO");
    expect(extraidos.length).toBeGreaterThanOrEqual(30);
    for (const e of extraidos) {
      expect(e.summary, `${e.policy_code} sin objeto`).toBeTruthy();
      expect(e.content_outline.length, `${e.policy_code} sin índice`).toBeGreaterThan(0);
    }
  });

  it("effective_date, cuando existe, es ISO y coherente con la edición", () => {
    for (const e of catalogo as Entry[]) {
      if (!e.effective_date) continue;
      expect(e.effective_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.edicion).toBeTruthy();
    }
  });
});
