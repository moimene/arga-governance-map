// src/test/schema/grc-riesgos-modulo-equivalencia.test.ts
//
// MOI-189, decisión D-10.b (delegada) — riesgos con `module_id` que no existe
// en `grc_modules` del tenant. No hay FK `risks.module_id → grc_modules`, así
// que la base de datos no lo impide: 122 de los 167 riesgos de ARGA usan un
// `module_id` legacy (compliance, fraud, governance, idd, labor, penal,
// reporting, reputational, solvency2, strategic, tech). Se decidió NO
// reclasificar el dato (eso exigiría criterio de negocio y cambiaría ARGA):
// se declara en `MODULO_RIESGO_EQUIVALENCIA` (src/lib/grc/risk-module-equivalencia.ts)
// y este test vigila que la lista no crezca en silencio. SÓLO LECTURA.
//
// Criterio de hecho de MOI-189: "risks.module_id NOT IN grc_modules devuelve 0
// en ARGA, o cada valor restante está en el mapa con su motivo y una prueba lo
// vigila." Aquí se cumple la segunda rama.
import { beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe, type CuentaDemo } from "../helpers/supabase-test-client";
import { MODULO_RIESGO_EQUIVALENCIA } from "../../lib/grc/risk-module-equivalencia";

type RiskRow = { id: string; module_id: string | null };

/**
 * Recuento de riesgos con `module_id` no declarado, por tenant, medido el
 * 2026-09-26. Un cambio aquí (subir o bajar) significa que ARGA cambió de
 * dato sin pasar por este test: actualízalo solo si el cambio fue autorizado.
 */
const RIESGOS_SIN_MODULO_ESPERADOS: Record<CuentaDemo, number> = { ARGA: 122, GARRIGUES: 0, NUEVO: 0 };

async function leer(cliente: SupabaseClient, tenant: string) {
  const [riesgos, modulos] = await Promise.all([
    cliente.from("risks").select("id, module_id").eq("tenant_id", tenant),
    cliente.from("grc_modules").select("id").eq("tenant_id", tenant),
  ]);
  for (const r of [riesgos, modulos]) if (r.error) throw new Error(`lectura GRC: ${r.error.message}`);
  return {
    riesgos: (riesgos.data ?? []) as RiskRow[],
    modulos: new Set(((modulos.data ?? []) as Array<{ id: string }>).map((m) => m.id)),
  };
}

const TENANTS: Array<[CuentaDemo, string]> = [
  ["ARGA", DEMO_TENANT],
  ["GARRIGUES", GARRIGUES_TENANT],
];

describe("MOI-189 D-10.b — riesgos con module_id sin declarar en grc_modules", () => {
  const dato = new Map<CuentaDemo, Awaited<ReturnType<typeof leer>>>();

  beforeAll(async () => {
    for (const [cuenta, tenant] of TENANTS) dato.set(cuenta, await leer(await sesionDe(cuenta), tenant));
  }, 30_000);

  it("control positivo: ARGA tiene riesgos y módulos, o el gate sería vacuo", () => {
    const d = dato.get("ARGA")!;
    expect(d.riesgos.length, "ARGA sin riesgos").toBeGreaterThan(0);
    expect(d.modulos.size, "ARGA sin grc_modules").toBeGreaterThan(0);
  });

  for (const [cuenta] of TENANTS) {
    it(`${cuenta}: cada riesgo con module_id no declarado está en MODULO_RIESGO_EQUIVALENCIA`, () => {
      const d = dato.get(cuenta)!;
      const sinDeclarar = d.riesgos.filter((r) => r.module_id && !d.modulos.has(r.module_id));
      const sinMapear = sinDeclarar
        .map((r) => r.module_id as string)
        .filter((moduleId) => !Object.prototype.hasOwnProperty.call(MODULO_RIESGO_EQUIVALENCIA, moduleId));
      expect(
        Array.from(new Set(sinMapear)),
        `${cuenta}: module_id sin equivalencia declarada. Añádelo a MODULO_RIESGO_EQUIVALENCIA con su motivo, o resuelve el desajuste en grc_modules (autorización de Moisés sobre dato de ARGA).`,
      ).toEqual([]);
    });

    it(`${cuenta}: el módulo equivalente de cada entrada del mapa sigue declarado en grc_modules`, () => {
      const d = dato.get(cuenta)!;
      const rotos = Object.entries(MODULO_RIESGO_EQUIVALENCIA)
        .filter(([, { equivalente }]) => !d.modulos.has(equivalente))
        .map(([moduleId, { equivalente }]) => `${moduleId} → ${equivalente}`);
      // Solo se comprueba en el tenant que realmente usa esos module_id
      // (ARGA); en Garrigues, sin filas que mapear, esta comprobación no
      // aplicaría — se deja fuera para no acoplar el mapa a un tenant que no
      // lo usa.
      if (cuenta !== "ARGA") return;
      expect(rotos, `Los módulos destino de MODULO_RIESGO_EQUIVALENCIA ya no existen en grc_modules: ${rotos.join(", ")}`).toEqual(
        [],
      );
    });

    it(`${cuenta}: el número de riesgos con module_id no declarado sigue siendo el medido`, () => {
      const d = dato.get(cuenta)!;
      const n = d.riesgos.filter((r) => r.module_id && !d.modulos.has(r.module_id)).length;
      expect(
        n,
        `${cuenta}: ${n} riesgos con module_id no declarado (esperados ${RIESGOS_SIN_MODULO_ESPERADOS[cuenta]}). Si el cambio es un ALTA/BAJA real y autorizada de dato de ARGA, actualiza RIESGOS_SIN_MODULO_ESPERADOS; si no, hay una regresión.`,
      ).toBe(RIESGOS_SIN_MODULO_ESPERADOS[cuenta]);
    });
  }

  it("ARGA no pierde ningún riesgo: el total de riesgos leídos no baja del medido", () => {
    // Guarda de no-pérdida pedida por el issue: ARGA no debe perder ningún
    // riesgo de sus pantallas por este cambio (que no toca la base de datos).
    const d = dato.get("ARGA")!;
    expect(d.riesgos.length, "ARGA: bajó el total de riesgos").toBeGreaterThanOrEqual(167);
  });
});
