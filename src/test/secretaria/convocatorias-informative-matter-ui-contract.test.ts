import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stepper = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ConvocatoriasStepper.tsx"),
  "utf8",
);
const detail = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ConvocatoriaDetalle.tsx"),
  "utf8",
);

describe("ConvocatoriasStepper — categoría informativa visible", () => {
  it("renderiza un selector accesible y editable para todo punto no decisorio", () => {
    expect(stepper).toContain("{!isDecisorio && (");
    expect(stepper).toContain("Categoría informativa");
    expect(stepper).toContain("AGENDA_INFORMATIVE_MATERIAS.map");
    expect(stepper).toContain("aria-invalid={!categoriaInformativaValida}");
    expect(stepper).toContain("Revisa el borrador legacy y selecciona una categoría informativa");
  });

  it("el cambio de naturaleza reemplaza el estado de materia de forma explícita", () => {
    expect(stepper).toContain("agendaMateriaSelectionForKind({");
    expect(stepper).toContain("currentMateria: item.materia");
    expect(stepper).toContain("...materiaSelection");
    expect(stepper).toContain("requires_attachments:");
  });

  it("usa el boundary decisorio tanto para rule packs como para el motor de convocatoria", () => {
    const uses = stepper.match(/agendaItemsForDecisionEngine\(agendaItems\)/g) ?? [];
    expect(uses).toHaveLength(2);
    expect(stepper).not.toContain(
      'materia: i.kind === "DECISORIO" ? i.materia : null',
    );
  });

  it("bloquea emisión de un borrador legacy con materia decisoria oculta", () => {
    expect(stepper).toContain("invalidNonDecisionItem");
    expect(stepper).toContain("!isMateriaInformativa(item.materia)");
    expect(stepper).toContain("Selecciona una categoría informativa válida");
  });

  it("humaniza materia y fechas sin inyectar variables EAD en el documento visible", () => {
    expect(stepper).toContain('tipo: itemKind === "DECISORIO" ? `Acuerdo · ${labelMateria(i.materia)}` : kindLabel');
    expect(stepper).toContain("normalizeVisibleDocumentText(result.text)");
    expect(stepper).toContain("DOCUMENT_DEMO_NOTICE");
    expect(stepper).not.toContain("firma_convocante_ref");
    expect(stepper).not.toContain("sello_tiempo_ref");
    expect(stepper).not.toContain("QTSP:");
  });

  it("no presenta una comunicación programada como entrega o certificación", () => {
    expect(detail).toContain(
      "La programación no acredita envío ni entrega. Esos estados solo cambian con respuesta real del proveedor.",
    );
  });

  it("no borra el órgano seleccionado al re-ejecutar efectos del mismo scope", () => {
    expect(stepper).toContain("previousScopedEntityIdRef.current !== scopedEntityId");
    expect(stepper).toContain(
      'selectedBodyId ? lastResolvedOrganoTipoRef.current : "JUNTA_GENERAL"',
    );
  });
});
