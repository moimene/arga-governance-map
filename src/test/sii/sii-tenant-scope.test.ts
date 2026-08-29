// src/test/sii/sii-tenant-scope.test.ts
// Tarea 2 del carril C3 — el canal interno deja de compartir expedientes.
//
// La auditoría midió que un usuario de Garrigues veía las tres denuncias de
// ARGA: clave de localStorage literal ("arga_sii_whistleblowing_cases_v1"),
// queryKeys constantes, y las 5 rutas /sii/* sin RequireModule pese a que la
// whitelist `branding.modules` del tenant sí incluye "sii".
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siiStorageKey, siiQueryKey } from "@/lib/sii/tenant-scope";

const ARGA = "00000000-0000-0000-0000-000000000001";
const GARR = "00000000-0000-0000-0000-000000000002";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("SII — el almacén y las claves llevan tenant", () => {
  it("dos tenants nunca comparten bucket", () => {
    expect(siiStorageKey(ARGA)).not.toBe(siiStorageKey(GARR));
  });

  it("no hay forma de construir la clave sin tenant", () => {
    expect(() => siiStorageKey("")).toThrow();
  });

  it("dos tenants nunca comparten queryKey", () => {
    expect(siiQueryKey(ARGA, "reports", "list")).not.toEqual(siiQueryKey(GARR, "reports", "list"));
  });

  it("un tenant sin resolver no colisiona con un tenant real", () => {
    // TenantProvider arranca en null y resuelve por red: sin esto, el primer
    // render de todos los tenants compartiría la clave [...,null].
    expect(siiQueryKey(null, "reports")).not.toEqual(siiQueryKey(ARGA, "reports"));
  });
});

describe("SII — el hook no conserva ningún camino compartido", () => {
  const HOOK = read("src/hooks/useWhistleblowing.ts");

  it("la clave literal compartida ha desaparecido", () => {
    expect(HOOK).not.toContain("arga_sii_whistleblowing_cases_v1");
  });

  it("ninguna queryKey empieza por el literal sin tenant", () => {
    expect(/queryKey:\s*\["whistleblowing"/.test(HOOK)).toBe(false);
  });

  it("toda query se inhabilita sin tenant", () => {
    const queries = (HOOK.match(/useQuery\(/g) ?? []).length;
    const enabled = (HOOK.match(/enabled:/g) ?? []).length;
    expect(queries).toBeGreaterThan(0);
    expect(enabled).toBeGreaterThanOrEqual(queries);
  });

  it("LAS TRES PUERTAS del almacén eligen la siembra por tenant", () => {
    // getStoredReports tenía tres caminos que devolvían las denuncias de ARGA:
    //   1. `typeof window === "undefined"` (SSR)
    //   2. bucket vacío -> siembra y devuelve
    //   3. `catch` de JSON corrupto -> devuelve SIN sembrar, y por eso no deja
    //      rastro en localStorage: es el más difícil de reproducir de los tres.
    // Ninguna puede devolver INITIAL_SII_REPORTS directamente.
    const cuerpo = HOOK.slice(HOOK.indexOf("function getStoredReports"));
    const fin = cuerpo.indexOf("\nfunction saveStoredReports");
    const fn = cuerpo.slice(0, fin > 0 ? fin : 2000);
    expect(fn).not.toContain("INITIAL_SII_REPORTS");
    expect(fn).toContain("initialReportsFor");
  });
});

describe("SII — las rutas están gateadas por el módulo del tenant", () => {
  const APP = read("src/App.tsx");

  it("las 5 rutas /sii/* van envueltas en RequireModule", () => {
    // Sin esto la whitelist `branding.modules` es decorativa: cualquier usuario
    // autenticado de cualquier tenant entra por URL directa.
    const rutas = APP.split("\n").filter((l) => /path="\/sii/.test(l));
    expect(rutas.length).toBe(5);
    for (const linea of rutas) {
      expect(linea).toContain("RequireModule");
    }
  });
});
