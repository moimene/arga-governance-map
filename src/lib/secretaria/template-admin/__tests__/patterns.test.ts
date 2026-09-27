import { describe, expect, it } from "vitest";
import {
  avisoCitaDesfasada,
  detectarCitasDesfasadas,
  hasCitaDesfasadaPendiente,
  MARCADOR_CITA_DESFASADA,
} from "../patterns";

// MOI-139, D-19 (delegada): detección de citas/variables desfasadas del pack
// base que el Comité Legal aún no ha resuelto (MOI-138). No fija criterio
// jurídico: solo decide si el clon se marca «pendiente de revisión».
describe("detectarCitasDesfasadas", () => {
  it("no detecta nada en un texto limpio", () => {
    expect(detectarCitasDesfasadas("Acta ordinaria conforme al art. 202 LSC.")).toEqual([]);
  });

  it("detecta Real Decreto 84/2015 (RD y forma larga)", () => {
    expect(detectarCitasDesfasadas("art. 38 del Real Decreto 84/2015")).toEqual(["Real Decreto 84/2015"]);
    expect(detectarCitasDesfasadas("arts. 21-22 RD 84/2015")).toEqual(["Real Decreto 84/2015"]);
  });

  it("detecta variables {{QTSP.*}}", () => {
    expect(detectarCitasDesfasadas("Firma: {{QTSP.firma_admin_ref}}")).toEqual([
      "variable {{QTSP.*}} (firma/sello EAD Trust)",
    ]);
  });

  it("detecta art. 17/19 RRM pero no un número que solo los contiene como subcadena", () => {
    expect(detectarCitasDesfasadas("Inscripción conforme al art. 17 RRM.")).toEqual(["art. 17/19 RRM"]);
    expect(detectarCitasDesfasadas("art. 19 RRM")).toEqual(["art. 17/19 RRM"]);
    expect(detectarCitasDesfasadas("Plazo de art. 117 RRM")).toEqual([]);
  });

  it("detecta el derecho de oposición de acreedores (con y sin tilde)", () => {
    expect(detectarCitasDesfasadas("Se reconoce el derecho de oposición de los acreedores.")).toEqual([
      "derecho de oposición de acreedores",
    ]);
    expect(detectarCitasDesfasadas("derecho de oposicion de acreedores")).toEqual([
      "derecho de oposición de acreedores",
    ]);
  });

  it("acumula varias etiquetas sin duplicarlas y busca en objetos serializándolos", () => {
    const etiquetas = detectarCitasDesfasadas(
      "Real Decreto 84/2015",
      { texto: "{{QTSP.firma_admin_ref}}" },
      null,
      undefined,
    );
    expect(etiquetas.sort()).toEqual(
      ["Real Decreto 84/2015", "variable {{QTSP.*}} (firma/sello EAD Trust)"].sort(),
    );
  });
});

describe("aviso y marcador de cita desfasada", () => {
  it("el aviso incluye el marcador y las etiquetas detectadas", () => {
    const aviso = avisoCitaDesfasada(["Real Decreto 84/2015", "art. 17/19 RRM"]);
    expect(aviso).toContain(MARCADOR_CITA_DESFASADA);
    expect(aviso).toContain("Real Decreto 84/2015, art. 17/19 RRM");
    expect(aviso).toMatch(/Comité Legal.*MOI-138/);
  });

  it("hasCitaDesfasadaPendiente reconoce el marcador y no falsos positivos", () => {
    expect(hasCitaDesfasadaPendiente(avisoCitaDesfasada(["Real Decreto 84/2015"]))).toBe(true);
    expect(hasCitaDesfasadaPendiente("Notas jurídicas sin incidencias.")).toBe(false);
    expect(hasCitaDesfasadaPendiente(null)).toBe(false);
    expect(hasCitaDesfasadaPendiente(undefined)).toBe(false);
  });
});
