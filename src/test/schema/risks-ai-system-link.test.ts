// src/test/schema/risks-ai-system-link.test.ts
//
// MOI-164 (F8.T1 adelantado) — `risks.ai_system_id`. Este fichero prueba,
// con logins reales, exactamente lo que el issue pide probar:
//   1. La columna existe y es legible por el tenant dueño de la fila.
//   2. NINGUNO de los tres riesgos de IA de ARGA quedó enlazado por invención
//      — es una decisión declarada (ver comentario de la migración
//      20260926116400), no una omisión: este test se rompe si alguien enlaza
//      uno de los tres sin pasar por una revisión deliberada de este mismo
//      fichero.
//   3. RSK-STRA-005 ya no afirma "AI Act alto riesgo" para el pricing de
//      automóvil (decisión D-15).
//   4. Aislamiento bidireccional del enlace nuevo con logins reales: la
//      sonda genérica de `tenant-isolation.test.ts` ya cubre `risks` fila a
//      fila (una fila invisible lo es también en todas sus columnas), pero
//      aquí se pide explícitamente sobre el enlace — se verifica por el ID
//      real de las tres filas conocidas, en las dos direcciones.
//
// PUERTA HUMANA (issue MOI-164): las migraciones 20260926116400 (columna) y
// 20260926116401 (corrección D-15) están escritas, ensayadas en reversa
// (supabase/migrations/proposed/*.probe.sql) y listas, pero aplicarlas en
// Cloud exige autorización humana explícita que este agente no tiene
// (prohibición expresa: solo SELECT en Cloud). Mientras la puerta siga
// cerrada, cada bloque de abajo tolera EXACTAMENTE el error de "columna no
// existe" / el texto previo sin corregir — mismo patrón que
// src/test/schema/rpcs-acta-cert.test.ts para RPCs pendientes de Cloud —, no
// cualquier error: si Cloud devuelve otra cosa (permission denied, columna
// con otro nombre, etc.), el test falla igual. En cuanto la migración se
// apruebe y se aplique, cada bloque pasa a exigir el comportamiento real sin
// tocar una línea de este fichero.
import { describe, expect, it } from "bun:test";
import {
  DEMO_TENANT,
  GARRIGUES_TENANT,
  sesionDe,
} from "../helpers/supabase-test-client";

const RIESGOS_IA_ARGA = [
  { code: "RSK-TECH-005", id: "e32da22c-6ce2-4827-b603-5cc919ae8bde" },
  { code: "RSK-TECH-006", id: "a08c19a4-0ca6-42a3-b4a3-a5c0f71cefbc" },
  { code: "RSK-STRA-005", id: "f87cd7ec-59aa-47dd-b422-a6e34fd9bf0f" },
] as const;

const COLUMNA_NO_EXISTE = /column .*ai_system_id.* does not exist/i;

describe("MOI-164 — risks.ai_system_id", () => {
  it("la columna existe y ARGA la lee sobre sus propios riesgos de IA", async () => {
    const arga = await sesionDe("ARGA");
    const { data, error } = await arga
      .from("risks")
      .select("code, ai_system_id")
      .eq("tenant_id", DEMO_TENANT)
      .in("code", RIESGOS_IA_ARGA.map((r) => r.code));
    if (error) {
      // Puerta humana aún cerrada: el único error tolerado es "no existe".
      expect(error.message).toMatch(COLUMNA_NO_EXISTE);
      return;
    }
    expect((data ?? []).length).toBe(3);
  });

  it("declarado: ninguno de los tres riesgos de IA de ARGA quedó enlazado por invención", async () => {
    // Los tres describen, respectivamente, varios sistemas a la vez, un uso
    // de IA fuera de todo inventario, y un sistema que no existe en
    // `ai_systems` — ninguno permite deducir CON CERTEZA un único sistema.
    // Si esto deja de ser NULL, alguien lo enlazó: bien, pero revisando este
    // test a propósito, no de paso.
    const arga = await sesionDe("ARGA");
    const { data, error } = await arga
      .from("risks")
      .select("code, ai_system_id")
      .eq("tenant_id", DEMO_TENANT)
      .in("code", RIESGOS_IA_ARGA.map((r) => r.code));
    if (error) {
      expect(error.message).toMatch(COLUMNA_NO_EXISTE);
      return;
    }
    for (const fila of data ?? []) {
      expect(fila.ai_system_id, `${fila.code} se enlazó sin que este test lo declare`).toBeNull();
    }
  });

  it("D-15: RSK-STRA-005 ya no afirma alto riesgo del anexo III para el pricing de automóvil", async () => {
    const arga = await sesionDe("ARGA");
    const { data, error } = await arga
      .from("risks")
      .select("description")
      .eq("tenant_id", DEMO_TENANT)
      .eq("code", "RSK-STRA-005")
      .maybeSingle();
    expect(error).toBeNull();
    const desc = data?.description ?? "";
    if (/AI Act alto riesgo/i.test(desc)) {
      // Migración 20260926116401 (misma puerta humana) aún no aplicada: el
      // texto previo sin corregir es el único estado tolerado aquí.
      return;
    }
    // La parte no errónea del riesgo original se conserva: no es una
    // reescritura completa, es una corrección puntual.
    expect(desc).toMatch(/anexo III, punto 5 c\)/i);
    expect(desc).toMatch(/vida y de salud/i);
    expect(desc).toMatch(/human-in-loop/i);
  });

  for (const riesgo of RIESGOS_IA_ARGA) {
    it(`Garrigues no ve ${riesgo.code} de ARGA (aislamiento del enlace nuevo, dirección de riesgo real)`, async () => {
      const garr = await sesionDe("GARRIGUES");
      const { data, error } = await garr
        .from("risks")
        .select("id, ai_system_id")
        .eq("id", riesgo.id);
      if (error) {
        expect(error.message).toMatch(COLUMNA_NO_EXISTE);
        return;
      }
      expect(data ?? []).toEqual([]);
    });
  }

  it("ARGA no ve los riesgos de Garrigues por esta misma consulta (dirección simétrica)", async () => {
    const arga = await sesionDe("ARGA");
    const { data, error } = await arga
      .from("risks")
      .select("id, tenant_id")
      .limit(500);
    expect(error).toBeNull();
    const foreign = (data ?? []).filter((r) => r.tenant_id === GARRIGUES_TENANT);
    expect(foreign).toEqual([]);
  });
});
