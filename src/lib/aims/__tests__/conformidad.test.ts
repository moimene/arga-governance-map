import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MOTIVO_L5_PENDIENTE_EVIDENCIA,
  MOTIVO_L5_SIN_EVIDENCIA,
  acreditaConformidad,
  motivoNoAcredita,
  pendientesDeEvidencia,
} from "../conformidad";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

/**
 * F1.T5 (GC-54) — un L5 de legado sin evidencia no acredita.
 *
 * Las filas anteriores al 2026-09-07 no midieron evidencia (`evidenceCount`
 * ausente) y hasta hoy acreditaban «porque no se había medido». Medido en Cloud
 * el 2026-09-19: la evaluación de Harvey tiene 40 medidas en L5 y ninguna lleva
 * recuento de evidencia; eran ellas las que sostenían su 49 %.
 */
describe("L5 sin recuento de evidencia: pendiente de evidencia, no acredita", () => {
  it("`evidenceCount` ausente o nulo no acredita", () => {
    expect(acreditaConformidad({ status: "L5" })).toBe(false);
    expect(acreditaConformidad({ status: "L5", evidenceCount: null })).toBe(false);
    expect(motivoNoAcredita({ status: "L5" })).toBe(MOTIVO_L5_PENDIENTE_EVIDENCIA);
    expect(MOTIVO_L5_PENDIENTE_EVIDENCIA).toBe("Pendiente de evidencia");
  });

  it("no medido y cero siguen siendo cosas distintas: se dicen distinto", () => {
    expect(motivoNoAcredita({ status: "L5", evidenceCount: 0 })).toBe(MOTIVO_L5_SIN_EVIDENCIA);
    expect(MOTIVO_L5_SIN_EVIDENCIA).not.toBe(MOTIVO_L5_PENDIENTE_EVIDENCIA);
  });

  it("control positivo: con evidencia sí acredita, y una L8 motivada no necesita recuento", () => {
    expect(acreditaConformidad({ status: "L5", evidenceCount: 1 })).toBe(true);
    expect(acreditaConformidad({ status: "L8", justification: "No trata datos biométricos." })).toBe(true);
  });
});

describe("el indicador cuenta aparte los L5 pendientes de evidencia", () => {
  it("caso Harvey: 40 L5 sin recuento, de 84 medidas", () => {
    // Distribución medida en Cloud el 2026-09-19 (fdcccf9e): 11 L1, 11 L2,
    // 11 L3, 10 L4, 40 L5, 1 L8 — ninguna con `evidenceCount`.
    const findings = [
      ...Array.from({ length: 40 }, () => ({ status: "L5" })),
      ...["L1", "L2", "L3"].flatMap((l) => Array.from({ length: 11 }, () => ({ status: l }))),
      ...Array.from({ length: 10 }, () => ({ status: "L4" })),
      { status: "L8" },
    ];
    expect(findings.length).toBe(84);
    expect(pendientesDeEvidencia(findings)).toBe(40);
    expect(findings.filter(acreditaConformidad).length).toBe(0);
  });

  it("control positivo: un L5 con recuento (aunque sea 0) no está pendiente de medir", () => {
    expect(pendientesDeEvidencia([{ status: "L5", evidenceCount: 0 }, { status: "L5", evidenceCount: 3 }, { status: "L3" }])).toBe(0);
    expect(pendientesDeEvidencia(null)).toBe(0);
  });

  it("G-ARISTA: el informe importa el contador de la hoja y lo pinta", () => {
    const src = sinComentarios(readFileSync("src/components/ai-governance/evaluacion-detalle/CabeceraInforme.tsx", "utf8"));
    expect(src).toMatch(/import \{[^}]*pendientesDeEvidencia[^}]*\} from "@\/lib\/aims\/conformidad"/);
    expect(src).toMatch(/pendientesDeEvidencia\(assessment\.findings\)/);
  });
});
