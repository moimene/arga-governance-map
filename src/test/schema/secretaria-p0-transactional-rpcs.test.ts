import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260504_000051_secretaria_p0_transactional_rpcs.sql"),
  "utf8",
);

describe("Secretaria P0 transactional RPC migration contract", () => {
  it("bridges no-session UI resolutions to WORM expedientes and idempotent agreements", () => {
    expect(migration).toMatch(/ALTER TABLE no_session_expedientes\s+ALTER COLUMN agreement_id DROP NOT NULL/i);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS no_session_resolution_id uuid REFERENCES no_session_resolutions\(id\)/i);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS selected_template_id uuid REFERENCES plantillas_protegidas\(id\)/i);
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS ux_no_session_expedientes_resolution/i);
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS ux_agreements_no_session_resolution/i);
  });

  it("defines SECURITY DEFINER RPCs with explicit search_path", () => {
    const rpcNames = [
      "fn_secretaria_current_tenant_id",
      "fn_secretaria_assert_tenant_access",
      "fn_no_session_cast_response",
      "fn_no_session_close_and_materialize_agreement",
      "fn_generar_certificacion_acuerdo_sin_sesion",
      "fn_registrar_transmision_capital",
    ];

    for (const rpcName of rpcNames) {
      expect(migration).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION ${rpcName}`, "i"));
    }
    expect(migration.match(/SECURITY DEFINER/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(migration.match(/SET search_path = public/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("guards SECURITY DEFINER RPCs with tenant authorization instead of trusting caller input", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_secretaria_current_tenant_id\(\)/i);
    expect(migration).toMatch(/auth\.jwt\(\) ->> 'tenant_id'/i);
    expect(migration).toMatch(/FROM user_profiles up\s+WHERE up\.user_id = auth\.uid\(\)/i);
    expect(migration).toMatch(/current_setting\('request\.jwt\.claim\.role', true\)/i);
    expect(migration).toMatch(/v_claim_role = 'service_role'/i);
    expect(migration.match(/PERFORM fn_secretaria_assert_tenant_access\(p_tenant_id\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(migration).toMatch(/PERFORM fn_secretaria_assert_tenant_access\(v_agreement\.tenant_id\)/i);
  });

  it("requires tenant-scoped closure and removes the NULL tenant sweep", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_cerrar_votaciones_vencidas\(p_tenant_id uuid\)/i);
    expect(migration).not.toMatch(/fn_cerrar_votaciones_vencidas\(p_tenant_id uuid DEFAULT NULL\)/i);
    expect(migration).toMatch(/IF p_tenant_id IS NULL THEN\s+RAISE EXCEPTION 'p_tenant_id is required'/i);
    expect(migration).toMatch(/WHERE tenant_id = p_tenant_id\s+AND status = 'VOTING_OPEN'/i);
  });

  it("stores no-session votes in WORM responses and derives counters from source of truth", () => {
    expect(migration).toMatch(/INSERT INTO no_session_respuestas/i);
    expect(migration).toMatch(/ON CONFLICT \(expediente_id, person_id\) DO NOTHING/i);
    expect(migration).toMatch(/COUNT\(\*\) FILTER \(WHERE sentido = 'CONSENTIMIENTO'\)/i);
    expect(migration).toMatch(/COUNT\(\*\) FILTER \(WHERE sentido IN \('OBJECION', 'OBJECION_PROCEDIMIENTO'\)\)/i);
  });

  it("materializes an adopted no-session agreement once and preserves template traceability", () => {
    expect(migration).toMatch(/INSERT INTO agreements \(/i);
    expect(migration).toMatch(/'NO_SESSION', 'ADOPTED'/i);
    expect(migration).toMatch(/'source', 'no_session_resolutions'/i);
    expect(migration).toMatch(/'selected_template_id', v_template_id/i);
    expect(migration).toMatch(/'schema_version', 'no-session-idempotency\.v1'/i);
  });

  it("certifies directly from an adopted no-session agreement without requiring a minute", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_generar_certificacion_acuerdo_sin_sesion/i);
    expect(migration).toMatch(/v_agreement\.adoption_mode <> 'NO_SESSION'/i);
    expect(migration).toMatch(/v_agreement\.status NOT IN \('ADOPTED', 'APROBADO', 'CERTIFIED', 'PROMOTED'\)/i);
    expect(migration).toMatch(/minute_id,\s+tipo_certificacion/i);
    expect(migration).toMatch(/p_tipo, p_certificante_role/i);
    expect(migration).toMatch(/ARRAY\[p_agreement_id::text\]/i);
  });

  it("updates capital holdings and appends paired movement entries atomically", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION fn_registrar_transmision_capital/i);
    expect(migration).toMatch(/FROM capital_holdings\s+WHERE id = p_source_holding_id[\s\S]*FOR UPDATE/i);
    expect(migration).toMatch(/UPDATE capital_holdings\s+SET effective_to = p_effective_date/i);
    expect(migration).toMatch(/INSERT INTO capital_holdings/i);
    expect(migration).toMatch(/fn_registrar_movimiento_capital\(/i);
    expect(migration).toMatch(/'TRANSMISION'/i);
  });

  it("keeps the demo boundary and avoids real registry submission language", () => {
    expect(migration).not.toMatch(/enviar al registro mercantil/i);
    expect(migration).not.toMatch(/presentado al registro mercantil/i);
    expect(migration).not.toMatch(/subsanaci[oó]n enviada/i);
  });
});
