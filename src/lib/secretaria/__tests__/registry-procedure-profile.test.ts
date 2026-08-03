import { describe, expect, it } from "vitest";
import { resolveRegistryProcedureProfile } from "../registry-procedure-profile";

describe("resolveRegistryProcedureProfile", () => {
  it("mantiene la aprobación como no inscribible y deriva el depósito de cuentas", () => {
    const result = resolveRegistryProcedureProfile("APROBACION_CUENTAS", {
      inscribible: false,
      instrumentoRequerido: "NINGUNO",
      publicacionRequerida: false,
      deposito_cuentas: {
        obligatorio: true,
        instrumento: "CERTIFICACION",
        plazoDias: 30,
      },
    });

    expect(result).toEqual({
      kind: "DEPOSITO_CUENTAS",
      label: "Depósito de cuentas anuales",
      baseDocumentKind: "CERTIFICACION",
      procedureProfileCode: "DEPOSITO_CUENTAS",
      deadlineDays: 30,
      canPrepareFiling: true,
    });
  });

  it("conserva la vía directa para un nombramiento inscribible", () => {
    expect(resolveRegistryProcedureProfile("NOMBRAMIENTO_CONSEJERO", {
      inscribible: true,
      instrumentoRequerido: "ESCRITURA",
      publicacionRequerida: false,
      plazoInscripcion: { dias: 30 },
    })).toMatchObject({
      kind: "ACTO_INSCRIBIBLE",
      baseDocumentKind: "ESCRITURA",
      deadlineDays: 30,
      canPrepareFiling: true,
    });
  });

  it("no inventa un expediente cuando no existe perfil posterior", () => {
    expect(resolveRegistryProcedureProfile("INFORME_GESTION", {
      inscribible: false,
      instrumentoRequerido: "NINGUNO",
      publicacionRequerida: false,
    })).toMatchObject({
      kind: "NO_TRAMITABLE",
      baseDocumentKind: null,
      canPrepareFiling: false,
    });
  });
});
