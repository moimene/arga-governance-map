// src/test/schema/aims-revisar-live.test.ts
//
// Congelar → revisar una evaluación (`fn_aims_freeze_assessment` /
// `fn_aims_review_assessment`, migración `20260907210000`), medido en Cloud con
// logins reales. SÓLO EL CAMINO NEGATIVO, y sin residuo.
//
// Por qué el camino feliz NO está aquí: desde `20260914120000` DELETE está
// revocado para `authenticated` en `ai_risk_assessments` (y en el resto de
// tablas `ai_*`/`aims_*` salvo `ai_systems`), y los FK hacia `ai_systems` son
// NO ACTION. Una sonda que creara una evaluación para congelarla no podría
// borrarla ni borrar su sistema: dejaría residuo en el tenant en cada corrida.
// El tramo congelar→revisar se verificó con una sonda SQL revertida
// (BEGIN…ROLLBACK) el 2026-09-14; su resultado está en el ledger
// `docs/superpowers/plans/2026-09-08-ledger-refactor-aims.md`. No se convierte
// en sonda permanente a propósito.
//
// Lo que sí se mide aquí, contra la evaluación REAL de Harvey (Garrigues), que
// no está congelada: que revisar lo no congelado se rechaza, que otro tenant
// no la encuentra, y que congelar un uuid inexistente se rechaza. Cero
// escrituras: al final se comprueba que `frozen_at` sigue NULL.
import { beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe } from "../helpers/supabase-test-client";

/** Evaluación real de Harvey en Garrigues. Trazabilidad, no constante de producto. */
const EVALUACION_HARVEY = "fdcccf9e-fff0-4346-a2f2-17e610981be3";

describe("congelar/revisar — camino negativo, vivo, sin residuo", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;

  beforeAll(async () => {
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);
    // Control positivo del sujeto: la fila existe para Garrigues y NO está
    // congelada. Si alguien la congela, este test deja de medir lo que dice.
    const { data, error } = await garr
      .from("ai_risk_assessments")
      .select("id, frozen_at")
      .eq("id", EVALUACION_HARVEY)
      .maybeSingle();
    if (error) throw new Error(`lectura de la evaluación de Harvey: ${error.message}`);
    if (!data) throw new Error(`la evaluación ${EVALUACION_HARVEY} no es visible para Garrigues`);
    if (data.frozen_at !== null) throw new Error(`la evaluación ${EVALUACION_HARVEY} ya está congelada: el sujeto cambió`);
  }, 30_000);

  it("revisar una evaluación no congelada se rechaza con NO_CONGELADA (Garrigues, su propia fila)", async () => {
    const { data, error } = await garr.rpc("fn_aims_review_assessment", { p_assessment_id: EVALUACION_HARVEY });
    expect(error?.message ?? "", "la RPC no rechazó la revisión de lo no congelado").toContain("NO_CONGELADA");
    expect(error?.code).toBe("42501");
    expect(data ?? null).toBeNull();
  });

  it("otro tenant no encuentra la evaluación: NO_ENCONTRADA (ARGA sobre la fila de Garrigues)", async () => {
    const { error } = await arga.rpc("fn_aims_review_assessment", { p_assessment_id: EVALUACION_HARVEY });
    expect(error?.message ?? "", "la RPC dejó ver una evaluación de otro tenant").toContain("NO_ENCONTRADA");
    expect(error?.code).toBe("42501");
  });

  it("congelar un uuid inexistente se rechaza con NO_ENCONTRADA", async () => {
    const { error } = await garr.rpc("fn_aims_freeze_assessment", { p_assessment_id: crypto.randomUUID() });
    expect(error?.message ?? "", "la RPC no rechazó un uuid inexistente").toContain("NO_ENCONTRADA");
    expect(error?.code).toBe("42501");
  });

  it("cero escrituras: la evaluación de Harvey sigue sin congelar ni revisar", async () => {
    const { data, error } = await garr
      .from("ai_risk_assessments")
      .select("frozen_at, reviewed_at")
      .eq("id", EVALUACION_HARVEY)
      .single();
    expect(error).toBeNull();
    expect(data?.frozen_at).toBeNull();
    expect(data?.reviewed_at).toBeNull();
  });
});
