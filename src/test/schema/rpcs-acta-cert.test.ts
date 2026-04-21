// src/test/schema/rpcs-acta-cert.test.ts
/**
 * F8.1 — RPCs `fn_generar_acta` + `fn_generar_certificacion`.
 *
 * Verifica únicamente que las funciones existen en la BD de Cloud con la
 * firma esperada. No validamos lógica de negocio aquí porque eso requiere
 * un fixture completo de meeting + minute + snapshot que pertenece a los
 * tests end-to-end de F9.
 *
 * Patrón: llamamos a la RPC con UUIDs dummy y aceptamos cualquier error
 * que NO sea "function does not exist". Cualquier otro error (meeting
 * not found, minute not found, etc.) indica que la función existe y está
 * rechazando datos inválidos como es debido.
 *
 * Usa el cliente anónimo `supabase` en vez del admin — basta para probar
 * la existencia de la función por RPC, y RLS no bloquea la resolución de
 * la firma (solo bloquearía la ejecución real con datos válidos).
 */
import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("F8.1 — RPCs acta/certificación", () => {
  it("fn_generar_acta existe y acepta la firma (p_meeting_id, p_content, p_snapshot_id)", async () => {
    const { error } = await supabase.rpc("fn_generar_acta", {
      p_meeting_id: "00000000-0000-0000-0000-000000000000",
      p_content: "probe",
      p_snapshot_id: null,
    });
    // Esperamos error de negocio (meeting not found), NO error de "function does not exist"
    expect(error?.message ?? "").not.toMatch(/function .* does not exist/i);
    expect(error?.message ?? "").not.toMatch(/could not find the function/i);
  });

  it("fn_generar_certificacion existe y acepta la firma esperada", async () => {
    const { error } = await supabase.rpc("fn_generar_certificacion", {
      p_minute_id: "00000000-0000-0000-0000-000000000000",
      p_tipo: "ACUERDO",
      p_agreements_certified: [],
      p_certificante_role: "SECRETARIO",
      p_visto_bueno_persona_id: null,
    });
    expect(error?.message ?? "").not.toMatch(/function .* does not exist/i);
    expect(error?.message ?? "").not.toMatch(/could not find the function/i);
  });
});
