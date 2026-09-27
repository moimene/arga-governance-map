// src/test/aims/secretaria-derivation-arista.test.ts
//
// MOI-56 — la conexión persistente AIMS -> Secretaría.
//
// La arista: una derivación sin tenant, sin origen, sin evento o sin destino
// no debe poder guardarse -- `buildDerivationInsert` revienta antes de que
// eso llegue a un INSERT. Y una vez guardada, debe verse DENTRO del tenant
// que la creó y NUNCA desde otro (control positivo + negativo entre grupos,
// mismo patrón que src/test/aims/handoff-reference.test.ts de MOI-158).
import { describe, expect, it, afterAll, afterEach } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { readFileSync } from "node:fs";
import { sinComentarios } from "../helpers/sin-comentarios";
import { mockearModulos } from "../garrigues/_mock-restaurable";
import {
  buildDerivationInsert,
  DERIVATION_UNIQUE_VIOLATION_CODE,
} from "@/lib/aims/secretaria-derivation";

const ARGA = "00000000-0000-0000-0000-000000000001";
const GARRIGUES = "00000000-0000-0000-0000-000000000002";

describe("MOI-56 — buildDerivationInsert (la arista pura)", () => {
  it("lanza si falta el tenant", () => {
    expect(() =>
      buildDerivationInsert({
        tenantId: null,
        sourceIncidentId: "inc-1",
        sourceEvent: "AIMS_INCIDENT_MATERIAL",
        target: { kind: "meeting", meetingId: "m-1" },
      }),
    ).toThrow(/DERIVACION_SIN_TENANT/);
  });

  it("lanza si falta el origen (el incidente de AIMS)", () => {
    expect(() =>
      buildDerivationInsert({
        tenantId: ARGA,
        sourceIncidentId: null,
        sourceEvent: "AIMS_INCIDENT_MATERIAL",
        target: { kind: "meeting", meetingId: "m-1" },
      }),
    ).toThrow(/DERIVACION_SIN_ORIGEN/);
  });

  it("lanza si falta el evento", () => {
    expect(() =>
      buildDerivationInsert({
        tenantId: ARGA,
        sourceIncidentId: "inc-1",
        sourceEvent: "",
        target: { kind: "meeting", meetingId: "m-1" },
      }),
    ).toThrow(/DERIVACION_SIN_EVENTO/);
  });

  it("lanza si falta el destino (la reunión o el acuerdo creado)", () => {
    expect(() =>
      buildDerivationInsert({
        tenantId: ARGA,
        sourceIncidentId: "inc-1",
        sourceEvent: "AIMS_INCIDENT_MATERIAL",
        target: null,
      }),
    ).toThrow(/DERIVACION_SIN_DESTINO/);
  });

  it("construye la fila correcta para una reunión", () => {
    const row = buildDerivationInsert({
      tenantId: ARGA,
      sourceIncidentId: "inc-1",
      sourceEvent: "AIMS_INCIDENT_MATERIAL",
      target: { kind: "meeting", meetingId: "m-1" },
    });
    expect(row).toEqual({
      tenant_id: ARGA,
      source_incident_id: "inc-1",
      source_event: "AIMS_INCIDENT_MATERIAL",
      target_meeting_id: "m-1",
      target_agreement_id: null,
    });
  });

  it("construye la fila correcta para un acuerdo", () => {
    const row = buildDerivationInsert({
      tenantId: ARGA,
      sourceIncidentId: "inc-1",
      sourceEvent: "AIMS_INCIDENT_MATERIAL",
      target: { kind: "agreement", agreementId: "a-1" },
    });
    expect(row.target_meeting_id).toBeNull();
    expect(row.target_agreement_id).toBe("a-1");
  });
});

/**
 * Doble de PostgREST para `aims_secretaria_derivations`: un INSERT que
 * repite el mismo par (source_incident_id, target_*) simula el índice único
 * parcial de la migración (23505); el SELECT de retorno filtra por TODOS los
 * `.eq()` acumulados, igual que la API real.
 */
function tablaDerivaciones() {
  const filas: Array<Record<string, unknown>> = [];
  return {
    insert(row: Record<string, unknown>) {
      return {
        select: () => ({
          single: async () => {
            const choque = filas.some(
              (f) =>
                f.source_incident_id === row.source_incident_id &&
                ((row.target_meeting_id && f.target_meeting_id === row.target_meeting_id) ||
                  (row.target_agreement_id && f.target_agreement_id === row.target_agreement_id)),
            );
            if (choque) {
              return { data: null, error: { code: DERIVATION_UNIQUE_VIOLATION_CODE, message: "duplicate key" } };
            }
            const nueva = { id: `der-${filas.length + 1}`, status: "LINKED", evidence_ref: null, created_at: "2026-09-27T10:00:00Z", ...row };
            filas.push(nueva);
            return { data: { id: nueva.id }, error: null };
          },
        }),
      };
    },
    select(_cols?: string) {
      const filtros: Array<[string, unknown]> = [];
      const api = {
        eq: (col: string, v: unknown) => {
          filtros.push([col, v]);
          return api;
        },
        order: async () => {
          const encontradas = filas.filter((f) => filtros.every(([c, v]) => f[c] === v));
          return {
            data: encontradas.map((f) => ({
              ...f,
              meetings: f.target_meeting_id ? { id: f.target_meeting_id, status: "EN_CURSO", scheduled_start: null } : null,
              agreements: f.target_agreement_id ? { id: f.target_agreement_id, status: "ADOPTED", agreement_kind: "OTROS_LIBRE" } : null,
            })),
            error: null,
          };
        },
      };
      return api;
    },
  };
}

let tenantActual: string | null = ARGA;
let derivaciones = tablaDerivaciones();

const restaurar = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
  [
    "@/integrations/supabase/client",
    () => ({
      supabase: {
        from: (name: string) => {
          if (name !== "aims_secretaria_derivations") {
            throw new Error(`tabla inesperada en el doble: ${name}`);
          }
          return derivaciones;
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

describe("MOI-56 — useCreateAimsSecretariaDerivation + useAimsSecretariaDerivationsForIncident", () => {
  it("crea la derivación y se lee de vuelta DENTRO del mismo tenant", async () => {
    derivaciones = tablaDerivaciones();
    tenantActual = ARGA;
    const { useCreateAimsSecretariaDerivation, useAimsSecretariaDerivationsForIncident } = await import(
      "@/hooks/useAimsSecretariaDerivations"
    );

    const { result: crear } = renderHook(() => useCreateAimsSecretariaDerivation(), { wrapper: envoltura });
    let outcome: { id: string | null; alreadyLinked: boolean } | undefined;
    await waitFor(async () => {
      outcome = await crear.current.mutateAsync({
        sourceIncidentId: "aaaaaaaa-0000-0000-0000-000000000001",
        sourceEvent: "AIMS_INCIDENT_MATERIAL",
        target: { kind: "meeting", meetingId: "c3305c16-0000-0000-0000-000000000000" },
      });
    });
    expect(outcome?.alreadyLinked).toBe(false);
    expect(outcome?.id).toBeTruthy();

    const { result: leer } = renderHook(
      () => useAimsSecretariaDerivationsForIncident("aaaaaaaa-0000-0000-0000-000000000001"),
      { wrapper: envoltura },
    );
    await waitFor(() => expect(leer.current.isSuccess).toBe(true));
    expect(leer.current.data).toHaveLength(1);
    expect(leer.current.data?.[0].target_meeting_id).toBe("c3305c16-0000-0000-0000-000000000000");
    expect(leer.current.data?.[0].meetings?.id).toBe("c3305c16-0000-0000-0000-000000000000");
  });

  it("reintentar el MISMO par no duplica -- 23505 tratado como éxito idempotente", async () => {
    derivaciones = tablaDerivaciones();
    tenantActual = ARGA;
    const { useCreateAimsSecretariaDerivation } = await import("@/hooks/useAimsSecretariaDerivations");
    const { result } = renderHook(() => useCreateAimsSecretariaDerivation(), { wrapper: envoltura });

    const input = {
      sourceIncidentId: "aaaaaaaa-0000-0000-0000-000000000001",
      sourceEvent: "AIMS_INCIDENT_MATERIAL",
      target: { kind: "meeting" as const, meetingId: "c3305c16-0000-0000-0000-000000000000" },
    };
    let primero: { id: string | null; alreadyLinked: boolean } | undefined;
    let segundo: { id: string | null; alreadyLinked: boolean } | undefined;
    await waitFor(async () => {
      primero = await result.current.mutateAsync(input);
    });
    await waitFor(async () => {
      segundo = await result.current.mutateAsync(input);
    });
    expect(primero?.alreadyLinked).toBe(false);
    expect(segundo?.alreadyLinked).toBe(true);
  });

  it("un incidente de OTRO tenant no ve la derivación -- control negativo entre grupos", async () => {
    derivaciones = tablaDerivaciones();
    tenantActual = ARGA;
    const { useCreateAimsSecretariaDerivation, useAimsSecretariaDerivationsForIncident } = await import(
      "@/hooks/useAimsSecretariaDerivations"
    );
    const { result: crear } = renderHook(() => useCreateAimsSecretariaDerivation(), { wrapper: envoltura });
    await waitFor(async () => {
      await crear.current.mutateAsync({
        sourceIncidentId: "aaaaaaaa-0000-0000-0000-000000000001",
        sourceEvent: "AIMS_INCIDENT_MATERIAL",
        target: { kind: "meeting", meetingId: "c3305c16-0000-0000-0000-000000000000" },
      });
    });

    // Se cambia de sesión a Garrigues DESPUÉS de crear la fila con ARGA --
    // simula el segundo grupo abriendo su propia sesión, no una carrera.
    tenantActual = GARRIGUES;
    const { result: leer } = renderHook(
      () => useAimsSecretariaDerivationsForIncident("aaaaaaaa-0000-0000-0000-000000000001"),
      { wrapper: envoltura },
    );
    await waitFor(() => expect(leer.current.isSuccess).toBe(true));
    expect(leer.current.data).toHaveLength(0);
  });
});

describe("MOI-56 — las pantallas no descartan el identificador ni la relación", () => {
  const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

  it("ReunionIntake propaga el handoff al enlace de Reunión universal (antes se perdía)", () => {
    const src = leer("src/pages/secretaria/ReunionStepper.tsx");
    expect(src).toContain("appendHandoffParams(");
    expect(src).toContain("scopedJuntaUniversalPath");
  });

  it("UniversalMeetingIntake persiste la derivación con el sourceId real del handoff, no un literal", () => {
    const src = leer("src/pages/secretaria/ReunionStepper.tsx");
    expect(src).toContain("useCreateAimsSecretariaDerivation");
    expect(src).toContain('handoff.source === "aims" && handoff.sourceId');
    expect(src).toContain("sourceIncidentId: handoff.sourceId");
    expect(src).toContain('target: { kind: "meeting", meetingId: result.id }');
  });

  it("AcuerdoSinSesionStepper persiste la derivación solo cuando el acuerdo se ADOPTA de verdad", () => {
    const src = leer("src/pages/secretaria/AcuerdoSinSesionStepper.tsx");
    expect(src).toContain("useCreateAimsSecretariaDerivation");
    expect(src).toContain('decision === "APROBADO" && agreementId && handoff.source === "aims"');
    expect(src).toContain('target: { kind: "agreement", agreementId }');
  });

  it("CabeceraIncidente ofrece los dos destinos (reunión y acuerdo) con el mismo contrato de handoff", () => {
    const src = leer("src/components/ai-governance/incidente/CabeceraIncidente.tsx");
    expect(src).toContain("/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=");
    expect(src).toContain("/secretaria/acuerdos-sin-sesion/nuevo?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=");
  });

  it("IncidenteDetalle monta la consulta de retorno de solo lectura", () => {
    const src = leer("src/pages/ai-governance/IncidenteDetalle.tsx");
    expect(src).toContain("<DerivacionesSecretaria incidentId={incident.id} />");
  });

  it("la consulta de retorno no hace ningún .update() sobre meetings ni agreements", () => {
    const src = leer("src/hooks/useAimsSecretariaDerivations.ts");
    const srcCard = leer("src/components/ai-governance/incidente/DerivacionesSecretaria.tsx");
    expect(src + srcCard).not.toMatch(/\.from\(["'](meetings|agreements)["']\)[\s\S]{0,80}\.update\(/);
  });

  it("no se escribe en governance_module_events ni governance_module_links", () => {
    const archivos = [
      "src/lib/aims/secretaria-derivation.ts",
      "src/hooks/useAimsSecretariaDerivations.ts",
      "src/components/ai-governance/incidente/DerivacionesSecretaria.tsx",
      "src/pages/secretaria/AcuerdoSinSesionStepper.tsx",
    ];
    for (const archivo of archivos) {
      const src = leer(archivo);
      expect(src).not.toContain("governance_module_events");
      expect(src).not.toContain("governance_module_links");
    }
  });
});
