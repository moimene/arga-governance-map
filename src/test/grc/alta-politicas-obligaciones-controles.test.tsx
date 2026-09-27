// src/test/grc/alta-politicas-obligaciones-controles.test.tsx
//
// MOI-149 (D-23, alta por pantalla): políticas, obligaciones y controles
// nacían solo por seed — ninguna pantalla podía darlos de alta. Estas
// pruebas son de ARISTA: montan las pantallas REALES (PoliticasList,
// ObligacionesList, ObligacionDetalle) con sus hooks reales, y sustituyen
// únicamente `supabase.from` en el propio cliente compartido (patrón de
// `tab-expediente-tecnico.test.tsx`) para no tocar Cloud. El almacén en
// memoria filtra por `tenant_id` igual que lo haría RLS, así que:
//
//   1. el INSERT que sale del formulario lleva el tenant de la sesión, y
//   2. lo creado bajo un tenant no aparece leído desde otro.
//
// Si el formulario deja de mandar `tenant_id` desde `useTenantContext()`, o
// la pantalla dejara de invalidar/leer la lista tras crear, estas pruebas
// caen.
import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { mockearModulos } from "../garrigues/_mock-restaurable";

// El preload monta JSDOM pero no expone `getComputedStyle`, y Radix Tabs lo
// invoca al montar. Puente local, no en setup.ts (que es de todos).
if (typeof globalThis.getComputedStyle === "undefined" && typeof window !== "undefined") {
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
}

const TENANT_A = "00000000-0000-0000-0000-000000000003"; // grupo nuevo
const TENANT_B = "00000000-0000-0000-0000-000000000001"; // ARGA

let tenantActual: string | null = TENANT_A;

// `mock.module` es GLOBAL a la corrida — ver _mock-restaurable.ts.
const restaurarMocks = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
]);
afterAll(restaurarMocks);

// ── Almacén en memoria + doble de `supabase.from`, restaurable ─────────────
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let nextId = 1;

function resetStore() {
  tables = { policies: [], obligations: [], controls: [], evidences: [], incidents: [] };
  nextId = 1;
}

function seedObligation(row: Row) {
  tables.obligations.push(row);
}

const cliente = supabase as unknown as Record<string, unknown>;

beforeEach(() => {
  resetStore();
  cliente.from = (table: string) => {
    const rows = tables[table] ?? (tables[table] = []);
    // Simula RLS: una lectura sin filtro explícito de tenant solo ve las
    // filas del tenant de la sesión (`tenantActual`), igual que la política
    // `tenant_id = fn_current_tenant_id()` en Cloud.
    let working = rows.filter((r) => r.tenant_id === tenantActual);
    let insertedRow: Row | null = null;

    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (col: string, val: unknown) => {
        working = working.filter((r) => r[col] === val);
        return builder;
      },
      in: (col: string, vals: unknown[]) => {
        working = working.filter((r) => vals.includes(r[col]));
        return builder;
      },
      insert: (v: Row) => {
        const row: Row = { id: `id-${nextId++}`, created_at: new Date().toISOString(), ...v };
        rows.push(row);
        insertedRow = row;
        working = [row];
        return builder;
      },
      maybeSingle: async () => ({ data: working[0] ?? null, error: null }),
      single: async () => ({ data: insertedRow ?? working[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[]; error: null }) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: working, error: null }).then(resolve, reject),
    };
    return builder;
  };
});
afterEach(() => {
  cleanup();
  // `from` es un método del prototipo del cliente real: borrar la propiedad
  // propia lo repone entre pruebas.
  delete cliente.from;
});

function clienteDePrueba() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

describe("MOI-149 — alta de políticas por pantalla", () => {
  it("crea una política con el tenant de la sesión y la lista la lee de vuelta", async () => {
    const { default: PoliticasList } = await import("@/pages/PoliticasList");
    render(
      <QueryClientProvider client={clienteDePrueba()}>
        <MemoryRouter>
          <PoliticasList />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Nueva política/i }));
    fireEvent.change(screen.getByLabelText(/Código \*/), { target: { value: "PI-NUEVA-01" } });
    fireEvent.change(screen.getByLabelText(/Título \*/), { target: { value: "Política de prueba" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear política" }));

    // Arista: la lista (misma pantalla) lee de vuelta lo recién creado.
    await waitFor(() => expect(screen.getByText("PI-NUEVA-01")).toBeTruthy());

    expect(tables.policies).toHaveLength(1);
    expect(tables.policies[0].tenant_id).toBe(TENANT_A);
    expect(tables.policies[0].policy_code).toBe("PI-NUEVA-01");
    // Estado inicial honesto: nace en borrador, no publicada.
    expect(tables.policies[0].status).toBe("Draft");
  });

  it("no escribe en otro grupo: lo creado bajo un tenant no lo lee otro", async () => {
    tables.policies.push({ id: "seed-1", tenant_id: TENANT_A, policy_code: "PI-SEED", title: "Semilla A", status: "Draft" });

    const { default: PoliticasList } = await import("@/pages/PoliticasList");
    tenantActual = TENANT_B;
    render(
      <QueryClientProvider client={clienteDePrueba()}>
        <MemoryRouter>
          <PoliticasList />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // La política sembrada para el otro tenant no aparece.
    await waitFor(() => expect(screen.queryByText(/políticas y normas en el catálogo/i)).toBeTruthy());
    expect(screen.queryByText("PI-SEED")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Nueva política/i }));
    fireEvent.change(screen.getByLabelText(/Código \*/), { target: { value: "PI-DE-B" } });
    fireEvent.change(screen.getByLabelText(/Título \*/), { target: { value: "Política de B" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear política" }));
    await waitFor(() => expect(screen.getByText("PI-DE-B")).toBeTruthy());

    const created = tables.policies.find((p) => p.policy_code === "PI-DE-B")!;
    expect(created.tenant_id).toBe(TENANT_B);
    tenantActual = TENANT_A;
  });
});

describe("MOI-149 — alta de obligaciones por pantalla", () => {
  it("crea una obligación con el tenant de la sesión", async () => {
    tenantActual = TENANT_A;
    const { default: ObligacionesList } = await import("@/pages/ObligacionesList");
    render(
      <QueryClientProvider client={clienteDePrueba()}>
        <MemoryRouter>
          <ObligacionesList />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Nueva obligación/i }));
    fireEvent.change(screen.getByLabelText(/Código \*/), { target: { value: "OBL-NUEVA-01" } });
    fireEvent.change(screen.getByLabelText(/Título \*/), { target: { value: "Obligación de prueba" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear obligación" }));

    await waitFor(() => expect(screen.getByText("OBL-NUEVA-01")).toBeTruthy());
    expect(tables.obligations).toHaveLength(1);
    expect(tables.obligations[0].tenant_id).toBe(TENANT_A);
    expect(tables.obligations[0].code).toBe("OBL-NUEVA-01");
  });
});

describe("MOI-149 — alta de controles por pantalla", () => {
  it("crea un control ligado a la obligación abierta, con el tenant de la sesión", async () => {
    tenantActual = TENANT_A;
    seedObligation({
      id: "obl-1",
      tenant_id: TENANT_A,
      code: "OBL-EXISTENTE",
      title: "Obligación existente",
      source: "RGPD",
      criticality: "Alto",
      policy_id: null,
    });

    const { default: ObligacionDetalle } = await import("@/pages/ObligacionDetalle");
    render(
      <QueryClientProvider client={clienteDePrueba()}>
        <MemoryRouter initialEntries={["/obligaciones/OBL-EXISTENTE"]}>
          <Routes>
            <Route path="/obligaciones/:id" element={<ObligacionDetalle />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // La pestaña "Controles" no está montada hasta que se selecciona. Radix
    // Tabs cambia de pestaña en `onMouseDown` (no en `onClick`, ver
    // @radix-ui/react-tabs) — mismo gotcha que en user-menu-cambio-entorno.test.tsx.
    fireEvent.mouseDown(await screen.findByRole("tab", { name: /Controles/i }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByText("Asignar control"));
    fireEvent.change(screen.getByLabelText(/Código \*/), { target: { value: "CTR-NUEVO-01" } });
    fireEvent.change(screen.getByLabelText(/Nombre \*/), { target: { value: "Control de prueba" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear control" }));

    await waitFor(() => expect(screen.getAllByText("CTR-NUEVO-01").length).toBeGreaterThan(0));

    expect(tables.controls).toHaveLength(1);
    const created = tables.controls[0];
    expect(created.tenant_id).toBe(TENANT_A);
    expect(created.code).toBe("CTR-NUEVO-01");
    expect(created.obligation_id).toBe("obl-1");
    // Estado inicial honesto: no se afirma "Efectivo" sin haberlo probado.
    expect(created.status).toBe("Parcial");
  });
});
