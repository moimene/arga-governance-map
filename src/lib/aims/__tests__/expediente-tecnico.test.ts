import { describe, it, expect } from "bun:test";
import {
  ANEXO_IV_SECCIONES,
  ESTADOS_SECCION,
  ESTADOS_SECCION_CON_REVISOR,
  ESTADOS_SECCION_EDITABLES,
  esEstadoSeccionConRevisor,
  esEstadoSeccionEditable,
  esSeccionCerrada,
  etiquetaEstadoSeccion,
  normalizarEstadoSeccion,
  vinculaArt11,
  vinculaArt47,
} from "../expediente-tecnico";

describe("expediente técnico — anexo IV", () => {
  it("el esqueleto son los nueve puntos del anexo IV con el prefijo que ya usa el dato", () => {
    expect(ANEXO_IV_SECCIONES.map((s) => s.code)).toEqual([
      "AIV-01", "AIV-02", "AIV-03", "AIV-04", "AIV-05", "AIV-06", "AIV-07", "AIV-08", "AIV-09",
    ]);
    expect(new Set(ANEXO_IV_SECCIONES.map((s) => s.anexo)).size).toBe(9);
  });

  it("el art. 11 vincula al proveedor de alto riesgo y a nadie más; sin dato no se afirma", () => {
    expect(vinculaArt11("PROVEEDOR", "Alto")).toBe(true);
    expect(vinculaArt11("PROVEEDOR_POSTERIOR", "Alto")).toBe(true);
    expect(vinculaArt11("RESPONSABLE_DESPLIEGUE", "Alto")).toBe(false);
    expect(vinculaArt11("PROVEEDOR", "Limitado")).toBe(false);
    expect(vinculaArt11(null, "Alto")).toBeNull();
    expect(vinculaArt11("PROVEEDOR", "")).toBeNull();
  });

  it("el art. 47 (declaración UE de conformidad) sigue el mismo tri-estado que el art. 11", () => {
    expect(vinculaArt47("PROVEEDOR", "Alto")).toBe(true);
    expect(vinculaArt47("RESPONSABLE_DESPLIEGUE", "Limitado")).toBe(false);
    expect(vinculaArt47("PROVEEDOR", "Limitado")).toBe(false);
    expect(vinculaArt47(null, "Alto")).toBeNull();
    expect(vinculaArt47("PROVEEDOR", "")).toBeNull();
  });

  it("reconoce los dos vocabularios de estado que conviven en Cloud y no inventa un tercero", () => {
    expect(normalizarEstadoSeccion("Conforme")).toBe("APPROVED");
    expect(normalizarEstadoSeccion("Pendiente")).toBe("PENDING");
    expect(normalizarEstadoSeccion("En revisión")).toBe("IN_REVIEW");
    expect(normalizarEstadoSeccion("APPROVED")).toBe("APPROVED");
    // Desconocido: se devuelve crudo, la pantalla lo pinta neutro.
    expect(normalizarEstadoSeccion("Lo que sea")).toBe("Lo que sea");
    expect(etiquetaEstadoSeccion("Conforme")).toBe("Conforme");
    expect(etiquetaEstadoSeccion("Lo que sea")).toBe("Lo que sea");
    expect(etiquetaEstadoSeccion(null)).toBe("Sin estado");
  });
});

describe("F1.T7 (GC-51) — el cliente no asigna estados que exigen un revisor", () => {
  it("el selector no ofrece SEALED ni APPROVED", () => {
    expect(ESTADOS_SECCION_EDITABLES).not.toContain("SEALED");
    expect(ESTADOS_SECCION_EDITABLES).not.toContain("APPROVED");
    expect([...ESTADOS_SECCION_CON_REVISOR].sort()).toEqual(["APPROVED", "SEALED"]);
  });

  it("control positivo: los estados de trabajo siguen ofreciéndose, y el universo queda cerrado", () => {
    // Una lista vacía satisfaría las dos ausencias de arriba sin ofrecer nada.
    expect(ESTADOS_SECCION_EDITABLES).toEqual(["PENDING", "IN_REVIEW", "NON_CONFORMING"]);
    // Todo estado conocido es editable o exige revisor: ninguno queda fuera.
    for (const e of ESTADOS_SECCION) {
      const editable = (ESTADOS_SECCION_EDITABLES as readonly string[]).includes(e);
      const conRevisor = (ESTADOS_SECCION_CON_REVISOR as readonly string[]).includes(e);
      expect(editable !== conRevisor, e).toBe(true);
    }
  });

  it("la escritura aplica el mismo criterio, también a las grafías del seed", () => {
    for (const s of ["APPROVED", "Conforme", "conforme", "SEALED", "sealed"]) {
      expect(esEstadoSeccionEditable(s), s).toBe(false);
    }
    for (const s of ["PENDING", "Pendiente", "IN_REVIEW", "En revisión", "NON_CONFORMING", "No conforme"]) {
      expect(esEstadoSeccionEditable(s), s).toBe(true);
    }
    // Lo desconocido no se escribe: no es un estado de trabajo declarado.
    expect(esEstadoSeccionEditable("Lo que sea")).toBe(false);
    expect(esEstadoSeccionEditable(null)).toBe(false);
  });
});

describe("F1.T7 — qué acompaña a un estado con revisor, y qué no se reabre", () => {
  it("«Revisada» solo es legible junto a un estado de revisor, en cualquier grafía", () => {
    for (const s of ["APPROVED", "Conforme", "SEALED", "sealed"]) expect(esEstadoSeccionConRevisor(s), s).toBe(true);
    // Control: los de trabajo y lo desconocido no afirman revisión.
    for (const s of ["PENDING", "Pendiente", "En revisión", "No conforme", "Lo que sea", null]) {
      expect(esEstadoSeccionConRevisor(s), String(s)).toBe(false);
    }
  });

  it("solo una sección cerrada queda fuera de la edición", () => {
    expect(esSeccionCerrada("SEALED")).toBe(true);
    expect(esSeccionCerrada("sealed")).toBe(true);
    for (const s of ["APPROVED", "Conforme", "PENDING", "En revisión", null]) expect(esSeccionCerrada(s), String(s)).toBe(false);
  });
});
