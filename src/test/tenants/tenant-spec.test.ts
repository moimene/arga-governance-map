// src/test/tenants/tenant-spec.test.ts
//
// El catálogo de tenants en blanco es lo que el bootstrap escribe en Cloud con
// service-role. Un spec malo no da error: da un tenant que se pinta como ARGA,
// un usuario con dominio real o un INSERT sobre un tenant con contrato. Cada
// regla de `validarTenantSpec` se prueba ROMPIÉNDOLA: un validador que devuelve
// siempre [] pasaría el primer test y ninguno de los demás.
import { describe, expect, it } from "vitest";
import {
  ARGA_TENANT_ID,
  GARRIGUES_TENANT_ID,
  TENANT_SPECS,
  tenantSpec,
  validarTenantSpec,
  type TenantSpec,
} from "../../../scripts/tenants/tenant-spec";
import { LOGIN_BRANDS } from "@/lib/login-brands";

const base = (): TenantSpec => structuredClone(TENANT_SPECS.nuevo);

describe("catálogo de tenants en blanco", () => {
  it("todo spec declarado es válido", () => {
    for (const [key, spec] of Object.entries(TENANT_SPECS)) {
      expect(validarTenantSpec(spec), `spec ${key}`).toEqual([]);
      expect(spec.key).toBe(key);
    }
  });

  it("ningún spec apunta a ARGA ni a Garrigues, ni dos comparten tenant o prefijo", () => {
    const specs = Object.values(TENANT_SPECS);
    for (const s of specs) {
      expect([ARGA_TENANT_ID, GARRIGUES_TENANT_ID]).not.toContain(s.tenantId);
    }
    expect(new Set(specs.map((s) => s.tenantId)).size).toBe(specs.length);
    expect(new Set(specs.map((s) => s.packIdPrefix)).size).toBe(specs.length);
  });

  it("cada spec tiene su entorno de login, con el MISMO tenantId", () => {
    // `login-brands.ts` es un mapa estático pre-auth y no puede importar el
    // catálogo de scripts: la coherencia se vigila aquí. Si divergen, la cuenta
    // del tenant se rechaza en su propio entorno («pertenece a otro entorno»).
    for (const spec of Object.values(TENANT_SPECS)) {
      expect(Object.prototype.hasOwnProperty.call(LOGIN_BRANDS, spec.key), `falta LOGIN_BRANDS.${spec.key}`).toBe(true);
      expect(LOGIN_BRANDS[spec.key].tenantId).toBe(spec.tenantId);
    }
  });

  it("el lookup no cuela propiedades heredadas", () => {
    expect(tenantSpec("nuevo")?.key).toBe("nuevo");
    expect(tenantSpec("__proto__")).toBeNull();
    expect(tenantSpec("constructor")).toBeNull();
    expect(tenantSpec("arga")).toBeNull();
    expect(tenantSpec(null)).toBeNull();
  });
});

describe("validarTenantSpec — cada regla se rompe a propósito", () => {
  const rompe = (mutar: (s: TenantSpec) => void, patron: RegExp) => {
    const s = base();
    mutar(s);
    const problemas = validarTenantSpec(s);
    expect(problemas.join(" | ")).toMatch(patron);
  };

  it("rechaza un tenant reservado", () => {
    rompe((s) => { s.tenantId = ARGA_TENANT_ID; }, /RESERVADO/);
    rompe((s) => { s.tenantId = GARRIGUES_TENANT_ID; }, /RESERVADO/);
  });

  it("rechaza un rótulo vacío: caería al default de ARGA", () => {
    rompe((s) => { s.branding.scope_label = "  "; }, /scope_label vacío/);
    rompe((s) => { s.branding.shell_label = ""; }, /shell_label vacío/);
    rompe((s) => { s.branding.nombre = "Grupo ARGA"; }, /menciona ARGA/);
  });

  it("exige fixtures «none» y rechaza una lista de módulos vacía", () => {
    rompe((s) => { (s.branding as { fixtures: string }).fixtures = "all"; }, /fixtures/);
    rompe((s) => { s.branding.modules = []; }, /modules declarada pero vacía/);
  });

  it("acepta una lista blanca de módulos bien formada", () => {
    const s = base();
    s.branding.modules = ["secretaria", "grc"];
    expect(validarTenantSpec(s)).toEqual([]);
  });

  it("rechaza dominios de correo que no sean ficticios", () => {
    rompe((s) => { s.users[0].email = "demo@garrigues.com"; }, /patrón ficticio/);
    rompe((s) => { s.users[1].email = s.users[0].email; }, /email repetido/);
  });

  it("exige SECRETARIO y ADMIN_TENANT", () => {
    rompe((s) => { s.users = s.users.filter((u) => u.role !== "ADMIN_TENANT"); }, /falta un usuario ADMIN_TENANT/);
    rompe((s) => { s.users = s.users.filter((u) => u.role !== "SECRETARIO"); }, /falta un usuario SECRETARIO/);
  });

  it("exige el módulo GRC `risk` y prefijo de pack propio", () => {
    rompe((s) => { s.grcModules = s.grcModules.filter((m) => m.id !== "risk"); }, /sin `risk`/);
    rompe((s) => { s.packIdPrefix = "GARR"; }, /pertenece a Garrigues/);
    rompe((s) => { s.packIdPrefix = "gn"; }, /packIdPrefix inválido/);
  });

  it("la contraseña es una variable de entorno, nunca un literal", () => {
    rompe((s) => { s.passwordEnvVar = "hunter2"; }, /passwordEnvVar inválida/);
    expect(JSON.stringify(TENANT_SPECS).toLowerCase()).not.toMatch(/"password"\s*:/);
  });
});
