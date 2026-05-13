import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { supabaseAdmin, hasAdminClient, DEMO_TENANT } from "../helpers/supabase-test-client";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260514_000067_fn_crear_sociedad_legal_y_capital.sql"),
  "utf8",
);

describe("fn_crear_sociedad_legal_y_capital migration contract", () => {
  it("defines a SECURITY DEFINER RPC with explicit search_path", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_crear_sociedad_legal_y_capital\(\s*p_tenant_id uuid,\s*p_payload jsonb\s*\) RETURNS jsonb/i);
    expect(migration).toMatch(/LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = public/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION fn_crear_sociedad_legal_y_capital\(uuid, jsonb\)\s+TO authenticated/i);
  });

  it("guards tenant and role with the hardened Secretaria helpers", () => {
    expect(migration).toMatch(/PERFORM fn_secretaria_assert_tenant_access\(p_tenant_id\)/);
    expect(migration).toMatch(/PERFORM fn_secretaria_assert_role_allowed\(p_tenant_id, ARRAY\['SECRETARIO', 'ADMIN_TENANT'\]\)/);
    expect(migration).not.toMatch(/SECRETARIA_CORPORATIVA/);
    expect(migration).not.toMatch(/ADMIN_SISTEMA/);
  });

  it("does not include SQL transaction control statements", () => {
    expect(migration).not.toMatch(/^\s*BEGIN\s*;/im);
    expect(migration).not.toMatch(/^\s*COMMIT\s*;/im);
    expect(migration).not.toMatch(/^\s*ROLLBACK\s*;/im);
  });

  it("uses lookup-first persons resolution instead of ON CONFLICT DO NOTHING RETURNING", () => {
    expect(migration).toMatch(/SELECT id\s+INTO v_person_id\s+FROM persons[\s\S]*WHERE tenant_id = p_tenant_id[\s\S]*AND tax_id = v_tax/i);
    expect(migration).toMatch(/SELECT id\s+INTO v_holder_person_id\s+FROM persons[\s\S]*WHERE tenant_id = p_tenant_id[\s\S]*AND tax_id = v_tax/i);
    expect(migration).not.toMatch(/ON CONFLICT DO NOTHING\s+RETURNING/i);
  });

  it("keeps TX1 pessimistic until TX2 promotes the society", () => {
    expect(migration).toMatch(/v_onboarding_status := COALESCE[\s\S]*'INCOMPLETA_CARGOS'/i);
    expect(migration).toMatch(/IF v_onboarding_status = 'OPERATIVA' THEN/i);
    expect(migration).toMatch(/TX1 cannot create an OPERATIVA society/i);
  });

  it("writes only non-personal TX1 tables plus reusable persons", () => {
    for (const table of [
      "persons",
      "entities",
      "entity_capital_profile",
      "share_classes",
      "capital_holdings",
      "governing_bodies",
      "entity_settings",
      "rule_param_overrides",
    ]) {
      expect(migration).toMatch(new RegExp(`INSERT INTO ${table}\\b`, "i"));
    }
    expect(migration).not.toMatch(/INSERT INTO condiciones_persona/i);
    expect(migration).not.toMatch(/INSERT INTO representaciones/i);
    expect(migration).not.toMatch(/INSERT INTO authority_evidence/i);
    expect(migration).not.toMatch(/INSERT INTO mandates/i);
  });
});

describe.skipIf(!hasAdminClient())("fn_crear_sociedad_legal_y_capital Cloud probe", () => {
  it("resolves the RPC signature after the human applies migration 000067", async () => {
    const { error } = await supabaseAdmin!.rpc("fn_crear_sociedad_legal_y_capital", {
      p_tenant_id: DEMO_TENANT,
      p_payload: {},
    });

    if (error?.message?.match(/function .* does not exist|could not find the function|schema cache/i)) {
      console.warn("[000067] fn_crear_sociedad_legal_y_capital not yet applied to Cloud; skipping live probe.");
      return;
    }

    expect(error?.message ?? "").toMatch(/payload root missing|payload must be a JSON object|role .* not allowed|tenant access denied/i);
  });
});
