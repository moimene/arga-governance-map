import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runTemplateImportPreflight: vi.fn(),
}));

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
