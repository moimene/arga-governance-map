import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@tanstack/react-query";
import * as __realModule1 from "@/context/TenantContext";
import * as __realModule2 from "@/lib/secretaria/template-admin/import-preflight";
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runTemplateImportPreflight: vi.fn(),
}));

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@tanstack/react-query", { ...__realModule0 }],
  ["@/context/TenantContext", { ...__realModule1 }],
  ["@/lib/secretaria/template-admin/import-preflight", { ...__realModule2 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@tanstack/react-query", () => ({
  useMutation: ({
    mutationFn,
  }: {
    mutationFn: (input: unknown) => Promise<unknown>;
  }) => ({
    mutateAsync: async (input: unknown) => mutationFn(input),
    isPending: false,
  }),
}));

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({ tenantId: "tenant-1" }),
}));

vi.mock("@/lib/secretaria/template-admin/import-preflight", () => ({
  runTemplateImportPreflight: mocks.runTemplateImportPreflight,
}));

import { useTemplatePreflight } from "../useTemplatePreflight";

describe("useTemplatePreflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runTemplateImportPreflight.mockResolvedValue({
      ok: true,
      payload: { template: { version: "1.0.0" } },
      gatePre: { ok: true, issues: [], summary: { blocking: 0, warning: 0, info: 0 } },
    });
  });

  it("ejecuta preflight read-only sin exigir ACK de warnings", async () => {
    const hook = useTemplatePreflight();
    const outcome = await hook.mutateAsync({ json: { template: {} } });

    expect(outcome.ok).toBe(true);
    expect(mocks.runTemplateImportPreflight).toHaveBeenCalledWith({
      json: { template: {} },
      tenantId: "tenant-1",
      requireWarningAck: false,
    });
  });
});
