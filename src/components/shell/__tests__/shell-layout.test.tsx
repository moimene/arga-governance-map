// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShellLayout } from "../ShellLayout";
import { ScopeProvider } from "@/context/ScopeContext";
import { TourProvider } from "@/context/TourContext";

// Mock Auth
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "usr-admin-1",
      email: "demo@arga-seguros.com",
      user_metadata: { full_name: "Dña. Lucía Paredes Vega" },
    },
    isAuthenticated: true,
    loading: false,
    logout: vi.fn(),
  }),
}));

// Mock TenantContext
vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({
    tenantId: "00000000-0000-0000-0000-000000000001",
    entityId: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
    personId: "p-lucia",
    roleCode: "SECRETARIO",
    isLoading: false,
  }),
}));

// Mock TenantBrandContext. Mutable para poder montar el shell con una lista
// blanca de módulos y comprobar qué secciones sobreviven.
const BRANDING_BASE = {
  nombre: "Grupo ARGA",
  shell_label: "TGMS PLATFORM",
  scope_label: "Grupo ARGA",
  scopes: ["Grupo ARGA", "ARGA España", "ARGA LATAM"],
};
let brandingMock: Record<string, unknown> = { ...BRANDING_BASE };

vi.mock("@/context/TenantBrandContext", () => ({
  useTenantBranding: () => brandingMock,
  useTenantBrandingLoading: () => false,
}));

// Mock CurrentUser hook
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    user: { id: "usr-admin-1", email: "demo@arga-seguros.com" },
    loading: false,
  }),
  useCurrentUserProfile: () => ({
    data: { roleCode: "SECRETARIO", displayName: "Dña. Lucía Paredes Vega" },
    isLoading: false,
  }),
  useCurrentUserRole: () => ({
    user: { id: "usr-admin-1", email: "demo@arga-seguros.com" },
    primaryRole: "SECRETARIO",
    displayName: "Dña. Lucía Paredes Vega",
    roles: ["SECRETARIO"],
    permissions: ["*"],
    hasPermission: () => true,
    isLoading: false,
  }),
}));

// Mock Notifications
vi.mock("@/components/shell/NotificationsBell", () => ({
  NotificationsBell: () => <div data-testid="notifications-bell">Bell</div>,
}));

function renderShell(initialRoute = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <ScopeProvider>
          <TourProvider>
            <Routes>
              <Route element={<ShellLayout />}>
                <Route path="/" element={<div data-testid="dashboard-content">Dashboard View</div>} />
                <Route path="/entidades" element={<div data-testid="entidades-content">Entidades View</div>} />
                <Route path="/secretaria" element={<div data-testid="secretaria-content">Secretaria View</div>} />
              </Route>
            </Routes>
          </TourProvider>
        </ScopeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  brandingMock = { ...BRANDING_BASE };
});

describe("TGMS Shell Layout & Management Console Tests", () => {
  it("renders the root TGMS shell with shell branding label", () => {
    renderShell("/");
    expect(screen.getByText("TGMS PLATFORM")).toBeDefined();
    expect(screen.getByTestId("dashboard-content")).toBeDefined();
  });

  it("renders the desktop sidebar with core governance items and module links", () => {
    renderShell("/");
    expect(screen.getByText("Gobernanza")).toBeDefined();
    expect(screen.getByText("Módulos")).toBeDefined();
    expect(screen.getByText("GRC Compass")).toBeDefined();
    expect(screen.getByText("Secretaría")).toBeDefined();
    expect(screen.getByText("AI Governance")).toBeDefined();
  });

  it("renders the interactive ScopeSwitcher in sidebar", () => {
    renderShell("/");
    expect(screen.getByText("Scope:")).toBeDefined();
    expect(screen.getByText("Grupo ARGA")).toBeDefined();
  });

  it("renders the UserMenu with initials and user info", () => {
    renderShell("/");
    const userBtn = screen.getByRole("button", { name: /Menú de usuario: Dña. Lucía Paredes Vega/i });
    expect(userBtn).toBeDefined();
    expect(screen.getByText("LP")).toBeDefined();
  });

  it("un tenant sin `sii` no lee el rótulo de una sección vacía", () => {
    // El rótulo es parte de lo gateado: "Canal interno" sobre cero items
    // anuncia una superficie que ese tenant no tiene. Lista blanca REAL de
    // Garrigues menos `sii`.
    brandingMock = {
      ...BRANDING_BASE,
      modules: ["secretaria", "grc", "ai-governance", "politicas", "obligaciones",
                "delegaciones", "hallazgos", "conflictos", "governance-map",
                "entidades", "organos"],
    };
    renderShell("/");
    expect(screen.queryByText("Canal interno")).toBeNull();
    expect(screen.queryByText("SII — Canal Interno")).toBeNull();
    // Controles positivos: el instrumento ve lo que sí queda. Sin esto, un
    // shell que no pintara nada pasaría las dos ausencias de arriba.
    expect(screen.getByText("Gobernanza")).toBeDefined();
    expect(screen.getByText("Módulos")).toBeDefined();
    expect(screen.getByText("Secretaría")).toBeDefined();
  });

  it("ARGA (sin lista blanca) conserva las tres secciones, SII incluido", () => {
    renderShell("/");
    expect(screen.getByText("Gobernanza")).toBeDefined();
    expect(screen.getByText("Módulos")).toBeDefined();
    expect(screen.getByText("Canal interno")).toBeDefined();
    expect(screen.getByText("SII — Canal Interno")).toBeDefined();
  });

  it("renders GlobalSearch quick search trigger in the header", () => {
    renderShell("/");
    const searchInput = screen.getByPlaceholderText(/Buscar rápido \(Cmd\+K\)/i);
    expect(searchInput).toBeDefined();
  });
});
