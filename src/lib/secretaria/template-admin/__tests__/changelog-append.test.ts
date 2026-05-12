import { describe, it, expect, beforeEach, vi } from "vitest";

const mockState = {
  lookupRows: [] as Array<{ id: string }>,
  lookupError: null as unknown,
  insertCalls: [] as Array<Record<string, unknown>>,
  eqCalls: [] as Array<[string, unknown]>,
  ilikeCalls: [] as Array<[string, string]>,
  limitCalls: [] as number[],
};

vi.mock("@/integrations/supabase/client", () => {
  function lookupChain() {
    const chain = {
      eq: vi.fn((column: string, value: unknown) => {
        mockState.eqCalls.push([column, value]);
        return chain;
      }),
      ilike: vi.fn((column: string, value: string) => {
        mockState.ilikeCalls.push([column, value]);
        return chain;
      }),
      limit: vi.fn(async (count: number) => {
        mockState.limitCalls.push(count);
        return { data: mockState.lookupRows, error: mockState.lookupError };
      }),
    };
    return chain;
  }

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table !== "plantilla_changelog") {
          throw new Error(`Unexpected table ${table}`);
        }
        return {
          select: vi.fn(() => lookupChain()),
          insert: vi.fn((row: Record<string, unknown>) => {
            mockState.insertCalls.push(row);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: "inserted-log" }, error: null })),
              })),
            };
          }),
        };
      }),
    },
  };
});

import { appendChangelog } from "../changelog";

const baseEntry = {
  plantillaId: "tpl-1",
  tenantId: "tenant-1",
  bumpType: "PATCH" as const,
  motivo: "STATE:BORRADOR->REVISADA",
  diffSummary: { action: "STATE_CHANGE" },
  fromVersion: "1.0.0",
  toVersion: "1.0.0",
  autor: "legal@arga-seguros.com",
};

describe("appendChangelog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1715508000000);
    mockState.lookupRows = [];
    mockState.lookupError = null;
    mockState.insertCalls = [];
    mockState.eqCalls = [];
    mockState.ilikeCalls = [];
    mockState.limitCalls = [];
  });

  it("lookup de idempotencia filtra por tenant_id y plantilla_id con token completo", async () => {
    await appendChangelog(baseEntry);

    expect(mockState.eqCalls).toContainEqual(["tenant_id", "tenant-1"]);
    expect(mockState.eqCalls).toContainEqual(["plantilla_id", "tpl-1"]);
    expect(mockState.ilikeCalls).toHaveLength(1);
    expect(mockState.ilikeCalls[0][0]).toBe("motivo");
    expect(mockState.ilikeCalls[0][1]).toMatch(/^%\[idemp:[0-9a-f]{8}\]%$/);
    expect(mockState.limitCalls).toEqual([1]);
  });

  it("si encuentra changelog existente no inserta otro", async () => {
    mockState.lookupRows = [{ id: "existing-log" }];

    const result = await appendChangelog(baseEntry);

    expect(result).toEqual({ id: "existing-log" });
    expect(mockState.insertCalls).toEqual([]);
  });
});
