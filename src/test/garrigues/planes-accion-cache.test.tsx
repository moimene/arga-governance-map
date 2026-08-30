//
// La clave de caché lleva el tenant. Fichero aparte a propósito: el test de
// contenido mockea `useQuery`, así que no puede ver la queryKey — si alguien le
// quitara el tenant, aquel seguiría verde. Aquí el QueryClient es REAL.
//
// La fuga que cubre es el gotcha nº10 del proyecto: RLS filtra la CONSULTA,
// pero no la CACHÉ. Con la clave sin tenant los dos comparten entrada y el
// segundo en entrar ve lo que trajo el primero.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PLAN_ACCION_AUSENCIA } from "../../../scripts/garrigues/hallazgos/hallazgos-penales";
import { mockearModulos } from "./_mock-restaurable";

// El caso que motivó el helper: este stub de `supabase` tumbaba 11 tests de
// motor-plantillas, que pasa 13/13 aislado. Ver _mock-restaurable.ts.
const restaurarMocks = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
  ["@/integrations/supabase/client", () => ({
    supabase: { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) },
  })],
]);
afterAll(restaurarMocks);


const ARGA = "00000000-0000-0000-0000-000000000001";
let tenantActual: string | null = null;



afterEach(() => cleanup());

async function entradasTras(tenant: string | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  tenantActual = tenant;
  const { default: ActionPlans } = await import("@/pages/grc/modules/audit/ActionPlans");
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ActionPlans />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const entradas = qc.getQueryCache().getAll().map((q) => ({
    clave: q.queryKey as unknown[],
    estado: q.state.fetchStatus,
    datos: q.state.data,
  }));
  cleanup();
  return entradas;
}

describe("C3 Tarea 5 — la caché de planes no se comparte entre tenants", () => {
  it("cada tenant tiene su propia entrada, y no la misma", async () => {
    const deGarrigues = await entradasTras(PLAN_ACCION_AUSENCIA.tenantId);
    const deArga = await entradasTras(ARGA);

    expect(deGarrigues.length).toBe(1);
    expect(deArga.length).toBe(1);
    expect(deGarrigues[0].clave).toContain(PLAN_ACCION_AUSENCIA.tenantId);
    expect(deArga[0].clave).toContain(ARGA);
    expect(JSON.stringify(deGarrigues[0].clave)).not.toBe(JSON.stringify(deArga[0].clave));
  });

  it("y con el tenant sin resolver NO se busca: la entrada queda sin datos", async () => {
    // Correccion de mi propia premisa: `enabled: false` NO impide que TanStack
    // registre la entrada en cache — la registra y no la busca. Lo que importa,
    // y lo que se asierta, es que no llega a traer datos que otro tenant
    // pudiera reutilizar.
    const entradas = await entradasTras(null);
    const conNull = entradas.filter((e) => e.clave.includes(null));
    expect(conNull.length).toBeGreaterThan(0);
    expect(conNull.every((e) => e.estado === "idle")).toBe(true);
    expect(conNull.every((e) => e.datos === undefined)).toBe(true);
  });
});
