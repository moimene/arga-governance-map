// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import fs from "node:fs";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

if (typeof window !== "undefined" && !globalThis.getComputedStyle) {
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
}

import {
  GARRIGUES_MODULES,
  getActiveGarriguesModule,
  getEnabledGarriguesModules,
  GRC_NAV_ITEMS,
  AI_NAV_ITEMS,
} from "@/components/garrigues-shell/navigation";
import { GarriguesModuleSwitcher } from "@/components/garrigues-shell/GarriguesModuleSwitcher";
import { GarriguesUserMenu } from "@/components/garrigues-shell/GarriguesUserMenu";
import { GarriguesHeader } from "@/components/garrigues-shell/GarriguesHeader";
import { GarriguesSidebar, GarriguesSidebarContent } from "@/components/garrigues-shell/GarriguesSidebar";
import { GarriguesStandaloneLayout } from "@/components/garrigues-shell/GarriguesStandaloneLayout";
import type { SecretariaScopeController } from "@/components/secretaria/shell/types";
import type { TenantBranding } from "@/context/TenantBrandContext";

// ── Mock Auth & Tenant Contexts ──────────────────────────────────────────────
let mockUser: { id: string; email: string; user_metadata: { full_name?: string } } | null = {
  id: "usr-emp-1",
  email: "abogado.corporativo@despacho-legal.com",
  user_metadata: { full_name: "Elena Rostova" },
};
let mockRoleCode = "SECRETARIO";
let mockTenantBranding: TenantBranding | null = {
  nombre: "Garrigues Corporate Legal",
  shell_label: "GARRIGUES PLATFORM",
  scope_label: "Holding Corporativo",
};
const mockLogout = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: !!mockUser,
    loading: false,
    logout: mockLogout,
  }),
}));

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({
    tenantId: "tenant-challenger-01",
    entityId: "ent-alpha-01",
    personId: "p-01",
    roleCode: mockRoleCode,
    isLoading: false,
  }),
}));

vi.mock("@/context/TenantBrandContext", () => ({
  useTenantBranding: () => mockTenantBranding,
  useTenantBrandingLoading: () => false,
}));

vi.mock("@/hooks/useNotifications", () => ({
  useAllNotifications: () => ({ data: [] }),
  useUnreadCount: () => ({ data: 0 }),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}));

function createChallengerMockScope(
  mode: "grupo" | "sociedad" = "sociedad",
  entityName = "Sociedad Matriz Holding, S.A.",
  section = "Convocatorias"
): SecretariaScopeController {
  return {
    mode,
    selectedEntityId: "ent-alpha-01",
    selectedEntity: {
      id: "ent-alpha-01",
      name: entityName,
      legalName: entityName,
      legalForm: "SA",
      jurisdiction: "ES",
      status: "ACTIVA",
      materiality: "Pendiente",
      parentEntityId: null,
      tipoSocial: "SA",
    },
    entities: [
      {
        id: "ent-alpha-01",
        name: entityName,
        legalName: entityName,
        legalForm: "SA",
        jurisdiction: "ES",
        status: "ACTIVA",
        materiality: "Pendiente",
        parentEntityId: null,
        tipoSocial: "SA",
      },
      {
        id: "ent-child-02",
        name: "Filial Industrial, S.L.U.",
        legalName: "Filial Industrial, S.L.U.",
        legalForm: "SL",
        jurisdiction: "ES",
        status: "ACTIVA",
        materiality: "Pendiente",
        parentEntityId: "ent-alpha-01",
        tipoSocial: "SL",
      },
    ],
    isLoadingEntities: false,
    currentSection: section,
    setMode: vi.fn(),
    setEntity: vi.fn(),
    createScopedTo: (path: string) => `${path}?entity=ent-alpha-01`,
  };
}

function renderChallengerView(ui: React.ReactElement, initialRoute = "/secretaria") {
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
  mockLogout.mockClear();
  mockUser = {
    id: "usr-emp-1",
    email: "abogado.corporativo@despacho-legal.com",
    user_metadata: { full_name: "Elena Rostova" },
  };
  mockRoleCode = "SECRETARIO";
  mockTenantBranding = {
    nombre: "Garrigues Corporate Legal",
    shell_label: "GARRIGUES PLATFORM",
    scope_label: "Holding Corporativo",
  };
});

describe("Milestone 2 — Empirical Challenger Verification Suite", () => {
  describe("1. Static Architectural Independence & Zero Leakage", () => {
    it("confirms 0 imports of ShellLayout or TGMS Sidebar in Garrigues components and pages", () => {
      const garriguesDirs = [
        "src/components/garrigues-shell",
        "src/pages/secretaria",
        "src/pages/grc",
        "src/pages/ai-governance",
      ];

      for (const dir of garriguesDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir, { recursive: true }) as string[];
        for (const file of files) {
          if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
          if (file.includes(".test.")) continue;
          const content = fs.readFileSync(`${dir}/${file}`, "utf8");

          expect(content).not.toContain('from "@/components/shell/ShellLayout"');
          expect(content).not.toContain('from "@/components/shell/Sidebar"');
          if (dir === "src/components/garrigues-shell") {
            expect(content).not.toContain("ShellLayout");
          }
        }
      }
    });

    it("confirms GarriguesStandaloneLayout enforces .garrigues-module class and Montserrat font", () => {
      const { container } = renderChallengerView(
        <GarriguesStandaloneLayout mode="standalone">
          <div data-testid="test-child">Child Node</div>
        </GarriguesStandaloneLayout>,
        "/secretaria"
      );

      const wrapper = container.firstElementChild as HTMLElement;
      expect(wrapper.classList.contains("garrigues-module")).toBe(true);
      expect(wrapper.style.fontFamily).toContain("Montserrat");
      expect(screen.getByTestId("test-child")).toBeDefined();
    });
  });

  describe("2. Standalone vs Embedded Mode Behavioral Adversarial Tests", () => {
    it("operates in standalone mode without any TGMS return button or host coupling", () => {
      const scope = createChallengerMockScope("sociedad");
      renderChallengerView(
        <GarriguesSidebar scope={scope} mode="standalone" />,
        "/secretaria"
      );

      expect(screen.queryByRole("button", { name: /Volver a/i })).toBeNull();
      expect(screen.getByText("Garrigues Suite")).toBeDefined();
      expect(screen.getByText("v2.0")).toBeDefined();
    });

    it("operates in embedded mode, renders return action and triggers navigation when clicked", () => {
      const scope = createChallengerMockScope("sociedad");
      const onNavigateSpy = vi.fn();

      renderChallengerView(
        <GarriguesSidebar
          scope={scope}
          mode="embedded"
          parentAppUrl="/hub-custom"
          parentAppLabel="Regresar al Portal Corporativo"
          onNavigate={onNavigateSpy}
        />,
        "/secretaria"
      );

      const returnBtn = screen.getByRole("button", { name: "Regresar al Portal Corporativo" });
      expect(returnBtn).toBeDefined();
      fireEvent.click(returnBtn);
      expect(onNavigateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Navigation Engine & Deep Routing Resolution", () => {
    it("accurately classifies root, nested, and parametrized paths across all 3 modules", () => {
      // Root paths
      expect(getActiveGarriguesModule("/secretaria")?.id).toBe("secretaria");
      expect(getActiveGarriguesModule("/grc")?.id).toBe("grc");
      expect(getActiveGarriguesModule("/ai-governance")?.id).toBe("ai-governance");

      // Deep nested paths
      expect(getActiveGarriguesModule("/secretaria/sociedades/ent-1/socio/nuevo")?.id).toBe("secretaria");
      expect(getActiveGarriguesModule("/secretaria/convocatorias/ef574517/reunion")?.id).toBe("secretaria");
      expect(getActiveGarriguesModule("/grc/risk-360/r-01/editar")?.id).toBe("grc");
      expect(getActiveGarriguesModule("/grc/m/dora/dashboard")?.id).toBe("grc");
      expect(getActiveGarriguesModule("/ai-governance/sistemas/sys-01")?.id).toBe("ai-governance");
      expect(getActiveGarriguesModule("/ai-governance/evaluaciones/nueva")?.id).toBe("ai-governance");

      // Unknown / TGMS Shell routes
      expect(getActiveGarriguesModule("/")).toBeNull();
      expect(getActiveGarriguesModule("/entidades")).toBeNull();
      expect(getActiveGarriguesModule("/organos/org-1")).toBeNull();
      expect(getActiveGarriguesModule("/politicas")).toBeNull();
    });

    it("switches context dynamically in GarriguesSidebar across routes", () => {
      const scope = createChallengerMockScope("sociedad");

      // GRC route renders GRC navigation
      renderChallengerView(
        <GarriguesSidebar scope={scope} mode="standalone" />,
        "/grc/tprm"
      );
      expect(screen.getByText("Navegación GRC")).toBeDefined();
      expect(screen.getByText("Terceros (TPRM)")).toBeDefined();
      expect(screen.getByText("Penal / Anticorr.")).toBeDefined();

      // AI Governance route renders AI navigation
      cleanup();
      renderChallengerView(
        <GarriguesSidebar scope={scope} mode="standalone" />,
        "/ai-governance/incidentes"
      );
      expect(screen.getByText("Navegación AI Governance")).toBeDefined();
      expect(screen.getByText("Sistemas IA")).toBeDefined();
      expect(screen.getByText("Incidentes IA")).toBeDefined();
    });

    it("filters modules based on tenant whitelist", () => {
      const brandingWithOnlySecretaria = {
        nombre: "Secretaría Only Client",
        // @ts-expect-error test typing
        modules: ["secretaria"],
      };

      const enabled = getEnabledGarriguesModules(brandingWithOnlySecretaria);
      expect(enabled).toHaveLength(1);
      expect(enabled[0].id).toBe("secretaria");
    });
  });

  describe("4. Breadcrumb Generation & Scope State Assertion", () => {
    it("renders dynamic breadcrumb with custom brand root and active section in sociedad mode", () => {
      const scope = createChallengerMockScope("sociedad", "Banco Internacional S.A.", "Actas y Certificaciones");
      renderChallengerView(<GarriguesHeader scope={scope} />, "/secretaria/actas");

      expect(screen.getByText("Garrigues Corporate Legal")).toBeDefined();
      expect(screen.getByRole("link", { name: "Secretaría Societaria" })).toBeDefined();
      expect(screen.getByText("Banco Internacional S.A.")).toBeDefined();
      expect(screen.getByText("Actas y Certificaciones")).toBeDefined();
      expect(screen.getByText(/Modo Sociedad/i)).toBeDefined();
    });

    it("renders holding label in grupo mode", () => {
      const scope = createChallengerMockScope("grupo", "Sociedad Matriz Holding, S.A.", "Mesa");
      renderChallengerView(<GarriguesHeader scope={scope} />, "/secretaria");

      expect(screen.getByText("Holding Corporativo")).toBeDefined();
      expect(screen.getByText(/Modo Grupo · visión multi-sociedad/i)).toBeDefined();
      // "Mesa" section is skipped in breadcrumbs as root
      expect(screen.queryByText("› Mesa")).toBeNull();
    });
  });

  describe("5. User Profile Menu & Role Formatting Stress Tests", () => {
    it("generates correct initials and subtitles for diverse user identities", () => {
      // 1. Full name: Elena Rostova -> ER
      renderChallengerView(<GarriguesUserMenu />);
      expect(screen.getByRole("button", { name: /Menú de usuario: Elena Rostova/i })).toBeDefined();
      expect(screen.getByText("ER")).toBeDefined();

      // 2. Single name fallback: "Admin" -> "AD"
      cleanup();
      mockUser = {
        id: "usr-2",
        email: "admin@corp.com",
        user_metadata: { full_name: "Admin" },
      };
      renderChallengerView(<GarriguesUserMenu />);
      expect(screen.getByText("AD")).toBeDefined();

      // 3. Email only with dots: "carlos.mendoza@empresa.com" -> "CM"
      cleanup();
      mockUser = {
        id: "usr-3",
        email: "carlos.mendoza@empresa.com",
        user_metadata: {},
      };
      renderChallengerView(<GarriguesUserMenu />);
      expect(screen.getByText("CM")).toBeDefined();
    });
  });

  describe("6. Mobile Navigation & Accessibility Attributes", () => {
    it("renders mobile navigation content and executes onNavigate callback on link click", () => {
      const scope = createChallengerMockScope("sociedad");
      const onNavigate = vi.fn();

      renderChallengerView(
        <GarriguesSidebarContent
          scope={scope}
          mode="standalone"
          onNavigate={onNavigate}
        />,
        "/grc"
      );

      const riskLink = screen.getByText("Risk 360");
      fireEvent.click(riskLink);

      expect(onNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe("7. Production App.tsx Route Nesting Validation", () => {
    it("validates App.tsx nests all Garrigues subroutes inside GarriguesStandaloneLayout", () => {
      const appSource = fs.readFileSync("src/App.tsx", "utf8");

      // Verify GarriguesStandaloneLayout is imported and used
      expect(appSource).toContain("GarriguesStandaloneLayout");
      expect(appSource).toContain('<GarriguesStandaloneLayout mode="embedded" />');

      // Verify key routes exist inside the Garrigues layout section
      expect(appSource).toContain('path="/secretaria"');
      expect(appSource).toContain('path="/secretaria/convocatorias"');
      expect(appSource).toContain('path="/secretaria/reuniones"');
      expect(appSource).toContain('path="/secretaria/actas"');
      expect(appSource).toContain('path="/secretaria/tramitador"');
      expect(appSource).toContain('path="/secretaria/acuerdos-sin-sesion"');
      expect(appSource).toContain('path="/secretaria/decisiones-unipersonales"');
      expect(appSource).toContain('path="/secretaria/libros"');
      expect(appSource).toContain('path="/secretaria/plantillas"');
      expect(appSource).toContain('path="/secretaria/sociedades"');
      expect(appSource).toContain('path="/secretaria/personas"');
      expect(appSource).toContain('path="/grc"');
      expect(appSource).toContain('path="/grc/risk-360"');
      expect(appSource).toContain('path="/grc/penal-anticorrupcion"');
      expect(appSource).toContain('path="/grc/tprm"');
      expect(appSource).toContain('path="/grc/incidentes"');
      expect(appSource).toContain('path="/ai-governance"');
      expect(appSource).toContain('path="/ai-governance/sistemas"');
      expect(appSource).toContain('path="/ai-governance/evaluaciones"');
      expect(appSource).toContain('path="/ai-governance/incidentes"');
    });
  });
});
