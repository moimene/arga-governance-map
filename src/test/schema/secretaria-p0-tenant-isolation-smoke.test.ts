import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const smoke = readFileSync(
  join(process.cwd(), "scripts/secretaria-p0-cloud-smoke.ts"),
  "utf8",
);

describe("Secretaria P0 tenant isolation cloud smoke contract", () => {
  it("exposes an explicit tenant-isolation mode separate from service-role happy path", () => {
    expect(smoke).toMatch(/--tenant-isolation/);
    expect(smoke).toMatch(/SECRETARIA_P0_RUN_TENANT_ISOLATION/);
    expect(smoke).toMatch(/tenant isolation cloud smoke/);
    expect(smoke).toMatch(/secretaria_p0_tenant_isolation_rollback_ok/);
  });

  it("simulates authenticated claims instead of relying on service_role bypasses", () => {
    expect(smoke).toMatch(/SET LOCAL ROLE authenticated/);
    expect(smoke).toMatch(/SET LOCAL "request\.jwt\.claim\.role" = 'authenticated'/);
    expect(smoke).toMatch(/"tenant_id":"\$\{tenantA\}"/);
    expect(smoke).toMatch(/"role_code":"SECRETARIO"/);
    expect(smoke).toMatch(/"person_id":"\$\{voterA\}"/);
  });

  it("covers cross-tenant negatives for the P0 RPC surface", () => {
    for (const rpc of [
      "fn_no_session_cast_response",
      "fn_no_session_close_and_materialize_agreement",
      "fn_generar_certificacion_acuerdo_sin_sesion",
      "fn_registrar_transmision_capital",
      "fn_cerrar_votaciones_vencidas",
    ]) {
      expect(smoke).toMatch(new RegExp(rpc));
    }
    expect(smoke).toMatch(/tenant access denied/);
    expect(smoke).toMatch(/person access denied/);
    expect(smoke).toMatch(/template .* does not belong to tenant/);
    expect(smoke).toMatch(/person .* does not belong to tenant/);
  });

  it("keeps tenant A table isolation checks scoped through app.current_tenant_id", () => {
    expect(smoke).toMatch(/SET LOCAL app\.current_tenant_id = '\$\{tenantA\}'/);
    expect(smoke).toMatch(/RLS leak: tenant A can read tenant B capital_holdings/);
    expect(smoke).toMatch(/ROLLBACK;/);
  });

  it("exercises real Supabase Auth users without touching the ARGA demo tenant", () => {
    expect(smoke).toMatch(/--auth-user-isolation/);
    expect(smoke).toMatch(/SECRETARIA_P0_RUN_AUTH_USER_ISOLATION/);
    expect(smoke).toMatch(/auth\.admin\.createUser/);
    expect(smoke).toMatch(/signInWithPassword/);
    expect(smoke).toMatch(/user_profiles/);
    expect(smoke).toMatch(/tenant access denied/);
    expect(smoke).toMatch(/capability VOTE_EMISSION denied for role AUDITOR/);
    expect(smoke).toMatch(/auth\.admin\.deleteUser/);
  });
});
