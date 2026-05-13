import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfiguracionSociedadTab } from "../ConfiguracionSociedadTab";

const mockSetEntity = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();

let mockSelectedEntityId: string | null = "entity-1";

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
