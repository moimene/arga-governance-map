import { describe, expect, it } from "vitest";
import {
  TAB_LABELS,
  TAB_ORDER,
  TAB_PERMISSIONS,
} from "../tab-guards";

describe("contrato de navegación del Gestor de plantillas", () => {
  it("mantiene los ocho ids URL en el orden ejecutivo acordado", () => {
    expect(TAB_ORDER).toEqual([
      "dashboard",
      "catalogo",
      "cobertura",
      "metricas",
      "auditoria",
      "importar",
      "validacion",
      "configuracion",
    ]);
  });

  it("expone las etiquetas visibles confirmadas sin alterar los ids", () => {
    expect(TAB_ORDER.map((tab) => TAB_LABELS[tab])).toEqual([
      "Salud documental",
      "Catálogo gobernado",
      "Cobertura por materia y órgano",
      "Indicadores de ciclo de vida",
      "Auditoría e historial de cambios",
      "Importar",
      "Comprobación documental",
      "Configuración por sociedad",
    ]);
  });

  it("conserva lectura para tres roles y escritura sensible solo para administración", () => {
    for (const tab of [
      "dashboard",
      "catalogo",
      "cobertura",
      "metricas",
      "auditoria",
    ] as const) {
      expect(TAB_PERMISSIONS[tab]).toEqual([
        "SECRETARIO",
        "COMPLIANCE",
        "ADMIN_TENANT",
      ]);
    }

    for (const tab of ["importar", "validacion", "configuracion"] as const) {
      expect(TAB_PERMISSIONS[tab]).toEqual(["ADMIN_TENANT"]);
    }
  });
});
