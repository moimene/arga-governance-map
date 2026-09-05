// Sonda Cloud del read model de la consola (contratos console.<owner>.<objeto>.v1).
//
// POR QUÉ EXISTE. Hasta 2026-09-05 el KPI «Incidentes DORA abiertos» de la
// consola filtraba por `incidents.module_id`, una columna que NO existe en
// Cloud, y consultaba estados (`OPEN|ABIERTO|IN_PROGRESS`) que tampoco son los
// reales. El `count ?? 0` del hook se tragaba el error de PostgREST, así que la
// consola llevaba desde su creación pintando un 0 que no era una medición sino
// un fallo silencioso — y ningún test lo veía.
//
// Esta sonda asierta las dos mitades: que la consulta vieja SIGUE fallando (lo
// que prueba que el 0 era falso) y que la nueva NO falla en los dos tenants.
//
// GOTCHA (G4 nº4): con más de un cliente Supabase hay que usar
// `persistSession: false`; el preload de bun monta JSDOM con localStorage y
// todos los clientes comparten storageKey. `sesionDe` ya lo hace y LANZA si no
// puede autenticar, así que un login roto pone la sonda ROJA, no verde.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_TENANT,
  GARRIGUES_TENANT,
  sesionDe,
} from "../helpers/supabase-test-client";
import {
  AI_ASSESSMENT_RESOLVED,
  INCIDENT_CLOSED as HOOK_INCIDENT_CLOSED,
  measured,
} from "@/hooks/useModuleStatus";

const INCIDENT_CLOSED = HOOK_INCIDENT_CLOSED;

describe("console read model — cada número nace de una query que existe", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;

  beforeAll(async () => {
    arga = await sesionDe("ARGA");
    garr = await sesionDe("GARRIGUES");
  }, 60_000);

  it("la consulta VIEJA falla: el 0 de «Incidentes DORA abiertos» era un fallo silencioso", async () => {
    const res = await arga
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", DEMO_TENANT)
      // Columna inexistente a propósito: es exactamente el defecto que se corrigió.
      .ilike("module_id", "%dora%");

    expect(res.error, "si esto deja de fallar, `incidents` ganó module_id y hay que revisar el contrato").not.toBeNull();
    // Y esta es la línea que explica el defecto: el hook hacía `count ?? 0`.
    expect(res.count ?? 0).toBe(0);
  });

  it("los estados de incidents en Cloud no son el vocabulario que consultaba la consola", async () => {
    const { data, error } = await arga.from("incidents").select("status").eq("tenant_id", DEMO_TENANT);
    expect(error).toBeNull();
    const estados = new Set((data ?? []).map((r: { status: string }) => r.status));
    expect(estados.size).toBeGreaterThan(0);
    for (const viejo of ["OPEN", "ABIERTO", "IN_PROGRESS"]) {
      expect(estados.has(viejo), `'${viejo}' no es un estado real de incidents`).toBe(false);
    }
  });

  it("la consulta NUEVA de incidentes no falla en ninguno de los dos tenants", async () => {
    for (const [nombre, cli, tenant] of [
      ["ARGA", arga, DEMO_TENANT],
      ["GARRIGUES", garr, GARRIGUES_TENANT],
    ] as const) {
      const abiertos = await cli
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant)
        .neq("status", INCIDENT_CLOSED);
      expect(abiertos.error, `incidentes abiertos (${nombre})`).toBeNull();
      expect(abiertos.count).not.toBeNull();

      const mayores = await cli
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant)
        .neq("status", INCIDENT_CLOSED)
        .eq("is_major_incident", true);
      expect(mayores.error, `incidentes mayores (${nombre})`).toBeNull();
      expect(mayores.count! <= abiertos.count!).toBe(true);
    }
  });

  it("las seis consultas del read model responden sin error para ARGA y para Garrigues", async () => {
    const tablas = [
      "convocatorias",
      "agreements",
      "regulatory_notifications",
      "ai_systems",
      "evidence_bundles",
      "governance_module_events",
      "governance_module_links",
    ] as const;

    for (const [nombre, cli, tenant] of [
      ["ARGA", arga, DEMO_TENANT],
      ["GARRIGUES", garr, GARRIGUES_TENANT],
    ] as const) {
      for (const tabla of tablas) {
        const res = await cli
          .from(tabla)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant);
        expect(res.error, `${tabla} (${nombre})`).toBeNull();
        expect(res.count, `${tabla} (${nombre}) sin recuento`).not.toBeNull();
      }
    }
  });

  it("Garrigues ve la verdad de Cloud, no un número prestado de ARGA", async () => {
    // Control discriminante: si el read model cruzara tenants, estos dos
    // recuentos coincidirían. ARGA tiene eventos y links; Garrigues no.
    const eventosArga = await arga
      .from("governance_module_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", DEMO_TENANT);
    const eventosGarr = await garr
      .from("governance_module_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", GARRIGUES_TENANT);

    expect(eventosArga.error).toBeNull();
    expect(eventosGarr.error).toBeNull();
    expect(eventosArga.count!).toBeGreaterThan(0);
    expect(eventosGarr.count).toBe(0);
  });

  it("las constantes del hook existen de verdad en Cloud (arista, no rótulo)", async () => {
    // Si alguien cambia INCIDENT_CLOSED a "CERRADO" o AI_ASSESSMENT_RESOLVED a un
    // valor que nadie escribe, el KPI vuelve a ser un número falso. Esta prueba
    // ata las constantes del hook al vocabulario real de las tablas.
    const inc = await arga.from("incidents").select("status").eq("tenant_id", DEMO_TENANT);
    expect(inc.error).toBeNull();
    const estadosIncidente = new Set((inc.data ?? []).map((r: { status: string }) => r.status));
    expect(
      estadosIncidente.has(HOOK_INCIDENT_CLOSED),
      `INCIDENT_CLOSED='${HOOK_INCIDENT_CLOSED}' no es un estado real de incidents`,
    ).toBe(true);

    const ass = await arga.from("ai_risk_assessments").select("status");
    expect(ass.error).toBeNull();
    const estadosEval = new Set((ass.data ?? []).map((r: { status: string }) => r.status));
    expect(
      AI_ASSESSMENT_RESOLVED.some((v) => estadosEval.has(v)),
      `ninguno de ${AI_ASSESSMENT_RESOLVED.join("|")} existe en ai_risk_assessments`,
    ).toBe(true);
  });

  it("measured() propaga el error como «no medido» y no como 0", () => {
    // La línea exacta del defecto histórico.
    expect(measured({ count: null, error: { message: "column does not exist" } })).toBeNull();
    expect(measured({ count: null, error: null })).toBe(0);
    expect(measured({ count: 7, error: null })).toBe(7);
  });

  it("deja escrita la postura REAL de sii_cases_view en vez de suponerla", async () => {
    // El informe daba por hecho un 42501 que role_table_grants no respalda.
    // Aquí se mide de verdad: lo que salga es lo que la consola debe pintar.
    const res = await garr
      .from("sii_cases_view" as "evidence_bundles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", GARRIGUES_TENANT);

    if (res.error) {
      // Con error, el contrato exige «no medido»; jamás 0.
      expect(res.count ?? null).toBeNull();
    } else {
      // Sin error, el canal no tiene ni un caso en Cloud: 0 es una medición real.
      expect(res.count).toBe(0);
    }
  });
});
