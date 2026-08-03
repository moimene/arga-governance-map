import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720122200_secretaria_annual_accounts_artifact_gate.sql",
  ),
  "utf8",
);

function rpc(name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const body = sql.indexOf("AS $function$", start);
  const end = sql.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return sql.slice(start, end + "$function$;".length);
}

describe("FORMULACION_CUENTAS — authoritative artifact gate", () => {
  it("models one immutable versioned set and structured legal components", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.secretaria_annual_accounts_sets");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.secretaria_annual_accounts_components");
    expect(sql).toContain("BOARD_SUBMISSION_VERSION");
    expect(sql).toContain("approval_status = 'APPROVED'");
    expect(sql).toContain("immutability_status = 'IMMUTABLE'");
    expect(sql).toContain("supersedes_set_id");
    expect(sql).toContain("BALANCE_SHEET");
    expect(sql).toContain("PROFIT_AND_LOSS_STATEMENT");
    expect(sql).toContain("NOTES");
    expect(sql).toContain("CHANGES_IN_EQUITY_STATEMENT");
    expect(sql).toContain("CASH_FLOW_STATEMENT");
    expect(sql).toContain("MANAGEMENT_REPORT");
  });

  it("makes the set, components, roster and outcomes append-only", () => {
    expect(sql).toContain("fn_secretaria_annual_accounts_append_only_guard");
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.secretaria_annual_accounts_sets/);
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.secretaria_annual_accounts_components/);
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.secretaria_annual_accounts_signer_rosters/);
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.secretaria_annual_accounts_signer_outcomes/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.secretaria_annual_accounts_sets FROM PUBLIC, anon, authenticated/);
  });

  it("fixes the board-submission version before the meeting and requires exact agenda identity", () => {
    const fix = rpc("fn_secretaria_fix_annual_accounts_set");
    expect(fix).toContain("v_meeting.scheduled_start <= now()");
    expect(fix).toContain("v_meeting.status NOT IN ('DRAFT', 'CONVOCADA')");
    expect(fix).toContain("FORMULACION_CUENTAS");
    expect(fix).toContain("v_agenda.kind <> 'DECISORIO'");
    expect(fix).toContain("v_agenda.requires_attachments");
    expect(fix).toContain("v_agenda.proposal_text");
    expect(fix).toContain("explicitly supersede set");
  });

  it("binds each component to Evidence Manager, double hash and storage identity — never filename", () => {
    const fix = rpc("fn_secretaria_fix_annual_accounts_set");
    expect(fix).toContain("ANNUAL_ACCOUNTS_COMPONENT");
    expect(fix).toContain("content_hash_sha256");
    expect(fix).toContain("content_hash_sha512");
    expect(fix).toContain("evidence_bundle_id");
    expect(fix).toContain("storage_object_id");
    expect(fix).toContain("storage_version");
    expect(fix).toContain("v_bundle.status NOT IN ('SEALED', 'VERIFIED')");
    expect(fix).toContain("v_bundle.legal_hold");
    expect(fix).not.toMatch(/file_?name|nombre_?fichero/i);
  });

  it("requires EFE and management report only when their applicability is explicit", () => {
    const fix = rpc("fn_secretaria_fix_annual_accounts_set");
    const validate = rpc("fn_secretaria_validate_annual_accounts_point");
    expect(fix).toContain("applicability decisions must be explicit");
    expect(fix).toContain("p_cash_flow_statement_applicable");
    expect(fix).toContain("p_management_report_applicable");
    expect(validate).toContain("v_set.cash_flow_statement_applicable");
    expect(validate).toContain("v_set.management_report_applicable");
  });

  it("provides the exact fail-closed helper consumed by the minute gate", () => {
    const validate = rpc("fn_secretaria_validate_annual_accounts_point");
    const trigger = rpc("fn_secretaria_annual_accounts_minute_gate");
    expect(validate).toContain("current set is absent or not APPROVED/IMMUTABLE");
    expect(validate).toContain("mandatory component, hash, evidence or custody binding is invalid");
    expect(validate).toContain("encode(digest(v_set.manifest::text, 'sha256'), 'hex')");
    expect(trigger).toContain("fn_secretaria_validate_annual_accounts_point");
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.minutes/);
  });

  it("freezes all voting administrators from the WORM political census only after adoption", () => {
    const freeze = rpc("fn_secretaria_freeze_annual_accounts_signer_roster");
    expect(freeze).toContain("v_meeting.status <> 'CELEBRADA'");
    expect(freeze).toContain("v_meeting.scheduled_end > now()");
    expect(freeze).toContain("resolution.status = 'ADOPTED'");
    expect(freeze).toContain("snapshot_type = 'POLITICO'");
    expect(freeze).toContain("v_snapshot.audit_worm_id IS NULL");
    expect(freeze).toContain("voting_rights");
    expect(freeze).toContain("count(DISTINCT item ->> 'person_id')");
    expect(freeze).toContain("minute.snapshot_id = p_snapshot_id");
    expect(freeze).toContain("same census snapshot as the authoritative minute");
  });

  it("accepts EAD interposition or advanced signature and a persisted individual cause", () => {
    const record = rpc("fn_secretaria_record_annual_accounts_signer_outcome");
    const requestGuard = rpc("fn_secretaria_qtsp_request_source_guard");
    expect(sql).toContain("'MINUTE', 'CERTIFICATION', 'ANNUAL_ACCOUNTS'");
    expect(sql).toContain("'MINUTE_FINAL', 'CERTIFICATION_FINAL', 'ANNUAL_ACCOUNTS_EXECUTION'");
    expect(requestGuard).toContain("NEW.document_hash !~ '^[0-9a-f]{64}$'");
    expect(requestGuard).toContain("NEW.content_hash_sha256 !~ '^[0-9a-f]{64}$'");
    expect(requestGuard).not.toContain("lower(NEW.document_hash) <> lower(NEW.content_hash_sha256)");
    expect(requestGuard).toContain("secretaria_annual_accounts_expected_signers");
    expect(requestGuard).toContain("signer_role', '')) <> 'ADMINISTRADOR'");
    expect(requestGuard).toContain("INTERPOSITION', 'ADVANCED'");
    expect(record).toContain("SIGNED_EAD");
    expect(record).toContain("MISSING_SIGNATURE_CAUSE");
    expect(record).toContain("INTERPOSITION");
    expect(record).toContain("ADVANCED");
    expect(record).toContain("only trusted EAD reconciliation");
    expect(record).toContain("v_request.source_domain <> 'ANNUAL_ACCOUNTS'");
    expect(record).toContain("v_set.manifest_hash_sha256");
    expect(record).toContain("provider_signatory_id");
    expect(record).toContain("ANNUAL_ACCOUNTS_SIGNATURE");
    expect(record).toContain("SERVICE_SIGNATURE_RECONCILIATION");
    expect(record).toContain("verification,signature_request_id");
    expect(record).toContain("DEATH");
    expect(record).toContain("ILLNESS_OR_INCAPACITY");
    expect(record).toContain("DISAGREEMENT");
    expect(record).toContain("cause_text");
    expect(record).not.toContain("QES");
  });

  it("binds SIGNED_EAD to one verifiable provider outcome for that exact administrator", () => {
    const record = rpc("fn_secretaria_record_annual_accounts_signer_outcome");
    expect(record).toContain("verification,provider_signer_outcomes");
    expect(record).toContain("provider_outcome ->> 'person_id' = v_expected.person_id::text");
    expect(record).toContain("provider_outcome ->> 'provider_signatory_id' = v_provider_reference");
    expect(record).toContain("COALESCE(v_provider_signer_outcome_count, 0) <> 1");
    expect(record).toContain("EAD_DOCUMENT_SIGNATORY_RESOURCE");
    expect(record).toContain("NOT IN ('SIGNED', 'CERTIFIED', 'COMPLETED')");
    expect(record).toContain("provider_outcome_hash_sha256");
    expect(record).toContain("v_request.evidence_id IS DISTINCT FROM v_bundle.id");
    expect(record).toContain("digest((v_provider_signer_outcome - 'provider_outcome_hash_sha256')::text, 'sha256')");
    expect(record).toContain("encode(digest(v_bundle.manifest::text, 'sha256'), 'hex') <> v_bundle.manifest_hash");
    expect(record).toContain("'provider_signer_outcome', v_provider_signer_outcome");
    expect(record).toContain("'signed_at', v_provider_signer_status_at");
    expect(record).not.toContain("'signed_at', v_request.completed_at");
  });

  it("does not allow FINAL_ARCHIVED until every administrator has signature or cause", () => {
    const validate = rpc("fn_secretaria_validate_annual_accounts_execution");
    const archive = rpc("fn_secretaria_register_annual_accounts_execution_artifact");
    expect(validate).toContain("every administrator needs an EAD signature or an individual persisted cause");
    expect(validate).toContain("v_resolved_count <> v_expected_count");
    expect(archive).toContain("fn_secretaria_validate_annual_accounts_execution");
    expect(archive).toContain("ANNUAL_ACCOUNTS_EXECUTION_OUTPUT");
    expect(archive).toContain("FINAL_ARCHIVED");
    expect(archive).toContain("trusted e-archive service required");
    expect(archive).toContain("signer_outcomes_manifest_hash_sha256");
    expect(archive).toContain("missing_signature_causes_manifest_hash_sha256");
    expect(validate).toContain("outcomes_manifest_hash_sha256");
    expect(validate).toContain("missing_signature_causes_manifest_hash_sha256");
    expect(sql).toMatch(/CHECK \(execution_status = 'FINAL_ARCHIVED'\)/);
  });
});
