import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/integrations/supabase/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TemplateAdminError, type PlantillaCandidate } from "../types";

const mockState = {
  current: null as PlantillaCandidate | null,
  plantillaInsertError: null as unknown,
  plantillaInsertId: "tpl-new",
  changelogInsertError: null as unknown,
  rollbackError: null as unknown,
  updateCalls: [] as Array<Record<string, unknown>>,
  deleteIds: [] as string[],
};

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/integrations/supabase/client", { ...__realModule0 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@/integrations/supabase/client", () => {
  function selectCurrentChain() {
    const chain = {
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: mockState.current, error: null })),
    };
    return chain;
  }

  function updateChain(payload: Record<string, unknown>) {
    mockState.updateCalls.push(payload);
    const isRollback = payload.estado === mockState.current?.estado;
    const chain = {
      error: isRollback ? mockState.rollbackError : null,
      eq: vi.fn(() => chain),
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
            select: vi.fn(() => selectCurrentChain()),
            update: vi.fn((payload: Record<string, unknown>) => updateChain(payload)),
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
    },
  };
});

import {
  createDraftFromImport,
  transitionTemplateState,
} from "../template-admin-service";

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
  aprobada_por: null,
  fecha_aprobacion: null,
  referencia_legal: "Art. 160 LSC",
  capa1_inmutable: "PRIMERO.- Aprobar cuentas.".padEnd(120, "x"),
  capa2_variables: [],
  capa3_editables: [],
  ...overrides,
});

describe("template-admin-service — rollback compensatorio", () => {
  beforeEach(() => {
    mockState.current = baseTemplate();
    mockState.plantillaInsertError = null;
    mockState.plantillaInsertId = "tpl-new";
    mockState.changelogInsertError = null;
    mockState.rollbackError = null;
    mockState.updateCalls = [];
    mockState.deleteIds = [];
  });

  it("transitionTemplateState revierte estado si falla el changelog", async () => {
    mockState.changelogInsertError = { message: "insert log failed" };

    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "REVISADA",
        motivo: "revisión legal",
        actor: "legal@arga-seguros.com",
      },
      { tenantId: "tenant-1" },
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "CHANGELOG_FAILED", rolledBack: true });
    expect(mockState.updateCalls).toEqual([
      { estado: "REVISADA" },
      { estado: "BORRADOR", aprobada_por: null, fecha_aprobacion: null },
    ]);
  });

  it("transitionTemplateState reporta rolledBack=false si falla el revert", async () => {
    mockState.changelogInsertError = { message: "insert log failed" };
    mockState.rollbackError = { message: "rollback failed" };

    const result = await transitionTemplateState(
      {
        plantillaId: "tpl-1",
        to: "REVISADA",
        motivo: "revisión legal",
        actor: "legal@arga-seguros.com",
      },
      { tenantId: "tenant-1" },
    );

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: "CHANGELOG_FAILED", rolledBack: false });
  });

  it("createDraftFromImport elimina el borrador si falla el changelog", async () => {
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
