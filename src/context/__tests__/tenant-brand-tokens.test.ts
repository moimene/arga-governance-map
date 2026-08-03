// src/context/__tests__/tenant-brand-tokens.test.ts
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { applyBrandTokens } from "@/context/TenantBrandContext";

describe("applyBrandTokens", () => {
  it("aplica solo claves --var y devuelve cleanup que las retira", () => {
    const el = document.createElement("div");
    const cleanup = applyBrandTokens(el, {
      "--t-brand": "#004438",
      "--primary": "168 100% 13%",
      "no-es-var": "ignorada",
    });
    expect(el.style.getPropertyValue("--t-brand")).toBe("#004438");
    expect(el.style.getPropertyValue("--primary")).toBe("168 100% 13%");
    expect(el.style.getPropertyValue("no-es-var")).toBe("");
    cleanup();
    expect(el.style.getPropertyValue("--t-brand")).toBe("");
    expect(el.style.getPropertyValue("--primary")).toBe("");
  });

  it("tokens null/undefined → no-op con cleanup inofensivo", () => {
    const el = document.createElement("div");
    const cleanup = applyBrandTokens(el, null);
    expect(el.getAttribute("style")).toBeFalsy();
    cleanup(); // no lanza
  });
});
