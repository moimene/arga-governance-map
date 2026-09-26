/**
 * MOI-137 — Prueba de arista (pantalla → librería), página Plantillas.
 *
 * Monta la página completa con datos reales (buildLegalTemplateReviewRows SIN
 * mockear) y comprueba que una plantilla ACTIVA con marcador de demostración
 * en `aprobada_por` nunca se pinta como «Aprobada legalmente». Hoy la página
 * no renderiza ese rótulo en ningún sitio (solo agrega incidencias por flag y
 * muestra el campo crudo `aprobada_por` bajo «Aprobada por», que es honesto);
 * este test es el que cae si algún día alguien vuelve a pintar el rótulo
 * calculado sin pasar por el veto del marcador de demo.
 */
import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "react-router-dom";
import * as __realModule1 from "@/hooks/useNormativeGovernance";
import * as __realModule2 from "@/hooks/useMesaControlSocietaria";
import * as __realModule3 from "@/hooks/usePlantillasProtegidas";
import * as __realModule4 from "@/hooks/useCurrentUser";
import * as __realModule5 from "@/components/secretaria/shell";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import Plantillas from "../Plantillas";

if (typeof vi.hoisted !== "function") {
  (vi as { hoisted?: <T>(factory: () => T) => T }).hoisted = <T,>(factory: () => T) => factory();
}

const mockState = vi.hoisted(() => ({
  rows: [] as PlantillaProtegidaRow[],
}));

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["react-router-dom", { ...__realModule0 }],
  ["@/hooks/useNormativeGovernance", { ...__realModule1 }],
  ["@/hooks/useMesaControlSocietaria", { ...__realModule2 }],
  ["@/hooks/usePlantillasProtegidas", { ...__realModule3 }],
  ["@/hooks/useCurrentUser", { ...__realModule4 }],
  ["@/components/secretaria/shell", { ...__realModule5 }],
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

vi.mock("@/hooks/useNormativeGovernance", () => ({
  useTemplateBindings: () => ({ data: [] }),
  useAssignTemplateBinding: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useMesaControlSocietaria", () => ({
  useMateriaCatalogoSocietario: () => ({ data: [] }),
}));

vi.mock("@/hooks/usePlantillasProtegidas", () => ({
  usePlantillasProtegidas: () => ({
    data: mockState.rows,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useUpdateEstadoPlantilla: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  extractTransitionResult: () => null,
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUserRole: () => ({
    primaryRole: "ADMIN_TENANT",
    user: { id: "u1", email: "demo@arga-seguros.com" },
    displayName: "Demo",
  }),
}));

vi.mock("@/components/secretaria/shell", () => ({
  useSecretariaScope: () => ({
    mode: "grupo",
    selectedEntity: null,
    isLoadingEntities: false,
  }),
}));

// jsdom (vía JSDOM directo en src/test/setup.ts) no implementa rAF en `window`
// (solo se polyfilla en `globalThis`, que aquí es un objeto distinto).
if (typeof window !== "undefined" && typeof window.requestAnimationFrame !== "function") {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof window.cancelAnimationFrame;
}

function renderPlantillas() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Plantillas />
    </QueryClientProvider>,
  );
}

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

describe("Plantillas (página) — MOI-137 arista pantalla→librería", () => {
  it("no pinta «Aprobada legalmente» ante una plantilla ACTIVA con marcador de demostración", () => {
    mockState.rows = [demoMarkedActiveTemplate()];

    renderPlantillas();

    expect(screen.queryAllByText("Aprobada legalmente")).toHaveLength(0);
  });
});
