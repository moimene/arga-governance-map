import { describe, it, expect } from "bun:test";
import {
  ANEXO_IV_SECCIONES,
  etiquetaEstadoSeccion,
  normalizarEstadoSeccion,
  vinculaArt11,
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
