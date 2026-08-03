import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720133000_secretaria_ead_interposition_policy.sql",
  ),
  "utf8",
);
const messagingMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720124000_ead_notice_manager_delivery_truth.sql",
  ),
  "utf8",
);

function rpc(name: string): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const body = migration.indexOf("AS $function$", start);
  const end = migration.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return migration.slice(start, end + "$function$;".length);
}

describe("Secretaría EAD Trust interposition policy", () => {
  it("persists verified interposition evidence as RPC-only WORM facts", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.secretaria_ead_interposition_evidence",
    );
    expect(migration).toContain("signature_claim        boolean NOT NULL DEFAULT false");
    expect(migration).toContain("CHECK (signature_claim IS FALSE)");
    expect(migration).toContain("provider_mode = 'INTERPOSITION'");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("trg_secretaria_ead_interposition_append_only");
    expect(migration).toContain("trg_secretaria_ead_interposition_insert_guard");
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.secretaria_ead_interposition_evidence[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
  });

  it("accepts only real EAD Evidence Manager interposition without signature-level claims", () => {
    const register = rpc("fn_secretaria_register_ead_interposition_evidence");
    expect(register).toContain("requires service_role");
    expect(register).toContain("signature_claim");
    expect(register).toContain("IS NOT FALSE");
    expect(register).toContain("provider_mode");
    expect(register).toContain("INTERPOSITION");
    expect(register).toContain("EVIDENCE_MANAGER");
    expect(register).toContain("fn_secretaria_jsonb_has_forbidden_signature_claim");
    expect(migration).toContain("provider_signature_type");
    expect(migration).toContain("qualified_signature");
    expect(migration).toContain("advanced_signature");
    expect(migration).toContain("simple_signature");
    expect(register).toContain("source,content_hash_sha256");
    expect(register).toContain("v_bundle.status <> 'VERIFIED'");
    expect(register).toContain("legal_hold");
  });

  it("blocks final registration until a server-authoritative binary exists", () => {
    const register = rpc("fn_secretaria_register_custodied_legal_artifact");
    const rejection = register.indexOf("AUTHORITATIVE_BINARY_REQUIRED");
    expect(rejection).toBeGreaterThanOrEqual(0);
    expect(register).toContain("server-generated and semantically verified binary is required");
    expect(register).not.toContain("INSERT INTO public.secretaria_legal_artifacts");
    expect(register).not.toContain("UPDATE public.minutes");
    expect(register).not.toContain("UPDATE public.certifications");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_register_custodied_legal_artifact\([\s\S]*?\) FROM PUBLIC, anon, authenticated, service_role/,
    );
  });

  it("revokes every legacy writer that elevated provider signature results", () => {
    for (const name of [
      "fn_secretaria_reconcile_verified_ead_bundle",
      "fn_secretaria_register_final_legal_artifact",
      "fn_secretaria_register_verified_qtsp_signature",
      "fn_secretaria_reconcile_annual_accounts_ead_bundle",
    ]) {
      const revoke = new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${name}\\([\\s\\S]*?\\) FROM PUBLIC, anon, authenticated, service_role`,
      );
      expect(migration, `${name} must be fail-closed`).toMatch(revoke);
    }
  });

  it("approves minutes from separate president consent and secretary constancia", () => {
    const approve = rpc("fn_aprobar_acta_autoritativa");
    expect(approve).toContain("secretaria_ead_interposition_evidence");
    expect(approve).toContain("evidence_purpose = 'CONSENT'");
    expect(approve).toContain("subject_role = 'PRESIDENTE'");
    expect(approve).toContain("evidence_purpose = 'CONSTANCIA'");
    expect(approve).toContain("subject_role = 'SECRETARIO'");
    expect(approve).toContain("signature_claim IS FALSE");
    expect(approve).toContain("approval_canonical_status = 'APPROVED_EVIDENCED'");
    expect(approve).toContain("'canonical_gate_status', 'APPROVED_EVIDENCED'");
    expect(approve).not.toContain("provider_signature_type");
    expect(approve).not.toContain("ADVANCED");
    expect(approve).not.toContain("QES");
  });

  it("evidences certifications by constancia and emits only from interposition custody", () => {
    const evidence = rpc("fn_firmar_certificacion_autoritativa");
    const emit = rpc("fn_emitir_certificacion");
    expect(evidence).toContain("evidence_purpose = 'CONSTANCIA'");
    expect(evidence).toContain("subject_role = 'CERTIFICANTE'");
    expect(evidence).toContain("subject_role = 'VISTO_BUENO'");
    expect(evidence).toContain("signature_status = 'EVIDENCED'");
    expect(evidence).toContain("legal_gate_status = 'INTERPOSITION_VERIFIED'");
    expect(evidence).toContain("interposition_canonical_status = 'CONSTANCIA_VERIFIED'");
    expect(evidence).toContain("'canonical_gate_status', 'CONSTANCIA_VERIFIED'");
    expect(evidence).not.toContain("provider_signature_type");
    expect(evidence).not.toContain("ADVANCED");
    expect(evidence.match(/v_binding_hash text;/g)).toHaveLength(1);
    expect(emit).toContain("v_cert.signature_status <> 'EVIDENCED'");
    expect(emit).toContain("v_cert.interposition_signature_claim IS NOT FALSE");
    expect(emit).toContain("CUSTODIED_BINARY");
    expect(emit).toContain("CERT_EMITIDA_INTERPOSICION");
  });

  it("keeps article 253.2 signature-or-cause while never treating EAD custody as signature", () => {
    const record = rpc("fn_secretaria_record_annual_accounts_external_signature");
    const validate = rpc("fn_secretaria_validate_annual_accounts_execution");
    const legacyAdapter = rpc("fn_secretaria_record_annual_accounts_signer_outcome");
    expect(record).toContain("EXTERNAL_SIGNATURE_CUSTODY");
    expect(record).toContain("external_signature_review");
    expect(record).toContain("secretaria_annual_accounts_signature_review_events");
    expect(record).toContain("p_review_event_id");
    expect(record).toContain("review_status = 'VERIFIED'");
    expect(record).toContain("document_hash_sha256");
    expect(record).toContain("reviewed_by");
    expect(record).toContain("v_review.reviewed_at > v_evidence.occurred_at");
    expect(record).toContain("p_finalizer_user_id = v_review.reviewer_user_id");
    expect(record).toContain("provider_signature_claim', false");
    expect(validate).toContain("EXTERNAL_SIGNATURE_EVIDENCE");
    expect(validate).toContain("MISSING_SIGNATURE_CAUSE");
    expect(validate).toContain("every administrator needs reviewed external signature evidence or an individual cause");
    expect(validate).toContain("'status', 'EXTERNAL_SIGNATURE_ROSTER_COMPLETE'");
    expect(validate).not.toContain("resolved.outcome_type = 'SIGNED_EAD'");
    expect(legacyAdapter).toContain("INTERPOSITION is custody, not signature");
    expect(legacyAdapter).not.toContain("INSERT INTO public.secretaria_annual_accounts_signer_outcomes");
  });

  it("e-archives annual execution only after the reviewed external-signature roster", () => {
    const bridge = rpc("fn_secretaria_register_annual_accounts_ead_execution");
    expect(bridge).toContain("EXTERNAL_SIGNATURE_ROSTER_COMPLETE");
    expect(bridge).toContain("provider_mode");
    expect(bridge).toContain("INTERPOSITION");
    expect(bridge).toContain("signature_claim");
    expect(bridge).toContain("IS NOT FALSE");
    expect(bridge).toContain("provider_signature_type");
    expect(bridge).toContain("signature_packaging");
    expect(bridge).toContain("'execution_state', v_execution_state");
    expect(bridge).toContain("secretaria_ead_provider_action_reservations");
    expect(bridge).toContain("lacks exact pre-provider reservation");
  });

  it("reserves every external e-archive action against tenant, source and exact hashes", () => {
    const reserve = rpc("fn_secretaria_reserve_ead_provider_action");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.secretaria_ead_provider_action_reservations",
    );
    expect(migration).toContain("trg_secretaria_ead_provider_reservation_append_only");
    expect(reserve).toContain("fn_secretaria_current_tenant_id");
    expect(reserve).toContain("fn_secretaria_assert_role_allowed");
    expect(reserve).toContain("source_hash_sha256");
    expect(reserve).toContain("payload_hash_sha256");
    expect(reserve).toContain("pg_advisory_xact_lock");
    expect(reserve).toContain("AUTHORITATIVE_BINARY_REQUIRED");
    expect(reserve).toContain("browser-generated bytes cannot become a final legal artifact");
  });

  it("authorizes provider effects only with an active, unexpired RBAC assignment", () => {
    const activeRole = rpc("fn_secretaria_has_active_role");
    const assertRole = rpc("fn_secretaria_assert_role_allowed");
    expect(activeRole).toContain("public.rbac_user_roles");
    expect(activeRole).toContain("user_role.is_active IS TRUE");
    expect(activeRole).toContain("user_role.expires_at IS NULL OR user_role.expires_at > now()");
    expect(assertRole).toContain("fn_secretaria_has_active_role");
    expect(assertRole).toContain("active, unexpired role");
  });

  it("never lets APPROVED_SIGNED/signed_at legacy create a book entry alone", () => {
    const guard = rpc("fn_secretaria_interposition_book_entry_guard");
    expect(guard).toContain("approval_canonical_status <> 'APPROVED_EVIDENCED'");
    expect(guard).toContain("approval_evidence_mode <> 'INTERPOSITION'");
    expect(guard).toContain("approval_signature_claim IS NOT FALSE");
    expect(guard).toContain("president_consent_evidence_id IS NULL");
    expect(guard).toContain("secretary_constancia_evidence_id IS NULL");
    expect(migration).toContain("trg_secretaria_interposition_book_entry_guard");
  });

  it("keeps basic messaging and e-archiving as separate provider facts", () => {
    expect(messagingMigration).toContain("fn_recipient_mark_ead_notice_result");
    expect(messagingMigration).toContain("EAD_TRUST_NOTICE_MANAGER");
    expect(messagingMigration).toContain("EAD_TRUST_EVIDENCE_MANAGER");
    expect(messagingMigration).toContain("REQUESTED response cannot carry delivered_at");
    expect(messagingMigration).toContain("completed EAD e-archive requires evidence id and archived_at");
    expect(migration).toContain("Mensajería básica EAD Notice Manager");
    expect(migration).toContain("no existe claim de firma");
  });
});
