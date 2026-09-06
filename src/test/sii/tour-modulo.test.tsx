// src/test/sii/tour-modulo.test.tsx
//
// El tour no lleva a un módulo que el tenant tiene oculto.
//
// El defecto medido: `tourSteps` incluía el paso `/sii` sin mirar
// `branding.modules`. Las 5 rutas /sii/* sí están envueltas en
// `<RequireModule moduleKey="sii">`, así que en un tenant sin ese módulo el
// guard redirige a `/` — y el panel del tour se quedaba encima del Dashboard
// describiendo «el canal de integridad: segregado por diseño». No es un paso de
// más: es un texto que afirma que el usuario está viendo algo que el producto
// acaba de ocultarle.
//
// SE COMPRUEBA EL COMPORTAMIENTO, NO EL CABLEADO. Un guard de texto sobre
// `TourContext.tsx` («contiene isModuleEnabled») se satisface con una llamada
// de señuelo cuyo resultado se tira. Aquí se monta el provider con dos
// brandings distintos y se lee la lista que realmente navega.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { mockearModulos } from "../garrigues/_mock-restaurable";
import type { TourStep } from "@/context/TourContext";

/** Branding que verá el provider en el montaje siguiente. */
let brandingActual: { modules?: string[] } | null = null;

const restaurarMocks = await mockearModulos([
  [
    "@/context/TenantBrandContext",
    () => ({
      useTenantBranding: () => brandingActual,
      useTenantBrandingLoading: () => false,
    }),
  ],
]);
afterAll(restaurarMocks);
afterEach(() => cleanup());

/** Monta el provider y devuelve los pasos que ese tenant puede recorrer. */
async function pasosDe(branding: { modules?: string[] } | null) {
  brandingActual = branding;
  const { TourProvider, useTour } = await import("@/context/TourContext");
  let capturados: TourStep[] = [];
  let total = -1;
  function Sonda() {
    const t = useTour();
    capturados = t.steps;
    total = t.total;
    return null;
  }
  render(
    <MemoryRouter>
      <TourProvider>
        <Sonda />
      </TourProvider>
    </MemoryRouter>,
  );
  return { pasos: capturados, total };
}

describe("Tour — los pasos se filtran por módulo habilitado", () => {
  it("un tenant sin `sii` en la lista blanca NO recibe el paso del canal", async () => {
    const catalogo = (await import("@/context/TourContext")).tourSteps;

    // Control positivo PRIMERO: sin lista blanca (ARGA, o branding en vuelo) el
    // paso está. Sin esto, «no aparece /sii» sería indistinguible de «el
    // provider no devuelve ningún paso», que es la forma más fácil de que este
    // test pase sin probar nada.
    const abierto = await pasosDe(null);
    expect(abierto.total).toBe(catalogo.length);
    expect(abierto.pasos.some((s) => s.route === "/sii")).toBe(true);

    cleanup();

    // Y ahora el tenant que lo tiene oculto: cae exactamente ese paso.
    const cerrado = await pasosDe({ modules: ["secretaria", "grc", "ai-governance"] });
    expect(cerrado.pasos.some((s) => s.route.startsWith("/sii"))).toBe(false);
    expect(cerrado.total).toBe(catalogo.length - 1);
    // El resto del tour sobrevive: no se está apagando el tour entero.
    expect(cerrado.total).toBeGreaterThan(1);
    expect(cerrado.pasos.map((s) => s.route)).toEqual(
      catalogo.filter((s) => s.route !== "/sii").map((s) => s.route),
    );
  });

  it("Garrigues sí lo recibe: su lista blanca declara `sii`", async () => {
    // La dirección contraria. Ocultar de más también es un defecto, y el tenant
    // despacho tiene el canal habilitado.
    const { pasos } = await pasosDe({ modules: ["secretaria", "sii", "grc"] });
    expect(pasos.some((s) => s.route === "/sii")).toBe(true);
  });

  it("la clave del paso es la MISMA con la que App.tsx gatea la ruta", async () => {
    // Si alguien renombra la clave en un sitio y no en el otro, el filtro deja
    // de coincidir con el guard y el tour vuelve a llevar a una ruta prohibida.
    const { tourSteps } = await import("@/context/TourContext");
    const paso = tourSteps.find((s) => s.route === "/sii");
    expect(paso?.moduleKey).toBe("sii");

    const app = readFileSync("src/App.tsx", "utf8");
    const rutas = app.split("\n").filter((l) => /path="\/sii/.test(l));
    expect(rutas.length).toBeGreaterThan(0);
    for (const linea of rutas) {
      expect(linea).toContain(`RequireModule moduleKey="${paso?.moduleKey}"`);
    }
  });
});
