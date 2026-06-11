import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "sonner";
import * as __realModule1 from "@/components/secretaria/shell";
import * as __realModule2 from "@/hooks/useEntitySettingsCatalog";
import * as __realModule3 from "@/hooks/useEntitySettings";
import * as __realModule4 from "@/hooks/usePlantillasProtegidas";
import * as __realModule5 from "@/hooks/useCapa3Overrides";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfiguracionSociedadTab } from "../ConfiguracionSociedadTab";

const mockSetEntity = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();

let mockSelectedEntityId: string | null = "entity-1";

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["sonner", { ...__realModule0 }],
  ["@/components/secretaria/shell", { ...__realModule1 }],
  ["@/hooks/useEntitySettingsCatalog", { ...__realModule2 }],
  ["@/hooks/useEntitySettings", { ...__realModule3 }],
  ["@/hooks/usePlantillasProtegidas", { ...__realModule4 }],
  ["@/hooks/useCapa3Overrides", { ...__realModule5 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/secretaria/shell", () => ({
  useSecretariaScope: () => ({
    mode: mockSelectedEntityId ? "sociedad" : "grupo",
    selectedEntity: mockSelectedEntityId
      ? {
          id: mockSelectedEntityId,
          name: "ARGA Seguros",
          legalName: "ARGA Seguros, S.A.",
          jurisdiction: "ES",
          legalForm: "SA",
          status: "Active",
          materiality: "High",
        }
      : null,
    entities: [
      {
        id: "entity-1",
        name: "ARGA Seguros",
        legalName: "ARGA Seguros, S.A.",
        jurisdiction: "ES",
        legalForm: "SA",
        status: "Active",
        materiality: "High",
      },
    ],
    isLoadingEntities: false,
    currentSection: "Gestor",
    setMode: vi.fn(),
    setEntity: mockSetEntity,
    createScopedTo: (to: string) => to,
  }),
}));

vi.mock("@/hooks/useEntitySettingsCatalog", () => ({
  useEntitySettingsCatalog: () => ({
    isLoading: false,
    data: [
      {
        key: "es_cotizada",
        value_type: "enum",
        allowed_values: ["SÍ", "NO"],
        default_value: "NO",
        descripcion: "Sociedad cotizada",
        categoria: "CONFIG_CONDICIONAL",
        usado_por_plantillas: ["APROBACION_CUENTAS"],
        estado_catalog: "ACTIVA",
        created_at: "2026-05-13T00:00:00Z",
      },
    ],
  }),
}));

vi.mock("@/hooks/useEntitySettings", () => ({
  parseEntitySettingInput: (catalog: { allowed_values?: unknown[] | null }, value: string) =>
    catalog.allowed_values?.includes(value)
      ? { ok: true, value }
      : { ok: false, message: "El valor no está permitido por el catálogo." },
  settingValueToDraft: (value: unknown) => (value === null || value === undefined ? "" : String(value)),
  useEntitySettings: () => ({
    isLoading: false,
    byKey: new Map([
      [
        "es_cotizada",
        {
          id: "setting-1",
          tenant_id: "tenant-1",
          entity_id: "entity-1",
          key: "es_cotizada",
          value: "NO",
          created_at: "2026-05-13T00:00:00Z",
          updated_at: null,
          updated_by: null,
        },
      ],
    ]),
  }),
  useUpsertEntitySetting: () => ({
    mutateAsync: mockUpsert,
    isPending: false,
  }),
  useDeleteEntitySetting: () => ({
    mutateAsync: mockDelete,
    isPending: false,
  }),
}));

vi.mock("@/hooks/usePlantillasProtegidas", () => ({
  usePlantillasProtegidas: () => ({
    isLoading: false,
    data: [],
  }),
}));

vi.mock("@/hooks/useCapa3Overrides", () => ({
  useCapa3Overrides: () => ({
    isLoading: false,
    data: [],
  }),
  useUpsertCapa3Override: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteCapa3Override: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  buildCapa3OverridePayload: () => ({
    ok: true,
    payload: {
      defaultValueOverride: null,
      opcionesOverride: null,
      obligatoriedadOverride: "OPCIONAL",
      motivo: "Motivo suficiente",
    },
  }),
}));

describe("ConfiguracionSociedadTab", () => {
  beforeEach(() => {
    mockSetEntity.mockReset();
    mockUpsert.mockReset();
    mockDelete.mockReset();
    mockSelectedEntityId = "entity-1";
  });

  it("guarda un override catalogado para la sociedad seleccionada", async () => {
    mockUpsert.mockResolvedValueOnce({});
    render(<ConfiguracionSociedadTab />);

    fireEvent.change(screen.getByLabelText("Valor sociedad"), { target: { value: "SÍ" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalledOnce());
    expect(mockUpsert).toHaveBeenCalledWith({
      entityId: "entity-1",
      key: "es_cotizada",
      value: "SÍ",
    });
  });

  it("muestra estado vacío cuando no hay sociedad seleccionada", () => {
    mockSelectedEntityId = null;
    render(<ConfiguracionSociedadTab />);

    expect(screen.getByText("No hay sociedad seleccionada.")).toBeTruthy();
  });
});
