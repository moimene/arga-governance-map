/**
 * MOI-137 — Prueba de arista (pantalla → librería).
 *
 * Monta CatalogoTab con datos reales (buildLegalTemplateReviewRows SIN mockear)
 * y comprueba que una plantilla ACTIVA con marcador de demostración en
 * `aprobada_por` nunca se pinta como «Aprobada legalmente». Si alguien vuelve a
 * introducir el bug — en esta pantalla o en la librería que consume — este test
 * cae, no solo el unitario de la librería.
 */
import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "react-router-dom";
import * as __realModule1 from "@/context/TenantContext";
import * as __realModule2 from "@/hooks/usePlantillasProtegidas";
import * as __realModule3 from "@/hooks/useNormativeGovernance";
import * as __realModule4 from "@/hooks/useCurrentUser";
import * as __realModule5 from "@/components/secretaria/shell";
import * as __realModule6 from "../tab-guards";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { CatalogoTab } from "../CatalogoTab";

// jsdom (vía JSDOM directo en src/test/setup.ts) no implementa rAF en `window`
// (solo se polyfilla en `globalThis`, que aquí es un objeto distinto);
// CatalogoTab lo usa para desplazar la fila seleccionada a la vista.
if (typeof window !== "undefined" && typeof window.requestAnimationFrame !== "function") {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof window.cancelAnimationFrame;
}

function renderCatalogoTab() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CatalogoTab />
    </QueryClientProvider>,
  );
}

if (typeof vi.hoisted !== "function") {
  (vi as { hoisted?: <T>(factory: () => T) => T }).hoisted = <T,>(factory: () => T) => factory();
}

const mockState = vi.hoisted(() => ({
  rows: [] as PlantillaProtegidaRow[],
}));

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["react-router-dom", { ...__realModule0 }],
  ["@/context/TenantContext", { ...__realModule1 }],
  ["@/hooks/usePlantillasProtegidas", { ...__realModule2 }],
  ["@/hooks/useNormativeGovernance", { ...__realModule3 }],
  ["@/hooks/useCurrentUser", { ...__realModule4 }],
  ["@/components/secretaria/shell", { ...__realModule5 }],
  ["../tab-guards", { ...__realModule6 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

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
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useUpdateEstadoPlantilla: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  // No se ejerce ningún flujo de transición en este test; basta un stub.
  extractTransitionResult: () => null,
}));

vi.mock("@/hooks/useNormativeGovernance", () => ({
  useTemplateBindings: () => ({ data: [] }),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ user: { id: "u1", email: "demo@arga-seguros.com" }, loading: false }),
}));

vi.mock("@/components/secretaria/shell", () => ({
  useSecretariaScope: () => ({
    mode: "grupo",
    selectedEntity: null,
    isLoadingEntities: false,
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
    // Marcador de demostración — MOI-137: no debe constituir aprobación nominativa.
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

describe("CatalogoTab — MOI-137 arista pantalla→librería", () => {
  it("no pinta «Aprobada legalmente» sobre una plantilla ACTIVA con marcador de demostración", () => {
    mockState.rows = [demoMarkedActiveTemplate()];

    renderCatalogoTab();

    expect(screen.queryAllByText("Aprobada legalmente")).toHaveLength(0);
    // El template aparece tanto en la tarjeta de la lista como en el panel de
    // detalle (auto-seleccionado al ser el único resultado) — ambos deben
    // rotular «Vigente sin aprobación nominativa».
    expect(screen.getAllByText("Vigente sin aprobación nominativa").length).toBeGreaterThan(0);
  });

  it("sí pinta «Aprobada legalmente» cuando la aprobación es nominativa real (control positivo)", () => {
    mockState.rows = [
      demoMarkedActiveTemplate({
        id: "tpl-nominativa-real",
        aprobada_por: "Rosa Zarza — Comité de Gobernanza",
      }),
    ];

    renderCatalogoTab();

    expect(screen.getAllByText("Aprobada legalmente").length).toBeGreaterThan(0);
  });
});
