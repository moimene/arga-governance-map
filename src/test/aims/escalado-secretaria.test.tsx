// src/test/aims/escalado-secretaria.test.tsx
//
// F2.T14 (MOI-170) — EscaladoSecretariaModal.tsx pasaba el órgano por NOMBRE
// (`value={b.name}`), sin sociedad y sin distinguir un responsable del
// despliegue de un proveedor. La arista:
//   1. `useAiSystemRiaSubject` resuelve el sujeto RIA del sistema, acotado al
//      tenant de la sesión (RLS: aims_ria_subjects es SELECT-only por tenant).
//   2. El componente resuelve el órgano por SOCIEDAD (`useBodiesByEntity`,
//      `adoptingOnly: true`) cuando hay sujeto, y pasa `organId`/`entityId`
//      JUNTO a `organ` (texto libre) — nunca en su lugar, para no romper a
//      los emisores no-AIMS (GRC) que mandan `organ` como texto libre.
import { describe, expect, it, afterAll, afterEach } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { sinComentarios } from "../helpers/sin-comentarios";
import { mockearModulos } from "../garrigues/_mock-restaurable";

const ARGA = "00000000-0000-0000-0000-000000000001";
const GARRIGUES = "00000000-0000-0000-0000-000000000002";

const SUBJECTS = [
  // Sistema con PROVEEDOR y RESPONSABLE_DESPLIEGUE a la vez: el proveedor manda.
  { tenant_id: ARGA, system_id: "sys-1", status: "VIGENTE", role: "RESPONSABLE_DESPLIEGUE", entity_id: "ent-desp", entity: { common_name: "ARGA Digital Services" } },
  { tenant_id: ARGA, system_id: "sys-1", status: "VIGENTE", role: "PROVEEDOR", entity_id: "ent-prov", entity: { common_name: "ARGA España Seguros y Reaseguros" } },
  // Sistema con SOLO responsable del despliegue.
  { tenant_id: ARGA, system_id: "sys-2", status: "VIGENTE", role: "RESPONSABLE_DESPLIEGUE", entity_id: "ent-salud", entity: { common_name: "ARGA Salud" } },
  // Fila CERRADA: no debe contar.
  { tenant_id: ARGA, system_id: "sys-3", status: "CERRADO", role: "PROVEEDOR", entity_id: "ent-cerrado", entity: { common_name: "No debería verse" } },
  // Sistema de OTRO tenant con el mismo system_id que uno de ARGA: si el
  // hook perdiera el filtro de tenant, esta fila se colaría.
  { tenant_id: GARRIGUES, system_id: "sys-2", status: "VIGENTE", role: "PROVEEDOR", entity_id: "ent-garrigues", entity: { common_name: "J&A Garrigues SLP" } },
];

function tablaSujetos(filas: typeof SUBJECTS) {
  function q(filtros: Array<[string, unknown]>) {
    return {
      select: () => q(filtros),
      eq: (col: string, v: unknown) => q([...filtros, [col, v]]),
      neq: (col: string, v: unknown) => q([...filtros, [col, `!=${v}`]]),
      then: (resolve: (r: { data: unknown; error: null }) => void) => {
        const data = filas.filter((f) =>
          filtros.every(([c, v]) => {
            if (typeof v === "string" && v.startsWith("!=")) {
              return (f as Record<string, unknown>)[c] !== v.slice(2);
            }
            return (f as Record<string, unknown>)[c] === v;
          }),
        );
        resolve({ data, error: null });
      },
    };
  }
  return q([]);
}

let tenantActual: string | null = ARGA;

const restaurar = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
  [
    "@/integrations/supabase/client",
    () => ({
      supabase: {
        from: (name: string) => {
          if (name !== "aims_ria_subjects") throw new Error(`tabla inesperada: ${name}`);
          return tablaSujetos(SUBJECTS);
        },
      },
    }),
  ],
]);
afterAll(restaurar);
afterEach(() => {
  cleanup();
  tenantActual = ARGA;
});

function envoltura({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("F2.T14 — useAiSystemRiaSubject", () => {
  it("con PROVEEDOR y RESPONSABLE_DESPLIEGUE a la vez, resuelve el PROVEEDOR", async () => {
    const { useAiSystemRiaSubject } = await import("@/hooks/useAiSystems");
    const { result } = renderHook(() => useAiSystemRiaSubject("sys-1"), { wrapper: envoltura });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.role).toBe("PROVEEDOR");
    expect(result.current.data?.entityName).toBe("ARGA España Seguros y Reaseguros");
    expect(result.current.data?.hasProveedor).toBe(true);
  });

  it("con SOLO responsable del despliegue, lo resuelve con hasProveedor=false", async () => {
    const { useAiSystemRiaSubject } = await import("@/hooks/useAiSystems");
    const { result } = renderHook(() => useAiSystemRiaSubject("sys-2"), { wrapper: envoltura });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.role).toBe("RESPONSABLE_DESPLIEGUE");
    expect(result.current.data?.entityName).toBe("ARGA Salud");
    expect(result.current.data?.hasProveedor).toBe(false);
  });

  it("una fila CERRADA no cuenta como sujeto vigente", async () => {
    const { useAiSystemRiaSubject } = await import("@/hooks/useAiSystems");
    const { result } = renderHook(() => useAiSystemRiaSubject("sys-3"), { wrapper: envoltura });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("sin sujeto sembrado, resuelve null (no inventa nada)", async () => {
    const { useAiSystemRiaSubject } = await import("@/hooks/useAiSystems");
    const { result } = renderHook(() => useAiSystemRiaSubject("sys-sin-sujeto"), { wrapper: envoltura });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("un system_id de OTRO tenant no se cuela (aislamiento)", async () => {
    tenantActual = ARGA;
    const { useAiSystemRiaSubject } = await import("@/hooks/useAiSystems");
    // sys-2 existe en ARGA (Salud) y en Garrigues (con otro sujeto): logueado
    // como ARGA, debe resolver el de ARGA, nunca "J&A Garrigues SLP".
    const { result } = renderHook(() => useAiSystemRiaSubject("sys-2"), { wrapper: envoltura });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.entityName).toBe("ARGA Salud");
  });
});

describe("F2.T14 — EscaladoSecretariaModal.tsx resuelve el órgano por sociedad y por id", () => {
  const src = sinComentarios(readFileSync("src/components/ai-governance/sistema/EscaladoSecretariaModal.tsx", "utf8"));

  it("usa useBodiesByEntity con adoptingOnly, no solo useBodiesList", () => {
    expect(src).toContain("useBodiesByEntity(subject?.entityId, { adoptingOnly: true })");
  });

  it("el <option> del órgano lleva el id, no el nombre (antes: value={b.name})", () => {
    expect(src).toContain('value={b.id}');
    expect(src).not.toContain("value={b.name}");
  });

  it("pasa organId y entityId al handoff, junto a organ (no en su lugar)", () => {
    expect(src).toContain("organ: organoSeleccionado?.name ?? null");
    expect(src).toContain("organId: organoSeleccionado?.id ?? null");
    expect(src).toContain("entityId: subject?.entityId ?? null");
  });

  it("usa el sujeto para no precargar 'Expediente Técnico' a un responsable del despliegue", () => {
    expect(src).toContain("defaultEscaladoMatter(system.name, subject)");
  });
});

describe("F2.T14 — los emisores no-AIMS conservan `organ` como texto libre (compatibilidad)", () => {
  const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

  for (const fichero of [
    "src/pages/grc/Excepciones.tsx",
    "src/pages/grc/IncidenteDetalle.tsx",
    "src/pages/grc/SolvenciaII.tsx",
  ]) {
    it(`${fichero} no manda organId ni entityId`, () => {
      const src = leer(fichero);
      expect(src).toContain("buildMeetingHandoffPath");
      expect(src).not.toContain("organId:");
      expect(src).not.toContain("entityId:");
    });
  }
});
