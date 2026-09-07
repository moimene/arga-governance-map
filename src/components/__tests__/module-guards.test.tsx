import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/context/TenantBrandContext";
/**
 * Gating por módulo de las vistas de /grc/m/:moduleId.
 *
 * POR QUÉ EXISTE. El guard solo miraba `dora` y dejaba pasar cualquier otro
 * moduleId, así que un usuario del despacho llegaba por URL directa a vistas
 * con fixtures de aseguradora (pólizas, siniestros, tomadores). El contrato es:
 * ARGA (branding NULL) sigue viéndolo todo; un tenant con lista blanca solo ve
 * los módulos que declara.
 *
 * Prueba de COMPORTAMIENTO: renderiza el guard con una ruta real y mira si el
 * hijo se pinta o si redirige.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

let brandingActual: { modules?: string[] } | null = null;
let cargando = false;
let tenantCargando = false;

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/context/TenantBrandContext", { ...__realModule0 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@/context/TenantBrandContext", () => ({
  useTenantBranding: () => brandingActual,
  useTenantBrandingLoading: () => cargando,
}));

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({
    tenantId: tenantCargando ? null : "00000000-0000-0000-0000-000000000002",
    entityId: null,
    personId: null,
    roleCode: null,
    isLoading: tenantCargando,
  }),
}));

const { RequireGrcModule } = await import("../module-guards");

/** Lista blanca REAL del tenant Garrigues en Cloud (tenants.branding->modules). */
const MODULOS_GARRIGUES = [
  "secretaria", "grc", "ai-governance", "sii", "politicas", "obligaciones",
  "delegaciones", "hallazgos", "conflictos", "governance-map", "entidades", "organos",
];

function montarEn(moduleId: string) {
  return render(
    <MemoryRouter initialEntries={[`/grc/m/${moduleId}`]}>
      <Routes>
        <Route
          path="/grc/m/:moduleId"
          element={<RequireGrcModule><div>vista-del-modulo</div></RequireGrcModule>}
        />
        <Route path="/" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireGrcModule", () => {
  beforeEach(() => {
    brandingActual = null;
    cargando = false;
    tenantCargando = false;
  });

  it("ARGA (branding NULL) alcanza todas las vistas de módulo", () => {
    brandingActual = null;
    cargando = false;
    for (const modulo of ["dora", "gdpr", "cyber", "audit"]) {
      const { unmount } = montarEn(modulo);
      expect(screen.getByText("vista-del-modulo"), `ARGA debería ver ${modulo}`).toBeTruthy();
      unmount();
    }
  });

  it("Garrigues NO alcanza las vistas de módulo que no declara", () => {
    brandingActual = { modules: MODULOS_GARRIGUES };
    cargando = false;
    for (const modulo of ["dora", "gdpr", "cyber", "audit"]) {
      const { unmount } = montarEn(modulo);
      expect(screen.queryByText("vista-del-modulo"), `Garrigues no debería ver ${modulo}`).toBeNull();
      expect(screen.getByText("dashboard")).toBeTruthy();
      unmount();
    }
  });

  it("control discriminante: un módulo que Garrigues SÍ declara sigue alcanzable", () => {
    // Sin este control, un guard que redirigiera siempre pasaría la prueba anterior.
    brandingActual = { modules: [...MODULOS_GARRIGUES, "gdpr"] };
    cargando = false;
    montarEn("gdpr");
    expect(screen.getByText("vista-del-modulo")).toBeTruthy();
  });

  it("mientras el branding carga ni redirige ni pinta el módulo", () => {
    // La aserción de «no redirige» por sí sola no puede fallar por el defecto
    // que cubre: un guard que MONTARA el hijo durante la carga también deja
    // "dashboard" a null. Durante la carga se pinta el fallback: ninguno de
    // los dos.
    brandingActual = null;
    cargando = true;
    const { unmount } = montarEn("gdpr");
    expect(screen.queryByText("dashboard"), "redirigió sin saber el branding").toBeNull();
    expect(screen.queryByText("vista-del-modulo"), "pintó el módulo sin saber el branding").toBeNull();
    unmount();

    // Control discriminante: el mismo módulo con el branding ya cargado sí se
    // pinta. Sin esto, un guard que cerrara siempre pasaría lo de arriba.
    cargando = false;
    montarEn("gdpr");
    expect(screen.getByText("vista-del-modulo")).toBeTruthy();
  });

  it("mientras el TENANT se resuelve tampoco se pinta el módulo", () => {
    // La otra espera. `useTenantBrandingLoading()` es `!!tenantId && isLoading`:
    // con el tenant aún sin resolver vale false, el branding vale null e
    // `isModuleEnabled` falla ABIERTO. Sin esperar al tenant, el hijo se pinta
    // un frame antes de saber de quién es la sesión.
    tenantCargando = true;
    brandingActual = null;
    cargando = false;
    const { unmount } = montarEn("gdpr");
    expect(screen.queryByText("vista-del-modulo"), "se pintó sin saber el tenant").toBeNull();
    expect(screen.queryByText("dashboard"), "redirigió sin saber el tenant").toBeNull();
    unmount();

    // Control discriminante: el MISMO estado con el tenant ya resuelto sí pinta.
    // Sin esto, un guard que cerrara siempre pasaría la aserción de arriba.
    tenantCargando = false;
    montarEn("gdpr");
    expect(screen.getByText("vista-del-modulo")).toBeTruthy();
  });

  it("lista blanca vacía falla ABIERTO: un seed a medio escribir no deja al tenant sin producto", () => {
    brandingActual = { modules: [] };
    cargando = false;
    montarEn("gdpr");
    expect(screen.getByText("vista-del-modulo")).toBeTruthy();
  });
});
