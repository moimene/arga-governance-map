/**
 * MOI-137 — Prueba de arista (pantalla → librería), DashboardTab.
 *
 * A diferencia de DashboardTab.test.tsx (que mockea buildLegalTemplateReviewRows
 * a `[]`), este test deja la librería real para que, si algún día DashboardTab
 * empieza a pintar `review.label` en algún KPI o cola de incidencias, el
 * marcador de demostración siga sin poder producir «Aprobada legalmente».
 */
import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@tanstack/react-query";
import * as __realModule1 from "react-router-dom";
import * as __realModule2 from "@/context/TenantContext";
import * as __realModule3 from "@/hooks/usePlantillasProtegidas";
import * as __realModule4 from "@/hooks/secretaria/usePlantillaChangelog";
import * as __realModule5 from "../tab-guards";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { DashboardTab } from "../DashboardTab";

if (typeof vi.hoisted !== "function") {
  (vi as { hoisted?: <T>(factory: () => T) => T }).hoisted = <T,>(factory: () => T) => factory();
}

const mockState = vi.hoisted(() => ({
  rows: [] as PlantillaProtegidaRow[],
}));

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@tanstack/react-query", { ...__realModule0 }],
  ["react-router-dom", { ...__realModule1 }],
  ["@/context/TenantContext", { ...__realModule2 }],
  ["@/hooks/usePlantillasProtegidas", { ...__realModule3 }],
  ["@/hooks/secretaria/usePlantillaChangelog", { ...__realModule4 }],
  ["../tab-guards", { ...__realModule5 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[1] === "coverage" ? { covered: 14, gaps: [] } : 0,
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({
    tenantId: "tenant-1",
    entityId: null,
    personId: null,
    roleCode: "ADMIN_TENANT",
    isLoading: false,
  }),
}));

vi.mock("@/hooks/usePlantillasProtegidas", () => ({
  usePlantillasProtegidas: () => ({
    data: mockState.rows,
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/secretaria/usePlantillaChangelog", () => ({
  usePlantillaChangelog: () => ({
    data: [],
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../tab-guards", () => ({
  useTabAccess: () => ({
    canAccess: () => true,
    visibleTabs: [],
    isLoading: false,
  }),
}));

function demoMarkedActiveTemplate(overrides: Partial<PlantillaProtegidaRow> = {}): PlantillaProtegidaRow {
  return {
    id: "tpl-demo-marker",
    tenant_id: "00000000-0000-0000-0000-000000000003",
    tipo: "MODELO_ACUERDO",
    materia: "FORMULACION_CUENTAS",
    jurisdiccion: "ES",
    version: "1.0.0",
    estado: "ACTIVA",
    aprobada_por:
      "Pack base LSC — clon de la plantilla … aprobada en origen por «Comite Legal ARGA - Secretaria Societaria (demo-operativo)»",
    fecha_aprobacion: "2026-07-01",
    contenido_template: null,
    capa1_inmutable: "Texto jurídico vigente".padEnd(120, "."),
    capa2_variables: [],
    capa3_editables: [],
    referencia_legal: "Art. 253 LSC",
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: false,
    adoption_mode: "MEETING",
    organo_tipo: "CONSEJO_ADMIN",
    tipo_social: "SL",
    contrato_variables_version: null,
    created_at: "2026-07-01T00:00:00Z",
    materia_acuerdo: "FORMULACION_CUENTAS",
    approval_checklist: null,
    version_history: null,
    ...overrides,
  };
}

describe("DashboardTab — MOI-137 arista pantalla→librería", () => {
  it("no pinta «Aprobada legalmente» ante una plantilla ACTIVA con marcador de demostración", () => {
    mockState.rows = [demoMarkedActiveTemplate()];

    render(<DashboardTab />);

    expect(screen.queryByText("Aprobada legalmente")).toBeNull();
  });
});
