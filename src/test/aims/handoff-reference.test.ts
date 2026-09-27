// src/test/aims/handoff-reference.test.ts
//
// MOI-158 — GRC y Secretaría leen qué caso de AIMS les llega.
//
// La arista: un id de handoff (`ai_incident`/`assessment`) que llega a GRC o
// Secretaría debe resolverse a referencia+título/sistema, EN SOLO LECTURA y
// ACOTADO AL TENANT de la sesión. Un id inexistente o de otro tenant no debe
// mostrar nada — nunca un error, nunca el dato de otro tenant.
//
// El doble de Supabase reproduce la semántica real de PostgREST que hace que
// esto sea una arista y no un detalle: más de una fila en `.maybeSingle()` es
// un ERROR (mismo patrón que src/test/grc/control-por-codigo.test.tsx). Si el
// filtro `.eq("id", …)` se pierde, dos incidentes del mismo tenant colisionan
// y la consulta revienta; si se pierde `.eq("tenant_id", …)` / el join
// `ai_systems!inner(tenant_id)`, un id de otro tenant deja de dar `null` y
// empieza a filtrar su título — las dos mutaciones tumban este test.
import { describe, expect, it, afterAll, afterEach } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { sinComentarios } from "../helpers/sin-comentarios";
import { mockearModulos } from "../garrigues/_mock-restaurable";

const ARGA = "00000000-0000-0000-0000-000000000001";
const GARRIGUES = "00000000-0000-0000-0000-000000000002";

const INCIDENTS = [
  { id: "aaaaaaaa-0000-0000-0000-000000000001", tenant_id: ARGA, title: "Sesgo en scoring", ai_systems: { name: "Motor de triaje" }, entity: null, subject: null },
  // Segundo incidente del MISMO tenant: si el hook dejara de filtrar por
  // `id`, el doble vería dos filas para `tenant_id=ARGA` y `.maybeSingle()`
  // pasa a ser un error — el test de abajo deja de resolver `isSuccess`.
  { id: "aaaaaaaa-0000-0000-0000-000000000002", tenant_id: ARGA, title: "Otro incidente ARGA", ai_systems: { name: "Otro sistema" }, entity: null, subject: null },
  { id: "bbbbbbbb-0000-0000-0000-000000000001", tenant_id: GARRIGUES, title: "Incidente de otro tenant", ai_systems: { name: "Harvey" }, entity: null, subject: null },
  // F2.T13 (carril A ya aplicado): un incidente CON entity_id/subject_id
  // sembrados — el hook debe resolver entidad y sujeto, no solo el sistema.
  {
    id: "aaaaaaaa-0000-0000-0000-000000000004",
    tenant_id: ARGA,
    title: "Incidente con sujeto RIA",
    ai_systems: { name: "Motor de triaje" },
    entity: { common_name: "ARGA España Seguros y Reaseguros, S.A." },
    subject: { role: "RESPONSABLE_DESPLIEGUE", entity: { common_name: "ARGA España Seguros y Reaseguros, S.A." } },
  },
];

const ASSESSMENTS = [
  { id: "cccccccc-0000-0000-0000-000000000001", assessment_date: "2026-07-31", ai_systems: { tenant_id: ARGA, name: "Asistente de suscripción" } },
  { id: "cccccccc-0000-0000-0000-000000000002", assessment_date: "2026-05-21", ai_systems: { tenant_id: ARGA, name: "Otro sistema ARGA" } },
  { id: "dddddddd-0000-0000-0000-000000000001", assessment_date: "2026-09-07", ai_systems: { tenant_id: GARRIGUES, name: "Harvey" } },
];

/**
 * Doble de PostgREST: acumula `.eq(col, valor)` (incluida la ruta con punto de
 * un join, p.ej. `ai_systems.tenant_id`) y en `.maybeSingle()` filtra por
 * TODOS ellos. Más de una fila resultante es un ERROR, igual que la API real.
 */
function tabla(filas: Record<string, unknown>[]) {
  function leer(fila: Record<string, unknown>, ruta: string): unknown {
    return ruta.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
      return undefined;
    }, fila);
  }
  function q(filtros: Array<[string, unknown]>) {
    return {
      select: (_columnas?: string) => q(filtros),
      eq: (col: string, v: unknown) => q([...filtros, [col, v]]),
      maybeSingle: async () => {
        const out = filas.filter((f) => filtros.every(([c, v]) => leer(f, c) === v));
        if (out.length > 1) {
          return { data: null, error: { code: "PGRST116", message: "multiple rows" } };
        }
        return { data: out[0] ?? null, error: null };
      },
    };
  }
  return q([]);
}

let tenantActual: string | null = ARGA;
let fromCalls = 0;

const restaurar = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
  [
    "@/integrations/supabase/client",
    () => ({
      supabase: {
        from: (name: string) => {
          fromCalls += 1;
          return tabla(name === "ai_incidents" ? INCIDENTS : ASSESSMENTS);
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

describe("MOI-158 — useAiIncidentHandoffReference", () => {
  it("resuelve referencia + título + sistema de un incidente real del tenant", async () => {
    tenantActual = ARGA;
    const { useAiIncidentHandoffReference } = await import("@/hooks/useAiIncidents");
    const { result } = renderHook(
      () => useAiIncidentHandoffReference("aaaaaaaa-0000-0000-0000-000000000001"),
      { wrapper: envoltura },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.title).toBe("Sesgo en scoring");
    expect(result.current.data?.ai_systems?.name).toBe("Motor de triaje");
  });

  it("un id de OTRO tenant no resuelve nada (ni error, ni su título)", async () => {
    tenantActual = ARGA;
    const { useAiIncidentHandoffReference } = await import("@/hooks/useAiIncidents");
    const { result } = renderHook(
      () => useAiIncidentHandoffReference("bbbbbbbb-0000-0000-0000-000000000001"),
      { wrapper: envoltura },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("un id inexistente (con forma de UUID) no resuelve nada", async () => {
    tenantActual = ARGA;
    const { useAiIncidentHandoffReference } = await import("@/hooks/useAiIncidents");
    const { result } = renderHook(
      () => useAiIncidentHandoffReference("99999999-9999-9999-9999-999999999999"),
      { wrapper: envoltura },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("F2.T13: resuelve entidad y sujeto RIA del incidente cuando existen", async () => {
    tenantActual = ARGA;
    const { useAiIncidentHandoffReference } = await import("@/hooks/useAiIncidents");
    const { result } = renderHook(
      () => useAiIncidentHandoffReference("aaaaaaaa-0000-0000-0000-000000000004"),
      { wrapper: envoltura },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.entity?.common_name).toBe("ARGA España Seguros y Reaseguros, S.A.");
    expect(result.current.data?.subject?.entity?.common_name).toBe("ARGA España Seguros y Reaseguros, S.A.");
  });

  it("F2.T13: sin entity_id/subject_id sembrados, resuelven null (no inventan nada)", async () => {
    tenantActual = ARGA;
    const { useAiIncidentHandoffReference } = await import("@/hooks/useAiIncidents");
    const { result } = renderHook(
      () => useAiIncidentHandoffReference("aaaaaaaa-0000-0000-0000-000000000001"),
      { wrapper: envoltura },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.entity).toBeNull();
    expect(result.current.data?.subject).toBeNull();
  });

  it("un id sin forma de UUID (fixture de test) no dispara ninguna consulta", async () => {
    tenantActual = ARGA;
    fromCalls = 0;
    const { useAiIncidentHandoffReference } = await import("@/hooks/useAiIncidents");
    const { result } = renderHook(() => useAiIncidentHandoffReference("e2e-ai-incident"), {
      wrapper: envoltura,
    });
    // skipToken: nunca pasa a fetching, y el doble de Supabase no se llama.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
    expect(fromCalls).toBe(0);
  });
});

describe("MOI-158 — useAssessmentHandoffReference", () => {
  it("resuelve sistema + fecha de una evaluación real del tenant", async () => {
    tenantActual = ARGA;
    const { useAssessmentHandoffReference } = await import("@/hooks/useAiAssessments");
    const { result } = renderHook(
      () => useAssessmentHandoffReference("cccccccc-0000-0000-0000-000000000001"),
      { wrapper: envoltura },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ai_systems?.name).toBe("Asistente de suscripción");
    expect(result.current.data?.assessment_date).toBe("2026-07-31");
  });

  it("un id de OTRO tenant no resuelve nada", async () => {
    tenantActual = ARGA;
    const { useAssessmentHandoffReference } = await import("@/hooks/useAiAssessments");
    const { result } = renderHook(
      () => useAssessmentHandoffReference("dddddddd-0000-0000-0000-000000000001"),
      { wrapper: envoltura },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe("MOI-158 — las pantallas receptoras no descartan el id", () => {
  const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

  it("IncidentesList.tsx lee ai_incident y lo pasa al hook de referencia", () => {
    const src = leer("src/pages/grc/IncidentesList.tsx");
    expect(src).toContain('params.get("ai_incident")');
    expect(src).toContain("useAiIncidentHandoffReference(handoffIncidentId)");
  });

  it("F2.T13: IncidentesList.tsx pinta entidad y sujeto del incidente cuando el hook los resuelve", () => {
    const src = leer("src/pages/grc/IncidentesList.tsx");
    expect(src).toContain("handoffIncident.entity?.common_name");
    expect(src).toContain("handoffIncident.subject?.entity?.common_name");
  });

  it("F2.T13: ReunionStepper.tsx pinta entidad y sujeto del incidente cuando el hook los resuelve", () => {
    const src = leer("src/pages/secretaria/ReunionStepper.tsx");
    expect(src).toContain("aimsIncidentRef.entity?.common_name");
    expect(src).toContain("aimsIncidentRef.subject?.entity?.common_name");
  });

  it("Risk360.tsx lee assessment y lo pasa al hook de referencia", () => {
    const src = leer("src/pages/grc/Risk360.tsx");
    expect(src).toContain('params.get("assessment")');
    expect(src).toContain("useAssessmentHandoffReference(handoffAssessmentId)");
  });

  it("ReunionStepper.tsx resuelve el sourceId de un handoff aims, no lo pinta crudo", () => {
    const src = leer("src/pages/secretaria/ReunionStepper.tsx");
    expect(src).toContain('useAiIncidentHandoffReference(');
    expect(src).toContain('source === "aims" ? sourceId : null');
  });
});
