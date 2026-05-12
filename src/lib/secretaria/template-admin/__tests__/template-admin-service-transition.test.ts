import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PlantillaCandidate } from "../types";

const mockState = {
  current: null as PlantillaCandidate | null,
  updateCalls: [] as Array<Record<string, unknown>>,
};

vi.mock("@/integrations/supabase/client", () => {
  function selectChain() {
    const chain = {
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: mockState.current, error: null })),
    };
    return chain;
  }

  function updateChain(payload: Record<string, unknown>) {
    mockState.updateCalls.push(payload);
    const chain = {
      error: null,
      eq: vi.fn(() => chain),
    };
    return chain;
  }

  function changelogInsertChain() {
    return {
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: "log-1" }, error: null })),
      })),
    };
  }

  function changelogLookupChain() {
    const chain = {
      eq: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };
    return chain;
  }

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "plantillas_protegidas") {
          return {
            select: vi.fn(() => selectChain()),
            update: vi.fn((payload: Record<string, unknown>) => updateChain(payload)),
          };
        }
        if (table === "plantilla_changelog") {
          return {
            select: vi.fn(() => changelogLookupChain()),
            insert: vi.fn(() => changelogInsertChain()),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    },
  };
});

import { transitionTemplateState } from "../template-admin-service";

const baseTemplate = (overrides: Partial<PlantillaCandidate> = {}): PlantillaCandidate => ({
  id: "tpl-1",
  tipo: "MODELO_ACUERDO",
  materia: "APROBACION_CUENTAS",
  materia_acuerdo: null,
  jurisdiccion: "ES",
  version: "1.0.0",
  estado: "REVISADA",
  organo_tipo: "JUNTA_GENERAL",
  adoption_mode: "MEETING",
  aprobada_por: null,
  fecha_aprobacion: null,
  referencia_legal: "Art. 160 LSC",
  capa1_inmutable: "PRIMERO.- Aprobar cuentas.".padEnd(120, "x"),
  capa2_variables: [],
  capa3_editables: [],
  ...overrides,
});

describe("template-admin-service — approval metadata transitions", () => {
  beforeEach(() => {
    mockState.current = baseTemplate();
    mockState.updateCalls = [];
  });

  it("transición a APROBADA falla sin aprobadaPor/fechaAprobacion", async () => {
    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "APROBADA",
        motivo: "aprobación legal",
        actor: "legal@arga-seguros.com",
      },
      { tenantId: "tenant-1" },
    );

    expect(result).toEqual({ ok: false, reason: "MISSING_APPROVAL_DATA" });
    expect(mockState.updateCalls).toEqual([]);
  });

  it("transición a APROBADA persiste firma cuando llega en input", async () => {
    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "APROBADA",
        motivo: "aprobación legal",
        actor: "legal@arga-seguros.com",
        aprobadaPor: "Comité Legal Garrigues",
        fechaAprobacion: "2026-05-12",
      },
      { tenantId: "tenant-1" },
    );

    expect(result.ok).toBe(true);
    expect(mockState.updateCalls[0]).toEqual({
      estado: "APROBADA",
      aprobada_por: "Comité Legal Garrigues",
      fecha_aprobacion: "2026-05-12",
    });
  });
});
