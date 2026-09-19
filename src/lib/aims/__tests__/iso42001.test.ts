import { describe, expect, it } from "bun:test";
import { ISO_42001_REQUIREMENTS, VERSION_CATALOGO_RIA } from "../catalog-aesia";
import { procedenciaDe } from "../perfil-aplicabilidad";

/**
 * Catálogo complementario ISO/IEC 42001 (F1.T13, 2026-09-19).
 *
 * El anexo A se pintaba con la numeración desplazada: «Políticas (A.5)»,
 * «Organización interna (A.6)», «Evaluación de impacto (A.8)» y «Ciclo de vida
 * (A.9)», cuando en la norma son A.2, A.3, A.5 y A.6. Y cubría 4 de los 9
 * objetivos de control. Ahora están los 9 (A.2 a A.10) más la planificación de
 * riesgos e impacto de la cláusula 6.1 (6.1.2, 6.1.3 y 6.1.4).
 *
 * Todo el catálogo es MARCO_OPERATIVO: ISO/IEC 42001 no es una obligación
 * jurídica autónoma. Se comprueba en la ARISTA que pinta la pantalla
 * (`procedenciaDe`, que usan el paso de medidas y el informe), no sólo en el dato.
 */
const OBJETIVOS = ["A.2", "A.3", "A.4", "A.5", "A.6", "A.7", "A.8", "A.9", "A.10"];

describe("ISO/IEC 42001 — anexo A renumerado y completo", () => {
  it("los 9 objetivos de control del anexo A, cada uno una vez", () => {
    const refs = ISO_42001_REQUIREMENTS.map((r) => r.articleRef.replace(/^ISO 42001 /, ""));
    for (const o of OBJETIVOS) expect(refs.filter((x) => x === o).length, `${o}`).toBe(1);
  });

  it("la cláusula 6.1 con la evaluación y el tratamiento de riesgos y la evaluación de impacto", () => {
    const planificacion = ISO_42001_REQUIREMENTS.find((r) => r.articleRef === "ISO 42001 6.1");
    expect(planificacion).toBeDefined();
    for (const c of ["6.1.2", "6.1.3", "6.1.4"]) {
      expect(planificacion.measures.some((m) => m.subpartId === c), `${c} sin medida`).toBe(true);
    }
  });

  it("los requisitos que ya existían conservan su código y pasan a su número real", () => {
    const por = Object.fromEntries(ISO_42001_REQUIREMENTS.map((r) => [r.code, r]));
    expect(por.ISO_POLICIES.articleRef).toBe("ISO 42001 A.2");
    expect(por.ISO_ORG_ROLES.articleRef).toBe("ISO 42001 A.3");
    expect(por.ISO_IMPACT_ASSESS.articleRef).toBe("ISO 42001 A.5");
    expect(por.ISO_LIFECYCLE.articleRef).toBe("ISO 42001 A.6");
    // El título visible lleva el número real, no el desplazado.
    expect(por.ISO_POLICIES.title).toContain("(A.2)");
    expect(por.ISO_LIFECYCLE.title).toContain("(A.6)");
    // Los ocho códigos de medida anteriores siguen en su requisito.
    const donde = new Map(ISO_42001_REQUIREMENTS.flatMap((r) => r.measures.map((m) => [m.id, r.code] as const)));
    expect([
      donde.get("MG_ISO_POL_01"), donde.get("MG_ISO_POL_02"),
      donde.get("MG_ISO_ORG_01"), donde.get("MG_ISO_ORG_02"),
      donde.get("MG_ISO_IMP_01"), donde.get("MG_ISO_IMP_02"),
      donde.get("MG_ISO_LIF_01"), donde.get("MG_ISO_LIF_02"),
    ]).toEqual([
      "ISO_POLICIES", "ISO_POLICIES", "ISO_ORG_ROLES", "ISO_ORG_ROLES",
      "ISO_IMPACT_ASSESS", "ISO_IMPACT_ASSESS", "ISO_LIFECYCLE", "ISO_LIFECYCLE",
    ]);
  });

  it("las medidas nuevas declaran la versión en que entran", () => {
    const anteriores = new Set(["MG_ISO_POL_01", "MG_ISO_POL_02", "MG_ISO_ORG_01", "MG_ISO_ORG_02", "MG_ISO_IMP_01", "MG_ISO_IMP_02", "MG_ISO_LIF_01", "MG_ISO_LIF_02"]);
    const medidas = ISO_42001_REQUIREMENTS.flatMap((r) => r.measures);
    expect(medidas.filter((m) => !anteriores.has(m.id)).every((m) => m.desde === VERSION_CATALOGO_RIA)).toBe(true);
    expect(medidas.filter((m) => anteriores.has(m.id)).every((m) => m.desde === undefined)).toBe(true);
  });
});

describe("ISO/IEC 42001 — siempre marco operativo", () => {
  it("cada requisito se declara MARCO_OPERATIVO", () => {
    for (const r of ISO_42001_REQUIREMENTS) expect(r.caracter, r.code).toBe("MARCO_OPERATIVO");
  });

  it("la procedencia que pinta la pantalla dice «marco operativo» para cada medida de ISO", () => {
    const medidas = ISO_42001_REQUIREMENTS.flatMap((r) => r.measures);
    expect(medidas.length).toBeGreaterThan(9);
    for (const m of medidas) {
      const p = procedenciaDe(m.id);
      expect(p, `${m.id} sin procedencia`).not.toBeNull();
      expect(p.fuente).toBe("ISO_42001");
      expect(p.caracter).toBe("MARCO_OPERATIVO");
      expect(p.norma).toMatch(/^ISO\/IEC 42001, /);
    }
    // Control: una medida del RIA no recibe procedencia de ISO.
    expect(procedenciaDe("MG_RISK_01")).toBeNull();
  });

  it("ningún requisito de ISO se presenta como cotejado contra el texto de la norma", () => {
    // La norma no se ha tenido delante: se cotejó la numeración, no el texto.
    expect(ISO_42001_REQUIREMENTS.length).toBeGreaterThan(0);
    for (const r of ISO_42001_REQUIREMENTS) expect(r.verificadoEl ?? null, r.code).toBeNull();
  });
});
