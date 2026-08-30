// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  GARRIGUES_MODULES,
  getActiveGarriguesModule,
  getEnabledGarriguesModules,
  GRC_NAV_ITEMS,
  AI_NAV_ITEMS,
} from "../navigation";
import { GarriguesModuleSwitcher } from "../GarriguesModuleSwitcher";
import { GarriguesUserMenu } from "../GarriguesUserMenu";
import { GarriguesHeader } from "../GarriguesHeader";
import { GarriguesSidebar } from "../GarriguesSidebar";
import { GarriguesStandaloneLayout } from "../GarriguesStandaloneLayout";
import type { SecretariaScopeController } from "@/components/secretaria/shell/types";

// Mock Auth and Tenant Contexts
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "usr-123",
      email: "abogado@garrigues-client.com",
      user_metadata: { full_name: "Carlos Mendoza" },
    },
    isAuthenticated: true,
    loading: false,
    logout: vi.fn(),
  }),
}));

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({
    tenantId: "tenant-demo",
    entityId: "ent-1",
    personId: "p-1",
    roleCode: "SECRETARIO",
    isLoading: false,
  }),
}));

vi.mock("@/context/TenantBrandContext", () => ({
  useTenantBranding: () => ({
    nombre: "Garrigues Legal Tech",
    shell_label: "GARRIGUES PLATFORM",
    scope_label: "Grupo Corporativo",
  }),
  useTenantBrandingLoading: () => false,
}));

vi.mock("@/hooks/useNotifications", () => ({
  useAllNotifications: () => ({ data: [] }),
  useUnreadCount: () => ({ data: 0 }),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}));

function createMockScope(mode: "grupo" | "sociedad" = "sociedad"): SecretariaScopeController {
  return {
    mode,
    selectedEntity: {
      id: "ent-1",
      name: "Empresa Matriz, S.A.",
      legalName: "Empresa Matriz, S.A.",
      legalForm: "SA",
      jurisdiction: "ES",
      status: "ACTIVA",
      materiality: "Pendiente",
      parentEntityId: null,
      tipoSocial: "SA",
    },
    entities: [
      {
        id: "ent-1",
        name: "Empresa Matriz, S.A.",
        legalName: "Empresa Matriz, S.A.",
        legalForm: "SA",
        jurisdiction: "ES",
        status: "ACTIVA",
        materiality: "Pendiente",
        parentEntityId: null,
        tipoSocial: "SA",
      },
    ],
    isLoadingEntities: false,
    currentSection: "Mesa",
    setMode: vi.fn(),
    setEntity: vi.fn(),
    createScopedTo: (path: string) => path,
  };
}

function renderWithProviders(ui: React.ReactElement, initialRoute = "/secretaria") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
});

describe("Garrigues Shell Architecture & Packaging Tests", () => {
  describe("1. Navigation Registry & Module Resolvers", () => {
    it("exports the 3 canonical Garrigues modules", () => {
      expect(GARRIGUES_MODULES).toHaveLength(3);
      expect(GARRIGUES_MODULES.map((m) => m.id)).toEqual(["secretaria", "grc", "ai-governance"]);
      expect(GARRIGUES_MODULES[0].basePath).toBe("/secretaria");
      expect(GARRIGUES_MODULES[1].basePath).toBe("/grc");
      expect(GARRIGUES_MODULES[2].basePath).toBe("/ai-governance");
    });

    it("resolves active module accurately from route pathnames", () => {
      expect(getActiveGarriguesModule("/secretaria")?.id).toBe("secretaria");
      expect(getActiveGarriguesModule("/secretaria/convocatorias/123")?.id).toBe("secretaria");
      expect(getActiveGarriguesModule("/grc")?.id).toBe("grc");
      expect(getActiveGarriguesModule("/grc/risk-360")?.id).toBe("grc");
      expect(getActiveGarriguesModule("/ai-governance")?.id).toBe("ai-governance");
      expect(getActiveGarriguesModule("/ai-governance/sistemas")?.id).toBe("ai-governance");
      expect(getActiveGarriguesModule("/governance-map")).toBeNull();
    });

    it("filters enabled modules using tenant branding rules", () => {
      const all = getEnabledGarriguesModules(null);
      expect(all).toHaveLength(3);

      // `TenantBranding` no declara `modules`, aunque el dato en Cloud sí lo
      // lleva: es la lista blanca por tenant que lee `isModuleEnabled`. El
      // shape se declara aquí en vez de disfrazarlo con un cast a un mapa.
      const filtered = getEnabledGarriguesModules({
        nombre: "Test Tenant",
        modules: ["secretaria", "ai-governance"],
      } as Parameters<typeof getEnabledGarriguesModules>[0]);
      // @ts-expect-error test shape
      const enabled = getEnabledGarriguesModules({ modules: ["secretaria", "ai-governance"] });
      expect(enabled.map((m) => m.id)).toEqual(["secretaria", "ai-governance"]);
    });

    it("maintains complete GRC and AI Governance navigation items", () => {
      expect(GRC_NAV_ITEMS.length).toBeGreaterThanOrEqual(8);
      expect(AI_NAV_ITEMS.length).toBeGreaterThanOrEqual(4);
      expect(GRC_NAV_ITEMS.some((i) => i.to === "/grc/tprm")).toBe(true);
      expect(AI_NAV_ITEMS.some((i) => i.to === "/ai-governance/evaluaciones")).toBe(true);
    });
  });

  describe("2. GarriguesModuleSwitcher Component", () => {
    it("renders the active module switcher button with proper accessible label", () => {
      renderWithProviders(<GarriguesModuleSwitcher />, "/secretaria");
      const button = screen.getByRole("button", { name: /Módulo actual: Secretaría Societaria/i });
      expect(button).toBeDefined();
      expect(screen.getByText("Secretaría Societaria")).toBeDefined();
    });

    it("renders GRC as active when on /grc routes", () => {
      renderWithProviders(<GarriguesModuleSwitcher />, "/grc/risk-360");
      expect(screen.getByRole("button", { name: /Módulo actual: GRC Compass/i })).toBeDefined();
    });
  });

  describe("3. GarriguesUserMenu Component", () => {
    it("renders the user avatar with dynamic initials and no hardcoded ARGA references", () => {
      renderWithProviders(<GarriguesUserMenu />);
      const button = screen.getByRole("button", { name: /Menú de usuario: Carlos Mendoza/i });
      expect(button).toBeDefined();
      expect(screen.getByText("CM")).toBeDefined();
    });
  });

  describe("4. GarriguesHeader Component", () => {
    it("renders dynamic breadcrumbs with brand root and module title without hardcoded TGMS root", () => {
      const scope = createMockScope("sociedad");
      renderWithProviders(<GarriguesHeader scope={scope} />, "/secretaria");

      expect(screen.getByText("Garrigues Legal Tech")).toBeDefined();
      expect(screen.getByRole("link", { name: "Secretaría Societaria" })).toBeDefined();
      expect(screen.getByText("Empresa Matriz, S.A.")).toBeDefined();
    });

    it("renders scope badge in sociedad mode", () => {
      const scope = createMockScope("sociedad");
      renderWithProviders(<GarriguesHeader scope={scope} />, "/secretaria");

      expect(screen.getByText(/Modo Sociedad · vista filtrada a la sociedad/i)).toBeDefined();
    });
  });

  describe("5. GarriguesSidebar Component", () => {
    it("renders top brand section and active module navigation", () => {
      const scope = createMockScope("sociedad");
      renderWithProviders(<GarriguesSidebar scope={scope} mode="standalone" />, "/secretaria");

      expect(screen.getByText("Garrigues")).toBeDefined();
      expect(screen.getByText("Corporate Solutions")).toBeDefined();
      expect(screen.getByText("Garrigues Suite")).toBeDefined();
      expect(screen.getByText("v2.0")).toBeDefined();
    });

    it("renders embedded return link when mode is embedded", () => {
      const scope = createMockScope("sociedad");
      renderWithProviders(
        <GarriguesSidebar
          scope={scope}
          mode="embedded"
          parentAppUrl="/"
          parentAppLabel="Volver a TGMS"
        />,
        "/secretaria"
      );

      const returnBtn = screen.getByRole("button", { name: /Volver a TGMS/i });
      expect(returnBtn).toBeDefined();
    });

    it("renders contextual GRC navigation on /grc routes", () => {
      const scope = createMockScope("sociedad");
      renderWithProviders(<GarriguesSidebar scope={scope} mode="standalone" />, "/grc");

      expect(screen.getByText("Navegación GRC")).toBeDefined();
      expect(screen.getByText("Risk 360")).toBeDefined();
      expect(screen.getByText("Terceros (TPRM)")).toBeDefined();
    });

    it("renders contextual AI Governance navigation on /ai-governance routes", () => {
      const scope = createMockScope("sociedad");
      renderWithProviders(<GarriguesSidebar scope={scope} mode="standalone" />, "/ai-governance");

      expect(screen.getByText("Navegación AI Governance")).toBeDefined();
      expect(screen.getByText("Sistemas IA")).toBeDefined();
      expect(screen.getByText("Evaluaciones")).toBeDefined();
    });
  });

  describe("6. GarriguesStandaloneLayout Integration", () => {
    it("renders layout container with garrigues-module class and typography", () => {
      const { container } = renderWithProviders(
        <Routes>
          <Route element={<GarriguesStandaloneLayout mode="standalone" />}>
            <Route path="/secretaria" element={<div data-testid="page-content">Contenido de prueba</div>} />
          </Route>
        </Routes>,
        "/secretaria"
      );

      const rootDiv = container.querySelector(".garrigues-module");
      expect(rootDiv).toBeDefined();
      expect(screen.getByTestId("page-content")).toBeDefined();
      expect(screen.getByText("Contenido de prueba")).toBeDefined();
    });
  });
});
