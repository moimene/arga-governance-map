// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import fs from "node:fs";
import path from "node:path";
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
import { GarriguesSidebar, GarriguesMobileSidebar } from "@/components/garrigues-shell/GarriguesSidebar";
import { GarriguesStandaloneLayout } from "@/components/garrigues-shell/GarriguesStandaloneLayout";
import {
  brandName,
  groupFullLabel,
  shellLabel,
  scopeLabel,
  DEFAULT_BRAND_NAME,
  DEFAULT_GROUP_FULL_LABEL,
  DEFAULT_SHELL_LABEL,
} from "@/lib/tenant-brand-labels";
import type { TenantBranding } from "@/context/TenantBrandContext";
import type { SecretariaScopeController } from "@/components/secretaria/shell/types";

// Mock Auth, Tenant, and Notifications
let mockAuthUser = {
  id: "usr-emp-1",
  email: "compliance@empresa-auditada.es",
  user_metadata: { full_name: "Elena Vázquez" },
};

const mockTenantRole = "COMPLIANCE";

let mockTenantBranding: TenantBranding | null = {
  nombre: "Corp Nexus Legal",
  shell_label: "CORP NEXUS SUITE",
  scope_label: "Grupo Nexus Internacional",
  sii_org_label: "Nexus Holding S.A.",
};

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: mockAuthUser,
    isAuthenticated: true,
    loading: false,
    logout: vi.fn(),
  }),
}));

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({
    tenantId: "tenant-nexus",
    entityId: "ent-nexus-1",
    personId: "person-elena",
    roleCode: mockTenantRole,
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

function createMockScope(mode: "grupo" | "sociedad" = "sociedad"): SecretariaScopeController {
  return {
    mode,
    selectedEntityId: "ent-nexus-1",
    selectedEntity: {
      id: "ent-nexus-1",
      name: "Nexus Seguros S.A.",
      legalName: "Nexus Seguros, Sociedad Anónima",
      legalForm: "SA",
      jurisdiction: "ES",
      status: "ACTIVA",
      parentEntityId: null,
      tipoSocial: "SA",
      tipoOrganoAdmin: "CONSEJO_ADMINISTRACION",
    },
    entities: [
      {
        id: "ent-nexus-1",
        name: "Nexus Seguros S.A.",
        legalName: "Nexus Seguros, Sociedad Anónima",
        legalForm: "SA",
        jurisdiction: "ES",
        status: "ACTIVA",
        parentEntityId: null,
        tipoSocial: "SA",
        tipoOrganoAdmin: "CONSEJO_ADMINISTRACION",
      },
    ],
    isLoadingEntities: false,
    currentSection: "Mesa",
    setMode: vi.fn(),
    setEntity: vi.fn(),
    createScopedTo: (p: string) => p,
  };
}

function renderWithRouter(ui: React.ReactElement, initialRoute = "/secretaria") {
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

describe("Milestone 2 — Empirical Challenger Verification & Stress Harness", () => {
  describe("1. Adversarial Codebase String Audit (Secretaria, GRC, AI Gov, Shell, Board-Pack)", () => {
    const targetDirs = [
      "src/components/garrigues-shell",
      "src/pages/secretaria",
      "src/pages/grc",
      "src/pages/ai-governance",
      "src/components/secretaria",
      "src/components/grc",
      "src/components/board-pack",
    ];

    function collectSourceFiles(dir: string, acc: string[] = []): string[] {
      const fullDir = path.resolve(process.cwd(), dir);
      if (!fs.existsSync(fullDir)) return acc;
      const entries = fs.readdirSync(fullDir, { withFileTypes: true });
      for (const e of entries) {
        const fullPath = path.join(fullDir, e.name);
        if (e.isDirectory()) {
          collectSourceFiles(path.relative(process.cwd(), fullPath), acc);
        } else if (
          (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) &&
          !e.name.includes(".test.") &&
          !e.name.includes(".spec.") &&
          !fullPath.includes("/__tests__/")
        ) {
          acc.push(fullPath);
        }
      }
      return acc;
    }

    const filesToAudit = targetDirs.flatMap((d) => collectSourceFiles(d));

    it("verifies that 0 non-comment lines in user views contain hardcoded ARGA, TGMS, or client emails", () => {
      const forbiddenWordRegex = /\b(ARGA|TGMS)\b/i;
      const forbiddenEmailRegex = /@arga-seguros\.com/i;
      const forbiddenPrefixRegex = /TPRM-ARGA-/i;

      const violations: { file: string; line: number; text: string }[] = [];

      for (const file of filesToAudit) {
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");

        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          // Exclude comments
          if (
            trimmed.startsWith("//") ||
            trimmed.startsWith("/*") ||
            trimmed.startsWith("*") ||
            trimmed.startsWith("{/*")
          ) {
            return;
          }

          if (
            forbiddenWordRegex.test(line) ||
            forbiddenEmailRegex.test(line) ||
            forbiddenPrefixRegex.test(line)
          ) {
            // Exclude internal retirement plan specification file if present
            if (file.endsWith("fallback-retirement-plan.ts")) return;
            violations.push({
              file: path.relative(process.cwd(), file),
              line: idx + 1,
              text: trimmed,
            });
          }
        });
      }

      expect(violations).toEqual([]);
    });

    it("verifies that no obsolete 'Volver a TGMS' buttons or static breadcrumb roots exist in any page", () => {
      const forbiddenExactPhrases = [
        "Volver a TGMS",
        "<span>TGMS</span>",
        ">TGMS<",
        ">ARGA<",
        "Grupo ARGA Seguros",
      ];

      const phraseViolations: { file: string; line: number; phrase: string }[] = [];

      for (const file of filesToAudit) {
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");

        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (
            trimmed.startsWith("//") ||
            trimmed.startsWith("/*") ||
            trimmed.startsWith("*") ||
            trimmed.startsWith("{/*")
          ) {
            return;
          }

          for (const phrase of forbiddenExactPhrases) {
            if (line.includes(phrase)) {
              phraseViolations.push({
                file: path.relative(process.cwd(), file),
                line: idx + 1,
                phrase,
              });
            }
          }
        });
      }

      expect(phraseViolations).toEqual([]);
    });
  });

  describe("2. Garrigues Standalone Layout Architecture & Decoupling", () => {
    it("renders GarriguesStandaloneLayout in standalone mode without TGMS exit link", () => {
      const { container } = renderWithRouter(
        <Routes>
          <Route element={<GarriguesStandaloneLayout mode="standalone" />}>
            <Route path="/secretaria" element={<div data-testid="page-inner">Standalone Content</div>} />
          </Route>
        </Routes>,
        "/secretaria"
      );

      // Verify Garrigues styling class
      expect(container.querySelector(".garrigues-module")).toBeDefined();
      expect(screen.getByTestId("page-inner")).toBeDefined();

      // In standalone mode, there is NO return button to TGMS
      const returnBtn = screen.queryByRole("button", { name: /Volver a TGMS/i });
      expect(returnBtn).toBeNull();

      // Brand badge in footer
      expect(screen.getByText("Garrigues Suite")).toBeDefined();
      expect(screen.getByText("v2.0")).toBeDefined();
    });

    it("renders GarriguesStandaloneLayout in embedded mode with dynamic parent return button", () => {
      renderWithRouter(
        <Routes>
          <Route
            element={
              <GarriguesStandaloneLayout
                mode="embedded"
                parentAppUrl="/hub"
                parentAppLabel="Volver al Portal Central"
              />
            }
          >
            <Route path="/secretaria" element={<div>Embedded Content</div>} />
          </Route>
        </Routes>,
        "/secretaria"
      );

      const returnBtn = screen.getByRole("button", { name: "Volver al Portal Central" });
      expect(returnBtn).toBeDefined();
    });

    it("renders sidebar content cleanly with Garrigues suite branding", () => {
      const scope = createMockScope("sociedad");
      renderWithRouter(
        <GarriguesSidebar
          scope={scope}
          mode="standalone"
        />,
        "/secretaria"
      );

      expect(screen.getByText("Garrigues")).toBeDefined();
      expect(screen.getByText("Corporate Solutions")).toBeDefined();
      expect(screen.getByText("Garrigues Suite")).toBeDefined();
      expect(screen.getByText("v2.0")).toBeDefined();
    });
  });

  describe("3. Dynamic Multi-Tenant Branding Stress Testing", () => {
    it("renders dynamic tenant brand in GarriguesHeader breadcrumbs and user menu without ARGA or TGMS strings", () => {
      mockTenantBranding = {
        nombre: "Santander Global Corporate",
        shell_label: "SANTANDER HUB",
        scope_label: "Grupo Santander",
        sii_org_label: "Banco Santander S.A.",
      };

      const scope = createMockScope("sociedad");
      const { unmount } = renderWithRouter(<GarriguesHeader scope={scope} />, "/secretaria");

      // Root breadcrumb must be "Santander Global Corporate"
      expect(screen.getByText("Santander Global Corporate")).toBeDefined();
      expect(screen.queryByText("ARGA")).toBeNull();
      expect(screen.queryByText("TGMS")).toBeNull();

      unmount();

      // User menu check
      renderWithRouter(<GarriguesUserMenu />);
      expect(screen.getByRole("button", { name: /Menú de usuario: Elena Vázquez/i })).toBeDefined();
      expect(screen.getByText("EV")).toBeDefined();
    });

    it("renders Grupo mode scope header correctly when in grupo mode", () => {
      mockTenantBranding = {
        nombre: "Iberdrola Renovables",
        shell_label: "IBERDROLA SUITE",
        scope_label: "Grupo Iberdrola Internacional",
        sii_org_label: "Iberdrola S.A.",
      };

      const scope = createMockScope("grupo");
      renderWithRouter(<GarriguesHeader scope={scope} />, "/secretaria");

      // Breadcrumb in grupo mode uses groupFullLabel -> "Grupo Iberdrola Internacional"
      expect(screen.getByText("Iberdrola Renovables")).toBeDefined();
      expect(screen.getByText("Grupo Iberdrola Internacional")).toBeDefined();
      expect(screen.getByText(/Modo Grupo · visión multi-sociedad/i)).toBeDefined();
    });

    it("renders user avatar and initials dynamically across different users and branding", () => {
      mockAuthUser = {
        id: "usr-2",
        email: "director.juridico@iberdrola.es",
        user_metadata: { full_name: "Ignacio Sánchez" },
      };
      mockTenantBranding = { nombre: "Iberdrola" };

      const { unmount } = renderWithRouter(<GarriguesUserMenu />);
      expect(screen.getByRole("button", { name: /Menú de usuario: Ignacio Sánchez/i })).toBeDefined();
      expect(screen.getByText("IS")).toBeDefined();
      unmount();
    });

    it("evaluates module whitelisting: disables unauthorized modules in module switcher", () => {
      // Whitelist only secretaria and grc
      mockTenantBranding = {
        nombre: "Auditoría & Risk S.L.",
        modules: ["secretaria", "grc"] as unknown as Record<string, string>,
      };

      const enabled = getEnabledGarriguesModules(mockTenantBranding);
      expect(enabled.map((m) => m.id)).toEqual(["secretaria", "grc"]);
      expect(enabled.some((m) => m.id === "ai-governance")).toBe(false);
    });

    it("evaluates single-module whitelisting: tenant with only AI Governance", () => {
      mockTenantBranding = {
        nombre: "AI Ethics Lab",
        modules: ["ai-governance"] as unknown as Record<string, string>,
      };

      const enabled = getEnabledGarriguesModules(mockTenantBranding);
      expect(enabled.map((m) => m.id)).toEqual(["ai-governance"]);
    });

    it("handles complex unicode and special characters in tenant branding safely", () => {
      mockTenantBranding = {
        nombre: "Companhia São Paulo & Filhos Ltda. (BR)",
        shell_label: "SÃO PAULO GOVERNANCE 2026",
        scope_label: "Grupo São Paulo — Divisão Latino-Americana",
        sii_org_label: "São Paulo Participações S.A.",
      };

      expect(brandName(mockTenantBranding)).toBe("Companhia São Paulo & Filhos Ltda. (BR)");
      expect(groupFullLabel(mockTenantBranding)).toBe("Grupo São Paulo — Divisão Latino-Americana");
      expect(shellLabel(mockTenantBranding)).toBe("SÃO PAULO GOVERNANCE 2026");

      const scope = createMockScope("grupo");
      const { unmount } = renderWithRouter(<GarriguesHeader scope={scope} />, "/secretaria");
      expect(screen.getByText("Companhia São Paulo & Filhos Ltda. (BR)")).toBeDefined();
      expect(screen.getByText("Grupo São Paulo — Divisão Latino-Americana")).toBeDefined();
      unmount();
    });

    it("falls back cleanly to default branding when tenant branding is null", () => {
      mockTenantBranding = null;

      expect(brandName(null)).toBe(DEFAULT_BRAND_NAME);
      expect(groupFullLabel(null)).toBe(DEFAULT_GROUP_FULL_LABEL);
      expect(shellLabel(null)).toBe(DEFAULT_SHELL_LABEL);
      expect(getEnabledGarriguesModules(null)).toHaveLength(3);
    });
  });

  describe("4. Contextual Navigation Resolution across all 3 Garrigues Modules", () => {
    it("correctly identifies active module and navigation items for Secretaria", () => {
      expect(getActiveGarriguesModule("/secretaria")?.id).toBe("secretaria");
      expect(getActiveGarriguesModule("/secretaria/convocatorias")?.id).toBe("secretaria");
      expect(getActiveGarriguesModule("/secretaria/acuerdos/123")?.id).toBe("secretaria");
    });

    it("correctly identifies active module and navigation items for GRC Compass", () => {
      expect(getActiveGarriguesModule("/grc")?.id).toBe("grc");
      expect(getActiveGarriguesModule("/grc/risk-360")?.id).toBe("grc");
      expect(getActiveGarriguesModule("/grc/tprm")?.id).toBe("grc");
      expect(getActiveGarriguesModule("/grc/m/dora")?.id).toBe("grc");
    });

    it("correctly identifies active module and navigation items for AI Governance", () => {
      expect(getActiveGarriguesModule("/ai-governance")?.id).toBe("ai-governance");
      expect(getActiveGarriguesModule("/ai-governance/sistemas")?.id).toBe("ai-governance");
      expect(getActiveGarriguesModule("/ai-governance/evaluaciones")?.id).toBe("ai-governance");
      expect(getActiveGarriguesModule("/ai-governance/incidentes")?.id).toBe("ai-governance");
    });
  });
});
