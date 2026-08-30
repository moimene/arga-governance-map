//
// El vacío de los planes de acción, con control discriminante.
//
// Un test que solo comprobara «Garrigues ve el texto razonado» pasaría igual si
// el componente se lo mostrara a TODO el mundo, ARGA incluida — y eso sería
// contarle a ARGA una procedencia que no es la suya. Así que se monta dos
// veces, una por tenant, y se exige que ARGA vea exactamente lo que veía.
import { afterEach, describe, expect, it, mock } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PLAN_ACCION_AUSENCIA } from "../../../scripts/garrigues/hallazgos/hallazgos-penales";

const ARGA = "00000000-0000-0000-0000-000000000001";
const TEXTO_GENERICO = "No hay planes de acción disponibles.";

let tenantActual: string | null = PLAN_ACCION_AUSENCIA.tenantId;

mock.module("@/context/TenantContext", () => ({
  useTenantContext: () => ({ tenantId: tenantActual }),
}));

mock.module("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [], isLoading: false, error: null }),
}));

afterEach(() => cleanup());

async function montar(tenant: string | null) {
  tenantActual = tenant;
  const { default: ActionPlans } = await import("@/pages/grc/modules/audit/ActionPlans");
  render(
    <MemoryRouter>
      <ActionPlans />
    </MemoryRouter>,
  );
}

describe("C3 Tarea 5 — el vacío de planes se explica, y solo a quien le toca", () => {
  it("Garrigues ve el motivo, la fuente y los controles que sí constan", async () => {
    await montar(PLAN_ACCION_AUSENCIA.tenantId);
    expect(screen.getByText(PLAN_ACCION_AUSENCIA.titulo)).toBeTruthy();
    expect(screen.getByText(new RegExp("no publica los planes concretos"))).toBeTruthy();
    expect(screen.getByText(/PPD-01.*246/)).toBeTruthy();
    // Y remite a lo que sí consta, con enlace, no como texto suelto.
    expect(screen.getByRole("link", { name: /CTR-GARR-25/ })).toBeTruthy();
  });

  it("y NO ve el texto genérico que ese estado vacío sustituye", async () => {
    await montar(PLAN_ACCION_AUSENCIA.tenantId);
    expect(screen.queryByText(TEXTO_GENERICO)).toBeNull();
  });

  it("ARGA sigue viendo exactamente lo que veía, y nada de la fuente ajena", async () => {
    // El control que hace que los dos anteriores signifiquen algo.
    await montar(ARGA);
    expect(screen.getByText(TEXTO_GENERICO)).toBeTruthy();
    expect(screen.queryByText(PLAN_ACCION_AUSENCIA.titulo)).toBeNull();
    expect(screen.queryByText(/PPD-01/)).toBeNull();
  });

  it("y con el tenant aún sin resolver tampoco se afirma nada", async () => {
    // `TenantProvider` arranca en null y resuelve por red: durante ese primer
    // render no se le puede atribuir la procedencia a nadie.
    await montar(null);
    expect(screen.queryByText(PLAN_ACCION_AUSENCIA.titulo)).toBeNull();
  });
});
