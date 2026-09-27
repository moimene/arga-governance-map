// src/test/schema/terceros-ia-seed.test.ts
//
// F5.T9 (MOI-175) — los 7 terceros de IA que fija la especificación
// (2026-09-19-aims-cobertura-ria-experto-design.md §8: 4 en Garrigues + 3 en
// ARGA), medidos con logins reales. Requiere aplicadas la migración
// 20260928110000_grc_terceros_ia.sql y el seed
// `scripts/grc/seed-terceros-ia.ts --commit`: hasta entonces este fichero
// falla en rojo, que es lo correcto (nada que verificar todavía).
//
// SÓLO LECTURA. No es un recuento cerrado en el tiempo: si algún día se
// declaran más terceros de IA, esta prueba solo exige que los 7 fijados por
// la especificación SIGAN estando, con su rol y país — no que no haya más.
import { describe, expect, it } from "bun:test";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

type TerceroEsperado = {
  id: string;
  provider: string;
  country: string;
  legal_entity_name: string | null;
  ai_roles: string[];
};

const GARRIGUES_ESPERADOS: TerceroEsperado[] = [
  { id: "TPRM-IA-GARR-001", provider: "Microsoft", country: "US", legal_entity_name: null, ai_roles: [] },
  { id: "TPRM-IA-GARR-002", provider: "Harvey", country: "US", legal_entity_name: "Counsel AI Corporation", ai_roles: [] },
  { id: "TPRM-IA-GARR-003", provider: "OpenAI", country: "US", legal_entity_name: null, ai_roles: ["PROVEEDOR_MODELO_GPAI"] },
  { id: "TPRM-IA-GARR-004", provider: "Anthropic", country: "US", legal_entity_name: null, ai_roles: ["PROVEEDOR_MODELO_GPAI"] },
];

const ARGA_ESPERADOS: TerceroEsperado[] = [
  { id: "TPRM-IA-ARGA-001", provider: "Palantir", country: "US", legal_entity_name: null, ai_roles: [] },
  { id: "TPRM-IA-ARGA-002", provider: "Bloomberg", country: "US", legal_entity_name: null, ai_roles: [] },
  { id: "TPRM-IA-ARGA-003", provider: "Microsoft Azure OpenAI", country: "US", legal_entity_name: null, ai_roles: [] },
];

describe("terceros de IA — F5.T9, vivo con logins reales (7 = 4 Garrigues + 3 ARGA)", () => {
  it("Garrigues tiene sus 4 terceros de IA con el rol y país que fija la especificación", async () => {
    const cliente = await sesionDe("GARRIGUES");
    const { data, error } = await cliente
      .from("grc_third_parties")
      .select("id, provider, country, legal_entity_name, ai_roles, is_ai_supplier")
      .eq("tenant_id", GARRIGUES_TENANT)
      .eq("is_ai_supplier", true);
    if (error) throw new Error(`lectura grc_third_parties (Garrigues): ${error.message}`);
    const porId = new Map((data ?? []).map((r) => [r.id as string, r]));
    for (const esperado of GARRIGUES_ESPERADOS) {
      const fila = porId.get(esperado.id);
      expect(fila, `falta ${esperado.id} en grc_third_parties de Garrigues`).toBeDefined();
      expect(fila!.provider).toBe(esperado.provider);
      expect(fila!.country).toBe(esperado.country);
      expect(fila!.legal_entity_name).toBe(esperado.legal_entity_name);
      expect((fila!.ai_roles as string[]) ?? []).toEqual(esperado.ai_roles);
    }
  });

  it("ARGA tiene sus 3 terceros de IA, y las 5 filas TPRM-ARGA-* legacy (DORA) siguen sin marcarse como proveedoras de IA", async () => {
    const cliente = await sesionDe("ARGA");
    const { data, error } = await cliente
      .from("grc_third_parties")
      .select("id, provider, country, legal_entity_name, ai_roles, is_ai_supplier")
      .eq("tenant_id", DEMO_TENANT);
    if (error) throw new Error(`lectura grc_third_parties (ARGA): ${error.message}`);
    const filas = data ?? [];
    const porId = new Map(filas.map((r) => [r.id as string, r]));
    for (const esperado of ARGA_ESPERADOS) {
      const fila = porId.get(esperado.id);
      expect(fila, `falta ${esperado.id} en grc_third_parties de ARGA`).toBeDefined();
      expect(fila!.is_ai_supplier).toBe(true);
      expect(fila!.provider).toBe(esperado.provider);
      expect(fila!.country).toBe(esperado.country);
      expect((fila!.ai_roles as string[]) ?? []).toEqual(esperado.ai_roles);
    }
    // G-PERSIST del contrato cero-cambio: el seed de F5.T9 no marca como
    // proveedoras de IA las filas TPRM-ARGA-* que ya existían (DORA genérico).
    const legacyMarcadasComoIa = filas.filter((r) => (r.id as string).startsWith("TPRM-ARGA-") && r.is_ai_supplier);
    expect(legacyMarcadasComoIa).toEqual([]);
  });
});
