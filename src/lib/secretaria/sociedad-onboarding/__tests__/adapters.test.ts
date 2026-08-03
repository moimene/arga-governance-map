import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/integrations/supabase/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterContext, CargoInputDraft, PersonaDraft } from "../types";

interface AdapterMockState {
  personsByTax: Map<string, string>;
  inserts: Array<{ table: string; payload: Record<string, unknown> }>;
  rpcs: Array<{ fn: string; args: Record<string, unknown> }>;
  nextPersonId: number;
  nextRpcId: number;
}

function getMockState(): AdapterMockState {
  const holder = globalThis as typeof globalThis & { __sociedadOnboardingAdaptersMock?: AdapterMockState };
  holder.__sociedadOnboardingAdaptersMock ??= {
    personsByTax: new Map<string, string>(),
    inserts: [],
    rpcs: [],
    nextPersonId: 1,
    nextRpcId: 1,
  };
  return holder.__sociedadOnboardingAdaptersMock;
}

const mockState = getMockState();

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
  function getStore() {
    const holder = globalThis as typeof globalThis & { __sociedadOnboardingAdaptersMock?: AdapterMockState };
    holder.__sociedadOnboardingAdaptersMock ??= {
      personsByTax: new Map<string, string>(),
      inserts: [],
      rpcs: [],
      nextPersonId: 1,
      nextRpcId: 1,
    };
    return holder.__sociedadOnboardingAdaptersMock;
  }

  return {
    supabase: {
      async rpc(fn: string, args: Record<string, unknown>) {
        const state = getStore();
        state.rpcs.push({ fn, args });
        return { data: `rpc-${state.nextRpcId++}`, error: null };
      },
      from(table: string) {
        const state = getStore();
        const filters: Record<string, unknown> = {};
        const chain = {
          select() {
            return chain;
          },
          eq(key: string, value: unknown) {
            filters[key] = value;
            return chain;
          },
          limit() {
            return chain;
          },
          async maybeSingle() {
            if (table !== "persons") return { data: null, error: null };
            const taxId = String(filters.tax_id ?? "");
            const id = state.personsByTax.get(taxId);
            return { data: id ? { id } : null, error: null };
          },
          insert(payload: Record<string, unknown>) {
            state.inserts.push({ table, payload });
            if (table === "persons") {
              const id = `person-${state.nextPersonId++}`;
              state.personsByTax.set(String(payload.tax_id), id);
              return {
                select() {
                  return {
                    async single() {
                      return { data: { id }, error: null };
                    },
                  };
                },
              };
            }
            return { error: null };
          },
        };
        return chain;
      },
    },
  };
});

const ctx: AdapterContext = {
  tenantId: "tenant-1",
  entityId: "entity-1",
  bodyJuntaId: "body-junta",
  bodyAdminId: "body-admin",
  bodyConsejoId: "body-cda",
  bodyComisiones: {
    COMISION_AUDITORIA: "body-auditoria",
  },
};

function persona(key: string, taxId: string, personType: PersonaDraft["person_type"] = "PF"): PersonaDraft {
  return {
    key,
    tax_id: taxId,
    full_name: `Persona ${key}`,
    denomination: personType === "PJ" ? `Sociedad ${key}` : "",
    email: "",
    person_type: personType,
  };
}

describe("sociedad-onboarding adapters", () => {
  beforeEach(() => {
    mockState.personsByTax.clear();
    mockState.inserts.length = 0;
    mockState.rpcs.length = 0;
    mockState.nextPersonId = 1;
    mockState.nextRpcId = 1;
  });

  it("reutiliza personas por NIF antes de crear nuevas filas", async () => {
    mockState.personsByTax.set("A123", "existing-person");
    const { resolvePersonByTaxIdOrCreate } = await import("../adapters");

    const id = await resolvePersonByTaxIdOrCreate("tenant-1", persona("existing", "A123", "PJ"));

    expect(id).toBe("existing-person");
    expect(mockState.inserts).toEqual([]);
  });

  it("persiste cargos iniciales con schema canonico y representative_person_id para ADMIN_PJ", async () => {
    const { persistInitialCargos } = await import("../adapters");
    const adminPJ = persona("admin-pj", "B123", "PJ");
    adminPJ.representante = persona("rep", "12345678Z");
    const cargos: CargoInputDraft[] = [
      {
        key: "cargo-1",
        tipo_condicion: "ADMIN_PJ",
        bodyKey: null,
        persona: adminPJ,
        fecha_inicio: "2026-05-12",
        fuente_designacion: "ESCRITURA",
      },
      {
        key: "cargo-2",
        tipo_condicion: "PRESIDENTE",
        bodyKey: "CDA",
        persona: persona("presidente", "11111111H"),
        fecha_inicio: "2026-05-12",
        fuente_designacion: "ACTA_NOMBRAMIENTO",
      },
    ];

    const result = await persistInitialCargos(ctx, cargos);

    expect(result.failedCargos).toEqual([]);
    expect(result.okCount).toBe(2);
    expect(mockState.inserts.some((insert) => insert.table === "condiciones_persona")).toBe(false);
    const designaciones = mockState.rpcs.filter((rpc) => rpc.fn === "fn_designar_cargo");
    expect(designaciones[0].args).toMatchObject({
      p_tenant_id: "tenant-1",
      p_entity_id: "entity-1",
      p_body_id: null,
      p_tipo_condicion: "ADMIN_PJ",
      p_fecha_inicio: "2026-05-12",
      p_fuente_designacion: "ESCRITURA",
      p_representative_person_id: "person-2",
      p_cesar_singleton_previo: true,
    });
    expect(designaciones[1].args).toMatchObject({
      p_body_id: "body-cda",
      p_tipo_condicion: "PRESIDENTE",
      p_fuente_designacion: "ACTA_NOMBRAMIENTO",
    });
  });

  it("persiste representative_person_id cuando el consejero es PJ", async () => {
    const { persistInitialCargos } = await import("../adapters");
    const consejeroPJ = persona("consejero-pj", "B999", "PJ");
    consejeroPJ.representante = persona("rep-consejero", "87654321A");

    const result = await persistInitialCargos(ctx, [
      {
        key: "cargo-pj-cda",
        tipo_condicion: "CONSEJERO",
        bodyKey: "CDA",
        persona: consejeroPJ,
        fecha_inicio: "2026-05-12",
        fuente_designacion: "ESCRITURA",
      },
    ]);

    expect(result.failedCargos).toEqual([]);
    const condicion = mockState.rpcs.find((rpc) => rpc.fn === "fn_designar_cargo");
    expect(condicion?.args).toMatchObject({
      p_body_id: "body-cda",
      p_tipo_condicion: "CONSEJERO",
      p_representative_person_id: "person-2",
    });
  });

  it("falla cerrado ante metadata libre que la RPC autoritativa no puede conservar", async () => {
    const { persistInitialCargos } = await import("../adapters");
    const cargo: CargoInputDraft = {
      key: "cargo-metadata",
      tipo_condicion: "PRESIDENTE",
      bodyKey: "CDA",
      persona: persona("presidente", "11111111H"),
      fecha_inicio: "2026-05-12",
      fuente_designacion: "ACTA_NOMBRAMIENTO",
      metadata: { origen: "no-modelado" },
    };

    const result = await persistInitialCargos(ctx, [cargo]);

    expect(result.okCount).toBe(0);
    expect(result.failedCargos[0]?.error).toContain("no admite metadata libre");
    expect(mockState.rpcs).toEqual([]);
    expect(mockState.inserts).toEqual([]);
  });

  it("persiste representaciones ADMIN_PJ_REPRESENTANTE sin meeting_id", async () => {
    const { persistInitialRepresentaciones } = await import("../adapters");
    const represented = persona("admin-pj", "B123", "PJ");
    const representante = persona("rep", "12345678Z");

    const result = await persistInitialRepresentaciones(ctx, [
      {
        represented,
        representante,
        effective_from: "2026-05-12",
        fuente: "ESCRITURA",
      },
    ]);

    expect(result.failedReps).toEqual([]);
    expect(result.okCount).toBe(1);
    expect(mockState.inserts.some((insert) => insert.table === "representaciones")).toBe(false);
    const rep = mockState.rpcs.find((rpc) => rpc.fn === "fn_upsert_representante_admin_pj");
    expect(rep?.args).toMatchObject({
      p_tenant_id: "tenant-1",
      p_entity_id: "entity-1",
      p_represented_person_id: "person-1",
      p_representative_person_id: "person-2",
      p_effective_from: "2026-05-12",
      p_inscripcion_rm_referencia: null,
      p_inscripcion_rm_fecha: null,
    });
  });
});
