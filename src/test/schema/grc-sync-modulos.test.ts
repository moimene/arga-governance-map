// src/test/schema/grc-sync-modulos.test.ts
//
// G-SYNC (F5.T14 + F5.T3 + F5.T5) — cada obligación está en el módulo de GRC que
// le toca por su código, medido con logins reales en los dos tenants.
// SÓLO LECTURA: cero escrituras.
//
// QUÉ VIGILA Y POR QUÉ ASÍ
// ------------------------
// El defecto que cierra F5.T14 era silencioso: `fn_sync_obligation_to_backbone`
// buscaba `OBL-GARR-PBC-%` y los códigos reales de Garrigues son `OBL-PBC-%`, así
// que sus 21 obligaciones de PBC/FT llevaban meses clasificadas como «Riesgos
// penales». Ningún test lo veía porque el de ciberseguridad solo miraba las suyas.
//
// La invariante NO es un recuento —sembrar Garrigues es requisito desde el
// 2026-09-07 y los recuentos van a crecer—, sino una correspondencia: el prefijo
// del código determina el módulo, y las filas que caen en el catch-all `risk`
// tienen que ser EXACTAMENTE las declaradas. Una obligación nueva que caiga ahí
// sin declararse pone el gate en rojo, que es lo que no pasó la primera vez.
import { beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe, type CuentaDemo } from "../helpers/supabase-test-client";

type Fila = { id: string; module_id: string; reference: string | null };

/**
 * El mismo criterio que el servidor, en TS. Si los dos dejan de coincidir, el
 * gate cae: es el espejo, no una segunda fuente de verdad.
 */
function moduloEsperado(code: string): string | null {
  if (code.startsWith("OBL-GDPR-")) return "gdpr";
  if (code.startsWith("OBL-DORA-")) return "dora";
  if (code.startsWith("OBL-RIA-")) return "ai";
  if (
    code.startsWith("OBL-NIS2-") ||
    code.startsWith("OBL-ISO") ||
    code.startsWith("OBL-GARR-CYBER-") ||
    code.startsWith("OBL-GARR-NIS2-")
  ) {
    return "cyber";
  }
  if (code.startsWith("OBL-LEY2-") || code.startsWith("OBL-GARR-PBC-") || code.startsWith("OBL-PBC-")) return "aml";
  if (code.startsWith("OBL-EIOPA-")) return "tprm";
  return null; // cae en el catch-all: tiene que estar declarada abajo
}

/**
 * Las ÚNICAS obligaciones que pueden estar en `risk` por el catch-all, con su
 * motivo. No son un defecto: su materia no tiene módulo propio en su tenant.
 * Añadir una fila aquí es una decisión, y por eso se escribe.
 */
const CATCH_ALL_DECLARADO: Record<string, string> = {
  "OBL-LGPD-001": "LGPD de Brasil: ARGA no tiene módulo de protección de datos brasileña",
  "OBL-ORSA-001": "Solvencia II: ARGA no tiene módulo de Solvencia II en grc_modules",
  "OBL-SII-001": "Solvencia II (SFCR): mismo motivo que ORSA",
  "OBL-ERM-APPETITE": "apetito de riesgo: fila propia del espejo, su módulo ES 'risk'",
};

/**
 * `grc_obligations` NO es un espejo puro de `obligations`: tiene filas propias,
 * sembradas directamente, cuyo `id` es el código y no un UUID. Medido el
 * 2026-09-20: 8 en ARGA (OBL-IIA-2024-QAIP, OBL-NIS2-021, OBL-DORA-017,
 * OBL-LEY2-009, OBL-GDPR-012, OBL-GDPR-033, OBL-ERM-APPETITE, OBL-EIOPA-CLOUD)
 * y 0 en Garrigues. El trigger no las gobierna —nadie las sincroniza— así que
 * este gate no juzga su módulo: lo puso una siembra a mano. Lo que sí hace es
 * contarlas, para que la exclusión no se trague en silencio filas nuevas.
 */
const NATIVAS_ESPERADAS: Record<CuentaDemo, number> = { ARGA: 8, GARRIGUES: 0 };

async function leer(cliente: SupabaseClient, tenant: string) {
  const [obl, esp, mod] = await Promise.all([
    cliente.from("obligations").select("id, code").eq("tenant_id", tenant),
    cliente.from("grc_obligations").select("id, module_id, reference").eq("tenant_id", tenant),
    cliente.from("grc_modules").select("id").eq("tenant_id", tenant),
  ]);
  for (const r of [obl, esp, mod]) if (r.error) throw new Error(`lectura GRC: ${r.error.message}`);
  return {
    obligaciones: (obl.data ?? []) as Array<{ id: string; code: string }>,
    espejo: (esp.data ?? []) as Fila[],
    modulos: new Set(((mod.data ?? []) as Array<{ id: string }>).map((m) => m.id)),
  };
}

const TENANTS: Array<[CuentaDemo, string]> = [
  ["ARGA", DEMO_TENANT],
  ["GARRIGUES", GARRIGUES_TENANT],
];

describe("G-SYNC — el espejo de obligaciones respeta el criterio del código", () => {
  const dato = new Map<CuentaDemo, Awaited<ReturnType<typeof leer>>>();

  beforeAll(async () => {
    for (const [cuenta, tenant] of TENANTS) dato.set(cuenta, await leer(await sesionDe(cuenta), tenant));
  }, 30_000);

  it("control positivo: los dos tenants tienen obligaciones y espejo, o el gate sería vacuo", () => {
    for (const [cuenta] of TENANTS) {
      const d = dato.get(cuenta)!;
      expect(d.obligaciones.length, `${cuenta} sin obligaciones`).toBeGreaterThan(0);
      expect(d.espejo.length, `${cuenta} sin espejo`).toBeGreaterThan(0);
    }
  });

  it("control positivo del criterio: un OBL-PBC-* resuelve a aml y un OBL-RIA-* a ai", () => {
    // Si alguien vacía `moduloEsperado`, esta aserción cae antes que las demás.
    expect(moduloEsperado("OBL-PBC-07")).toBe("aml");
    expect(moduloEsperado("OBL-RIA-ORG-04")).toBe("ai");
    expect(moduloEsperado("OBL-LGPD-001")).toBeNull();
  });

  for (const [cuenta] of TENANTS) {
    it(`${cuenta}: cada obligación está en el módulo que le toca por su código`, () => {
      const d = dato.get(cuenta)!;
      const porId = new Map(d.espejo.map((e) => [e.id, e]));
      const mal: string[] = [];
      for (const o of d.obligaciones) {
        const esperado = moduloEsperado(o.code);
        if (!esperado) continue; // catch-all, se comprueba aparte
        const fila = porId.get(o.id);
        if (!fila) {
          mal.push(`${o.code}: sin fila en el espejo`);
        } else if (fila.module_id !== esperado) {
          mal.push(`${o.code}: está en '${fila.module_id}' y le toca '${esperado}'`);
        }
      }
      expect(mal, `${cuenta}: obligaciones mal sincronizadas`).toEqual([]);
    });

    it(`${cuenta}: las que caen en el catch-all 'risk' son exactamente las declaradas`, () => {
      const d = dato.get(cuenta)!;
      const porId = new Map(d.obligaciones.map((o) => [o.id, o.code]));
      // La clave es el código: el de la obligación si la fila viene de ella, y
      // el propio `id` si es una fila nativa del espejo (ahí el id ES el código).
      const enRisk = d.espejo
        .filter((e) => e.module_id === "risk")
        .map((e) => porId.get(e.id) ?? e.id)
        .filter((code) => !Object.prototype.hasOwnProperty.call(CATCH_ALL_DECLARADO, code));
      expect(
        enRisk,
        `${cuenta}: obligaciones en 'risk' sin declarar. Si es correcto, decláralas en CATCH_ALL_DECLARADO con su motivo; si no, falta una rama en fn_sync_obligation_to_backbone`,
      ).toEqual([]);
    });

    it(`${cuenta}: las filas propias del espejo siguen siendo las declaradas`, () => {
      const d = dato.get(cuenta)!;
      const ids = new Set(d.obligaciones.map((o) => o.id));
      const nativas = d.espejo.filter((e) => !ids.has(e.id)).map((e) => e.id);
      expect(
        nativas.length,
        `${cuenta}: filas de grc_obligations sin obligación detrás: ${nativas.join(", ")}. Si son nuevas, actualiza NATIVAS_ESPERADAS`,
      ).toBe(NATIVAS_ESPERADAS[cuenta]);
    });

    it(`${cuenta}: el módulo 'ai' existe y el art. 4 está dentro`, () => {
      const d = dato.get(cuenta)!;
      expect(d.modulos.has("ai"), `${cuenta} sin módulo 'ai' en grc_modules`).toBe(true);
      const art4 = d.obligaciones.find((o) => o.code === "OBL-RIA-ORG-04");
      expect(art4, `${cuenta} sin la obligación del art. 4`).toBeTruthy();
      expect(d.espejo.find((e) => e.id === art4!.id)?.module_id).toBe("ai");
    });
  }

  it("Garrigues: las 21 de PBC/FT están en aml y ninguna quedó en risk", () => {
    const d = dato.get("GARRIGUES")!;
    const pbc = d.obligaciones.filter((o) => o.code.startsWith("OBL-PBC-"));
    // Control del instrumento: si el seed de PBC/FT desapareciera, el gate no mediría nada.
    expect(pbc.length, "Garrigues sin obligaciones de PBC/FT").toBeGreaterThanOrEqual(21);
    const porId = new Map(d.espejo.map((e) => [e.id, e.module_id]));
    expect(pbc.filter((o) => porId.get(o.id) !== "aml").map((o) => o.code)).toEqual([]);
  });
});
