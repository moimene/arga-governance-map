import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720138000_secretaria_convocation_manifest_and_emit_rpc.sql",
  ),
  "utf8",
);
const executableSql = migration.replace(/^\s*--.*$/gm, "");
const emitRpc =
  executableSql.match(
    /CREATE OR REPLACE FUNCTION public\.fn_emit_convocatoria\([\s\S]*?\n\$function\$;/i,
  )?.[0] ?? "";
const lifecycleRpc =
  executableSql.match(
    /CREATE OR REPLACE FUNCTION public\.fn_transition_convocatoria_lifecycle\([\s\S]*?\n\$function\$;/i,
  )?.[0] ?? "";

describe("convocatoria — manifiesto canónico y emisión gobernada", () => {
  it("crea un manifiesto WORM DEMO con identidad y hashes recalculados", () => {
    expect(executableSql).toContain("CREATE TABLE IF NOT EXISTS public.convocation_manifests");
    expect(executableSql).toContain("UNIQUE");
    expect(executableSql).toContain("manifest_hash_sha512");
    expect(executableSql).toContain("fn_convocation_manifest_worm_guard");
    expect(executableSql).toContain("CONVOCATION_MANIFEST_WORM_MUTATION_FORBIDDEN");
    expect(executableSql).toContain("manifest_json::text");
    expect(executableSql).toContain("DEMO_SIMULATION_NO_LEGAL_EFFECT");
    expect(executableSql).toContain("secretaria.convocation-manifest.v2");
    expect(executableSql).toContain("DEMO_OPERATIONAL_DRAFT_RECORDED");
    expect(executableSql).toContain("not_a_legal_convocation");
    expect(executableSql).toContain("reviewed_demo_draft_text_hash_sha256");
  });

  it("vincula un acto DEMO WORM 1:1 sin atribuir actuación ni firma al Presidente", () => {
    expect(executableSql).toContain("CREATE TABLE IF NOT EXISTS public.convocation_acts");
    expect(executableSql).toContain("convocatoria_id                 uuid NOT NULL UNIQUE");
    expect(executableSql).toContain("DEMO_CONVOCATION_RECORD");
    expect(executableSql).toContain("approved_text_hash_sha256");
    expect(executableSql).toContain("agenda_hash_sha256");
    expect(executableSql).toContain("'actor_role_reference_only', true");
    expect(executableSql).toContain("'president_action_not_asserted', true");
    expect(executableSql).toContain("'signature_status', 'NOT_ASSERTED'");
    expect(emitRpc).toContain("'act_id', v_act_row.id");
    expect(emitRpc).toContain("'act_hash_sha512', v_act_row.act_hash_sha512");
  });

  it("solo permite emitir por RPC con rol activo y capability explícita", () => {
    expect(executableSql).toContain("CONVOCATION_EMISSION_REQUIRES_GOVERNED_RPC");
    expect(emitRpc).toContain("user_role.is_active IS TRUE");
    expect(emitRpc).toContain("user_role.expires_at IS NULL");
    expect(emitRpc).toContain("CONVOCATION_ISSUE");
    expect(emitRpc).toContain("ACTIVE_CONVOCATION_ISSUE_CAPABILITY_REQUIRED");
    expect(emitRpc).toContain("CONVOCATION_SERVER_FIELDS_ARE_NOT_CLIENT_CLAIMS");
    expect(emitRpc).toContain("CONVOCATION_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_CDA");
  });

  it("deriva fecha y sandbox y exige manifiesto en la misma transacción", () => {
    expect(emitRpc).toContain("'EMITIDA'");
    expect(emitRpc).toContain("'fecha_emision'");
    expect(emitRpc).toContain("'SANDBOX_' || channel.normalized");
    expect(executableSql).toContain("EMITTED_CONVOCATION_REQUIRES_CANONICAL_MANIFEST");
    expect(executableSql).toContain("DEFERRABLE INITIALLY DEFERRED");
  });

  it("liga semánticamente el texto a sociedad, órgano, sesión y agenda", () => {
    expect(emitRpc).toContain("CONVOCATION_TEXT_ENTITY_NAME_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_BODY_NAME_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_MEETING_DATE_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_MEETING_TIME_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_PLACE_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_AGENDA_TITLE_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_REPRESENTATION_TARGET_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_REPRESENTATION_PERSON_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_LEGACY_ISABEL_CONTRADICTION");
    expect(emitRpc).toContain("CONVOCATION_TEXT_CANONICAL_DEMO_PREFIX_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_CANONICAL_DEMO_SUFFIX_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_CANONICAL_AGENDA_LINE_MISMATCH");
    expect(emitRpc).toContain("CONVOCATION_TEXT_CANONICAL_DEMO_SAFEGUARDS_MISSING");
    expect(emitRpc).toContain("no afirma que dicha persona haya ordenado, consentido, emitido o firmado");
  });

  it("rechaza aliases/claims y revalida autoridad, delegación y capital justo antes del WORM", () => {
    expect(emitRpc).toContain("REPRESENTATION_LEGACY_MATTER_FORBIDDEN");
    expect(emitRpc).toContain("REPRESENTATION_CLAIMS_FORBIDDEN_OUTSIDE_CANONICAL_MATTER");
    expect(emitRpc).toContain("CONVOCATION_AUTHORITY_REVALIDATION_FAILED");
    expect(emitRpc).toContain("CONVOCATION_REPRESENTATION_SOURCE_REVALIDATION_FAILED");
    expect(emitRpc).toContain("CONVOCATION_REPRESENTATION_ART_212_BIS_REVALIDATION_FAILED");
    expect(emitRpc).toContain("FOR SHARE");
  });

  it("gobierna CANCELADA/RECTIFICADA con evento WORM y preserva manifiesto y acto", () => {
    expect(executableSql).toContain("CREATE TABLE IF NOT EXISTS public.convocation_lifecycle_events");
    expect(executableSql).toContain("CONVOCATION_LIFECYCLE_TRANSITION_REQUIRES_GOVERNED_RPC");
    expect(executableSql).toContain("CONVOCATION_LIFECYCLE_TRANSITION_REQUIRES_WORM_EVENT");
    expect(lifecycleRpc).toContain("FOR UPDATE");
    expect(lifecycleRpc).toContain("v_target_state NOT IN ('CANCELADA', 'RECTIFICADA')");
    expect(lifecycleRpc).toContain("manifest_id");
    expect(lifecycleRpc).toContain("act_id");
    expect(lifecycleRpc).toMatch(/SET estado = v_target_state/);
    expect(lifecycleRpc).not.toMatch(/SET[\s\S]*fecha_emision\s*=/);
  });

  it("incluye representación y evidencia en el hash canónico de cada punto", () => {
    expect(executableSql).toContain("fn_secretaria_convocation_agenda_item_canonical");
    expect(executableSql).toContain("'target_entity_name'");
    expect(executableSql).toContain("'representative_name'");
    expect(executableSql).toContain("'representation_delegation_id'");
    expect(executableSql).toContain("'representation_source_reference'");
    expect(executableSql).toContain("'representation_source_hash_sha512'");
    expect(executableSql).toContain("'capital_evidence_status'");
  });

  it("no afirma una conclusión jurídica sobre firma", () => {
    expect(emitRpc).toContain("'ead_signature_service_required', false");
    expect(emitRpc).toContain("'legal_signature_status', 'NOT_ASSERTED'");
    expect(emitRpc).toContain(
      "'external_signature_requirements', 'OUT_OF_SCOPE_FOR_THIS_DEMO_ARTIFACT'",
    );
    expect(emitRpc).not.toContain("'signature_required'");
  });

  it("bloquea entrega real y registra el DOCX server-side contra el manifiesto exacto", () => {
    expect(executableSql).toContain("DEMO_CONVOCATION_SANDBOX_NO_REAL_DISPATCH");
    expect(executableSql).toContain("fn_get_convocation_manifest_canonical_source");
    expect(executableSql).toContain("fn_register_server_rendered_convocation_attachment");
    expect(executableSql).toContain("convocation_manifest_hash_sha512");
    expect(executableSql).toContain("service_role required for server-rendered convocatoria registration");
    expect(executableSql).toContain("server-rendered final artifact requires exact DEMO manifest");
    expect(executableSql).toContain(
      "server-rendered artifact manifest is not bound to the recorded DEMO draft text",
    );
    expect(executableSql).toContain("convocatoria has multiple final artifacts; manual consistency repair required");
    expect(executableSql).toContain("COMMUNICATION:CONVOCATORIA:");
    expect(executableSql).toContain("REVOKE ALL ON FUNCTION public.fn_precommit_convocation_final_candidate");
  });

  it("revoca DML funcional y declara la frontera de confianza frente a owner/superuser", () => {
    expect(executableSql).toContain("Un owner/superuser");
    expect(executableSql).toContain("REVOKE ALL ON TABLE public.convocation_acts");
    expect(executableSql).toContain("REVOKE ALL ON TABLE public.convocation_manifests");
    expect(executableSql).toContain("REVOKE ALL ON TABLE public.convocation_lifecycle_events");
    expect(executableSql).toContain("has_function_privilege('service_role', 'public.fn_emit_convocatoria(jsonb)', 'EXECUTE')");
    expect(executableSql).toContain("has_table_privilege('service_role', 'public.convocation_acts', 'INSERT')");
    expect(executableSql).not.toContain("CREATE POLICY convocation_manifests_service_all");
  });
});
