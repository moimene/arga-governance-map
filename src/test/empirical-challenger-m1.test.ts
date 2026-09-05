import { describe, it, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { getPreferredEntity } from "@/components/secretaria/shell/useSecretariaScope";
import {
  brandName,
  groupFullLabel,
  shellLabel,
  scopeLabel,
  groupPortfolioLabel,
  DEFAULT_BRAND_NAME,
  DEFAULT_GROUP_FULL_LABEL,
  DEFAULT_SHELL_LABEL,
  DEFAULT_SCOPE_LABEL,
} from "@/lib/tenant-brand-labels";
import type { TenantBranding } from "@/context/TenantBrandContext";
import { sinComentarios } from "./helpers/sin-comentarios";

describe("Milestone 1 — Empirical Challenger Verification Suite", () => {
  describe("1. Static Scan: Zero literal ARGA / TGMS in JSX and UI views of Secretaria and GRC", () => {
    const targetDirs = [
      "src/pages/secretaria",
      "src/components/secretaria",
      "src/lib/secretaria",
      "src/pages/grc",
      "src/components/grc",
      "src/lib/grc",
    ];

    function getFiles(dir: string, acc: string[] = []): string[] {
      if (!fs.existsSync(dir)) return acc;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const fullPath = path.join(dir, e.name);
        if (e.isDirectory()) {
          getFiles(fullPath, acc);
        } else if (
          (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) &&
          !e.name.includes(".test.") &&
          !e.name.includes(".spec.") &&
          !e.name.includes(".fixture.") &&
          !fullPath.includes("/__tests__/")
        ) {
          acc.push(fullPath);
        }
      }
      return acc;
    }

    const filesToScan = targetDirs.flatMap((d) => getFiles(d));

    it("scans all production files in target directories and finds no user-visible ARGA or TGMS strings", () => {
      const wordRegex = /\b(ARGA|TGMS)\b/i;
      const violations: { file: string; line: number; text: string }[] = [];

      for (const file of filesToScan) {
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
          // Check for forbidden word
          if (wordRegex.test(line)) {
            // Exclude internal retirement plan file if noted
            if (file.endsWith("fallback-retirement-plan.ts")) return;
            violations.push({ file, line: idx + 1, text: trimmed });
          }
        });
      }

      expect(violations).toEqual([]);
    });
  });

  describe("2. Dynamic Tenant Branding Contract & Abstraction", () => {
    it("preserves default branding when tenant branding is null", () => {
      expect(brandName(null)).toBe(DEFAULT_BRAND_NAME);
      expect(groupFullLabel(null)).toBe(DEFAULT_GROUP_FULL_LABEL);
      expect(shellLabel(null)).toBe(DEFAULT_SHELL_LABEL);
      expect(scopeLabel(null)).toBe(DEFAULT_SCOPE_LABEL);
      expect(groupPortfolioLabel(null)).toBe("Vista de grupo: cartera societaria ARGA");
    });

    it("applies customized tenant branding dynamically without hardcoded fallback", () => {
      const customBranding: TenantBranding = {
        nombre: "ACME Corp",
        shell_label: "ACME Enterprise Hub",
        scope_label: "Grupo ACME Global",
        sii_org_label: "ACME Holding S.A.",
      };

      expect(brandName(customBranding)).toBe("ACME Corp");
      expect(groupFullLabel(customBranding)).toBe("Grupo ACME Global");
      expect(shellLabel(customBranding)).toBe("ACME Enterprise Hub");
      expect(scopeLabel(customBranding)).toBe("Grupo ACME Global");
      expect(groupPortfolioLabel(customBranding)).toBe("Vista de grupo: cartera societaria ACME Corp");
    });
  });

  describe("3. useSecretariaScope: getPreferredEntity Dynamic Behavior", () => {
    const mockEntities = [
      {
        id: "ent-child-1",
        name: "Acme Services SL",
        legalName: "Acme Services, S.L.U.",
        parentEntityId: "ent-root-1",
        taxId: "B12345678",
        countryCode: "ES",
        jurisdiction: "ES",
        legalForm: "SLU",
        status: "ACTIVA",
        materiality: "Pendiente",
      },
      {
        id: "ent-root-1",
        name: "Acme Holdings SA",
        legalName: "Acme Holdings, S.A.",
        parentEntityId: null,
        taxId: "A12345678",
        countryCode: "ES",
        jurisdiction: "ES",
        legalForm: "SA",
        status: "ACTIVA",
        materiality: "Pendiente",
      },
    ];

    it("selects root parent entity without needing ARGA in entity name", () => {
      const preferred = getPreferredEntity(mockEntities);
      expect(preferred?.id).toBe("ent-root-1");
      expect(preferred?.legalName).toBe("Acme Holdings, S.A.");
    });

    it("selects explicitly requested preferred name when provided", () => {
      const preferred = getPreferredEntity(mockEntities, "Acme Services, S.L.U.");
      expect(preferred?.id).toBe("ent-child-1");
    });
  });

  describe("4. MatrizJurisdiccional Mock Data Neutrality", () => {
    it("uses generic subsidiary names in MatrizJurisdiccional", () => {
      const file = fs.readFileSync("src/pages/secretaria/MatrizJurisdiccional.tsx", "utf8");
      expect(file).toContain("Filial España, S.L.U.");
      expect(file).toContain("Filial Portugal, Unipessoal Lda.");
      expect(file).toContain("Filial Brasil Ltda.");
      expect(file).toContain("Filial México S.A. de C.V.");
      expect(file).not.toContain("Cartera ARGA");
      expect(file).not.toContain("ARGA Seguros Portugal");
      expect(file).not.toContain("ARGA Seguros Brasil");
      expect(file).not.toContain("ARGA Seguros México");
    });
  });

  describe("5. PenalAnticorrupcion & IncidenteDetalle Neutral Fallbacks", () => {
    // La invariante que estos dos protegen es que NINGUNA identidad concreta
    // se filtre a la pantalla. Las aserciones positivas originales
    // —`toContain("en nombre de la entidad")`, `toContain('useState("Auditor de
    // Cumplimiento")')`— eran proxies de esa invariante, y en 2026-09-05 se
    // volvieron en contra: el carril GRC borró los riesgos y controles fixture
    // de aseguradora (de donde salía «en nombre de la entidad») y dejó el campo
    // del responsable VACÍO en vez de prerrellenarlo con un cargo inventado.
    // Las dos cosas son mejores que lo que el test exigía, y aun así lo ponían
    // en rojo. Se conserva la invariante —cero identidad fabricada— y se
    // sustituyen los proxies por la comprobación directa.
    const IDENTIDADES_PROHIBIDAS = [
      "Lucía Martín",
      "lucia@arga-seguros.com",
      "arga-seguros.com",
      "ARGA Seguros",
      "Apoderado de Cumplimiento",
    ];

    it("no filtra ninguna identidad concreta en Penal/Anticorrupción", () => {
      const file = sinComentarios(fs.readFileSync("src/pages/grc/PenalAnticorrupcion.tsx", "utf8"));
      // Control positivo: el fichero se leyó de verdad.
      expect(file.length).toBeGreaterThan(1000);
      for (const identidad of IDENTIDADES_PROHIBIDAS) {
        expect(file, `identidad filtrada: ${identidad}`).not.toContain(identidad);
      }
    });

    it("no prerrellena responsables ni filtra identidades en el detalle de incidente", () => {
      const filePenal = sinComentarios(fs.readFileSync("src/pages/grc/PenalAnticorrupcion.tsx", "utf8"));
      const fileIncidente = sinComentarios(fs.readFileSync("src/pages/grc/IncidenteDetalle.tsx", "utf8"));
      expect(filePenal.length).toBeGreaterThan(1000);
      expect(fileIncidente.length).toBeGreaterThan(1000);

      for (const identidad of IDENTIDADES_PROHIBIDAS) {
        expect(filePenal, `Penal: ${identidad}`).not.toContain(identidad);
        expect(fileIncidente, `Incidente: ${identidad}`).not.toContain(identidad);
      }

      // El campo del responsable arranca vacío o con un cargo genérico; lo que
      // no puede es traer el nombre de una persona.
      const arranquePenal = filePenal.match(/const \[auditorName, setAuditorName\] = useState\((.*?)\);/);
      expect(arranquePenal, "no se encontró el estado del responsable en Penal").toBeTruthy();
      expect(
        /^""$|Cumplimiento/.test(arranquePenal![1]),
        `el responsable arranca con ${arranquePenal![1]}, que no es ni vacío ni un cargo genérico`,
      ).toBe(true);
    });
  });

  describe("6. Steppers Form Placeholders Neutrality", () => {
    it("verifies generic placeholder strings across all steppers", () => {
      const persona = fs.readFileSync("src/pages/secretaria/PersonaNuevaStepper.tsx", "utf8");
      expect(persona).toContain('"Sociedad Filial, S.L."');
      expect(persona).toContain('"persona@empresa.com"');
      expect(persona).not.toContain('"ARGA Servicios Externos, S.L."');
      expect(persona).not.toContain('"persona@arga-seguros.com"');

      const decision = fs.readFileSync("src/pages/secretaria/DecisionUnipersonalStepper.tsx", "utf8");
      expect(decision).toContain("Sociedad Matriz, S.L.U.");
      expect(decision).not.toContain("Cartera ARGA S.L.U.");

      const acuerdo = fs.readFileSync("src/pages/secretaria/AcuerdoSinSesionStepper.tsx", "utf8");
      expect(acuerdo).toContain("secretaria@empresa.com");
      expect(acuerdo).not.toContain("secretaria@arga-seguros.com");

      const transmision = fs.readFileSync("src/pages/secretaria/TransmisionStepper.tsx", "utf8");
      expect(transmision).toContain("TRANSMISION_DOC_01");
      expect(transmision).not.toContain("ARGA_SEG_TRANSMISION");

      const clases = fs.readFileSync("src/pages/secretaria/sociedad-nueva/StepClasesSeries.tsx", "utf8");
      expect(clases).toContain("dividendo preferente para la sociedad matriz");
      expect(clases).not.toContain("dividendo preferente para ARGA Seguros");
    });
  });
});
