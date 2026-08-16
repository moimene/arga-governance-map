// G4 Task 2 gate: el catálogo normativo es la única fuente de verdad del
// seed. Test puro sobre el JSON, sin red — patrón entities-catalog de G1.
import { describe, expect, it } from "vitest";
import {
  NORMATIVO_CATALOG as catalogo,
  type NormativoEntry as Entry,
} from "../../../scripts/garrigues/normativo/catalogo-normativo";

describe("G4 Task 2 — catálogo normativo Garrigues", () => {
  it("tiene 39 documentos", () => {
    expect(catalogo).toHaveLength(39);
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

  it("incluye los 7 documentos del núcleo", () => {
    const codes = catalogo.map((e: Entry) => e.policy_code);
    for (const c of ["CE-2023", "PPD-01", "PPD-02", "PBC-FT-10", "PPD-CAT", "CCS", "LGTBI-01"]) {
      expect(codes).toContain(c);
    }
  });

  it("todo normative_tier es un valor admitido por el CHECK", () => {
    const ok = ["POLITICA", "NORMA", "PROCEDIMIENTO", "DOCUMENTO"];
    for (const e of catalogo as Entry[]) expect(ok).toContain(e.normative_tier);
  });

  // "Citado, no incorporado" afirma en pantalla que el despacho no aportó el
  // documento. Solo puede decirse de los dos que de verdad faltan de la
  // carpeta; ambos constan citados en fuente (el Código Ético remite al Código
  // de Conducta del Socio como régimen disciplinario de los socios, y PPD-01
  // §3 identifica el Modelo Organizativo como documento independiente).
  it("solo PPD-02 y el Código de Conducta del Socio van etiquetados como no incorporados", () => {
    const citados = (catalogo as Entry[]).filter((e) => e.provenance === "CITADO_NO_INCORPORADO");
    expect(citados.map((e) => e.policy_code).sort()).toEqual(["CCS", "PPD-02"]);
    for (const e of citados) {
      expect(e.summary, `${e.policy_code} no puede traer objeto`).toBeNull();
      expect(e.content_outline).toEqual([]);
      expect(e.source_file).toBeNull();
    }
  });

  // Regresión: PPD-01 y PPD-CAT se etiquetaron como "no incorporados" TENIENDO
  // su texto en la carpeta, en `.md`. PPD-01 es además el manual del que
  // salen varias atribuciones de ownership de esta fase.
  it("PPD-01 y PPD-CAT se extraen de su fuente real, que está en la carpeta", () => {
    const ppd01 = (catalogo as Entry[]).find((e) => e.policy_code === "PPD-01");
    expect(ppd01?.provenance).toBe("PDF_EXTRAIDO");
    expect(ppd01?.source_file).toMatch(/\.md$/);
    expect(ppd01?.edicion).toBe("Edición 03, mayo 2018");
    expect(ppd01?.content_outline.length).toBeGreaterThan(15);

    const cat = (catalogo as Entry[]).find((e) => e.policy_code === "PPD-CAT");
    expect(cat?.provenance).toBe("PDF_EXTRAIDO");
    expect(cat?.summary).toBeTruthy();
  });

  it("todo lo extraído de una fuente trae objeto", () => {
    const extraidos = (catalogo as Entry[]).filter((e) => e.provenance === "PDF_EXTRAIDO");
    expect(extraidos.length).toBeGreaterThanOrEqual(30);
    for (const e of extraidos) expect(e.summary, `${e.policy_code} sin objeto`).toBeTruthy();
  });

  // Índice sí, salvo donde el documento no tiene ninguno: PPD-CAT es un
  // volcado de una página de SharePoint sin apartados numerados. Fabricarle
  // uno sería inventar; la excepción va nombrada para que no se amplíe sola.
  it("todo lo extraído trae índice, salvo PPD-CAT que no tiene", () => {
    const sinIndice = (catalogo as Entry[])
      .filter((e) => e.provenance === "PDF_EXTRAIDO" && e.content_outline.length === 0)
      .map((e) => e.policy_code);
    expect(sinIndice).toEqual(["PPD-CAT"]);
  });

  // El extractor truncaba el índice en 40 entradas y la pantalla lo presentaba
  // completo bajo el rótulo "Índice del documento". Se perdían el §8 entero
  // del Manual PBC/FT (medidas de control interno, representante ante el
  // SEPBLAC, CACI, experto externo) y el capítulo VI del Código Ético (Canal
  // Interno de Información). Se ancla la ÚLTIMA entrada de cada uno: es lo que
  // prueba que el índice llega al final del documento y no a un tope.
  it("el índice llega al final del documento, sin tope artificial", () => {
    const last = (code: string) => {
      const e = (catalogo as Entry[]).find((x) => x.policy_code === code)!;
      return e.content_outline[e.content_outline.length - 1];
    };
    expect(last("PBC-FT-10")).toBe("12. Anexos");
    expect(last("CE-2023")).toBe("Artículo 44.- Actualización");

    const pbc = (catalogo as Entry[]).find((e) => e.policy_code === "PBC-FT-10")!;
    expect(pbc.content_outline).toContain("8.1.3 Comité de Análisis y Control Interno (CACI)");
    expect(pbc.content_outline).toContain("8.4 Examen de experto externo");
    const ce = (catalogo as Entry[]).find((e) => e.policy_code === "CE-2023")!;
    expect(ce.content_outline).toContain("VI. Canal Interno de Información");
  });

  // Un índice que salta de página trae la cabecera/pie de hoja EN MEDIO, y se
  // fundía en el título de la entrada anterior.
  it("ninguna entrada de índice arrastra la cabecera de página", () => {
    for (const e of catalogo as Entry[]) {
      for (const item of e.content_outline) {
        expect(item, `${e.policy_code}: entrada con cabecera de página pegada`).not.toMatch(/Sistema normativo interno-|Edición \d+, [a-z]+ \d{4}/);
      }
    }
  });

  // Las erratas del documento fuente se reproducen fielmente, pero anotadas:
  // ni se corrigen en silencio (falsearía la cita) ni se dejan desnudas.
  it("la fecha errónea de la Ley 10/2010 en PBC-FT-10 va marcada como errata de la fuente", () => {
    const pbc = (catalogo as Entry[]).find((e) => e.policy_code === "PBC-FT-10")!;
    expect(pbc.summary).toContain("18 [sic en el documento fuente: la Ley 10/2010 es de 28 de abril] de abril");
  });

  it("effective_date, cuando existe, es ISO y coherente con la edición", () => {
    for (const e of catalogo as Entry[]) {
      if (!e.effective_date) continue;
      expect(e.effective_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.edicion).toBeTruthy();
    }
  });
});
