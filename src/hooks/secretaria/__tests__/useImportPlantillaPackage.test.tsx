import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GatePreResult } from "@/lib/secretaria/template-admin/types";

const mocks = {
  createDraftFromImport: vi.fn(),
  loadAllActiveTemplates: vi.fn(),
  validateTemplateForActivation: vi.fn(),
  parseImport: vi.fn(),
  buildDraftRow: vi.fn(),
  invalidateQueries: vi.fn(),
};

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (input: unknown) => Promise<unknown>;
    onSuccess?: (data: unknown) => void;
  }) => ({
    mutateAsync: async (input: unknown) => {
      const data = await mutationFn(input);
      onSuccess?.(data);
      return data;
    },
    isPending: false,
  }),
}));

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({ tenantId: "tenant-1" }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    user: { id: "user-1", email: "legal@arga-seguros.com" },
  }),
}));

vi.mock("@/lib/secretaria/template-admin/template-admin-service", () => ({
  createDraftFromImport: mocks.createDraftFromImport,
}));

vi.mock("@/lib/secretaria/template-admin/cloud-helpers", () => ({
  loadAllActiveTemplates: mocks.loadAllActiveTemplates,
}));

vi.mock("@/lib/secretaria/template-admin/gate-pre", () => ({
  validateTemplateForActivation: mocks.validateTemplateForActivation,
}));

vi.mock("@/lib/secretaria/template-admin/template-importer", () => ({
  parseImport: mocks.parseImport,
  buildDraftRow: mocks.buildDraftRow,
}));

import { useImportPlantillaPackage } from "../useImportPlantillaPackage";

const validPayload = {
  template: {
    tipo: "MODELO_ACUERDO",
    materia: "APROBACION_CUENTAS",
    materia_acuerdo: undefined,
    jurisdiccion: "ES",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Art. 160 LSC",
  },
  capa1_inmutable: "PRIMERO.- Aprobar cuentas.".padEnd(120, "x"),
  capa2_variables: [],
  capa3_editables: [],
};

const warningGate: GatePreResult = {
  ok: true,
  issues: [
    {
      severity: "WARNING",
      code: "GEN_IF_COUNT",
      message: "warning",
    },
  ],
  summary: { blocking: 0, warning: 1, info: 0 },
};

describe("useImportPlantillaPackage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.parseImport.mockReturnValue({ ok: true, payload: validPayload });
    mocks.loadAllActiveTemplates.mockResolvedValue([]);
    mocks.validateTemplateForActivation.mockReturnValue(warningGate);
    mocks.buildDraftRow.mockReturnValue({ tipo: "MODELO_ACUERDO" });
    mocks.createDraftFromImport.mockResolvedValue({ plantillaId: "tpl-new" });
  });

  it("no escribe BORRADOR si hay warnings sin ackMotivo", async () => {
    const hook = useImportPlantillaPackage();
    const outcome = await hook.mutateAsync({ json: { ok: true } });

    expect(outcome).toEqual({
      ok: false,
      reason: "WARNINGS_NEED_ACK",
      gatePre: warningGate,
    });
    expect(mocks.createDraftFromImport).not.toHaveBeenCalled();
    expect(mocks.validateTemplateForActivation).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ targetEstado: "BORRADOR" }),
    );
  });

  it("escribe BORRADOR cuando warnings vienen con ackMotivo válido", async () => {
    const hook = useImportPlantillaPackage();
    const outcome = await hook.mutateAsync({
      json: { ok: true },
      ackMotivo: "Warnings revisadas por Comité Legal el 12/05/2026.",
    });

    expect(outcome).toEqual({
      ok: true,
      plantillaId: "tpl-new",
      gatePre: warningGate,
    });
    expect(mocks.createDraftFromImport).toHaveBeenCalledTimes(1);
    expect(mocks.createDraftFromImport).toHaveBeenCalledWith(
      expect.objectContaining({
        ackMotivo: "Warnings revisadas por Comité Legal el 12/05/2026.",
      }),
      { tenantId: "tenant-1" },
    );
  });
});
