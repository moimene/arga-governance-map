import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DemoScenarioResult from "../DemoScenarioResult";

const defaultTenantState = {
  tenantId: "00000000-0000-0000-0000-000000000001",
  entityId: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
  personId: null,
  roleCode: "SECRETARIO",
  isLoading: false,
};

let mockTenantState = { ...defaultTenantState };

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => mockTenantState,
}));

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/demo-operable/:scenarioId" element={<DemoScenarioResult />} />
        <Route path="/" element={<div>Home Mock</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("DemoScenarioResult route tenant guard (MOI-127)", () => {
  beforeEach(() => {
    mockTenantState = { ...defaultTenantState };
  });

  afterEach(() => {
    mockTenantState = { ...defaultTenantState };
  });
  it("blocks rendering of ARGA demo scenario and shows restricted notice when user is on Garrigues tenant", () => {
    mockTenantState = {
      tenantId: "00000000-0000-0000-0000-000000000002",
      entityId: null,
      personId: null,
      roleCode: "SECRETARIO",
      isLoading: false,
    };

    renderRoute("/demo-operable/JUNTA_UNIVERSAL_OK");

    expect(screen.getByText("Escenario no disponible en este entorno")).toBeInTheDocument();
    expect(
      screen.getByText(/Los escenarios de demostración guiada pertenecen en exclusiva al entorno de demostración/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("Junta general universal ordinaria")).not.toBeInTheDocument();
  });

  it("blocks rendering when user is on a new group tenant", () => {
    mockTenantState = {
      tenantId: "00000000-0000-0000-0000-000000000003",
      entityId: null,
      personId: null,
      roleCode: "ADMIN",
      isLoading: false,
    };

    renderRoute("/demo-operable/JUNTA_UNIVERSAL_OK");

    expect(screen.getByText("Escenario no disponible en este entorno")).toBeInTheDocument();
    expect(screen.queryByText("Junta general universal ordinaria")).not.toBeInTheDocument();
  });

  it("renders the full ARGA demo scenario when user is on ARGA tenant", () => {
    mockTenantState = {
      tenantId: "00000000-0000-0000-0000-000000000001",
      entityId: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
      personId: null,
      roleCode: "SECRETARIO",
      isLoading: false,
    };

    renderRoute("/demo-operable/JUNTA_UNIVERSAL_OK");

    expect(screen.queryByText("Escenario no disponible en este entorno")).not.toBeInTheDocument();
    expect(screen.getByText("DEMO MODE")).toBeInTheDocument();
    expect(screen.getByText("Junta universal correcta")).toBeInTheDocument();
  });

  it("shows invalid scenario notice if scenarioId does not exist even on ARGA tenant", () => {
    mockTenantState = {
      tenantId: "00000000-0000-0000-0000-000000000001",
      entityId: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
      personId: null,
      roleCode: "SECRETARIO",
      isLoading: false,
    };

    renderRoute("/demo-operable/SCENARIO_INEXISTENTE");

    expect(screen.getByText("Escenario no disponible")).toBeInTheDocument();
    expect(screen.getByText(/El identificador solicitado no pertenece al Demo Pack ARGA/i)).toBeInTheDocument();
  });
});
