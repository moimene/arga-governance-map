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
// NOTA: hasta que la migración 20260926116400 esté aplicada en Cloud (aplicar
// exige autorización humana tras el ensayo — ver issue MOI-164, "Puerta
// humana"), la sección 1 falla con "column risks.ai_system_id does not
// exist". Es el comportamiento correcto de un gate que no finge: prueba lo
// que hay, no lo que se planea.
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

describe("MOI-164 — risks.ai_system_id", () => {
  it("la columna existe y ARGA la lee sobre sus propios riesgos de IA", async () => {
    const arga = await sesionDe("ARGA");
    const { data, error } = await arga
      .from("risks")
      .select("code, ai_system_id")
      .eq("tenant_id", DEMO_TENANT)
      .in("code", RIESGOS_IA_ARGA.map((r) => r.code));
    expect(error).toBeNull();
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
    expect(error).toBeNull();
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
    expect(data?.description ?? "").not.toMatch(/AI Act alto riesgo/i);
    expect(data?.description ?? "").toMatch(/anexo III, punto 5 c\)/i);
    expect(data?.description ?? "").toMatch(/vida y de salud/i);
    // La parte no errónea del riesgo original se conserva: no es una
    // reescritura completa, es una corrección puntual.
    expect(data?.description ?? "").toMatch(/human-in-loop/i);
  });

  for (const riesgo of RIESGOS_IA_ARGA) {
    it(`Garrigues no ve ${riesgo.code} de ARGA (aislamiento del enlace nuevo, dirección de riesgo real)`, async () => {
      const garr = await sesionDe("GARRIGUES");
      const { data, error } = await garr
        .from("risks")
        .select("id, ai_system_id")
        .eq("id", riesgo.id);
      expect(error).toBeNull();
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
