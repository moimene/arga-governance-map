import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/integrations/supabase/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateAdminError, type PlantillaCandidate } from "../types";

const mockState = {
  current: null as PlantillaCandidate | null,
  activeTemplates: [] as PlantillaCandidate[],
  plantillaInsertError: null as unknown,
  plantillaInsertId: "tpl-new",
  changelogInsertError: null as unknown,
  rpcData: null as Record<string, unknown> | null,
  rpcError: null as unknown,
  rpcCalls: [] as Array<Record<string, unknown>>,
  deleteIds: [] as string[],
};

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/integrations/supabase/client", { ...__realModule0 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@/integrations/supabase/client", () => {
  function selectCurrentOrActiveChain() {
    const chain = {
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: mockState.current, error: null })),
      then: (
        resolve: (value: { data: PlantillaCandidate[]; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve({ data: mockState.activeTemplates, error: null }).then(resolve, reject),
    };
    return chain;
  }

  function insertPlantillaChain() {
    return {
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: mockState.plantillaInsertError ? null : { id: mockState.plantillaInsertId },
          error: mockState.plantillaInsertError,
        })),
      })),
    };
  }

  function deleteChain() {
    const chain = {
      eq: vi.fn((column: string, value: string) => {
        if (column === "id") mockState.deleteIds.push(value);
        return chain;
      }),
    };
    return chain;
  }

  function changelogLookupChain() {
    const chain = {
      eq: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
      limit: vi.fn(async () => ({ data: [], error: null })),
    };
    return chain;
  }

  function changelogInsertChain() {
    return {
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: mockState.changelogInsertError ? null : { id: "log-1" },
          error: mockState.changelogInsertError,
        })),
      })),
    };
  }

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "plantillas_protegidas") {
          return {
            select: vi.fn(() => selectCurrentOrActiveChain()),
            insert: vi.fn(() => insertPlantillaChain()),
            delete: vi.fn(() => deleteChain()),
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
      rpc: vi.fn(async (_name: string, params: Record<string, unknown>) => {
        mockState.rpcCalls.push(params);
        return { data: mockState.rpcData, error: mockState.rpcError };
      }),
    },
  };
});

import { createDraftFromImport, transitionTemplateState } from "../template-admin-service";

const baseTemplate = (overrides: Partial<PlantillaCandidate> = {}): PlantillaCandidate => ({
  id: "tpl-1",
  tipo: "MODELO_ACUERDO",
  materia: "APROBACION_CUENTAS",
  materia_acuerdo: null,
  jurisdiccion: "ES",
  version: "1.0.0",
  estado: "BORRADOR",
  organo_tipo: "JUNTA_GENERAL",
  adoption_mode: "MEETING",
  tipo_social: null,
  aprobada_por: null,
  fecha_aprobacion: null,
  referencia_legal: "Art. 160 LSC",
  capa1_inmutable: "PRIMERO.- Aprobar cuentas.".padEnd(120, "x"),
  capa2_variables: [],
  capa3_editables: [],
  ...overrides,
});

describe("template-admin-service — atomicidad servidor", () => {
  beforeEach(() => {
    mockState.current = baseTemplate();
    mockState.activeTemplates = [];
    mockState.plantillaInsertError = null;
    mockState.plantillaInsertId = "tpl-new";
    mockState.changelogInsertError = null;
    mockState.rpcData = {
      ok: true,
      plantilla_id: "tpl-1",
      from: "BORRADOR",
      to: "REVISADA",
      changelog_id: "log-transition",
      operation_id: "00000000-0000-4000-8000-000000000001",
      replayed: false,
      bindings_moved: 0,
    };
    mockState.rpcError = null;
    mockState.rpcCalls = [];
    mockState.deleteIds = [];
  });

  it("devuelve STALE_STATE sin intentar un UPDATE ni rollback cliente", async () => {
    mockState.rpcData = null;
    mockState.rpcError = { message: "STALE_STATE: expected BORRADOR, actual REVISADA" };

    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "REVISADA",
        motivo: "revisión legal",
        actor: "legal@arga-seguros.com",
        operationId: "00000000-0000-4000-8000-000000000001",
      },
      { tenantId: "tenant-1" },
    );

    expect(result).toMatchObject({ reason: "STALE_STATE", expected: "BORRADOR" });
    expect(mockState.rpcCalls).toHaveLength(1);
  });

  it("un fallo transaccional genérico se devuelve sin rollback compensatorio", async () => {
    mockState.rpcData = null;
    mockState.rpcError = { message: "insert changelog failed; transaction rolled back" };

    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "REVISADA",
        motivo: "revisión legal",
        actor: "legal@arga-seguros.com",
      },
      { tenantId: "tenant-1" },
    );

    expect(result).toMatchObject({ reason: "RPC_FAILED" });
    expect(result).not.toHaveProperty("rolledBack");
    expect(mockState.rpcCalls).toHaveLength(1);
  });

  it("la activación exige ack y envía la predecesora exacta a la RPC", async () => {
    mockState.current = baseTemplate({
      id: "candidate",
      version: "1.1.0",
      estado: "APROBADA",
      aprobada_por: "Comité Legal Garrigues",
      fecha_aprobacion: "2026-07-12",
    });
    mockState.activeTemplates = [
      baseTemplate({
        id: "active-v1",
        estado: "ACTIVA",
        version: "1.0.0",
        aprobada_por: "Comité Legal Garrigues",
        fecha_aprobacion: "2026-07-01",
      }),
    ];
    mockState.rpcData = {
      ok: true,
      plantilla_id: "candidate",
      from: "APROBADA",
      to: "ACTIVA",
      changelog_id: "log-active",
      archived_template_id: "active-v1",
      archived_changelog_id: "log-archive",
      operation_id: "00000000-0000-4000-8000-000000000001",
      replayed: false,
      bindings_moved: 2,
    };

    const first = await transitionTemplateState(
      {
        plantillaId: "candidate",
        to: "ACTIVA",
        motivo: "sustitución controlada",
        actor: "legal@arga-seguros.com",
      },
      { tenantId: "tenant-1" },
    );
    expect(first).toMatchObject({
      reason: "WARNINGS_NEED_ACK",
      expectedFrom: "APROBADA",
      expectedPredecessorId: "active-v1",
    });
    expect(mockState.rpcCalls).toEqual([]);
    if (first.ok || first.reason !== "WARNINGS_NEED_ACK") {
      throw new Error("Expected warning context");
    }

    const confirmed = await transitionTemplateState(
      {
        plantillaId: "candidate",
        to: "ACTIVA",
        motivo: "sustitución controlada",
        actor: "legal@arga-seguros.com",
        ackWarnings: true,
        operationId: first.operationId,
        expectedFrom: first.expectedFrom,
        expectedPredecessorId: first.expectedPredecessorId,
      },
      { tenantId: "tenant-1" },
    );

    expect(confirmed).toMatchObject({
      ok: true,
      archivedTemplateId: "active-v1",
      archivedChangelogId: "log-archive",
      bindingsMoved: 2,
    });
    expect(mockState.rpcCalls[0].p_expected_predecessor_id).toBe("active-v1");
    expect(mockState.rpcCalls[0].p_ack_warnings).toBe(true);
  });

  it("no sustituye una predecesora distinta de la que el usuario reconoció", async () => {
    mockState.current = baseTemplate({
      id: "candidate",
      version: "1.1.0",
      estado: "APROBADA",
      aprobada_por: "Comité Legal Garrigues",
      fecha_aprobacion: "2026-07-12",
    });
    mockState.activeTemplates = [
      baseTemplate({ id: "active-v1", estado: "ACTIVA", version: "1.0.0" }),
    ];

    const first = await transitionTemplateState(
      {
        plantillaId: "candidate",
        to: "ACTIVA",
        motivo: "sustitución controlada",
        actor: "legal@arga-seguros.com",
      },
      { tenantId: "tenant-1" },
    );
    if (first.ok || first.reason !== "WARNINGS_NEED_ACK") {
      throw new Error("Expected warning context");
    }

    mockState.activeTemplates = [
      baseTemplate({ id: "active-v2", estado: "ACTIVA", version: "1.0.1" }),
    ];
    const confirmed = await transitionTemplateState(
      {
        plantillaId: "candidate",
        to: "ACTIVA",
        motivo: "sustitución controlada",
        actor: "legal@arga-seguros.com",
        ackWarnings: true,
        operationId: first.operationId,
        expectedFrom: first.expectedFrom,
        expectedPredecessorId: first.expectedPredecessorId,
      },
      { tenantId: "tenant-1" },
    );

    expect(confirmed).toEqual({
      ok: false,
      reason: "STALE_PREDECESSOR",
      expected: "active-v1",
    });
    expect(mockState.rpcCalls).toEqual([]);
  });

  it("un ack sin predecesora fijada devuelve contexto y no sustituye en silencio", async () => {
    mockState.current = baseTemplate({
      id: "candidate",
      estado: "APROBADA",
      aprobada_por: "Comité Legal Garrigues",
      fecha_aprobacion: "2026-07-12",
    });
    mockState.activeTemplates = [
      baseTemplate({ id: "active-v1", estado: "ACTIVA" }),
    ];

    const result = await transitionTemplateState(
      {
        plantillaId: "candidate",
        to: "ACTIVA",
        motivo: "sustitución controlada",
        actor: "legal@arga-seguros.com",
        ackWarnings: true,
      },
      { tenantId: "tenant-1" },
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "WARNINGS_NEED_ACK",
      expectedPredecessorId: "active-v1",
    });
    expect(mockState.rpcCalls).toEqual([]);
  });

  it("createDraftFromImport conserva su rollback local porque no cambia estado", async () => {
    mockState.changelogInsertError = { message: "insert log failed" };

    await expect(
      createDraftFromImport(
        {
          draftRow: { tipo: "MODELO_ACUERDO" },
          fromVersion: null,
          toVersion: "1.0.0",
          actor: "legal@arga-seguros.com",
        },
        { tenantId: "tenant-1" },
      ),
    ).rejects.toBeInstanceOf(TemplateAdminError);

    expect(mockState.deleteIds).toEqual(["tpl-new"]);
  });
});
