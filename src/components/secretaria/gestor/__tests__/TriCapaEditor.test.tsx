import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "sonner";
import * as __realModule1 from "@/hooks/usePlantillasProtegidas";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TriCapaEditor } from "../TriCapaEditor";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";

const mockMutateAsync = vi.fn();

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["sonner", { ...__realModule0 }],
  ["@/hooks/usePlantillasProtegidas", { ...__realModule1 }],
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

vi.mock("@/hooks/usePlantillasProtegidas", () => ({
  useUpdateContenidoPlantilla: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

const basePlantilla = (overrides: Partial<PlantillaProtegidaRow> = {}): PlantillaProtegidaRow => ({
  id: "tpl-1",
  tenant_id: "tenant-1",
  tipo: "MODELO_ACUERDO",
  materia: "APROBACION_CUENTAS",
  jurisdiccion: "ES",
  version: "1.0.0",
  estado: "BORRADOR",
  aprobada_por: null,
  fecha_aprobacion: null,
  contenido_template: null,
  capa1_inmutable: "PRIMERO.- Aprobar las cuentas anuales de la sociedad correspondientes al ejercicio cerrado.".padEnd(130, "x"),
  capa2_variables: [],
  capa3_editables: [
    {
      campo: "observaciones",
      obligatoriedad: "OPCIONAL",
      descripcion: "Observaciones del acuerdo",
    },
  ],
  referencia_legal: "Art. 160 LSC",
  notas_legal: null,
  variables: [],
  protecciones: {},
  snapshot_rule_pack_required: false,
  adoption_mode: "MEETING",
  organo_tipo: "JUNTA_GENERAL",
  contrato_variables_version: null,
  created_at: "2026-05-13T00:00:00Z",
  materia_acuerdo: null,
  approval_checklist: null,
  version_history: null,
  ...overrides,
});

describe("TriCapaEditor", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
  });

  it("guarda cambios de capa1 con el hook auditado", async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    render(
      <TriCapaEditor
        plantilla={basePlantilla({
          capa3_editables: [
            {
              campo: "observaciones",
              obligatoriedad: "OPCIONAL",
              descripcion: "Observaciones del acuerdo",
              tipo: "textarea",
              requerido: false,
            },
          ],
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("Editor de contenido capa 1"), {
      target: {
        value: "PRIMERO.- Texto de acuerdo actualizado con longitud suficiente para pasar Gate PRE de borrador.".padEnd(130, "y"),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce());
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "tpl-1",
        motivo: expect.stringContaining("Editor tri-capa"),
        capa1_inmutable: expect.stringContaining("Texto de acuerdo actualizado"),
        capa3_editables: [
          expect.objectContaining({
            campo: "observaciones",
            tipo: "textarea",
            requerido: false,
          }),
        ],
      }),
    );
  });

  it("bloquea edición si no es BORRADOR", () => {
    render(<TriCapaEditor plantilla={basePlantilla({ estado: "ACTIVA" })} />);

    expect((screen.getByLabelText("Editor de contenido capa 1") as HTMLTextAreaElement).readOnly).toBe(true);
    // G5 — modo solo lectura honesto: Guardar/Cancelar NO se renderizan y el
    // banner explica el motivo.
    expect(screen.queryByRole("button", { name: /guardar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancelar/i })).toBeNull();
    expect(screen.getByText(/modo solo lectura/i)).toBeTruthy();
    expect(screen.getByText(/solo las plantillas en borrador/i)).toBeTruthy();
  });

  it("con readOnlyReason oculta Guardar/Cancelar y muestra banner de solo lectura", () => {
    render(
      <TriCapaEditor
        plantilla={basePlantilla()}
        readOnlyReason="Tu rol no tiene permisos de edición de plantillas."
      />,
    );

    expect(screen.queryByRole("button", { name: /guardar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancelar/i })).toBeNull();
    expect(screen.getByText(/modo solo lectura/i)).toBeTruthy();
    expect(screen.getByText(/tu rol permite revisar esta plantilla, no modificarla/i)).toBeTruthy();
    expect((screen.getByLabelText("Editor de contenido capa 1") as HTMLTextAreaElement).readOnly).toBe(true);
  });

  it("con permisos de edición el botón Guardar sí se renderiza", () => {
    render(<TriCapaEditor plantilla={basePlantilla()} />);

    expect(screen.getByRole("button", { name: /guardar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeTruthy();
    expect(screen.queryByText(/modo solo lectura/i)).toBeNull();
  });

  it("muestra diagnóstico local para variables duplicadas", () => {
    render(
      <TriCapaEditor
        plantilla={basePlantilla({
          capa2_variables: [
            { variable: "entities.name", fuente: "entities.*", condicion: "SIEMPRE" },
            { variable: "entities.name", fuente: "entities.*", condicion: "SIEMPRE" },
          ],
        })}
      />,
    );

    // G6 — etiqueta humana como texto principal + código técnico como detalle.
    expect(screen.getByText(/Variable duplicada en la capa 2/)).toBeTruthy();
    expect(screen.getByText(/CAPA2_DUPLICATE_VARIABLE/)).toBeTruthy();
  });
});
