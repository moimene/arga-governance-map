import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  brandName,
  groupFullLabel,
  groupPortfolioLabel,
  scopeLabel,
  shellLabel,
  siiOrgLabel,
  DEFAULT_SCOPE_LABEL,
  DEFAULT_GROUP_FULL_LABEL,
  DEFAULT_SII_ORG_LABEL,
} from "@/lib/tenant-brand-labels";
import { dashboardGreeting, scopesForTenant } from "@/lib/tenant-scopes";
import { scopes as ARGA_SCOPES } from "@/data/scopes";
import {
  isModuleEnabled,
  resolveTenantModulesState,
} from "@/lib/tenant-modules";
import { usaFixturesDemo } from "@/lib/tenant-fixtures";
import { getRegulationById } from "@/data/regulations";
import { resolverReglamentoOrgano } from "@/pages/OrganoDetalle";
import { debeMostrarOpvDemo } from "@/pages/Conflictos";
import { resolverSaludoDashboard, resolverEtiquetaMinimapa } from "@/pages/Dashboard";

describe("MOI-54 — Contrato de desacoplamiento de branding, fixtures y módulos", () => {
  describe("1. Un grupo sin configuración propia (distinto de ARGA) no muestra datos de ARGA", () => {
    it("branding con solo fixtures: 'none' no muestra 'Grupo ARGA', 'Grupo ARGA Seguros' ni scopes de ARGA", () => {
      const b = { fixtures: "none" };
      expect(scopeLabel(b)).not.toBe(DEFAULT_SCOPE_LABEL);
      expect(scopeLabel(b)).toBe("Grupo");

      expect(groupFullLabel(b)).not.toBe(DEFAULT_GROUP_FULL_LABEL);
      expect(groupFullLabel(b)).toBe("Grupo");

      expect(siiOrgLabel(b)).not.toBe(DEFAULT_SII_ORG_LABEL);
      expect(siiOrgLabel(b)).toBe("Entidad");

      const scopes = scopesForTenant(b);
      expect(scopes).toEqual(["Grupo (Global)"]);
      for (const argaScope of ARGA_SCOPES) {
        expect(scopes).not.toContain(argaScope);
      }
    });

    it("branding vacío ({}) no hereda rótulos ni scopes de ARGA", () => {
      const b = {};
      expect(scopeLabel(b)).toBe("Grupo");
      expect(groupFullLabel(b)).toBe("Grupo");
      expect(siiOrgLabel(b)).toBe("Entidad");
      expect(brandName(b)).toBe("Grupo");
      expect(groupPortfolioLabel(b)).toBe("Vista de grupo: cartera societaria Grupo");
      expect(scopesForTenant(b)).toEqual(["Grupo (Global)"]);
    });

    it("branding de Grupo Nuevo con solo nombre y fixtures ('none') deriva sus propios rótulos", () => {
      const b = { nombre: "Grupo Nuevo", fixtures: "none" };
      expect(scopeLabel(b)).toBe("Grupo Nuevo");
      expect(groupFullLabel(b)).toBe("Grupo Nuevo");
      expect(siiOrgLabel(b)).toBe("Grupo Nuevo");
      expect(brandName(b)).toBe("Grupo Nuevo");
      expect(groupPortfolioLabel(b)).toBe("Vista de grupo: cartera societaria Grupo Nuevo");
      expect(scopesForTenant(b)).toEqual(["Grupo Nuevo (Global)"]);
    });
  });

  describe("2. Contrato de ARGA y Garrigues intacto (cero cambio visual)", () => {
    it("branding null (ARGA) preserva byte a byte sus rótulos de contrato", () => {
      expect(shellLabel(null)).toBe("TGMS PLATFORM");
      expect(scopeLabel(null)).toBe("Grupo ARGA");
      expect(siiOrgLabel(null)).toBe("Grupo ARGA Seguros");
      expect(brandName(null)).toBe("TGMS");
      expect(groupFullLabel(null)).toBe("Grupo ARGA Seguros");
      expect(groupPortfolioLabel(null)).toBe("Vista de grupo: cartera societaria ARGA");
      expect(scopesForTenant(null)).toEqual(ARGA_SCOPES);
      expect(dashboardGreeting(null)).toBe("Buen día, Lucía");
    });

    it("branding Garrigues preserva sus rótulos configurados", () => {
      const b = {
        nombre: "Garrigues",
        shell_label: "GARRIGUES GOBERNANZA",
        scope_label: "Grupo Garrigues",
        sii_org_label: "Garrigues",
      };
      expect(shellLabel(b)).toBe("GARRIGUES GOBERNANZA");
      expect(scopeLabel(b)).toBe("Grupo Garrigues");
      expect(siiOrgLabel(b)).toBe("Garrigues");
      expect(brandName(b)).toBe("Garrigues");
      expect(groupFullLabel(b)).toBe("Grupo Garrigues");
      expect(groupPortfolioLabel(b)).toBe("Vista de grupo: cartera societaria Garrigues");
      expect(scopesForTenant(b)).toEqual(["Grupo Garrigues (Global)"]);
      expect(dashboardGreeting(b)).toBe("Buen día");
    });
  });

  describe("3. Discriminación formal de los cuatro estados de módulos en tenant-modules", () => {
    it("separa loading, unconfigured, empty y configured", () => {
      // loading
      expect(resolveTenantModulesState(null, { isLoading: true })).toBe("loading");
      expect(isModuleEnabled(null, "dora", { isLoading: true })).toBe(true);

      // unconfigured (ARGA)
      expect(resolveTenantModulesState(null)).toBe("unconfigured");
      expect(isModuleEnabled(null, "dora")).toBe(true);

      // unconfigured (Grupo Nuevo ...0003 T3)
      const grupoNuevo = { nombre: "Grupo Nuevo", fixtures: "none" };
      expect(resolveTenantModulesState(grupoNuevo)).toBe("unconfigured");
      expect(isModuleEnabled(grupoNuevo, "secretaria")).toBe(true);
      expect(isModuleEnabled(grupoNuevo, "dora")).toBe(true);
      expect(isModuleEnabled(grupoNuevo, "grc")).toBe(true);

      // empty (lista deliberadamente vacía)
      const emptyBranding = { modules: [] };
      expect(resolveTenantModulesState(emptyBranding)).toBe("empty");
      expect(isModuleEnabled(emptyBranding, "secretaria")).toBe(false);
      expect(isModuleEnabled(emptyBranding, "dora")).toBe(false);

      // configured (Garrigues whitelist)
      const garrigues = {
        nombre: "Garrigues",
        modules: ["secretaria", "grc"],
      };
      expect(resolveTenantModulesState(garrigues)).toBe("configured");
      expect(isModuleEnabled(garrigues, "secretaria")).toBe(true);
      expect(isModuleEnabled(garrigues, "grc")).toBe(true);
      expect(isModuleEnabled(garrigues, "dora")).toBe(false);
    });
  });

  describe("4. Fixtures de ARGA no se inyectan en /conflictos ni /organos/:id para Grupo Nuevo", () => {
    it("Grupo Nuevo tiene fixtures: 'none' -> usaFixturesDemo devuelve false", () => {
      const grupoNuevo = { nombre: "Grupo Nuevo", fixtures: "none" };
      expect(usaFixturesDemo(grupoNuevo)).toBe(false);
    });

    it("OrganoDetalle (resolverReglamentoOrgano) no inyecta reglamento de ARGA si usaFixturesDemo es false o durante carga", () => {
      const grupoNuevo = { nombre: "Grupo Nuevo", fixtures: "none" };

      // ARGA (branding null, carga completa): resuelve REG-001
      const regArga = resolverReglamentoOrgano(null, "REG-001", false);
      expect(regArga).not.toBeNull();
      expect(regArga?.title).toBe("Reglamento del Consejo de Administración");

      // Grupo Nuevo (fixtures: 'none'): resuelve null
      const regGrupoNuevo = resolverReglamentoOrgano(grupoNuevo, "REG-001", false);
      expect(regGrupoNuevo).toBeNull();

      // Ventana de carga (brandingLoading = true): resuelve null para cualquier tenant
      expect(resolverReglamentoOrgano(null, "REG-001", true)).toBeNull();
      expect(resolverReglamentoOrgano(grupoNuevo, "REG-001", true)).toBeNull();
    });

    it("ConflictosList (debeMostrarOpvDemo) oculta operaciones vinculadas demo para Grupo Nuevo, Garrigues y durante carga", () => {
      const grupoNuevo = { nombre: "Grupo Nuevo", fixtures: "none" };
      const garrigues = { nombre: "Garrigues", scope_label: "Grupo Garrigues" };

      // ARGA (branding null, cargado): muestra OPVs
      expect(debeMostrarOpvDemo(null, false)).toBe(true);

      // Grupo Nuevo: oculta OPVs
      expect(debeMostrarOpvDemo(grupoNuevo, false)).toBe(false);

      // Garrigues: oculta OPVs
      expect(debeMostrarOpvDemo(garrigues, false)).toBe(false);

      // Durante carga (brandingLoading = true): oculta siempre para prevenir parpadeos
      expect(debeMostrarOpvDemo(null, true)).toBe(false);
      expect(debeMostrarOpvDemo(grupoNuevo, true)).toBe(false);
    });
  });

  describe("5. Auditoría de correos de ARGA en src/ fuera de tests", () => {
    function getFilesRecursively(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (
            entry.name === "__tests__" ||
            entry.name === "test" ||
            entry.name === "node_modules"
          ) {
            continue;
          }
          files.push(...getFilesRecursively(fullPath));
        } else if (
          entry.isFile() &&
          (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
          !entry.name.endsWith(".test.ts") &&
          !entry.name.endsWith(".test.tsx")
        ) {
          files.push(fullPath);
        }
      }
      return files;
    }

    it("ningún archivo fuente de src fuera de tests expone dominios demo de ARGA sin guard de tenant", () => {
      const srcDir = join(process.cwd(), "src");
      const files = getFilesRecursively(srcDir);
      const matches: { file: string; line: number; content: string }[] = [];

      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          // Escanear tanto con guion como sin guion
          if (
            line.includes("@arga-seguros.com") ||
            line.includes("@argaseguros.com")
          ) {
            matches.push({
              file: file.replace(process.cwd() + "/", ""),
              line: idx + 1,
              content: line.trim(),
            });
          }
        });
      }

      // Los únicos matches autorizados en código fuente son:
      // 1. src/lib/login-brands.ts (placeholder en la tarjeta específica de login de ARGA)
      // 2. src/components/shell/UserMenu.tsx (fallback condicionado estrictamente a !branding)
      expect(matches.length).toBeGreaterThan(0);
      for (const m of matches) {
        if (m.file === "src/lib/login-brands.ts") {
          expect(m.content).toContain("emailPlaceholder");
        } else if (m.file === "src/components/shell/UserMenu.tsx") {
          expect(m.content).toContain("!branding");
        } else {
          // Si aparece en cualquier otro lugar, falla
          expect(m).toBeNull();
        }
      }
    });
  });

  describe("6. Dashboard no pinta valores transitorios de ARGA mientras carga la marca (reapertura, motivo #3)", () => {
    it("resolverSaludoDashboard: ARGA muestra el mismo saludo con las dos esperas en curso, en solo una, o en ninguna", () => {
      // Estado final de ARGA: sin ninguna espera en curso.
      expect(resolverSaludoDashboard(null, false, false)).toBe("Buen día, Lucía");
      // Antes del fix, pasar solo `brandingLoading` (ignorando `tenantLoading`)
      // dejaba este frame -tenantId todavía sin resolver- pintando el saludo
      // final de ARGA por accidente. Con las dos esperas combinadas el saludo
      // se mantiene neutro mientras CUALQUIERA de las dos siga en curso, y solo
      // vuelve a "Buen día, Lucía" cuando ambas han terminado.
      expect(resolverSaludoDashboard(null, true, false)).toBe("Buen día");
      expect(resolverSaludoDashboard(null, false, true)).toBe("Buen día");
      expect(resolverSaludoDashboard(null, true, true)).toBe("Buen día");
    });

    it("resolverSaludoDashboard: Garrigues no cambia de rótulo por las esperas", () => {
      const garrigues = { nombre: "Garrigues" };
      expect(resolverSaludoDashboard(garrigues, false, false)).toBe("Buen día");
      expect(resolverSaludoDashboard(garrigues, true, false)).toBe("Buen día");
    });

    it("resolverEtiquetaMinimapa: ARGA muestra 'ARGA Seguros' solo cuando las dos esperas han terminado, nunca 'Grupo' a medio camino", () => {
      // Estado final de ARGA.
      expect(resolverEtiquetaMinimapa(null, false, false)).toBe("ARGA Seguros");
      // Mientras cualquiera de las dos esperas sigue en curso, el rótulo se
      // queda en el neutro "Grupo": nunca "ARGA Seguros" a medias (eso sería
      // afirmar la marca antes de saberla) ni el "Grupo" transitorio que se
      // cuela y desaparece si solo se mira `brandingLoading`.
      expect(resolverEtiquetaMinimapa(null, true, false)).toBe("Grupo");
      expect(resolverEtiquetaMinimapa(null, false, true)).toBe("Grupo");
      expect(resolverEtiquetaMinimapa(null, true, true)).toBe("Grupo");
    });

    it("resolverEtiquetaMinimapa: un tenant con nombre propio (Garrigues, Grupo Nuevo) muestra su nombre desde que branding resuelve, sin pasar por 'Grupo'", () => {
      const garrigues = { nombre: "Garrigues" };
      expect(resolverEtiquetaMinimapa(garrigues, false, false)).toBe("Garrigues");
      // Con branding ya resuelto, el resultado no depende de las esperas.
      expect(resolverEtiquetaMinimapa(garrigues, true, false)).toBe("Garrigues");
    });
  });
});
