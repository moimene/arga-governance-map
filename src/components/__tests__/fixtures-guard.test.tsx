// El guard de las páginas que son fixture entero (ESG, Notificaciones).
//
// SE COMPRUEBA EL COMPORTAMIENTO: qué ve cada tenant. ARGA y Garrigues ven la
// página; el tenant que declara `fixtures: "none"` ve el vacío honesto; y
// mientras no se sabe de qué tenant hablamos, no se pinta NI la página NI el
// vacío — que es el frame en el que el dato de otro grupo se colaría.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { mockearModulos } from "../../test/garrigues/_mock-restaurable";

let brandingActual: Record<string, unknown> | null = null;
let brandingCargando = false;
let tenantCargando = false;

const restaurar = await mockearModulos([
  [
    "@/context/TenantBrandContext",
    () => ({
      useTenantBranding: () => brandingActual,
      useTenantBrandingLoading: () => brandingCargando,
    }),
  ],
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: "t", isLoading: tenantCargando }) })],
]);
afterAll(restaurar);
afterEach(() => {
  cleanup();
  brandingActual = null;
  brandingCargando = false;
  tenantCargando = false;
});

async function montar() {
  const { SoloConFixturesDemo } = await import("@/components/fixtures-guard");
  return render(
    <SoloConFixturesDemo titulo="ESG — Sostenibilidad e Impacto">
      <div data-testid="pagina-fixture">Score ESG 78</div>
    </SoloConFixturesDemo>,
  );
}

describe("SoloConFixturesDemo", () => {
  it("ARGA (branding NULL) ve la página", async () => {
    const r = await montar();
    expect(r.queryByTestId("pagina-fixture")).not.toBeNull();
  });

  it("Garrigues (branding sin la clave) ve la página", async () => {
    brandingActual = { nombre: "Garrigues", modules: ["secretaria"] };
    const r = await montar();
    expect(r.queryByTestId("pagina-fixture")).not.toBeNull();
  });

  it("el tenant en blanco ve el vacío honesto, con el título de la vista, y NO el fixture", async () => {
    brandingActual = { nombre: "Grupo Nuevo", fixtures: "none" };
    const r = await montar();
    expect(r.queryByTestId("pagina-fixture")).toBeNull();
    expect(r.container.textContent).not.toContain("Score ESG 78");
    expect(r.getByRole("heading", { level: 1 }).textContent).toBe("ESG — Sostenibilidad e Impacto");
    expect(r.getByRole("status").textContent).toContain("Sin datos todavía");
  });

  it("con el perfil o el branding en vuelo no pinta ni la página ni el vacío", async () => {
    for (const [t, b] of [[true, false], [false, true]] as const) {
      tenantCargando = t;
      brandingCargando = b;
      brandingActual = null; // indistinguible de ARGA: por eso se espera
      const r = await montar();
      expect(r.queryByTestId("pagina-fixture")).toBeNull();
      expect(r.queryByRole("status")).toBeNull();
      cleanup();
    }
  });
});
