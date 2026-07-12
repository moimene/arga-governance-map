import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@tanstack/react-query";
import * as __realModule1 from "react-router-dom";
import * as __realModule2 from "@/context/TenantContext";
import * as __realModule3 from "@/hooks/usePlantillasProtegidas";
import * as __realModule4 from "@/hooks/secretaria/usePlantillaChangelog";
import * as __realModule5 from "@/lib/secretaria/legal-template-coverage";
import * as __realModule6 from "@/lib/secretaria/legal-template-review";
import * as __realModule7 from "@/lib/secretaria/template-admin";
import * as __realModule8 from "../tab-guards";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { CORE_V1_MATERIAS_COUNT } from "@/lib/secretaria/template-admin";
import { DashboardTab } from "../DashboardTab";

const mockNavigate = vi.fn();
const mockValidate = vi.fn();
let mockOrphanCount = 0;
let mockRows: PlantillaProtegidaRow[] = [];
let mockCanImport = true;
let mockSearchParams = new URLSearchParams();

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@tanstack/react-query", { ...__realModule0 }],
  ["react-router-dom", { ...__realModule1 }],
  ["@/context/TenantContext", { ...__realModule2 }],
  ["@/hooks/usePlantillasProtegidas", { ...__realModule3 }],
  ["@/hooks/secretaria/usePlantillaChangelog", { ...__realModule4 }],
  ["@/lib/secretaria/legal-template-coverage", { ...__realModule5 }],
  ["@/lib/secretaria/legal-template-review", { ...__realModule6 }],
  ["@/lib/secretaria/template-admin", { ...__realModule7 }],
  ["../tab-guards", { ...__realModule8 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@tanstack/react-query", () => ({
  ...__realModule0,
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data:
      queryKey[1] === "coverage"
        ? { covered: CORE_V1_MATERIAS_COUNT, gaps: [] }
        : mockOrphanCount,
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("react-router-dom", () => ({
  ...__realModule1,
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

vi.mock("@/context/TenantContext", () => ({
  ...__realModule2,
  useTenantContext: () => ({
    tenantId: "tenant-1",
    entityId: null,
    personId: null,
    roleCode: "ADMIN_TENANT",
    isLoading: false,
  }),
}));

vi.mock("@/hooks/usePlantillasProtegidas", () => ({
  ...__realModule3,
  usePlantillasProtegidas: () => ({
    data: mockRows,
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/secretaria/usePlantillaChangelog", () => ({
  ...__realModule4,
  usePlantillaChangelog: () => ({
    data: [],
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/lib/secretaria/legal-template-coverage", () => ({
  ...__realModule5,
  buildLegalTemplateCoverage: () => [],
}));

vi.mock("@/lib/secretaria/legal-template-review", () => ({
  ...__realModule6,
  buildLegalTemplateReviewRows: () => [],
}));

vi.mock("@/lib/secretaria/template-admin", () => ({
  ...__realModule7,
  validateTemplateForActivation: (...args: unknown[]) => mockValidate(...args),
}));

vi.mock("../tab-guards", () => ({
  ...__realModule8,
  useTabAccess: () => ({
    canAccess: (tab: string) => tab !== "importar" || mockCanImport,
    visibleTabs: [],
    isLoading: false,
  }),
}));

function activeTemplate(overrides: Partial<PlantillaProtegidaRow> = {}): PlantillaProtegidaRow {
  return {
    id: "tpl-active",
    tenant_id: "tenant-1",
    tipo: "MODELO_ACUERDO",
    materia: "APROBACION_CUENTAS",
    jurisdiccion: "ES",
    version: "1.0.0",
    estado: "ACTIVA",
    aprobada_por: "Comité Legal",
    fecha_aprobacion: "2026-07-01",
    contenido_template: null,
    capa1_inmutable: "Texto jurídico vigente".padEnd(120, "."),
    capa2_variables: [],
    capa3_editables: [],
    referencia_legal: "Art. 160 LSC",
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: false,
    adoption_mode: "MEETING",
    organo_tipo: "JUNTA",
    tipo_social: "SA",
    contrato_variables_version: null,
    created_at: "2026-07-01T00:00:00Z",
    materia_acuerdo: "APROBACION_CUENTAS",
    approval_checklist: null,
    version_history: null,
    ...overrides,
  };
}

describe("DashboardTab", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockValidate.mockReset();
    mockValidate.mockReturnValue({
      ok: true,
      issues: [],
      summary: { blocking: 0, warning: 0, info: 0 },
    });
    mockOrphanCount = 0;
    mockRows = [activeTemplate()];
    mockCanImport = true;
    mockSearchParams = new URLSearchParams();
  });

  it("trata las plantillas sin changelog como advertencia y enlaza su auditoría", () => {
    mockOrphanCount = 73;
    render(<DashboardTab />);

    expect(screen.getByText("Con advertencias")).toBeTruthy();
    expect(screen.queryByText("Operativo")).toBeNull();
    expect(screen.getByRole("heading", { name: "Cola de incidencias" })).toBeTruthy();
    expect(screen.getByText("Trazabilidad formal pendiente")).toBeTruthy();
    expect(screen.getByText("73 elementos afectados")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Revisar trazabilidad:/i }));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/secretaria/gestor-plantillas?tab=auditoria&focus=sin-changelog",
      { replace: false },
    );
  });

  it("normaliza shapes legacy para Gate PRE y abre la primera plantilla exacta", () => {
    mockRows = [
      activeTemplate({
        id: "tpl-legacy",
        capa2_variables: [{ name: "entities.name", source: "entities.*", display: "Siempre" }],
        capa3_editables: [{ field: "observaciones", hint: "Detalle opcional" }],
      }),
    ];
    mockValidate.mockReturnValue({
      ok: false,
      issues: [
        {
          severity: "BLOCKING",
          code: "CAPA1_LENGTH",
          message: "Contenido insuficiente",
          field: "capa1_inmutable",
        },
      ],
      summary: { blocking: 1, warning: 0, info: 0 },
    });

    render(<DashboardTab />);

    expect(mockValidate).toHaveBeenCalledWith(
      expect.objectContaining({
        capa2_variables: [expect.objectContaining({ variable: "entities.name" })],
        capa3_editables: [expect.objectContaining({ campo: "observaciones" })],
      }),
      expect.objectContaining({ tenantId: "tenant-1" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir primera plantilla:/i }));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/secretaria/gestor-plantillas?tab=catalogo&plantilla=tpl-legacy",
      { replace: false },
    );
  });

  it("conserva el contexto al abrir una incidencia", () => {
    mockOrphanCount = 1;
    mockSearchParams = new URLSearchParams(
      "tab=dashboard&scope=sociedad&entity=arga&materia=FUSION&q=acta&modo=legal",
    );

    render(<DashboardTab />);
    fireEvent.click(screen.getByRole("button", { name: /Revisar trazabilidad:/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      "/secretaria/gestor-plantillas?tab=auditoria&scope=sociedad&entity=arga&materia=FUSION&q=acta&modo=legal&focus=sin-changelog",
      { replace: false },
    );
  });

  it("no ofrece importar en el estado vacío sin permiso", () => {
    mockRows = [];
    mockCanImport = false;

    render(<DashboardTab />);

    expect(screen.queryByRole("button", { name: "Importar tus primeras plantillas" })).toBeNull();
    expect(
      screen.getByText("Un administrador del tenant debe importar la primera plantilla."),
    ).toBeTruthy();
  });
});
