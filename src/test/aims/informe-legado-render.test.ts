// src/test/aims/informe-legado-render.test.ts
//
// F1.T4 y F1.T5, sobre lo que el informe RENDERIZA (no sobre su fuente): la
// evaluación de Harvey —anterior a los controles del 2026-09-07— se rotula
// «Legado demo, no acredita» y sus L5 sin recuento de evidencia se cuentan
// aparte del porcentaje guardado. Un gate de fuente dejaba pasar un
// `false && (` delante del bloque: por eso se monta.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockearModulos } from "@/test/garrigues/_mock-restaurable";

const restaurar = await mockearModulos([["@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) })]]);
afterAll(restaurar);
afterEach(() => cleanup());

const { default: CabeceraInforme } = await import("@/components/ai-governance/evaluacion-detalle/CabeceraInforme");

const nada = () => undefined;
function montar(assessment: Record<string, unknown>) {
  render(
    createElement(
      MemoryRouter,
      null,
      createElement(CabeceraInforme, {
        assessment: { id: "a", system_id: "s", framework: "EU_AI_ACT", assessment_date: "2026-09-07", ...assessment } as never,
        isIso: false,
        catalogoDeDespliegue: false,
        anteriorAClasificacion: false,
        onExportJson: nada,
        onPrint: nada,
        onCongelar: nada,
        onRevisar: nada,
        congelando: false,
        revisando: false,
      }),
    ),
  );
}

describe("el informe dice lo que no acredita", () => {
  it("Harvey: rótulo de legado y 40 L5 pendientes de evidencia contados aparte", () => {
    const findings = [
      ...Array.from({ length: 40 }, (_, i) => ({ code: `L5-${i}`, status: "L5" })),
      ...Array.from({ length: 44 }, (_, i) => ({ code: `Lx-${i}`, status: "L2" })),
    ];
    montar({ status: "CON_GAPS", score: 49, findings });
    expect(screen.getByText("Legado demo, no acredita")).toBeTruthy();
    expect(screen.getByText(/40 medidas en L5 pendientes de evidencia/)).toBeTruthy();
  });

  it("control positivo: congelada, revisada y con evidencia, no hay rótulo ni pendientes", () => {
    montar({
      status: "CONFORME",
      score: 100,
      frozen_at: "2026-09-18T10:00:00Z",
      reviewed_at: "2026-09-18T11:00:00Z",
      findings: [{ code: "MG_QUAL_01", status: "L5", evidenceCount: 2 }],
    });
    expect(screen.queryByText(/no acredita/)).toBeNull();
    expect(screen.queryByText(/pendientes de evidencia/)).toBeNull();
    // Y el informe sí se ha montado: la aserción de ausencia no es vacía.
    expect(screen.getByText("Informe de autodiagnóstico de madurez")).toBeTruthy();
  });
});
