// src/test/grc/control-por-codigo.test.tsx
//
// [#75] `useControlByCode` resolvía por clave natural con `.maybeSingle()`, y
// `controls.code` no es único. El cierre anterior le puso el tenant, que era
// necesario pero NO suficiente: el código tampoco es único DENTRO de un tenant.
//
// Medido en Cloud el 2026-09-06: ARGA tiene dos `CTR-004` distintos, creados
// con dos días de diferencia. Con dos filas, PostgREST devuelve error en
// `.maybeSingle()` y `/controles/CTR-004` no abría ninguno de los dos.
//
// El doble de Supabase reproduce esa semántica —más de una fila es un ERROR,
// no la primera— y por eso el test cae si alguien quita el `limit(1)`.
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "../helpers/sin-comentarios";
import { mockearModulos } from "../garrigues/_mock-restaurable";

const ARGA = "00000000-0000-0000-0000-000000000001";
const OTRO_TENANT = "00000000-0000-0000-0000-000000000002";

// Las dos filas reales de ARGA, con sus id y created_at de Cloud.
const VIEJA = {
  id: "faf7131b-4e90-4c55-b0c1-01daef6da9e3",
  tenant_id: ARGA,
  code: "CTR-004",
  name: "Procedimiento de notificación de incidentes DORA — Plantilla y escalado",
  status: "Parcial",
  created_at: "2026-04-17T12:16:41.897319+00:00",
  owner_id: null,
  obligation_id: null,
  last_test_date: null,
  next_test_date: null,
};
const NUEVA = {
  ...VIEJA,
  id: "db07c309-a873-4fe9-97b5-7e7c4848abc4",
  name: "Gestión de parches ICT críticos en plazo <15 días",
  created_at: "2026-04-19T14:46:18.193094+00:00",
};
// Mismo código en otro tenant: si el scoping desapareciera, habría tres.
const AJENA = { ...VIEJA, id: "ffffffff-0000-0000-0000-000000000009", tenant_id: OTRO_TENANT };

const FILAS = [NUEVA, AJENA, VIEJA];

type Fila = typeof VIEJA;

/** Doble de PostgREST: `maybeSingle()` con más de una fila es un ERROR. */
function consultaFake(filas: Fila[]) {
  const filtros: Array<[string, unknown]> = [];
  const ordenes: string[] = [];
  let tope: number | null = null;
  const q = {
    // Acepta la lista de columnas: el hook llama `.select("*")` y el doble
    // tiene que admitir la misma firma que PostgREST o `tsc` lo caza.
    select: (_columnas?: string) => q,
    eq: (col: string, v: unknown) => {
      filtros.push([col, v]);
      return q;
    },
    order: (col: string) => {
      ordenes.push(col);
      return q;
    },
    limit: (n: number) => {
      tope = n;
      return q;
    },
    maybeSingle: async () => {
      let out = filas.filter((f) =>
        filtros.every(([c, v]) => (f as unknown as Record<string, unknown>)[c] === v),
      );
      out = [...out].sort((a, b) => {
        for (const c of ordenes) {
          const va = String((a as unknown as Record<string, unknown>)[c]);
          const vb = String((b as unknown as Record<string, unknown>)[c]);
          if (va !== vb) return va < vb ? -1 : 1;
        }
        return 0;
      });
      if (tope !== null) out = out.slice(0, tope);
      if (out.length > 1) {
        return {
          data: null,
          error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
        };
      }
      return { data: out[0] ?? null, error: null };
    },
  };
  return q;
}

let tenantActual: string | null = ARGA;

const restaurar = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
  ["@/integrations/supabase/client", () => ({ supabase: { from: () => consultaFake(FILAS) } })],
]);
afterAll(restaurar);
afterEach(() => cleanup());

function envoltura({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("#75 — un código duplicado no rompe la ficha de control", () => {
  it("el doble castiga de verdad: sin limit(1), dos filas son error", async () => {
    // Control positivo del instrumento. Sin esto, el test de abajo pasaría
    // aunque el fake devolviera siempre la primera fila.
    const sinTope = await consultaFake(FILAS)
      .select("*")
      .eq("tenant_id", ARGA)
      .eq("code", "CTR-004")
      .maybeSingle();
    expect(sinTope.error?.code).toBe("PGRST116");
    expect(sinTope.data).toBeNull();
  });

  it("con los dos CTR-004 reales de ARGA resuelve, y siempre al mismo", async () => {
    tenantActual = ARGA;
    const { useControlByCode } = await import("@/hooks/useControls");
    const { result } = renderHook(() => useControlByCode("CTR-004"), { wrapper: envoltura });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.error).toBeNull();
    // Determinista: el más antiguo por `created_at`, con `id` de desempate.
    expect(result.current.data?.id).toBe(VIEJA.id);
    expect(result.current.data?.name).toBe(VIEJA.name);
  });

  it("y sigue sin cruzar tenants: otro tenant no ve el control de ARGA", async () => {
    tenantActual = OTRO_TENANT;
    const { useControlByCode } = await import("@/hooks/useControls");
    const { result } = renderHook(() => useControlByCode("CTR-004"), { wrapper: envoltura });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(AJENA.id);
    tenantActual = ARGA;
  });

  it("la consulta conserva el filtro por tenant y el orden explícito", () => {
    const src = sinComentarios(readFileSync(join(process.cwd(), "src/hooks/useControls.ts"), "utf8"));
    // Control positivo: es el fichero que toca.
    expect(src).toContain("useControlByCode");
    expect(src).toMatch(/\.eq\("tenant_id"/);
    expect(src).toMatch(/\.order\("created_at"/);
    expect(src).toMatch(/\.limit\(1\)/);
  });
});
