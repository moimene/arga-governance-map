// src/test/schema/aims-checks-enlaces-live.test.ts
//
// M01 (F1.T14) — G-VIVO-NEG: enlaces de comprobaciones y evaluación, medidos en
// Cloud con logins reales. SÓLO LECTURAS Y CAMINOS NEGATIVOS, y sin residuo POR
// CONSTRUCCIÓN.
//
// Cómo se garantiza que no deja fila aunque el trigger falte: toda escritura
// que se espera rechazada lleva `id: null`. El trigger BEFORE corre antes que
// las restricciones y rechaza con su código; si el trigger no estuviera, la fila
// caería igualmente por el NOT NULL de la clave primaria —con otro mensaje, que
// pone el test en rojo— y nunca llegaría a la tabla. Con DELETE revocado para
// `authenticated`, una sonda que dejara fila no podría limpiarla.
//
// El camino POSITIVO (la autoría la pone el servidor, la comprobación queda
// enlazada, una sesión sin persona se rechaza) no puede ser permanente: vive en
// la sonda revertida `supabase/tests/aims_checks_enlaces_evaluacion_probe.sql`
// y en el bloque de verificación de la propia migración.
//
// Antes de aplicar 20260919100000 este fichero está en ROJO a propósito: la
// columna y la relación no existen.
import { beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe } from "../helpers/supabase-test-client";

/** Evaluación real de Harvey en Garrigues. Trazabilidad, no constante de producto. */
const EVALUACION_HARVEY = "fdcccf9e-fff0-4346-a2f2-17e610981be3";
/** Día de la migración: lo anterior es legado y no puede aparecer enlazado. */
const CORTE_LEGADO = "2026-09-19T00:00:00Z";

describe("M01 — enlaces de comprobaciones y evaluación, vivo, sin residuo", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;
  let sistemaHarvey: string;
  let evaluacionArga: string;
  let checkPropio: string;
  let filasAntes: number;

  const contarGarrigues = async () => {
    const { count, error } = await garr
      .from("ai_compliance_checks")
      .select("id", { count: "exact", head: true })
      .eq("system_id", sistemaHarvey);
    if (error) throw new Error(`recuento de comprobaciones: ${error.message}`);
    return count ?? -1;
  };

  beforeAll(async () => {
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);

    const { data: ev, error: e1 } = await garr
      .from("ai_risk_assessments")
      .select("id, system_id")
      .eq("id", EVALUACION_HARVEY)
      .maybeSingle();
    if (e1 || !ev?.system_id) throw new Error(`la evaluación de Harvey no es visible para Garrigues: ${e1?.message ?? "sin fila"}`);
    sistemaHarvey = ev.system_id;

    const { data: evArga, error: e2 } = await arga.from("ai_risk_assessments").select("id").limit(1).maybeSingle();
    if (e2 || !evArga) throw new Error(`ARGA no tiene evaluación visible: ${e2?.message ?? "sin fila"}`);
    evaluacionArga = evArga.id;

    const { data: ck, error: e3 } = await garr
      .from("ai_compliance_checks")
      .select("id")
      .eq("system_id", sistemaHarvey)
      .limit(1)
      .maybeSingle();
    if (e3 || !ck) throw new Error(`Harvey no tiene comprobaciones: ${e3?.message ?? "sin fila"}`);
    checkPropio = ck.id;

    filasAntes = await contarGarrigues();
  }, 30_000);

  it("la lectura embebe la evaluación, y las legacy siguen sin enlace (no hubo relleno)", async () => {
    const { data, error } = await garr
      .from("ai_compliance_checks")
      .select("id, created_at, assessment_id, evaluacion:ai_risk_assessments!assessment_id(status, reviewed_at)")
      .eq("system_id", sistemaHarvey);
    expect(error, "la relación comprobación → evaluación no existe en Cloud").toBeNull();
    const legacy = (data ?? []).filter((c) => (c.created_at ?? "") < CORTE_LEGADO);
    // Control positivo: si no hubiera legacy, la aserción de abajo pasaría sobre nada.
    expect(legacy.length, "Harvey no tiene comprobaciones legacy que medir").toBeGreaterThan(0);
    for (const c of legacy) {
      expect(c.assessment_id, `la comprobación legacy ${c.id} aparece enlazada`).toBeNull();
      expect(c.evaluacion ?? null).toBeNull();
    }
  });

  it("una comprobación de Garrigues no se enlaza a una evaluación de ARGA", async () => {
    const { error } = await garr.from("ai_compliance_checks").insert({
      id: null,
      system_id: sistemaHarvey,
      requirement_code: "PROBE_M01",
      assessment_id: evaluacionArga,
    });
    expect(error?.message ?? "", "el enlace cross-tenant no se rechazó").toContain("EVALUACION_DE_OTRO_SISTEMA");
    expect(error?.code).toBe("42501");
  });

  it("ni a una evaluación que no existe", async () => {
    const { error } = await garr.from("ai_compliance_checks").insert({
      id: null,
      system_id: sistemaHarvey,
      requirement_code: "PROBE_M01",
      assessment_id: crypto.randomUUID(),
    });
    expect(error?.message ?? "").toContain("EVALUACION_DE_OTRO_SISTEMA");
    expect(error?.code).toBe("42501");
  });

  it("una sesión no reescribe la autoría de una comprobación", async () => {
    const { error } = await garr
      .from("ai_compliance_checks")
      .update({ id: null, checked_by_id: crypto.randomUUID() })
      .eq("id", checkPropio);
    expect(error?.message ?? "", "la autoría se dejó reescribir").toContain("COMPROBACION_INMUTABLE");
    expect(error?.code).toBe("42501");
  });

  it("una evaluación no se enlaza a un cuestionario de otro sistema", async () => {
    const { error } = await garr.from("ai_risk_assessments").insert({
      id: null,
      system_id: sistemaHarvey,
      framework: "EU_AI_ACT",
      status: "BORRADOR",
      questionnaire_id: crypto.randomUUID(),
    });
    expect(error?.message ?? "").toContain("CUESTIONARIO_DE_OTRO_SISTEMA");
    expect(error?.code).toBe("42501");
  });

  it("cero escrituras: Harvey tiene las mismas comprobaciones que al empezar", async () => {
    expect(filasAntes, "control: el recuento inicial mide algo").toBeGreaterThan(0);
    expect(await contarGarrigues()).toBe(filasAntes);
  });
});
