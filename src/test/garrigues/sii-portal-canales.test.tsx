//
// El portal de entrada del SII informa del canal externo, y solo a quien le
// toca.
//
// Lo que se protege aquí no es un rótulo: es que el informante lea, ANTES de
// comunicar, que puede acudir a la A.A.I. o al SEPBLAC **directamente**. El
// art. 25 de la Ley 2/2023 obliga a informar de ambos canales, y presentar el
// interno como obligatorio o previo sería un error de derecho.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockearModulos } from "./_mock-restaurable";
import {
  SII_CANALES_EXTERNOS,
  SII_ROLES,
  SII_TENANT,
} from "../../../scripts/garrigues/sii/canal-interno";

const ARGA = "00000000-0000-0000-0000-000000000001";

if (typeof globalThis.getComputedStyle === "undefined" && typeof window !== "undefined") {
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
}

let tenantActual: string | null = SII_TENANT;

const restaurarMocks = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
  ["@/hooks/useEntities", () => ({ useEntitiesList: () => ({ data: [], isLoading: false }) })],
  ["@/hooks/useWhistleblowing", () => ({
    useCreateWhistleblowingReport: () => ({ mutateAsync: async () => ({}), isPending: false }),
  })],
]);
afterAll(restaurarMocks);
afterEach(() => cleanup());

async function montar(tenant: string | null) {
  tenantActual = tenant;
  const { default: SiiPortalIntake } = await import("@/pages/sii/SiiPortalIntake");
  render(
    <MemoryRouter>
      <SiiPortalIntake />
    </MemoryRouter>,
  );
}

describe("SII — el portal informa del canal externo (art. 25)", () => {
  it("nombra los dos canales externos con su ámbito", async () => {
    await montar(SII_TENANT);
    for (const c of SII_CANALES_EXTERNOS) {
      // `getAllBy…`: el nombre aparece también dentro de su nota, y
      // `getByText` lanza cuando encuentra más de uno.
      const escapado = c.nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(screen.getAllByText(new RegExp(escapado)).length).toBeGreaterThan(0);
      // Y el ámbito, que es lo que dice CUÁNDO sirve cada canal.
      expect(screen.getByText(new RegExp(c.ambito.slice(0, 40)))).toBeTruthy();
    }
  });

  it("y dice que NO son subsidiarios del interno", async () => {
    // La aserción con contenido jurídico. Sin esto, el bloque podría listar
    // los canales y aun así dar a entender que hay que agotar el interno.
    await montar(SII_TENANT);
    expect(screen.getByText(/no es obligatorio ni previo/)).toBeTruthy();
    expect(screen.getByText(/directamente/)).toBeTruthy();
  });

  it("nombra a los dos responsables reales, y ninguno es una comisión", async () => {
    await montar(SII_TENANT);
    for (const r of SII_ROLES) {
      expect(screen.getByText(new RegExp(r.cargo))).toBeTruthy();
    }
    // Los órganos que había antes —«Comisión de Auditoría y Control», «Comité
    // de Cumplimiento»— son de una aseguradora y aquí no existen.
    expect(screen.queryByText(/Comisión de Auditoría y Control/)).toBeNull();
    expect(screen.queryByText(/Comité de Cumplimiento e Independencia/)).toBeNull();
  });

  it("y ARGA no ve nada de esto: el control que da sentido a lo anterior", async () => {
    await montar(ARGA);
    expect(screen.queryByText(/SEPBLAC/)).toBeNull();
    expect(screen.queryByText(/Senior Partner/)).toBeNull();
    expect(screen.queryByText(/PI-31/)).toBeNull();
    // Pero la pantalla sigue estando: no se le ha roto nada.
    expect(screen.getByText(/Portal de Recepción del Sistema Interno/)).toBeTruthy();
  });
});
