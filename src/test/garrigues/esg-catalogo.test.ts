// src/test/garrigues/esg-catalogo.test.ts
// Tarea 4 del carril C3 — ESG de gobernanza, SIN métricas (decisión del usuario).
//
// El guard central de esta fase no es que el contenido esté: es que NO aparezca
// una cifra que pretenda ser un indicador. El Informe de Sostenibilidad 2025 no
// está en el corpus, así que cualquier número aquí estaría inventado.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ESG_ORGANOS,
  ESG_POLITICA,
  PLAN_SOSTENIBILIDAD,
  COMPROMISOS_ESG,
  PRINCIPIOS_PACTO_MUNDIAL,
  ESG_MODULO,
} from "../../../scripts/garrigues/esg/plan-sostenibilidad";

describe("ESG Garrigues — gobernanza acreditada", () => {
  it("los owners son los dos órganos reales, con el slug con el que están en Cloud", () => {
    // Los slugs llevan prefijo `garrigues-`, que el JSON de origen NO tiene. La
    // ficha de órgano resuelve por slug: uno mal copiado deja el enlace muerto
    // sin que nada falle.
    expect(ESG_ORGANOS.map((o) => o.slug)).toEqual([
      "garrigues-comite-sostenibilidad",
      "garrigues-comision-seguimiento-sostenibilidad",
    ]);
  });

  it("la política rectora es PI-22", () => {
    expect(ESG_POLITICA).toBe("PI-22");
  });

  it("el módulo se declara sólo para el tenant Garrigues", () => {
    expect(ESG_MODULO.id).toBe("esg");
    expect(ESG_MODULO.tenant_id).toBe("00000000-0000-0000-0000-000000000002");
  });
});

describe("ESG Garrigues — el Plan se nombra, no se rellena", () => {
  it("tiene nombre y periodo, y NINGÚN objetivo", () => {
    expect(PLAN_SOSTENIBILIDAD.nombre).toBe("Plan de Sostenibilidad 2023-2025");
    expect(PLAN_SOSTENIBILIDAD.periodo).toBe("2023-2025");
    expect(PLAN_SOSTENIBILIDAD.objetivos).toBeNull();
  });

  it("declara por qué no los tiene", () => {
    expect(PLAN_SOSTENIBILIDAD.motivo_ausencia).toMatch(/no consta en fuente disponible/i);
  });
});

describe("ESG Garrigues — ni una métrica inventada", () => {
  const catalogo = readFileSync(
    join(process.cwd(), "scripts/garrigues/esg/plan-sostenibilidad.ts"),
    "utf8",
  );

  it("ningún compromiso lleva porcentaje, objetivo cuantificado ni tonelaje", () => {
    for (const c of COMPROMISOS_ESG) {
      expect(c.titulo).not.toMatch(/\d+\s*%/);
      // El texto citado puede contener cifras que están EN LA FUENTE (1,5 °C,
      // 2050, 2002, 2015): eso es la cita, no una métrica de desempeño. Lo que
      // no puede haber es un porcentaje de cumplimiento o de reducción.
      expect(c.cita).not.toMatch(/\d+\s*%/);
    }
  });

  it("todo compromiso cita su fuente literal", () => {
    for (const c of COMPROMISOS_ESG) {
      expect(c.fuente).toMatch(/^(PI-22|Código Ético)/);
      expect(c.cita.length).toBeGreaterThan(40);
    }
  });

  it("el responsable es null cuando la fuente no lo dice, en vez de inventarse", () => {
    // Tres de los siete compromisos NO tienen responsable acreditado. Es el
    // mismo criterio de G4: el ownership sólo se atribuye donde la fuente lo dice.
    const sinResponsable = COMPROMISOS_ESG.filter((c) => c.responsable === null);
    expect(sinResponsable.length).toBeGreaterThan(0);
  });

  it("los tres ejes ESG tienen contenido real", () => {
    const ejes = new Set(COMPROMISOS_ESG.map((c) => c.eje));
    expect(ejes).toEqual(new Set(["AMBIENTAL", "SOCIAL", "GOBERNANZA"]));
  });

  it("los diez principios del Pacto Mundial están completos", () => {
    expect(PRINCIPIOS_PACTO_MUNDIAL).toHaveLength(10);
  });

  it("el catálogo no declara ningún objetivo numérico de reducción o cumplimiento", () => {
    // Guard de fichero completo: si alguien añade `objetivo: "-30% emisiones"`
    // o `cumplimiento: 85`, se cae aquí aunque no pase por COMPROMISOS_ESG.
    expect(catalogo).not.toMatch(/objetivo\w*:\s*["'`]?[-+]?\d/i);
    expect(catalogo).not.toMatch(/cumplimiento:\s*\d/i);
    expect(catalogo).not.toMatch(/kpi|indicador:\s*\d/i);
  });
});
