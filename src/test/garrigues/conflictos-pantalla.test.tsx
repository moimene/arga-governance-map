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
    useConflictsList: () => ({ data: filasActuales, isLoading: false }),
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
let filasActuales: Array<Record<string, unknown>> = [FILA_SIN_TIPO];

afterEach(() => cleanup());

async function montar(tenant: string | null, filas = [FILA_SIN_TIPO] as Array<Record<string, unknown>>) {
  tenantActual = tenant;
  filasActuales = filas;
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

  it("los KPI muestran «—» y no 0 cuando ninguna fila lleva clasificación", async () => {
    // `0` afirma «no hay ninguno». Con cinco filas delante y ningún
    // `conflict_type`, lo cierto es «sin clasificar por este eje». Mismo
    // criterio que la columna Persona de la misma tabla.
    await montar(CONFLICTOS_TENANT, [FILA_SIN_TIPO, { ...FILA_SIN_TIPO, id: "c2", code: "COI-GARR-02" }]);
    // Se comprueba el VALOR, no que la cadena contenga un carácter: el
    // `textContent` del KPI es «<valor><etiqueta>» pegado, así que un
    // `/\b0\b/` no casaba nunca y la aserción habría pasado igual con un 0.
    // Lo destapó el tercer caso al fallar. Se pina el principio de la cadena.
    const permanentes = screen.getByText("Conflictos permanentes declarados").parentElement!;
    const situacionales = screen.getByText("Conflictos situacionales").parentElement!;
    expect(permanentes.textContent!.startsWith("—")).toBe(true);
    expect(situacionales.textContent!.startsWith("—")).toBe(true);
  });

  it("pero un tenant CON clasificación sigue viendo su cifra: ARGA no cambia", async () => {
    await montar(ARGA, [
      { ...FILA_SIN_TIPO, id: "a1", code: "CON-SIT-002", conflict_type: "Situacional" },
    ]);
    const kpi = screen.getByText("Conflictos situacionales").parentElement!;
    expect(kpi.textContent!.startsWith("1")).toBe(true);
  });

  it("y un tenant SIN conflictos ve un cero de verdad, no «—»", async () => {
    // El caso que mantiene honesto el arreglo. Si «—» apareciera también aquí,
    // se estaría ocultando una ausencia real detrás de una de procedencia.
    await montar(CONFLICTOS_TENANT, []);
    const kpi = screen.getByText("Conflictos permanentes declarados").parentElement!;
    expect(kpi.textContent!.startsWith("0")).toBe(true);
    expect(kpi.textContent).not.toContain("—");
  });
});
