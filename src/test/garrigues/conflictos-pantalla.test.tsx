//
// Dos cosas en la misma pantalla, y la primera es una regresión de verdad.
//
// `Conflictos.tsx` hacía `c.conflict_type.toUpperCase()` sin guarda. La columna
// admite NULL —y lo es en todas las filas cuya taxonomía de origen no es la de
// esa columna—, así que la primera de ellas reventaba la pantalla ENTERA, no
// solo su celda. No lo cubría nada.
//
// La segunda es el control discriminante de la procedencia: que ARGA no vea un
// aviso que habla de una política que no es suya.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  CONFLICTOS_AVISO,
  CONFLICTOS_TENANT,
} from "../../../scripts/garrigues/conflictos/catalogo-conflictos";
import { mockearModulos } from "./_mock-restaurable";

// `mock.module` es GLOBAL a la corrida. Ver _mock-restaurable.ts.
const restaurarMocks = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
  ["@/context/TenantBrandContext", () => ({ useTenantBranding: () => null })],
  ["@/hooks/useConflicts", () => ({
    useConflictsList: () => ({ data: [FILA_SIN_TIPO], isLoading: false }),
    useAttestationsList: () => ({ data: [], isLoading: false }),
  })],
]);
afterAll(restaurarMocks);


// El preload monta JSDOM pero no expone `getComputedStyle` como global, y los
// primitivos de Radix que usa esta pantalla lo llaman. Se puentea AQUÍ y no en
// `src/test/setup.ts`, que es de todos y no de este carril.
if (typeof globalThis.getComputedStyle === "undefined" && typeof window !== "undefined") {
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
}

const ARGA = "00000000-0000-0000-0000-000000000001";

const FILA_SIN_TIPO = {
  id: "c1",
  code: "COI-GARR-01",
  conflict_type: null, // el caso que reventaba
  description: "Un socio del área Mercantil recibe un encargo…",
  status: "Pendiente",
  person_name: null,
  person_role: null,
  finding_code: null,
  related_finding_id: null,
};

let tenantActual: string | null = CONFLICTOS_TENANT;

afterEach(() => cleanup());

async function montar(tenant: string | null) {
  tenantActual = tenant;
  const { default: Conflictos } = await import("@/pages/Conflictos");
  render(
    <MemoryRouter>
      <Conflictos />
    </MemoryRouter>,
  );
}

describe("C3 Tarea 6 — la pantalla de conflictos", () => {
  it("no revienta con `conflict_type` a NULL, y muestra la categoría de PI-02", async () => {
    // Si vuelve el `.toUpperCase()` sin guarda, esto no falla: lanza.
    await montar(CONFLICTOS_TENANT);
    expect(screen.getByText("COI-GARR-01")).toBeTruthy();
    expect(screen.getByText(/sentido estricto/i)).toBeTruthy();
    expect(screen.getByText("PI-02 §2.1")).toBeTruthy();
  });

  it("Garrigues ve de dónde salen estas filas", async () => {
    await montar(CONFLICTOS_TENANT);
    expect(screen.getByText(CONFLICTOS_AVISO.titulo)).toBeTruthy();
    expect(screen.getByText(/no publica un registro/)).toBeTruthy();
  });

  it("ARGA NO ve el aviso de una política que no es suya", async () => {
    // El control que hace que los dos anteriores signifiquen algo.
    await montar(ARGA);
    expect(screen.queryByText(CONFLICTOS_AVISO.titulo)).toBeNull();
    expect(screen.queryByText(/PI-02/)).toBeNull();
  });
});
