// src/test/grc/perimetro-declarado.test.tsx
//
// Tres pantallas que enseñaban un número o una etiqueta sin decir qué queda
// fuera. Todo se comprueba RENDERIZANDO: el defecto de esta familia es de
// pantalla, y un grep del fuente lo declara arreglado sin mirarla.
//
// [#1119] La arista Risk360 → countSeverity era un grep (`toContain
// ("countSeverity(")`). Un señuelo `void countSeverity();` con el recuento
// reimplementado en línea la satisface entera. Aquí se monta la pantalla con
// un riesgo evaluado por banda y se lee el KPI en el DOM: si alguien vuelve a
// contar ROJO como crítico, este test cae aunque la llamada siga escrita.
//
// [#1090] El KPI "Riesgos críticos" del dashboard GRC cuenta residual >= 15.
// Medido en Cloud el 2026-09-06: 159 de los 167 riesgos de ARGA y los 82 del
// otro tenant no tienen residual. El número desnudo decía 0 sobre un perímetro
// que no había mirado.
//
// [#1116] `assessment_provenance` se traía en el select y no lo leía nadie:
// la banda se pintaba con su color y su etiqueta como dato firme, cuando la
// fuente declara `firmeza: "DEMO_PILOTO"` y que el nivel salió de un muestreo
// de píxel sin leyenda publicada.
import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { mockearModulos } from "../garrigues/_mock-restaurable";

const RIESGO_BASE = {
  id: "11111111-1111-1111-1111-111111111111",
  code: "RSK-PEN-001",
  title: "Cohecho",
  description: null,
  status: "Abierto",
  entity_id: null,
  module_id: "risk",
  probability: null,
  impact: null,
  inherent_score: null,
  residual_score: null,
  obligation_id: null,
  finding_id: null,
  assessed_band: null,
  assessment_breakdown: null,
  assessment_provenance: null,
  obligations: null,
  findings: null,
};

const PROVENANCE = {
  fuente: "Mapa de riesgos penales evaluado 2025",
  firmeza: "DEMO_PILOTO",
  metodo_extraccion: "muestreo de píxel sobre render pdftoppm; el nivel es color, no texto",
  escala: {
    tipo: "ORDINAL_SIN_NOMBRES",
    leyenda_en_fuente: false,
    advertencia: "La fuente no publica leyenda ni criterio de bandas.",
  },
};

// Estado mutable: `mock.module` se declara una vez y cada test lo apunta a lo
// que necesita. Se restaura en afterAll porque el mock es GLOBAL a la corrida.
let listaRiesgos: Array<Record<string, unknown>> = [];
let riesgoFicha: Record<string, unknown> | null = null;
let kpisGrc: Record<string, unknown> | undefined;

const restaurar = await mockearModulos([
  ["@/hooks/useRisks", () => ({
    useRisks: () => ({ data: listaRiesgos, isLoading: false, error: null }),
    useRiskById: () => ({ data: riesgoFicha, isLoading: false, error: null }),
    useCreateRisk: () => ({ mutate: () => {}, isPending: false }),
    useUpdateRisk: () => ({ mutate: () => {}, isPending: false }),
  })],
  ["@/hooks/useGrcDashboard", () => ({
    useGrcKpis: () => ({ data: kpisGrc, isLoading: false, error: null }),
    useGrcModules: () => ({ data: [], isLoading: false, error: null }),
  })],
  ["@/components/secretaria/shell", () => ({
    useSecretariaScope: () => ({
      mode: "grupo",
      selectedEntity: null,
      entities: [],
      createScopedTo: (ruta: string) => ruta,
    }),
  })],
]);
afterAll(restaurar);
afterEach(() => cleanup());
beforeEach(() => {
  listaRiesgos = [];
  riesgoFicha = null;
  kpisGrc = undefined;
});

/** El número que la tarjeta enseña: hijo directo, sin hijos propios y solo
 *  dígitos. Distingue el valor del rótulo y de la cautela. */
function valorDirecto(raiz: HTMLElement): string | null {
  for (const hijo of Array.from(raiz.children)) {
    const texto = (hijo.textContent ?? "").trim();
    if (hijo.children.length === 0 && /^\d+$/.test(texto)) return texto;
  }
  return null;
}

/** La tarjeta de un KPI: se sube desde su rótulo hasta el nodo que enseña el
 *  número. Exige UNA sola coincidencia: si el rótulo se repite en otra
 *  superficie, este helper avisa en vez de medir la equivocada. */
function tarjetaKpi(rotulo: string): HTMLElement {
  const encontradas: HTMLElement[] = [];
  for (const nodo of screen.getAllByText(rotulo)) {
    // Los accesos rápidos y las tarjetas de prioridad son enlaces; los
    // indicadores esenciales, no. Ese es el discriminante.
    if (nodo.closest("a")) continue;
    let actual: HTMLElement | null = nodo.parentElement;
    for (let salto = 0; salto < 3 && actual; salto++) {
      if (valorDirecto(actual) !== null) {
        encontradas.push(actual);
        break;
      }
      actual = actual.parentElement;
    }
  }
  if (encontradas.length !== 1) {
    throw new Error(`${encontradas.length} tarjetas de KPI para "${rotulo}", se esperaba 1`);
  }
  return encontradas[0];
}

async function montarRisk360() {
  const { default: Risk360 } = await import("@/pages/grc/Risk360");
  render(
    <MemoryRouter initialEntries={["/grc/risk-360"]}>
      <Risk360 />
    </MemoryRouter>,
  );
}

async function montarFicha(id: string) {
  const { default: RiskDetalle } = await import("@/pages/grc/RiskDetalle");
  render(
    <MemoryRouter initialEntries={[`/grc/risk-360/${id}`]}>
      <Routes>
        <Route path="/grc/risk-360/:id" element={<RiskDetalle />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function montarDashboard() {
  const { default: GrcDashboard } = await import("@/pages/grc/Dashboard");
  render(
    <MemoryRouter initialEntries={["/grc"]}>
      <GrcDashboard />
    </MemoryRouter>,
  );
}

describe("#1119 — una banda no cuenta como crítico EN PANTALLA", () => {
  it("un riesgo en banda roja deja el KPI Críticos en 0 y aparece en la tira de bandas", async () => {
    listaRiesgos = [{ ...RIESGO_BASE, assessed_band: "ROJO" }];
    await montarRisk360();

    const criticos = tarjetaKpi("Críticos");
    expect(valorDirecto(criticos)).toBe("0");

    // Control positivo de la ausencia: el riesgo SÍ está en pantalla, en su
    // banda. Sin esto, un Risk360 que no renderizara nada pasaría el KPI.
    expect(screen.getByText("Mapa de riesgos evaluados por bandas")).toBeTruthy();
    // Sale dos veces: cabecera del grupo y chip de la tarjeta del riesgo.
    expect(screen.getAllByText("Banda roja").length).toBeGreaterThan(0);
    expect(screen.getByText("1 delito")).toBeTruthy();
  });

  it("y el KPI dice cuántos riesgos quedan fuera del recuento", async () => {
    listaRiesgos = [
      { ...RIESGO_BASE, assessed_band: "ROJO" },
      { ...RIESGO_BASE, id: "b", code: "RSK-PEN-002", assessed_band: "NARANJA" },
    ];
    await montarRisk360();
    const kpi = tarjetaKpi("Críticos");
    expect(valorDirecto(kpi)).toBe("0");
    expect(kpi.textContent).toContain("2 riesgos fuera del recuento");
  });

  it("control discriminante: con ejes reales el KPI sí cuenta — el camino de ARGA", async () => {
    listaRiesgos = [{ ...RIESGO_BASE, probability: 5, impact: 5, residual_score: 25 }];
    await montarRisk360();
    const criticos = tarjetaKpi("Críticos");
    expect(valorDirecto(criticos)).toBe("1");
    // Y sin bandas no se pinta la tira: nada de perímetro fantasma.
    expect(screen.queryByText("Mapa de riesgos evaluados por bandas")).toBeNull();
  });
});

describe("#1090 — el KPI de riesgos críticos declara lo que no ha mirado", () => {
  it("dice cuántos no tienen residual y cuántos están en banda alta", async () => {
    kpisGrc = {
      criticalRisks: 0,
      risksSinScore: 82,
      risksBandaAlta: 8,
      openIncidents: 0,
      majorOpen: 0,
      pendingExceptions: 0,
      pendingRegNots: 0,
    };
    await montarDashboard();
    const tarjeta = tarjetaKpi("Riesgos críticos");
    expect(valorDirecto(tarjeta)).toBe("0");
    expect(tarjeta.textContent).toContain("82 sin residual, fuera del recuento");
    expect(tarjeta.textContent).toContain("8 en banda alta");
  });

  it("control discriminante: si TODO el perímetro tiene residual, no hay cautela que dar", async () => {
    kpisGrc = {
      criticalRisks: 3,
      risksSinScore: 0,
      risksBandaAlta: 0,
      openIncidents: 0,
      majorOpen: 0,
      pendingExceptions: 0,
      pendingRegNots: 0,
    };
    await montarDashboard();
    const tarjeta = tarjetaKpi("Riesgos críticos");
    expect(valorDirecto(tarjeta)).toBe("3");
    expect(tarjeta.textContent).not.toContain("residual");
  });
});

describe("#1116 — la banda del detalle enseña su procedencia", () => {
  it("con procedencia declarada, la ficha muestra la firmeza y la cautela", async () => {
    riesgoFicha = {
      ...RIESGO_BASE,
      assessed_band: "ROJO",
      assessment_provenance: PROVENANCE,
    };
    await montarFicha(RIESGO_BASE.id);
    expect(screen.getByText("Banda evaluada en origen")).toBeTruthy();
    expect(screen.getByText("DEMO_PILOTO")).toBeTruthy();
    expect(screen.getByText(/no publica leyenda ni criterio de bandas/)).toBeTruthy();
  });

  it("sin `escala.advertencia` cae al método de extracción, que también es cautela", async () => {
    riesgoFicha = {
      ...RIESGO_BASE,
      assessed_band: "NARANJA",
      assessment_provenance: { firmeza: "DEMO_PILOTO", metodo_extraccion: "muestreo de píxel" },
    };
    await montarFicha(RIESGO_BASE.id);
    expect(screen.getByText("muestreo de píxel")).toBeTruthy();
  });

  it("control discriminante ARGA: sin procedencia no se inventa ninguna", async () => {
    riesgoFicha = { ...RIESGO_BASE, assessed_band: "ROJO", assessment_provenance: null };
    await montarFicha(RIESGO_BASE.id);
    // Positivo primero: la ficha está montada y la banda se sigue viendo.
    expect(screen.getByText("Banda evaluada en origen")).toBeTruthy();
    expect(screen.getByText("Banda roja")).toBeTruthy();
    expect(screen.queryByText("DEMO_PILOTO")).toBeNull();
    expect(screen.queryByText(/muestreo de píxel/)).toBeNull();
  });
});
