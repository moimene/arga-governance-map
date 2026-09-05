import { describe, it, expect } from "vitest";
import {
  LOGIN_BRANDS,
  brandForTenant,
  loginTenantMismatch,
  resolveLoginBrand,
} from "@/lib/login-brands";

const ARGA = "00000000-0000-0000-0000-000000000001";
const GARRIGUES = "00000000-0000-0000-0000-000000000002";

describe("resolveLoginBrand", () => {
  it("devuelve ARGA por defecto", () => {
    const b = resolveLoginBrand("");
    expect(b.key).toBe("arga");
    expect(b.nombre).toBe("ARGA");
    expect(b.tenantId).toBe(ARGA);
  });

  it("devuelve Garrigues con ?tenant=garrigues", () => {
    const b = resolveLoginBrand("?tenant=garrigues");
    expect(b.key).toBe("garrigues");
    expect(b.nombre).toBe("Garrigues");
    expect(b.tenantId).toBe(GARRIGUES);
  });

  it("cae a ARGA con tenant desconocido y es case-insensitive", () => {
    expect(resolveLoginBrand("?tenant=acme").key).toBe("arga");
    expect(resolveLoginBrand("?tenant=GARRIGUES").key).toBe("garrigues");
  });

  it("no cuela propiedades heredadas de Object.prototype", () => {
    expect(resolveLoginBrand("?tenant=__proto__").key).toBe("arga");
    expect(resolveLoginBrand("?tenant=constructor").key).toBe("arga");
  });
});

describe("la pantalla de login no conoce credenciales", () => {
  it("ninguna marca lleva contraseña ni email demo", () => {
    const texto = JSON.stringify(LOGIN_BRANDS).toLowerCase();
    expect(texto).not.toMatch(/password|demoemail|tgmsdemo/);
  });
});

describe("loginTenantMismatch — la selección de entorno se contrasta con el perfil", () => {
  const arga = LOGIN_BRANDS.arga;
  const garrigues = LOGIN_BRANDS.garrigues;

  it("encaja cuando el perfil pertenece al entorno elegido", () => {
    expect(loginTenantMismatch(arga, ARGA)).toBeNull();
    expect(loginTenantMismatch(garrigues, GARRIGUES)).toBeNull();
  });

  it("rechaza una cuenta ARGA bajo el entorno Garrigues, y viceversa, nombrando el entorno real", () => {
    expect(loginTenantMismatch(garrigues, ARGA)).toMatch(/pertenece al entorno ARGA/);
    expect(loginTenantMismatch(arga, GARRIGUES)).toMatch(/pertenece al entorno Garrigues/);
  });

  it("rechaza una cuenta sin perfil (autoalta huérfana)", () => {
    expect(loginTenantMismatch(arga, null)).toMatch(/no tiene perfil/);
    expect(loginTenantMismatch(garrigues, undefined)).toMatch(/no tiene perfil/);
  });

  it("rechaza un tenant que no está en la pantalla", () => {
    expect(brandForTenant("eed5e854-0000-0000-0000-000000000000")).toBeNull();
    expect(loginTenantMismatch(arga, "eed5e854-0000-0000-0000-000000000000")).toMatch(/no está disponible/);
  });
});
