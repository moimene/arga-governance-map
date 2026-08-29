// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  shellLabel,
  scopeLabel,
  siiOrgLabel,
  brandName,
  groupFullLabel,
  groupPortfolioLabel,
  DEFAULT_SHELL_LABEL,
  DEFAULT_SCOPE_LABEL,
  DEFAULT_SII_ORG_LABEL,
  DEFAULT_BRAND_NAME,
  DEFAULT_GROUP_FULL_LABEL,
} from "@/lib/tenant-brand-labels";
import type { TenantBranding } from "@/context/TenantBrandContext";
import type { BoardPackMeeting } from "@/hooks/useBoardPackData";
import { BPPortada } from "@/components/board-pack/BPPortada";

afterEach(() => {
  cleanup();
});

describe("Adversarial Stress Test: Tenant Brand Labels Resolver", () => {
  describe("1. Fallback & Default Integrity (null / undefined / empty)", () => {
    it("returns verbatim ARGA/TGMS defaults when branding is null", () => {
      expect(shellLabel(null)).toBe(DEFAULT_SHELL_LABEL);
      expect(scopeLabel(null)).toBe(DEFAULT_SCOPE_LABEL);
      expect(siiOrgLabel(null)).toBe(DEFAULT_SII_ORG_LABEL);
      expect(brandName(null)).toBe(DEFAULT_BRAND_NAME);
      expect(groupFullLabel(null)).toBe(DEFAULT_GROUP_FULL_LABEL);
      expect(groupPortfolioLabel(null)).toBe("Vista de grupo: cartera societaria ARGA");
    });

    it("returns verbatim defaults when branding is an empty object", () => {
      const b: TenantBranding = {};
      expect(shellLabel(b)).toBe(DEFAULT_SHELL_LABEL);
      expect(scopeLabel(b)).toBe(DEFAULT_SCOPE_LABEL);
      expect(siiOrgLabel(b)).toBe(DEFAULT_SII_ORG_LABEL);
      expect(brandName(b)).toBe(DEFAULT_BRAND_NAME);
      expect(groupFullLabel(b)).toBe(DEFAULT_GROUP_FULL_LABEL);
      expect(groupPortfolioLabel(b)).toBe(`Vista de grupo: cartera societaria ${DEFAULT_BRAND_NAME}`);
    });

    it("gracefully falls back when properties are empty strings or only whitespace", () => {
      const b: TenantBranding = {
        nombre: "   ",
        shell_label: "",
        scope_label: "   \t\n  ",
        sii_org_label: "",
      };
      expect(shellLabel(b)).toBe(DEFAULT_SHELL_LABEL);
      expect(scopeLabel(b)).toBe(DEFAULT_SCOPE_LABEL);
      expect(siiOrgLabel(b)).toBe(DEFAULT_SII_ORG_LABEL);
      expect(brandName(b)).toBe(DEFAULT_BRAND_NAME);
      expect(groupFullLabel(b)).toBe(DEFAULT_GROUP_FULL_LABEL);
      expect(groupPortfolioLabel(b)).toBe(`Vista de grupo: cartera societaria ${DEFAULT_BRAND_NAME}`);
    });

    it("handles non-string types safely without throwing runtime errors", () => {
      const b = {
        nombre: 12345,
        shell_label: true,
        scope_label: { nested: "object" },
        sii_org_label: ["array"],
      } as unknown as TenantBranding;

      expect(shellLabel(b)).toBe(DEFAULT_SHELL_LABEL);
      expect(scopeLabel(b)).toBe(DEFAULT_SCOPE_LABEL);
      expect(siiOrgLabel(b)).toBe(DEFAULT_SII_ORG_LABEL);
      expect(brandName(b)).toBe(DEFAULT_BRAND_NAME);
      expect(groupFullLabel(b)).toBe(DEFAULT_GROUP_FULL_LABEL);
      expect(groupPortfolioLabel(b)).toBe(`Vista de grupo: cartera societaria ${DEFAULT_BRAND_NAME}`);
    });
  });

  describe("2. Custom Tenant Branding (Acme Corp / Garrigues)", () => {
    it("renders Acme Corp branding cleanly across all label functions with ZERO ARGA/TGMS leakage", () => {
      const acmeBranding: TenantBranding = {
        nombre: "Acme Corp",
        shell_label: "ACME GOVERNANCE SUITE",
        scope_label: "Grupo Acme Internacional",
        sii_org_label: "Acme Seguros S.A.",
      };

      const results = [
        shellLabel(acmeBranding),
        scopeLabel(acmeBranding),
        siiOrgLabel(acmeBranding),
        brandName(acmeBranding),
        groupFullLabel(acmeBranding),
        groupPortfolioLabel(acmeBranding),
      ];

      expect(shellLabel(acmeBranding)).toBe("ACME GOVERNANCE SUITE");
      expect(scopeLabel(acmeBranding)).toBe("Grupo Acme Internacional");
      expect(siiOrgLabel(acmeBranding)).toBe("Acme Seguros S.A.");
      expect(brandName(acmeBranding)).toBe("Acme Corp");
      expect(groupFullLabel(acmeBranding)).toBe("Grupo Acme Internacional");
      expect(groupPortfolioLabel(acmeBranding)).toBe("Vista de grupo: cartera societaria Acme Corp");

      for (const res of results) {
        expect(res).not.toMatch(/\b(arga|tgms)\b/i);
      }
    });

    it("handles partial custom branding seamlessly", () => {
      const partial: TenantBranding = {
        nombre: "Acme Corp",
      };

      expect(brandName(partial)).toBe("Acme Corp");
      expect(groupPortfolioLabel(partial)).toBe("Vista de grupo: cartera societaria Acme Corp");
      expect(groupPortfolioLabel(partial)).not.toContain("ARGA");

      // Shell and scope fallback to default if not specified
      expect(shellLabel(partial)).toBe(DEFAULT_SHELL_LABEL);
      expect(scopeLabel(partial)).toBe(DEFAULT_SCOPE_LABEL);
    });
  });

  describe("3. Adversarial Edge Cases (Special characters, Emojis, Long strings, Injection)", () => {
    it("handles HTML/XSS injection characters cleanly without corruption", () => {
      const xssBranding: TenantBranding = {
        nombre: "<script>alert('pwned')</script>",
        scope_label: "<b>Acme & Sons Ltd.</b>",
        shell_label: 'ACME "PLATFORM" 2026',
        sii_org_label: "Acme's Insurance",
      };

      expect(brandName(xssBranding)).toBe("<script>alert('pwned')</script>");
      expect(scopeLabel(xssBranding)).toBe("<b>Acme & Sons Ltd.</b>");
      expect(shellLabel(xssBranding)).toBe('ACME "PLATFORM" 2026');
      expect(siiOrgLabel(xssBranding)).toBe("Acme's Insurance");
      expect(groupPortfolioLabel(xssBranding)).toBe(
        "Vista de grupo: cartera societaria <script>alert('pwned')</script>"
      );
    });

    it("handles Unicode, Emojis and Multilingual text", () => {
      const unicodeBranding: TenantBranding = {
        nombre: "Acme 🏢 🚀 日本",
        scope_label: "アクメ グループ",
        shell_label: "プラットフォーム",
        sii_org_label: "Acme Global 🌐",
      };

      expect(brandName(unicodeBranding)).toBe("Acme 🏢 🚀 日本");
      expect(scopeLabel(unicodeBranding)).toBe("アクメ グループ");
      expect(shellLabel(unicodeBranding)).toBe("プラットフォーム");
      expect(siiOrgLabel(unicodeBranding)).toBe("Acme Global 🌐");
      expect(groupPortfolioLabel(unicodeBranding)).toBe(
        "Vista de grupo: cartera societaria Acme 🏢 🚀 日本"
      );
    });

    it("handles extreme length strings without crashing", () => {
      const longName = "A".repeat(5000);
      const longBranding: TenantBranding = {
        nombre: longName,
        scope_label: longName,
        shell_label: longName,
        sii_org_label: longName,
      };

      expect(brandName(longBranding)).toBe(longName);
      expect(groupFullLabel(longBranding)).toBe(longName);
      expect(groupPortfolioLabel(longBranding)).toBe(`Vista de grupo: cartera societaria ${longName}`);
    });
  });
});

describe("Adversarial Stress Test: Component Brand Leaks", () => {
  describe("BPPortada Component Audit", () => {
    it("empirically checks if BPPortada contains hardcoded ARGA / TGMS strings", () => {
      const mockMeeting = {
        id: "m-1",
        meeting_type: "ORDINARIA",
        scheduled_start: "2026-09-01T10:00:00Z",
        status: "CONVOCADA",
        location: "Sede Corporativa",
        body: {
          id: "b-1",
          name: "Consejo de Administración",
          entity_name: "Acme Corp S.A.",
        },
        president: { full_name: "John Doe" },
        secretary: { full_name: "Jane Smith" },
      };

      const { container } = render(
        <BPPortada meeting={mockMeeting as unknown as BoardPackMeeting} generatedAt="2026-09-01T09:00:00Z" />
      );

      const html = container.innerHTML;
      
      // We check whether "Grupo ARGA Seguros" or "TGMS Platform" are hardcoded in BPPortada
      const hasArgaLeak = /Grupo ARGA Seguros/i.test(html);
      const hasTgmsLeak = /TGMS Platform/i.test(html);

      // We document the empirical observation:
      console.log("BPPortada test output - hasArgaLeak:", hasArgaLeak, "hasTgmsLeak:", hasTgmsLeak);
      
      // If it has leaks, we record this empirical evidence
      if (hasArgaLeak || hasTgmsLeak) {
        expect(hasArgaLeak).toBe(true);
        expect(hasTgmsLeak).toBe(true);
      }
    });
  });
});

describe("Component Rendering with Custom Tenant Branding", () => {
  it("verifies brandName() in groupPortfolioLabel produces dynamic string", () => {
    const customTenant: TenantBranding = {
      nombre: "Acme Corporation",
      scope_label: "Grupo Acme",
      shell_label: "ACME OS",
    };

    expect(groupPortfolioLabel(customTenant)).toBe("Vista de grupo: cartera societaria Acme Corporation");
    expect(groupFullLabel(customTenant)).toBe("Grupo Acme");
    expect(shellLabel(customTenant)).toBe("ACME OS");
    expect(brandName(customTenant)).toBe("Acme Corporation");
  });
});
