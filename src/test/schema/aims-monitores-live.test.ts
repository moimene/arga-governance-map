// src/test/schema/aims-monitores-live.test.ts
//
// G-VIVO-NEG (F1.T1, GC-43): los monitores del Dashboard de AIMS, calculados
// con `buildAimsReadiness` sobre el dato REAL de los dos tenants, leído con
// logins reales igual que lo lee la pantalla. SÓLO LECTURA: cero escrituras.
//
// Invariante (no un rótulo, para que sembrar no la ponga en rojo): un monitor
// sólo puede decir que se apoya en comprobaciones si alguna comprobación lleva
// el CÓDIGO de su área (`mapa-monitores`), y toda comprobación con código de un
// área aparece en ese monitor. Así cae si vuelve la asignación por subcadena
// del título —que dio «Derechos fundamentales / DPIA» Listo 1/1 en ARGA por la
// palabra «privacidad»— y no cae porque alguien siembre dato nuevo.
import { beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe, type CuentaDemo } from "../helpers/supabase-test-client";
import { buildAimsReadiness, apartarChecksDeOtroCatalogo, type AimsReadinessInput } from "@/lib/aims/readiness";
import { MONITOR_DE_CODIGO, monitorDeCodigo } from "@/lib/aims/mapa-monitores";
import { checksVigentes } from "@/lib/aims/checks-vigentes";
import { LEGADO_A_VIGENTE, traducirLegado } from "@/lib/aims/legado";

/** Universo cerrado de códigos: el catálogo vigente más el legado declarado. */
const conocido = (code: string | null | undefined) =>
  Boolean(code) &&
  (Object.prototype.hasOwnProperty.call(MONITOR_DE_CODIGO, code!) ||
    Object.prototype.hasOwnProperty.call(LEGADO_A_VIGENTE, code!));

/** Monitor de una comprobación: su código, leído como vigente si es de legado (F1.T4). */
const monitorDe = (c: { requirement_code?: string | null }) => monitorDeCodigo(traducirLegado(c).requirement_code);

type Dato = Required<AimsReadinessInput>;

async function leer(cliente: SupabaseClient, tenant: string): Promise<Dato> {
  const [sys, asm, inc, chk, sec, ind] = await Promise.all([
    cliente.from("ai_systems").select("*").eq("tenant_id", tenant),
    cliente
      .from("ai_risk_assessments")
      .select("*, ai_systems!inner(tenant_id)")
      .eq("ai_systems.tenant_id", tenant)
      .order("assessment_date", { ascending: false }),
    cliente.from("ai_incidents").select("*").eq("tenant_id", tenant),
    cliente
      .from("ai_compliance_checks")
      .select("*, ai_systems!inner(tenant_id)")
      .eq("ai_systems.tenant_id", tenant)
      .order("created_at", { ascending: true }),
    cliente.from("aims_technical_file_sections").select("system_id, section_code, status, reviewed_by_id").eq("tenant_id", tenant),
    cliente.from("aims_monitoring_indicators").select("system_id, current_value").eq("tenant_id", tenant),
  ]);
  for (const r of [sys, asm, inc, chk, sec, ind]) if (r.error) throw new Error(`lectura AIMS: ${r.error.message}`);
  return {
    systems: sys.data ?? [],
    assessments: asm.data ?? [],
    incidents: inc.data ?? [],
    complianceChecks: checksVigentes(chk.data ?? []),
    technicalFileSections: sec.data ?? [],
    monitoringIndicators: ind.data ?? [],
  };
}

const TENANTS: Array<[CuentaDemo, string]> = [
  ["ARGA", DEMO_TENANT],
  ["GARRIGUES", GARRIGUES_TENANT],
];

describe("monitores AIMS sobre el dato vivo — asignación por código", () => {
  const dato = new Map<CuentaDemo, Dato>();

  beforeAll(async () => {
    for (const [cuenta, tenant] of TENANTS) dato.set(cuenta, await leer(await sesionDe(cuenta), tenant));
  }, 30_000);

  it("control positivo: los dos tenants tienen inventario y comprobaciones, y alguna lleva código del catálogo", () => {
    let conCodigo = 0;
    for (const [cuenta] of TENANTS) {
      const d = dato.get(cuenta)!;
      expect(d.systems.length, `${cuenta} sin sistemas: la sonda no mediría nada`).toBeGreaterThan(0);
      expect(d.complianceChecks.length, `${cuenta} sin comprobaciones`).toBeGreaterThan(0);
      conCodigo += d.complianceChecks.filter((c) => monitorDe(c)).length;
    }
    expect(conCodigo, "ninguna comprobación viva tiene código del catálogo: la invariante sería vacua").toBeGreaterThan(0);
  });

  it("control positivo del universo: reconoce un código vigente y uno de legado, y rechaza uno inventado", () => {
    expect(conocido("RISK_MGMT")).toBe(true);
    expect(conocido("AIA-09")).toBe(true);
    expect(conocido("ISO42001_6.1")).toBe(true);
    expect(conocido("INVENTADO-99")).toBe(false);
    expect(conocido(null)).toBe(false);
  });

  for (const [cuenta] of TENANTS) {
    it(`${cuenta}: todo código vivo es del catálogo o del legado declarado (ninguno cae en silencio fuera de los monitores)`, () => {
      const codigos = [...new Set(dato.get(cuenta)!.complianceChecks.map((c) => c.requirement_code))];
      expect(codigos.length, `${cuenta} sin códigos que comprobar`).toBeGreaterThan(0);
      expect(codigos.filter((c) => !conocido(c)), `${cuenta}: códigos sin monitor ni equivalencia declarada`).toEqual([]);
    });

    it(`${cuenta}: un monitor se apoya en comprobaciones si y sólo si alguna lleva el código de su área`, () => {
      const d = dato.get(cuenta)!;
      const { medibles } = apartarChecksDeOtroCatalogo(d.systems, d.complianceChecks.map(traducirLegado));
      const conCodigo = new Set(medibles.map(monitorDe).filter(Boolean));
      const monitores = buildAimsReadiness(d).complianceMonitors;
      expect(monitores.length).toBeGreaterThan(10);
      for (const m of monitores) {
        expect(
          { monitor: m.id, deComprobaciones: m.source === "ai_compliance_checks" },
          `${cuenta}: ${m.id} (${m.metric})`,
        ).toEqual({ monitor: m.id, deComprobaciones: conCodigo.has(m.id as never) });
      }
    });
  }
});
