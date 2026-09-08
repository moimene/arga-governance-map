import { describe, it, expect } from "bun:test";
import {
  ESTADOS_EVALUACION,
  ESTADOS_EVALUACION_LEGADO,
  ESTADOS_SISTEMA,
  MARCOS_EVALUACION,
  NIVELES_RIESGO,
  SEVERIDADES_INCIDENTE,
  ESTADOS_INCIDENTE,
  claseNivelRiesgo,
  etiqueta,
  isMaterialSeverity,
  normalizeAimsStatus,
  opcionesFiltro,
} from "../vocabulario";

/**
 * El vocabulario del módulo vivía repartido en siete pantallas, cada una con su
 * propia lista y su propio mapa de etiquetas. Aquí se prueba la hoja: los
 * valores, la traducción y el fallback conservador.
 */
describe("etiqueta", () => {
  it("traduce lo conocido de cada dominio", () => {
    expect(etiqueta("severidad", "CRITICO")).toBe("Crítico");
    expect(etiqueta("estadoSistema", "EN_EVALUACION")).toBe("En evaluación");
    expect(etiqueta("estadoIncidente", "EN_INVESTIGACION")).toBe("En investigación");
    expect(etiqueta("estadoEvaluacion", "CON_GAPS")).toBe("Con brechas");
    expect(etiqueta("marco", "EU_AI_ACT")).toBe("EU AI Act");
    // El nivel de riesgo se persiste ya en castellano: la etiqueta es el valor.
    expect(etiqueta("nivel", "Mínimo")).toBe("Mínimo");
  });

  it("un valor desconocido se pinta tal cual está escrito en la base", () => {
    // Renombrarlo sería inventar un estado que nadie ha declarado.
    expect(etiqueta("estadoSistema", "Conforme")).toBe("Conforme");
    expect(etiqueta("severidad", "CRITICA")).toBe("CRITICA");
  });

  it("sin valor no se afirma nada", () => {
    expect(etiqueta("estadoIncidente", null)).toBe("");
    expect(etiqueta("estadoIncidente", undefined)).toBe("");
    expect(etiqueta("estadoIncidente", "")).toBe("");
  });

  it("los dos estados de evaluación que sólo están en el dato antiguo se declaran legado", () => {
    expect(etiqueta("estadoEvaluacion", "APROBADO")).toContain("legado");
    expect(etiqueta("estadoEvaluacion", "EN_REVISION")).toContain("legado");
    // Y los que el producto escribe hoy no llevan esa marca.
    for (const v of ESTADOS_EVALUACION) {
      expect(etiqueta("estadoEvaluacion", v), `${v} se presenta como legado`).not.toContain("legado");
    }
  });
});

describe("opcionesFiltro", () => {
  it("abre con Todos y ofrece los valores del dominio", () => {
    expect(opcionesFiltro("estadoSistema")).toEqual([
      { value: "Todos", label: "Todos" },
      { value: "ACTIVO", label: "Activos" },
      { value: "EN_EVALUACION", label: "En evaluación" },
      { value: "RETIRADO", label: "Retirados" },
    ]);
  });

  it("los dominios femeninos cambian la ETIQUETA, no el valor del filtro", () => {
    // El valor sigue siendo "Todos" en los seis dominios: es la clave con la
    // que cada pantalla compara para no filtrar.
    expect(opcionesFiltro("severidad")[0]).toEqual({ value: "Todos", label: "Todas" });
    expect(opcionesFiltro("estadoEvaluacion")[0]).toEqual({ value: "Todos", label: "Todas" });
    expect(opcionesFiltro("nivel")[0]).toEqual({ value: "Todos", label: "Todos" });
  });

  it("añade los valores presentes en el dato sin duplicar ni renombrar", () => {
    // `ai_systems.status` no tiene CHECK: en Cloud hay grafías fuera del
    // vocabulario y sin esto no eran alcanzables por ningún filtro.
    const opciones = opcionesFiltro("estadoSistema", ["Conforme", "ACTIVO"]);
    expect(opciones.map((o) => o.value)).toEqual(["Todos", "ACTIVO", "EN_EVALUACION", "RETIRADO", "Conforme"]);
    expect(opciones.at(-1)).toEqual({ value: "Conforme", label: "Conforme" });
  });

  it("los extras llegan ordenados y sin vacíos", () => {
    const opciones = opcionesFiltro("estadoIncidente", ["Zeta", "", "Alfa", "Alfa"]);
    expect(opciones.map((o) => o.value)).toEqual([
      "Todos", "ABIERTO", "EN_INVESTIGACION", "CERRADO", "Alfa", "Zeta",
    ]);
  });

  it("el filtro de evaluaciones ofrece el legado marcado como tal", () => {
    const legado = opcionesFiltro("estadoEvaluacion").filter((o) => ESTADOS_EVALUACION_LEGADO.includes(o.value as never));
    expect(legado.map((o) => o.label)).toEqual(["Aprobadas (legado)", "En revisión (legado)"]);
  });
});

describe("claseNivelRiesgo", () => {
  it("un nivel desconocido va NEUTRO, no en alarma", () => {
    const neutro = claseNivelRiesgo("lo que sea");
    expect(/status-error/.test(neutro), "un nivel desconocido se pinta como alarma").toBe(false);
    expect(/status-success|status-warning/.test(neutro)).toBe(false);
    expect(claseNivelRiesgo(null)).toBe(neutro);
  });

  it("y los conocidos reciben su color, o el neutro no informaría de nada", () => {
    expect(claseNivelRiesgo("Inaceptable")).toContain("status-error");
    expect(claseNivelRiesgo("Alto")).toContain("status-error");
    expect(claseNivelRiesgo("Limitado")).toContain("status-warning");
    expect(claseNivelRiesgo("Mínimo")).toContain("status-success");
  });

  it("sólo usa tokens de la guía Garrigues", () => {
    for (const nivel of [...NIVELES_RIESGO, "desconocido"]) {
      const cls = claseNivelRiesgo(nivel);
      expect(/#[0-9a-fA-F]{3,8}|bg-(gray|green|amber|red|slate)-/.test(cls), `${nivel}: ${cls}`).toBe(false);
    }
  });
});

describe("predicados movidos desde readiness", () => {
  it("normaliza las grafías reales de Cloud", () => {
    expect(normalizeAimsStatus("En revisión")).toBe("EN_REVISION");
    expect(normalizeAimsStatus("No conforme")).toBe("NO_CONFORME");
    expect(normalizeAimsStatus(null)).toBe("");
  });

  it("la severidad material se mide sobre lo que el alta escribe", () => {
    expect(isMaterialSeverity("CRITICO")).toBe(true);
    expect(isMaterialSeverity("ALTO")).toBe(true);
    expect(isMaterialSeverity("MEDIO")).toBe(false);
    expect(isMaterialSeverity(null)).toBe(false);
  });
});

describe("los conjuntos de valores", () => {
  it("son los que el producto escribe y lee", () => {
    // Control positivo: sin esto, vaciar un array dejaría verdes los tests de
    // arriba que sólo recorren el dominio.
    expect([...NIVELES_RIESGO]).toEqual(["Inaceptable", "Alto", "Limitado", "Mínimo"]);
    expect([...ESTADOS_SISTEMA]).toEqual(["ACTIVO", "EN_EVALUACION", "RETIRADO"]);
    expect([...ESTADOS_EVALUACION]).toEqual(["CONFORME", "CON_GAPS", "BORRADOR"]);
    expect([...ESTADOS_EVALUACION_LEGADO]).toEqual(["APROBADO", "EN_REVISION"]);
    expect([...SEVERIDADES_INCIDENTE]).toEqual(["CRITICO", "ALTO", "MEDIO", "BAJO"]);
    expect([...ESTADOS_INCIDENTE]).toEqual(["ABIERTO", "EN_INVESTIGACION", "CERRADO"]);
    expect([...MARCOS_EVALUACION]).toEqual(["EU_AI_ACT", "ISO_42001"]);
  });
});
