// src/test/schema/secretaria-annual-accounts-demo-sets.test.ts
//
// Sonda de COMPORTAMIENTO de la migración
// `20260906101102_seed_annual_accounts_set_demo_cda_sessions`: los dos
// conjuntos de cuentas sembrados para las sesiones vivas del CdA de ARGA tienen
// que pasar el validador REAL del producto —el mismo que llama
// `fn_generar_acta`— con una sesión autenticada de ARGA. No se comprueba que
// las filas existan (eso lo probaría un SELECT vacuo), sino que el servidor las
// da por VÁLIDAS.
//
// Si alguien borra el conjunto, corrompe un componente o cambia un hash, el
// validador lanza y esta sonda se pone roja. Y con la sesión de Garrigues el
// mismo RPC debe negar el acceso (42501): un conjunto de cuentas de ARGA no se
// valida desde otro tenant.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe } from "../helpers/supabase-test-client";

const SESIONES = [
  { meeting: "b1fccfb0-3eef-438e-9aad-8ad3b737d9c2", agenda: "8cadc476-5914-44f8-977b-de06e8133b7c" },
  { meeting: "ac961a00-0a5d-4439-a8d4-618a0dd804b2", agenda: "747f98a7-d473-4efe-a140-878f3175e99a" },
] as const;

describe("Secretaría — conjuntos de cuentas anuales sembrados para las sesiones demo del CdA", () => {
  let arga: SupabaseClient;
  let garrigues: SupabaseClient;

  beforeAll(async () => {
    // `sesionDe` LANZA si no autentica: sin sesión el gate se pone rojo, no se salta.
    arga = await sesionDe("ARGA");
    garrigues = await sesionDe("GARRIGUES");
  }, 60_000);

  it.each(SESIONES)("el validador del producto da por VÁLIDO el conjunto de $meeting", async ({ meeting, agenda }) => {
    const { data, error } = await arga.rpc("fn_secretaria_validate_annual_accounts_point", {
      p_meeting_id: meeting,
      p_agenda_item_id: agenda,
    });
    expect(error, `validador: ${error?.message ?? ""}`).toBeNull();
    const out = data as { status?: string; fiscal_year?: number; set_id?: string } | null;
    expect(out?.status).toBe("VALID");
    expect(out?.fiscal_year).toBe(2025);
    expect(out?.set_id).toMatch(/^[0-9a-f-]{36}$/);
  }, 30_000);

  it("la sesión de Garrigues no puede validar un conjunto de ARGA", async () => {
    const { data, error } = await garrigues.rpc("fn_secretaria_validate_annual_accounts_point", {
      p_meeting_id: SESIONES[0].meeting,
      p_agenda_item_id: SESIONES[0].agenda,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code === "42501" || /tenant/i.test(error?.message ?? "")).toBe(true);
  }, 30_000);
});
