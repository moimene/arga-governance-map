import { describe, expect, it } from "vitest";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { isOperationalTemplate, templateUsabilityNotice } from "@/lib/doc-gen/template-operability";

// Fixture mínimo: solo los campos que consultan las funciones de operabilidad.
// `tipo` no matchea ningún plan de aprobación legal conocido (borrador = sin revisar).
function make(overrides: Partial<PlantillaProtegidaRow>): PlantillaProtegidaRow {
  return {
    id: "t1",
    tipo: "TIPO_TEST_SIN_PLAN",
    version: "1.0.0",
    estado: "ACTIVA",
    aprobada_por: null,
    fecha_aprobacion: null,
    capa1_inmutable: "Contenido legal protegido.",
    ...overrides,
  } as PlantillaProtegidaRow;
}

describe("templateUsabilityNotice — política 'todas visibles + avisar', verja del motor intacta", () => {
  it("operativa (ACTIVA / APROBADA / borrador revisado por Legal) → sin aviso y generable", () => {
    expect(templateUsabilityNotice(make({ estado: "ACTIVA" }))).toBeNull();
    expect(isOperationalTemplate(make({ estado: "ACTIVA" }))).toBe(true);
    expect(templateUsabilityNotice(make({ estado: "APROBADA" }))).toBeNull();
    expect(
      templateUsabilityNotice(
        make({ estado: "BORRADOR", aprobada_por: "Comité Legal", fecha_aprobacion: "2026-01-01" }),
      ),
    ).toBeNull();
  });

  it("sin contenido (Capa 1 vacía) → avisa y NO es operativa (no se puede generar nada)", () => {
    const t = make({ estado: "ACTIVA", capa1_inmutable: "" });
    expect(isOperationalTemplate(t)).toBe(false);
    expect(templateUsabilityNotice(t)).toMatch(/no tiene contenido/i);
  });

  it("ARCHIVADA → avisa (conservada por trazabilidad, no disponible) y no genera", () => {
    const t = make({ estado: "ARCHIVADA" });
    expect(isOperationalTemplate(t)).toBe(false);
    expect(templateUsabilityNotice(t)).toMatch(/archivada/i);
  });

  it("DEPRECADA → avisa (archivada o deprecada) y no genera", () => {
    const t = make({ estado: "DEPRECADA" });
    expect(isOperationalTemplate(t)).toBe(false);
    expect(templateUsabilityNotice(t)).toMatch(/deprecada/i);
  });

  it("borrador sin aprobación legal → avisa (pendiente de revisión/aprobación) y no genera", () => {
    const t = make({ estado: "BORRADOR" });
    expect(isOperationalTemplate(t)).toBe(false);
    expect(templateUsabilityNotice(t)).toMatch(/pendiente de revisión o aprobación/i);
  });
});
