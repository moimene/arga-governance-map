import { describe, expect, it } from "bun:test";
import { pickPrimaryRiaSubject, defaultEscaladoMatter } from "../sujeto-escalado";

// F2.T14 (MOI-170): el sujeto citado en el escalado a Secretaría, y la
// materia por defecto que NO debe precargar "Expediente Técnico" para un
// responsable del despliegue sin sujeto proveedor.
describe("pickPrimaryRiaSubject", () => {
  it("sin filas, no hay sujeto", () => {
    expect(pickPrimaryRiaSubject([])).toBeNull();
  });

  it("con un solo RESPONSABLE_DESPLIEGUE, lo elige y marca hasProveedor=false", () => {
    const sujeto = pickPrimaryRiaSubject([
      { entity_id: "e1", role: "RESPONSABLE_DESPLIEGUE", entity: { common_name: "ARGA Salud" } },
    ]);
    expect(sujeto).toEqual({
      entityId: "e1",
      entityName: "ARGA Salud",
      role: "RESPONSABLE_DESPLIEGUE",
      hasProveedor: false,
    });
  });

  it("con PROVEEDOR y RESPONSABLE_DESPLIEGUE a la vez, el PROVEEDOR manda", () => {
    const sujeto = pickPrimaryRiaSubject([
      { entity_id: "e-despliegue", role: "RESPONSABLE_DESPLIEGUE", entity: { common_name: "ARGA Digital" } },
      { entity_id: "e-proveedor", role: "PROVEEDOR", entity: { common_name: "ARGA España Seguros" } },
    ]);
    expect(sujeto?.role).toBe("PROVEEDOR");
    expect(sujeto?.entityId).toBe("e-proveedor");
    expect(sujeto?.hasProveedor).toBe(true);
  });
});

describe("defaultEscaladoMatter", () => {
  const NOMBRE = "Motor de triaje de siniestros auto";

  it("sin sujeto conocido, mantiene el texto histórico de Expediente Técnico", () => {
    expect(defaultEscaladoMatter(NOMBRE, null)).toBe(
      `Propuesta de aprobación del Expediente Técnico para el Sistema de IA: ${NOMBRE}`,
    );
  });

  it("con sujeto PROVEEDOR, mantiene el texto de Expediente Técnico", () => {
    const sujeto = { entityId: "e1", entityName: "ARGA España Seguros", role: "PROVEEDOR", hasProveedor: true };
    expect(defaultEscaladoMatter(NOMBRE, sujeto)).toContain("Expediente Técnico");
  });

  it("con sujeto SOLO responsable del despliegue, NO precarga Expediente Técnico", () => {
    const sujeto = { entityId: "e1", entityName: "ARGA Salud", role: "RESPONSABLE_DESPLIEGUE", hasProveedor: false };
    const materia = defaultEscaladoMatter(NOMBRE, sujeto);
    expect(materia).not.toContain("Expediente Técnico");
    expect(materia).toContain(NOMBRE);
    expect(materia).toContain("responsable del despliegue");
  });
});
