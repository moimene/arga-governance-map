//
// La arista riesgo → hallazgo, comprobada RENDERIZANDO.
//
// El gate 6 de G5 comprueba esto con un grep del fuente, y un grep sobrevive a
// `{risk.findings && null}`: el enlace desaparece de la pantalla y el gate
// sigue verde porque la cadena sigue estando en el fichero. Aquí se monta el
// componente en su ruta real y se busca el enlace en el DOM, con su destino.
//
// El destino importa tanto como el enlace: `/hallazgos/:id` resuelve por
// CÓDIGO (`useFindingByCode`), no por UUID. Un enlace construido con el id
// llevaría a una ficha vacía y en pantalla parecería igual de correcto.
//
// Se mockea SOLO el hook de datos. El router se monta de verdad, con la ruta
// que declara `App.tsx`, para que `useParams` resuelva como en producción.
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const RIESGO_ID = "11111111-1111-1111-1111-111111111111";
const HALLAZGO_ID = "22222222-2222-2222-2222-222222222222";

const RIESGO = {
  id: RIESGO_ID,
  code: "RSK-GARR-PEN-069",
  title: "Contrabando",
  description: null,
  status: "Abierto",
  entity_id: null,
  module_id: null,
  probability: null,
  impact: null,
  inherent_score: null,
  residual_score: null,
  obligation_id: null,
  finding_id: HALLAZGO_ID,
  assessed_band: null,
  assessment_breakdown: null,
  assessment_provenance: null,
  obligations: null,
  findings: {
    code: "FND-GARR-PEN-069-FISCAL",
    title: "Nivel máximo evaluado: Contrabando — Fiscal",
  },
};

let riesgoActual: Record<string, unknown> | null = RIESGO;

mock.module("@/hooks/useRisks", () => ({
  useRiskById: () => ({ data: riesgoActual, isLoading: false, error: null }),
  useRisks: () => ({ data: [], isLoading: false, error: null }),
  useCreateRisk: () => ({ mutate: () => {}, isPending: false }),
  useUpdateRisk: () => ({ mutate: () => {}, isPending: false }),
}));

mock.module("@/components/secretaria/shell", () => ({
  useSecretariaScope: () => ({
    mode: "grupo",
    selectedEntity: null,
    entities: [],
    createScopedTo: (ruta: string) => ruta,
  }),
}));

beforeEach(() => { riesgoActual = RIESGO; });
afterEach(() => cleanup());

async function montar() {
  const { default: RiskDetalle } = await import("@/pages/grc/RiskDetalle");
  render(
    <MemoryRouter initialEntries={[`/grc/risk-360/${RIESGO_ID}`]}>
      <Routes>
        <Route path="/grc/risk-360/:id" element={<RiskDetalle />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("C3 Tarea 5 — desde el riesgo se llega al hallazgo, en el DOM", () => {
  it("el enlace al hallazgo se renderiza y apunta a su CÓDIGO", async () => {
    await montar();
    const enlace = screen.getByRole("link", { name: /FND-GARR-PEN-069-FISCAL/ });
    expect(enlace.getAttribute("href")).toBe("/hallazgos/FND-GARR-PEN-069-FISCAL");
    // Por código, no por UUID: si alguien enlaza con el id, la ficha sale vacía.
    expect(enlace.getAttribute("href")).not.toContain(HALLAZGO_ID);
  });

  it("y NO se renderiza cuando el riesgo no tiene hallazgo", async () => {
    // Control negativo. Sin esto, un componente que pintara el enlace SIEMPRE
    // —incluso con `findings` a null— pasaría el test anterior sin probar nada.
    riesgoActual = { ...RIESGO, finding_id: null, findings: null };
    await montar();
    expect(screen.queryByRole("link", { name: /FND-GARR-PEN/ })).toBeNull();
  });
});
