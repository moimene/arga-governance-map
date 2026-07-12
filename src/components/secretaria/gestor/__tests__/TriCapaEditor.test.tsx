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
        mode="tecnica"
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
      }),
    );
    expect(mockMutateAsync.mock.calls[0][0]).not.toHaveProperty("capa3_editables");
  });

  it("bloquea edición si no es BORRADOR", () => {
    render(<TriCapaEditor mode="tecnica" plantilla={basePlantilla({ estado: "ACTIVA" })} />);

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
        mode="tecnica"
        plantilla={basePlantilla()}
        readOnlyReason="Tu rol no tiene permisos de edición de plantillas."
        readOnlyDetail="Tu rol permite revisar esta plantilla, no modificarla."
      />,
    );

    expect(screen.queryByRole("button", { name: /guardar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancelar/i })).toBeNull();
    expect(screen.getByText(/modo solo lectura/i)).toBeTruthy();
    expect(screen.getByText(/tu rol permite revisar esta plantilla, no modificarla/i)).toBeTruthy();
    expect((screen.getByLabelText("Editor de contenido capa 1") as HTMLTextAreaElement).readOnly).toBe(true);
  });

  it("con permisos de edición el botón Guardar sí se renderiza", () => {
    render(<TriCapaEditor mode="tecnica" plantilla={basePlantilla()} />);

    expect(screen.getByRole("button", { name: /guardar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeTruthy();
    expect(screen.queryByText(/modo solo lectura/i)).toBeNull();
  });

  it("muestra diagnóstico local para variables duplicadas", () => {
    render(
      <TriCapaEditor
        mode="tecnica"
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

  it("presenta la vista legal con namespaces, uso, obligatoriedad y validación por campo", () => {
    render(
      <TriCapaEditor
        mode="legal"
        plantilla={basePlantilla({
          estado: "ACTIVA",
          capa1_inmutable: "La sociedad {{ENTIDAD.denominacion_social}} adopta el acuerdo.".padEnd(130, "x"),
          capa2_variables: [
            {
              variable: "ENTIDAD.denominacion_social",
              fuente: "entities.legal_name",
              condicion: "SIEMPRE",
            },
          ],
          capa3_editables: [
            {
              field: "observaciones",
              hint: "Motivación jurídica adicional",
              required: true,
              type: "textarea",
            },
          ],
        })}
      />,
    );

    expect(screen.getByLabelText("Vista legal del texto protegido")).toBeTruthy();
    expect(screen.getByText("Entidad")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Capa 2 — Variables automáticas/ }));
    expect(screen.getByRole("columnheader", { name: "Uso en el texto" })).toBeTruthy();
    expect(screen.getByText("Usada una vez")).toBeTruthy();
    expect(screen.getByText("Siempre")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Capa 3 — Campos editables/ }));
    expect(screen.getByText("Obligatoria")).toBeTruthy();
    expect(screen.getByText("Tipo de dato: Texto largo")).toBeTruthy();
    expect(screen.getByText("Motivación jurídica adicional")).toBeTruthy();
    expect(screen.queryByLabelText("Editor de contenido capa 1")).toBeNull();
  });

  it("marca cada identificador duplicado de Capa 2 como inválido y lo describe", () => {
    render(
      <TriCapaEditor
        mode="tecnica"
        plantilla={basePlantilla({
          capa2_variables: [
            { variable: "entities.name", fuente: "entities.name", condicion: "SIEMPRE" },
            { variable: "entities.name", fuente: "entities.name", condicion: "SIEMPRE" },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Capa 2 — Variables automáticas/ }));
    const inputs = screen.getAllByLabelText(/Variable capa 2/);
    expect(inputs).toHaveLength(2);
    expect(inputs[0].getAttribute("aria-invalid")).toBe("true");
    expect(inputs[1].getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById("capa2-validation-0")?.textContent).toContain(
      "está duplicada en Capa 2",
    );
    expect(document.getElementById("capa2-validation-1")?.textContent).toContain(
      "está duplicada en Capa 2",
    );
  });

  it("conserva en solo lectura defaults y opciones con tipos no textuales", () => {
    render(
      <TriCapaEditor
        mode="tecnica"
        plantilla={basePlantilla({
          capa3_editables: [
            {
              campo: "umbral",
              descripcion: "Umbral tipado",
              obligatoriedad: "OPCIONAL",
              default: 3,
              opciones: [1, { code: "alto" }],
            },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Capa 3 — Campos editables/ }));
    const defaultInput = screen.getByLabelText("Default capa 3 1") as HTMLInputElement;
    const optionsInput = screen.getByLabelText("Opciones capa 3 1") as HTMLInputElement;
    expect(defaultInput.readOnly).toBe(true);
    expect(defaultInput.value).toBe("3");
    expect(optionsInput.readOnly).toBe(true);
    expect(optionsInput.value).toBe('[1,{"code":"alto"}]');
    expect(screen.getByText(/Valor tipado conservado sin cambios/)).toBeTruthy();
    expect(screen.getByText(/Opciones tipadas conservadas sin cambios/)).toBeTruthy();
  });

  it("envía solo la capa modificada para no pisar ediciones concurrentes", async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    render(
      <TriCapaEditor
        mode="tecnica"
        plantilla={basePlantilla({
          capa2_variables: [
            {
              name: "denominacion_social",
              source: "entities.legal_name",
              condition: "SIEMPRE",
              fallback: "ARGA",
              descripcion_juridica: "Denominación registral",
            },
          ],
          capa3_editables: [
            {
              field: "observaciones",
              hint: "Motivación jurídica adicional",
              required: false,
              type: "textarea",
              validacion_recomendada: "max:500",
            },
          ],
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("Editor de contenido capa 1"), {
      target: { value: "Texto actualizado con contenido jurídico suficiente para conservar todas las extensiones legacy.".padEnd(140, "z") },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledOnce());
    const payload = mockMutateAsync.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.capa1_inmutable).toContain("Texto actualizado");
    expect(payload).not.toHaveProperty("capa2_variables");
    expect(payload).not.toHaveProperty("capa3_editables");
    expect(payload).not.toHaveProperty("notas_legal");
  });
});
