import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260504193000_000052_secretaria_p0_rpc_hardening.sql"),
  "utf8",
);

describe("Secretaria P0 RPC hardening migration contract", () => {
  it("adds reusable caller identity and capability helpers", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_is_service_role\(\)/i);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_current_role_code\(\)/i);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_current_person_id\(\)/i);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_assert_capability\(\s*p_tenant_id uuid,\s*p_action text\s*\)/i);
    expect(migration).toMatch(/FROM capability_matrix cm/i);
    expect(migration).toMatch(/cm\.enabled IS TRUE/i);
  });

  it("binds authenticated votes to capability and caller person", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_no_session_cast_response/i);
    expect(migration).toMatch(/PERFORM fn_secretaria_assert_capability\(p_tenant_id, 'VOTE_EMISSION'\)/i);
    expect(migration).toMatch(/PERFORM fn_secretaria_assert_actor_person\(p_tenant_id, p_person_id\)/i);
  });

  it("restricts close/materialization and expired-close to Secretaria operators", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_cerrar_votaciones_vencidas/i);
    expect(migration).toMatch(/fn_secretaria_assert_role_allowed\(p_tenant_id, ARRAY\['SECRETARIO', 'ADMIN_TENANT'\]\)/i);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_no_session_close_and_materialize_agreement/i);
    expect(migration).toMatch(/fn_secretaria_assert_template_tenant\(p_tenant_id, p_selected_template_id\)/i);
    expect(migration).toMatch(/fn_secretaria_assert_template_tenant\(p_tenant_id, v_template_id\)/i);
  });

  it("certifies only with certification capability and current-person authority unless service/admin", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_generar_certificacion_acuerdo_sin_sesion/i);
    expect(migration).toMatch(/PERFORM fn_secretaria_assert_capability\(v_agreement\.tenant_id, 'CERTIFICATION'\)/i);
    expect(migration).toMatch(/person_id = fn_secretaria_current_person_id\(\)/i);
    expect(migration).toMatch(/fn_secretaria_current_role_code\(\) = 'ADMIN_TENANT'/i);
  });

  it("keeps capital transmission tenant-scoped for destination holder", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_registrar_transmision_capital/i);
    expect(migration).toMatch(/PERFORM fn_secretaria_assert_role_allowed\(p_tenant_id, ARRAY\['SECRETARIO', 'ADMIN_TENANT'\]\)/i);
    expect(migration).toMatch(/PERFORM fn_secretaria_assert_person_tenant\(p_tenant_id, p_destination_person_id\)/i);
    expect(migration).toMatch(/person % does not belong to tenant %/i);
  });
});
