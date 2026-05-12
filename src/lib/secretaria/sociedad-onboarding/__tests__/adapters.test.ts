import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterContext, CargoInputDraft, PersonaDraft } from "../types";

interface AdapterMockState {
  personsByTax: Map<string, string>;
  inserts: Array<{ table: string; payload: Record<string, unknown> }>;
  nextPersonId: number;
}

function getMockState(): AdapterMockState {
  const holder = globalThis as typeof globalThis & { __sociedadOnboardingAdaptersMock?: AdapterMockState };
  holder.__sociedadOnboardingAdaptersMock ??= {
    personsByTax: new Map<string, string>(),
    inserts: [],
    nextPersonId: 1,
  };
  return holder.__sociedadOnboardingAdaptersMock;
}

const mockState = getMockState();

vi.mock("@/integrations/supabase/client", () => {
  function getStore() {
    const holder = globalThis as typeof globalThis & { __sociedadOnboardingAdaptersMock?: AdapterMockState };
    holder.__sociedadOnboardingAdaptersMock ??= {
      personsByTax: new Map<string, string>(),
      inserts: [],
      nextPersonId: 1,
    };
    return holder.__sociedadOnboardingAdaptersMock;
  }

  return {
    supabase: {
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
    mockState.nextPersonId = 1;
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
        metadata: { origen: "test" },
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
    const condiciones = mockState.inserts.filter((insert) => insert.table === "condiciones_persona");
    expect(condiciones[0].payload).toMatchObject({
      tenant_id: "tenant-1",
      entity_id: "entity-1",
      body_id: null,
      tipo_condicion: "ADMIN_PJ",
      estado: "VIGENTE",
      fecha_inicio: "2026-05-12",
      fecha_fin: null,
      fuente_designacion: "ESCRITURA",
      representative_person_id: "person-2",
      metadata: { origen: "test" },
    });
    expect(condiciones[1].payload).toMatchObject({
      body_id: "body-cda",
      tipo_condicion: "PRESIDENTE",
      fuente_designacion: "ACTA_NOMBRAMIENTO",
    });
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
    const rep = mockState.inserts.find((insert) => insert.table === "representaciones");
    expect(rep?.payload).toMatchObject({
      tenant_id: "tenant-1",
      entity_id: "entity-1",
      represented_person_id: "person-1",
      representative_person_id: "person-2",
      scope: "ADMIN_PJ_REPRESENTANTE",
      meeting_id: null,
      porcentaje_delegado: null,
      effective_from: "2026-05-12",
      effective_to: null,
      evidence: {
        fuente: "ESCRITURA",
        referencia: "Alta sociedad onboarding D6",
      },
    });
  });
});
