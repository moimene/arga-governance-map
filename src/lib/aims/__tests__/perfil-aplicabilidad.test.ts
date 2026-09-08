import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  AVISO_COBERTURA_PROVISIONAL,
  DESPLIEGUE_REQUIREMENTS,
  PROCEDENCIA_DESPLIEGUE,
  catalogoDeLosFindings,
  perfilAplicable,
  procedenciaDe,
} from "../perfil-aplicabilidad";
import { AESIA_RIA_REQUIREMENTS, ISO_42001_REQUIREMENTS } from "../catalog-aesia";

/**
 * Las 84 medidas guía desarrollan los arts. 9 a 15, 17, 72 y 73: son las
 * obligaciones del PROVEEDOR de un sistema de alto riesgo. Medir con ellas a un
 * responsable del despliegue de riesgo limitado produce un porcentaje que no
 * dice si cumple, sino que se le ha medido contra deberes que no le vinculan.
 *
 * En el primer piloto real (Harvey, tenant Garrigues) eso dio un 49 %.
 */

const medidasDe = (cat: typeof AESIA_RIA_REQUIREMENTS) =>
  cat.reduce((n, r) => n + r.measures.length, 0);

describe("el catálogo se acota por rol y nivel de riesgo", () => {
  it("un responsable del despliegue de riesgo limitado no se mide con las 84 del proveedor", () => {
    // Control positivo del instrumento: el catálogo de proveedor es el que se
    // dice que es. Sin esto, un perfil que devolviera siempre lo mismo dejaría
    // el resto de aserciones verdes.
    expect(medidasDe(AESIA_RIA_REQUIREMENTS), "el catálogo de proveedor ya no son 84 medidas").toBe(84);

    const perfil = perfilAplicable(
      { regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: "Limitado" },
      AESIA_RIA_REQUIREMENTS,
    );
    expect(perfil.requirements).toBe(DESPLIEGUE_REQUIREMENTS);
    expect(perfil.provisional, "el catálogo del despliegue no se declara provisional").toBe(true);
    expect(medidasDe(perfil.requirements)).toBeLessThan(84);
    expect(medidasDe(perfil.requirements)).toBeGreaterThanOrEqual(30);
  });

  it("sin rol declarado FALLA ABIERTO: catálogo completo y aviso", () => {
    // Medir de más y decirlo es conservador; medir de menos por un dato que
    // falta esconde obligaciones.
    const perfil = perfilAplicable({ regulatory_role: null, risk_level: "Limitado" }, AESIA_RIA_REQUIREMENTS);
    expect(perfil.requirements).toBe(AESIA_RIA_REQUIREMENTS);
    expect(perfil.sinRolDeclarado).toBe(true);
    expect(perfil.motivo).toMatch(/no declara rol/i);
  });

  it("en alto riesgo no se reduce nada, sea cual sea el rol", () => {
    for (const nivel of ["Alto", "Inaceptable"]) {
      const perfil = perfilAplicable(
        { regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: nivel },
        AESIA_RIA_REQUIREMENTS,
      );
      expect(perfil.requirements, `${nivel} se está midiendo con el catálogo reducido`).toBe(
        AESIA_RIA_REQUIREMENTS,
      );
      expect(perfil.provisional).toBe(false);
    }
  });

  it("sin nivel de riesgo tampoco se reduce", () => {
    const perfil = perfilAplicable(
      { regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: "" },
      AESIA_RIA_REQUIREMENTS,
    );
    expect(perfil.requirements).toBe(AESIA_RIA_REQUIREMENTS);
  });

  it("un proveedor de riesgo limitado sigue midiéndose con su catálogo", () => {
    const perfil = perfilAplicable(
      { regulatory_role: "PROVEEDOR", risk_level: "Limitado" },
      AESIA_RIA_REQUIREMENTS,
    );
    expect(perfil.requirements).toBe(AESIA_RIA_REQUIREMENTS);
  });
});

describe("cada medida del perfil dice de dónde sale y con qué carácter", () => {
  it("todas las medidas del catálogo del despliegue tienen procedencia declarada", () => {
    const sinProcedencia = DESPLIEGUE_REQUIREMENTS.flatMap((r) => r.measures)
      .map((m) => m.id)
      .filter((id) => !procedenciaDe(id));
    expect(sinProcedencia, `medidas sin procedencia: ${sinProcedencia.join(", ")}`).toEqual([]);
  });

  it("no sobra procedencia de medidas que no existen", () => {
    const codigos = new Set(DESPLIEGUE_REQUIREMENTS.flatMap((r) => r.measures.map((m) => m.id)));
    const huerfanas = Object.keys(PROCEDENCIA_DESPLIEGUE).filter((id) => !codigos.has(id));
    expect(huerfanas, `procedencia huérfana: ${huerfanas.join(", ")}`).toEqual([]);
  });

  it("ningún control de ISO 42001 se presenta como obligación jurídica", () => {
    // La validación regulatoria lo dice expresamente: ISO/IEC 42001 y las guías
    // de la AESIA valen como marco operativo de madurez y documentación, pero
    // las obligaciones ejecutables se anclan en el RIA, el RGPD y el derecho
    // aplicable. Presentar un control del anexo A como deber jurídico sería
    // fabricar una obligación que la norma no impone.
    const isoComoObligacion = Object.entries(PROCEDENCIA_DESPLIEGUE)
      .filter(([, p]) => p.fuente === "ISO_42001" && p.caracter === "OBLIGACION")
      .map(([id]) => id);
    expect(isoComoObligacion, `ISO presentada como obligación: ${isoComoObligacion.join(", ")}`).toEqual([]);

    // Y lo mismo con la deontología profesional, que no es norma exigible por
    // el Reglamento.
    const deontologiaComoObligacion = Object.entries(PROCEDENCIA_DESPLIEGUE)
      .filter(([, p]) => p.fuente === "DEONTOLOGIA" && p.caracter === "OBLIGACION")
      .map(([id]) => id);
    expect(deontologiaComoObligacion).toEqual([]);
  });

  it("el art. 26 no se presenta como obligación en riesgo limitado", () => {
    // El art. 26 vincula al responsable del despliegue de un sistema de ALTO
    // riesgo. El catálogo del perfil es el de riesgo limitado.
    const art26 = Object.entries(PROCEDENCIA_DESPLIEGUE).filter(([, p]) => p.norma.startsWith("Art. 26"));
    expect(art26.length, "ya no hay medidas del art. 26: revisa este invariante").toBeGreaterThan(0);
    expect(art26.every(([, p]) => p.caracter === "MARCO_OPERATIVO")).toBe(true);
  });

  it("el art. 4 sí es obligación: vincula a proveedores y a responsables del despliegue", () => {
    const art4 = Object.entries(PROCEDENCIA_DESPLIEGUE).filter(([, p]) => p.norma === "Art. 4");
    expect(art4.length).toBeGreaterThan(0);
    expect(art4.every(([, p]) => p.caracter === "OBLIGACION")).toBe(true);
  });

  it("los códigos no colisionan con los del catálogo del proveedor", () => {
    // Si colisionaran, `catalogoDeLosFindings` no podría distinguir con cuál se
    // evaluó una fila ya guardada.
    const proveedor = new Set(AESIA_RIA_REQUIREMENTS.flatMap((r) => r.measures.map((m) => m.id)));
    const choques = DESPLIEGUE_REQUIREMENTS.flatMap((r) => r.measures.map((m) => m.id)).filter((id) =>
      proveedor.has(id),
    );
    expect(choques).toEqual([]);
  });
});

describe("el informe resuelve el catálogo por el dato, no por la columna", () => {
  it("una evaluación del despliegue se pinta con su catálogo", () => {
    const findings = DESPLIEGUE_REQUIREMENTS[0].measures.map((m) => ({ code: m.id }));
    expect(
      catalogoDeLosFindings(findings, [AESIA_RIA_REQUIREMENTS, DESPLIEGUE_REQUIREMENTS]),
    ).toBe(DESPLIEGUE_REQUIREMENTS);
  });

  it("una evaluación del proveedor se sigue pintando con las 84", () => {
    const findings = AESIA_RIA_REQUIREMENTS[0].measures.map((m) => ({ code: m.id }));
    expect(
      catalogoDeLosFindings(findings, [AESIA_RIA_REQUIREMENTS, DESPLIEGUE_REQUIREMENTS]),
    ).toBe(AESIA_RIA_REQUIREMENTS);
  });

  it("sin findings, o con códigos de ningún catálogo, se queda con el primero", () => {
    expect(catalogoDeLosFindings([], [ISO_42001_REQUIREMENTS, DESPLIEGUE_REQUIREMENTS])).toBe(
      ISO_42001_REQUIREMENTS,
    );
    expect(
      catalogoDeLosFindings([{ code: "VAL-01" }], [ISO_42001_REQUIREMENTS, DESPLIEGUE_REQUIREMENTS]),
    ).toBe(ISO_42001_REQUIREMENTS);
  });
});

describe("las pantallas declaran el perfil", () => {
  it("el wizard y el informe avisan de la cobertura provisional", () => {
    // Cargar un catálogo no validado por el Comité de IA sin decirlo lo
    // convertiría en un dictamen que nadie ha firmado.
    for (const f of [
      "src/pages/ai-governance/EvaluacionNueva.tsx",
      "src/pages/ai-governance/EvaluacionDetalle.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} no declara la cobertura provisional`).toContain("AVISO_COBERTURA_PROVISIONAL");
    }
    expect(AVISO_COBERTURA_PROVISIONAL).toMatch(/Comité de IA/);
  });

  it("el wizard elige el catálogo por el perfil, no por el marco a secas", () => {
    const src = readFileSync("src/pages/ai-governance/EvaluacionNueva.tsx", "utf8");
    expect(src).toMatch(/perfilAplicable\(selectedSystem/);
    expect(src).toMatch(/const requirements: RequirementDef\[\] = perfil\.requirements/);
  });
});

describe("el perfil expone el perfil de catálogo A/B/C del cuestionario guiado (2026-09-08)", () => {
  it("proveedor de alto riesgo es A; despliegue de alto riesgo es B y falla abierto diciéndolo", () => {
    const a = perfilAplicable({ regulatory_role: "PROVEEDOR", risk_level: "Alto" }, AESIA_RIA_REQUIREMENTS);
    expect(a.catalogProfile).toBe("PROFILE_A");
    const b = perfilAplicable({ regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: "Alto" }, AESIA_RIA_REQUIREMENTS);
    expect(b.catalogProfile).toBe("PROFILE_B");
    // S-6: no hay catálogo validado para el perfil B; se mide contra las 84 y se dice.
    expect(b.requirements).toBe(AESIA_RIA_REQUIREMENTS);
    expect(b.motivo).toMatch(/no hay catálogo validado/i);
  });

  it("despliegue de riesgo limitado es C con las 43; sin rol no hay perfil", () => {
    const c = perfilAplicable({ regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: "Limitado" }, AESIA_RIA_REQUIREMENTS);
    expect(c.catalogProfile).toBe("PROFILE_C");
    expect(c.requirements).toBe(DESPLIEGUE_REQUIREMENTS);
    expect(perfilAplicable({ regulatory_role: null, risk_level: "Limitado" }, AESIA_RIA_REQUIREMENTS).catalogProfile).toBeNull();
  });
});
