import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720120000_authoritative_legal_artifact_gates.sql"),
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

describe("authoritative legal artifact gates", () => {
  it("keeps final artifacts and EAD verifications append-only and RPC-only", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.secretaria_legal_artifacts");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.secretaria_qtsp_verifications");
    expect(sql).toContain("binary_hash_sha256");
    expect(sql).toContain("binary_hash_sha512");
    expect(sql).toContain("authoritative legal evidence is append-only");
    expect(sql).toContain("insert only through governed RPC");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("makes minute and certification domain rows append-only against DELETE", () => {
    const guard = rpc("fn_secretaria_authoritative_domain_guard");
    expect(guard).toContain("TG_OP = 'DELETE'");
    expect(guard).toContain("retained legal-domain record");
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.minutes/);
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.certifications/);
    expect(sql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.minutes, public\.certifications[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
  });

  it("recomputes the minute manifest on the server and ignores client authority claims", () => {
    const generate = rpc("fn_generar_acta");
    const manifest = rpc("fn_secretaria_build_minute_legal_manifest");
    expect(generate).toContain("fn_secretaria_build_minute_legal_manifest");
    expect(generate).toContain("p_canonical_minutes_hash text DEFAULT NULL");
    expect(generate).toContain("client_canonical_hash_ignored");
    expect(generate).toContain("SERVER_RECOMPUTED");
    expect(generate).not.toMatch(/v_canonical_hash\s*:=\s*COALESCE\s*\(\s*p_canonical_minutes_hash/i);
    expect(manifest).toContain("censo_snapshot");
    expect(manifest).toContain("convocatoria must be emitted, immutable and complete");
    expect(manifest).toContain("server quorum not reached");
    expect(manifest).toContain("fn_secretaria_server_resolution_evaluation");
    expect(manifest).not.toMatch(/quorum_data\s*(?:#>>|->)\s*'\{?point_snapshots/);
    expect(manifest).toContain("a future or still-open meeting cannot produce legal minutes");
    expect(manifest).toMatch(/scheduled_start > now\(\)[\s\S]*scheduled_end > now\(\)/);
    expect(manifest).toContain("every decision agenda item requires exactly one resolution");
    expect(manifest).toContain("resolution/agreement linkage or adoption state is invalid");
  });

  it("renders outward-facing minute and certification text without technical hashes or formulas", () => {
    const manifest = rpc("fn_secretaria_build_minute_legal_manifest");
    const minuteRenderer = rpc("fn_secretaria_render_authoritative_minute");
    const certificationRenderer = rpc("fn_secretaria_render_authoritative_certification");
    expect(minuteRenderer).not.toContain("huella SHA-256 %s");
    expect(minuteRenderer).not.toContain("effective_favor > eligible_concurrent_weight / 2");
    expect(minuteRenderer).toContain("mayoría alcanzada");
    expect(minuteRenderer).toContain("v_point ->> 'matter_label_es'");
    expect(minuteRenderer).not.toContain("initcap(replace(lower(COALESCE(v_point ->> 'matter_code'");
    expect(manifest).toContain("'matter_label_es', mc.materia_label_es");
    expect(manifest).toContain("every point needs a catalogued matter");
    expect(certificationRenderer).not.toContain("con hash fuente %s");
    expect(certificationRenderer).not.toContain("huella SHA-256 %s");
    expect(certificationRenderer).toContain("Cargo vigente y en ejercicio");
    expect(certificationRenderer).toContain("Firma de la Secretaría o del certificante");
    expect(certificationRenderer).toContain("Visto bueno de la Presidencia");
    expect(certificationRenderer).toContain("interposición resulta suficiente");
  });

  it("routes the legacy three-argument minute overload through the authoritative writer", () => {
    const overloads = sql.match(
      /CREATE OR REPLACE FUNCTION public\.fn_generar_acta\([\s\S]*?\$function\$;/g,
    ) ?? [];
    expect(overloads).toHaveLength(2);
    const legacyAdapter = overloads.find((definition) =>
      !definition.includes("p_canonical_minutes_hash text"),
    ) ?? "";
    expect(legacyAdapter).toContain("RETURN public.fn_generar_acta(");
    expect(legacyAdapter).toContain("NULL::text");
    expect(legacyAdapter).not.toContain("INSERT INTO public.minutes");
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_generar_acta\(uuid, text, uuid\)[\s\S]*FROM PUBLIC, anon/,
    );
  });

  it("creates a fresh VERIFIED EAD bundle through a service-only reachable path", () => {
    const reconcile = rpc("fn_secretaria_reconcile_verified_ead_bundle");
    expect(reconcile).toContain("fn_secretaria_is_service_role() IS NOT TRUE");
    expect(reconcile).toContain("p_provider_signature_type NOT IN ('INTERPOSITION', 'ADVANCED')");
    expect(reconcile).toContain("provider_document_status");
    expect(reconcile).toContain("storage_binary_hash_sha256");
    expect(reconcile).toContain("storage_binary_hash_sha512");
    expect(reconcile).toContain("v_request.sr_status <> 'COMPLETED'");
    expect(reconcile).toContain("request_input_hash_sha256");
    expect(reconcile).toContain("signed_output_hash_sha256");
    expect(reconcile).toContain("signed_output_hash_sha512");
    expect(reconcile).toContain("SERVICE_HASH_VERIFIED");
    expect(reconcile).toContain("completion_certificate_ref");
    expect(reconcile).toContain("completion_package_ref");
    expect(reconcile).toMatch(/INSERT INTO public\.evidence_bundles[\s\S]*'VERIFIED'/);
    expect(reconcile).not.toMatch(/UPDATE\s+public\.evidence_bundles/i);
    expect(reconcile).not.toContain("validation_report_id");
    expect(reconcile).not.toContain("evidence_report_id");
  });

  it("registers the exact SHA-256/SHA-512 artifact idempotently from reconciled custody", () => {
    const register = rpc("fn_secretaria_register_final_legal_artifact");
    expect(register).toContain("p_binary_hash_sha256 text");
    expect(register).toContain("v_bundle.status <> 'VERIFIED'");
    expect(register).toContain("SERVICE_EARCHIVE");
    expect(register).toContain("EVIDENCE_MANAGER");
    expect(register).toContain("'{binary,artifact_role}' <> 'SIGNED_OUTPUT'");
    expect(register).toContain("v_existing_artifact.binary_hash_sha256 = p_binary_hash_sha256");
    expect(register).toContain("v_existing_artifact.binary_hash_sha512 = v_bundle.hash_sha512");
    expect(register).toContain("RETURN v_existing_artifact.id");
    expect(register).toContain("position(btrim(mr.resolution_text) IN c.content) = 0");
    expect(register).toContain("omits the exact adopted resolution/agreement text");
    expect(register).not.toContain("v_bundle.status NOT IN ('SEALED', 'VERIFIED')");
  });

  it("accepts real INTERPOSITION or ADVANCED evidence without inventing a qualified signature", () => {
    const verify = rpc("fn_secretaria_register_verified_qtsp_signature");
    expect(verify).toContain("provider_signatory_id");
    expect(verify).toContain("provider_signatory_status");
    expect(verify).toContain("v_artifact.binary_hash_sha256");
    expect(verify).toContain("v_artifact.binary_hash_sha512");
    expect(verify).toContain("request_input_hash_sha256");
    expect(verify).toContain("signed_output_hash_sha256");
    expect(verify).toContain("signed_output_hash_sha512");
    expect(verify).toContain("SERVICE_SIGNATURE_RECONCILIATION");
    expect(verify).toContain("input_output_binding");
    expect(verify).not.toContain("qualified_signature_certificate_id");
    expect(sql).not.toMatch(/QES_VERIFIED|QES_EVIDENCE_VERIFIED/);
    expect(sql).toContain("required_ead_signature_type text NOT NULL DEFAULT 'INTERPOSITION'");
    expect(sql).toMatch(/requires_qualified_signature,[\s\S]{0,700}false,/);
  });

  it("keeps input/output hashes separate and applies equality according to actual packaging", () => {
    const reconcile = rpc("fn_secretaria_reconcile_verified_ead_bundle");
    const verify = rpc("fn_secretaria_register_verified_qtsp_signature");
    expect(reconcile).toContain("v_signature_packaging = 'ENVELOPED'");
    expect(reconcile).toContain("'DETACHED'");
    expect(reconcile).toContain("'PROVIDER_ATTESTATION'");
    expect(reconcile).toMatch(/v_signature_packaging = 'ENVELOPED'[\s\S]{0,160}v_request\.document_hash[\s\S]{0,120}= p_signed_output_hash_sha256/);
    expect(reconcile).toMatch(/request_input[\s\S]*artifact_role', 'SIGNED_OUTPUT'/);
    expect(verify).toMatch(/v_signature_packaging = 'ENVELOPED'[\s\S]{0,160}lower\(v_request\.document_hash\) = v_artifact\.binary_hash_sha256/);
    expect(verify).toMatch(/request_input_hash_sha256[\s\S]*signed_output_hash_sha256[\s\S]*signed_output_hash_sha512/);
  });

  it("binds authoritative EAD requests to source, content hash and immutable signer census", () => {
    const guard = rpc("fn_secretaria_qtsp_request_source_guard");
    expect(sql).toContain("qtsp_signature_requests_source_binding_check");
    expect(guard).toContain("EAD request source, input hash and signatory census are immutable");
    expect(guard).toContain("signer ->> 'source_domain'");
    expect(guard).toContain("signer ->> 'authority_evidence_id'");
    const verify = rpc("fn_secretaria_register_verified_qtsp_signature");
    expect(verify).toContain("v_request.source_domain IS DISTINCT FROM v_artifact.source_domain");
    expect(verify).toContain("provider_completed_at");
  });

  it("freezes meeting source facts after the server minute manifest exists", () => {
    const freeze = rpc("fn_secretaria_freeze_minute_source_facts");
    expect(freeze).toContain("MANIFEST_READY");
    expect(freeze).toContain("ARTIFACT_FINAL");
    expect(freeze).toContain("APPROVED_SIGNED");
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OR DELETE ON public\.meeting_attendees/);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OR DELETE ON public\.meeting_votes/);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OR DELETE ON public\.meeting_resolutions/);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OR DELETE ON public\.agenda_item_constancias/);
  });

  it("allows one multi-signer SR while requiring distinct individual signatory evidence", () => {
    const approve = rpc("fn_aprobar_acta_autoritativa");
    expect(approve).toContain("signer_person_id = v_secretary_verification.signer_person_id");
    expect(approve).toContain("provider_reference = v_secretary_verification.provider_reference");
    expect(approve).not.toContain("signature_request_id = v_secretary_verification.signature_request_id");
    expect(approve).not.toContain("provider_evidence_bundle_id = v_secretary_verification.provider_evidence_bundle_id");
    expect(approve).toContain("president signer lacks current body authority");
    expect(approve).toContain("secretary signer lacks current body authority");
  });

  it("classifies impossible legacy dates and their certifications as DEMO_SIMULATION", () => {
    expect(sql).toMatch(/meeting\.scheduled_start > now\(\)[\s\S]*minute\.signed_at < meeting\.scheduled_start/);
    expect(sql).toMatch(/meeting\.scheduled_end IS NOT NULL[\s\S]*minute\.signed_at < meeting\.scheduled_end/);
    expect(sql).toMatch(/minute\.legal_gate_status = 'DEMO_SIMULATION'[\s\S]*THEN 'DEMO_SIMULATION'/);
  });

  it("dates approval from the end of the meeting and never from its scheduled start", () => {
    const approve = rpc("fn_aprobar_acta_autoritativa");
    expect(approve).toContain("v_signed_at < v_meeting.scheduled_end");
    expect(approve).toContain("v_signed_at > v_meeting.scheduled_end + interval '15 days'");
    expect(approve).toContain("p_approval_effective_at - v_signed_at");
    expect(approve).not.toContain("v_signed_at > v_meeting.scheduled_start + interval '15 days'");
  });

  it("certifies only a nonempty exact set of adopted agreements from an approved posted minute", () => {
    const generate = rpc("fn_generar_certificacion");
    const agreementManifest = rpc("fn_secretaria_certified_agreements_manifest");
    expect(generate).toContain("cardinality(p_agreements_certified) = 0");
    expect(generate).toContain("cardinality(v_agreement_ids) <> cardinality(p_agreements_certified)");
    expect(generate).toContain("legal_gate_status <> 'APPROVED_SIGNED'");
    expect(generate).toContain("book_destination_status <> 'POSTED'");
    expect(generate).toContain("COALESCE(btrim(ae.inscripcion_rm_referencia), '') <> ''");
    expect(generate).toContain("ae.inscripcion_rm_fecha IS NOT NULL");
    expect(agreementManifest).toContain("mr.status = 'ADOPTED'");
    expect(agreementManifest).toContain("a.status IN ('ADOPTED', 'CERTIFIED', 'INSTRUMENTED', 'FILED', 'REGISTERED', 'PUBLISHED')");
    expect(agreementManifest).not.toContain("'agreement_status'");
  });

  it("blocks token demos and transitions agreements only after verified emission", () => {
    const legacySign = rpc("fn_firmar_certificacion");
    const authoritativeSign = rpc("fn_firmar_certificacion_autoritativa");
    const emit = rpc("fn_emitir_certificacion");
    expect(legacySign).toContain("opaque/demo tokens are not proof");
    expect(legacySign).not.toMatch(/UPDATE\s+public\.certifications/i);
    expect(authoritativeSign).toContain("legal_gate_status = 'SIGNATURE_VERIFIED'");
    expect(authoritativeSign).toContain("verified_ead_signature_type");
    expect(authoritativeSign).toContain("authoritative certification approval authority is no longer current or lacks registry evidence");
    expect(emit).toContain("v_bundle.status <> 'VERIFIED'");
    expect(emit).toContain("SET status = 'CERTIFIED'");
    expect(emit.indexOf("SET status = 'CERTIFIED'")).toBeGreaterThan(emit.indexOf("v_bundle.status <> 'VERIFIED'"));
    expect(sql).not.toContain("not yet linked");
  });
});
