import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260720132000_secretaria_convocation_communication_binding.sql",
);
const sql = readFileSync(MIGRATION, "utf8");
const hardening = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260720135000_secretaria_convocation_dispatch_hardening.sql",
  ),
  "utf8",
);
const probe = readFileSync(
  join(
    process.cwd(),
    "supabase/tests/secretaria_convocation_dispatch_hardening_probe.sql",
  ),
  "utf8",
);

describe("convocatoria communication authoritative binding", () => {
  it("uses first-class tenant-bound convocatoria and source attachment identities", () => {
    expect(sql).toMatch(/communications[\s\S]*ADD COLUMN IF NOT EXISTS convocatoria_id uuid/);
    expect(sql).toMatch(/REFERENCES public\.convocatorias\(id\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/source_attachment_id uuid[\s\S]*REFERENCES public\.attachments\(id\) ON DELETE RESTRICT/);
    expect(sql).toContain("artifact_kind IN ('SUPPORTING_DOCUMENT', 'CONVOCATORIA_FINAL')");
    expect(sql).toContain("file_hash ~ '^[0-9a-f]{64}$'");
    expect(sql).toContain("file_hash_sha512 ~ '^[0-9a-f]{128}$'");
    expect(sql).toContain("'evidence-bundle://convocatorias/' || convocatoria_id::text || '/%'");
  });

  it("registers exactly one immutable final DOCX through the authoritative RPC", () => {
    expect(hardening).toContain("CREATE TABLE IF NOT EXISTS public.convocation_artifact_candidates");
    expect(hardening).toContain("fn_precommit_convocation_final_candidate");
    expect(hardening).toContain("candidate source hash differs from immutable convocatoria_text");
    expect(hardening).toContain("final DOCX differs from its authoritative precommitted candidate");
    expect(hardening).toContain("review_status = 'CONSUMED'");
    expect(hardening).toContain("consumed_attachment_id = v_attachment_id");
    expect(sql).toContain("fn_register_convocatoria_final_attachment");
    expect(sql).toContain("app.secretaria_final_artifact_rpc");
    expect(sql).toContain("CONVOCATORIA_FINAL must be registered by the authoritative RPC");
    expect(sql).toContain("CONVOCATORIA_FINAL is immutable");
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS ux_attachments_one_convocatoria_final/);
    expect(sql).toContain("convocatoria already has a different immutable final artifact");
  });

  it("requires one final DOCX plus every zero-to-many supporting document", () => {
    expect(sql).toContain("v_generated_count <> 1");
    expect(sql).toContain("v_valid_generated_count <> 1");
    expect(sql).toContain("v_valid_attachment_count <> v_attachment_count");
    expect(sql).toContain("v_support_attachment_count <> v_support_source_count");
    expect(sql).toContain("communication_attachment.tipo <> 'DOCUMENTO_GENERADO'");
    expect(sql).toContain("attachment.artifact_kind = 'SUPPORTING_DOCUMENT'");
    expect(sql).toContain("supporting package is frozen after communication programming");
  });

  it("assembles only in draft and promotes atomically under an advisory lock", () => {
    expect(sql).toContain("communications must be inserted as BORRADOR");
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.communications/);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OR DELETE ON public\.communication_attachments/);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OR DELETE ON public\.communication_recipients/);
    expect(sql).toContain("communication attachments can only be assembled in BORRADOR");
    expect(sql).toContain("communication recipients can only be inserted in BORRADOR");
    expect(sql).toContain("save draft identity and content before promoting the communication");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("'BORRADOR',");
    expect(sql).toMatch(/IF v_requested_state = 'PROGRAMADA'[\s\S]*SET estado = 'PROGRAMADA'/);
    expect(sql).toContain("meeting agenda must be materialized before programming the convocatoria");
    expect(sql).toContain("extensions.digest(convert_to(NEW.cuerpo_render, 'UTF8'), 'sha512')");
  });

  it("quarantines invalid legacy communications instead of promoting a defective document", () => {
    expect(sql).toContain("84dc2d8c-6791-4f33-8170-f1821d2913b9");
    expect(sql).toContain("expired_demo_communication_with_non_authoritative_document");
    expect(sql).toContain("legacy_convocatoria_failed_authoritative_gate");
    expect(sql).toContain("SET estado = 'CANCELADA'");
    expect(sql).not.toContain("3917f270-170f-4ce9-8135-43113df6ed83");
  });

  it("fences each claim and never auto-requeues an unknown provider outcome", () => {
    expect(hardening).toMatch(/fn_claim_recipients_for_dispatch\([\s\S]*p_tenant_id uuid DEFAULT NULL/);
    expect(hardening).toContain("dispatch_attempt_id = gen_random_uuid()");
    expect(hardening).toContain("provider_idempotency_key = COALESCE");
    expect(hardening).toContain("|| ':CHANNEL:' || COALESCE(recipient.canal_usado, recipient.canal_primario)");
    expect(hardening).toContain("provider_idempotency_key = NULL");
    expect(hardening).toContain("dispatch lease expired with unknown provider outcome");
    expect(hardening).toContain("estado_entrega = 'RECONCILIATION_REQUIRED'");
    expect(hardening).not.toMatch(/lease expired[\s\S]{0,300}estado_entrega = 'PENDIENTE'/);
    expect(hardening).toContain("FOR UPDATE OF candidate SKIP LOCKED");
    expect(hardening).toContain("fn_revalidate_recipient_dispatch_attempt");
    expect(hardening).toContain("v_recipient.dispatch_attempt_id IS DISTINCT FROM p_dispatch_attempt_id");
    expect(hardening).toContain("v_communication.package_revision IS DISTINCT FROM p_package_revision");
    expect(hardening).toContain("v_communication.package_hash_sha512 IS DISTINCT FROM lower(p_package_hash_sha512)");
    expect(hardening).toContain("'PROVIDER:SENT:' || p_proveedor || ':' || btrim(p_proveedor_evento_id)");
    expect(hardening).toContain("provider event id is already bound to recipient");
  });

  it("keeps package identity immutable and routes operator/provider mutations through narrow RPCs", () => {
    expect(hardening).toContain("NEW.organo_tipo IS DISTINCT FROM OLD.organo_tipo");
    expect(hardening).toContain("NEW.tipo_comunicacion IS DISTINCT FROM OLD.tipo_comunicacion");
    expect(hardening).toContain("NEW.metadata IS DISTINCT FROM OLD.metadata");
    expect(hardening).toContain("fn_program_communication");
    expect(hardening).toContain("fn_cancel_communication");
    expect(hardening).toContain("fn_retry_communication_recipient");
    expect(hardening).toContain("fn_recipient_record_resend_callback");
    expect(hardening).toContain("terminal delivered/read/responded fact");
    expect(hardening).toMatch(/REVOKE INSERT, UPDATE, DELETE ON TABLE public\.communications FROM authenticated/);
    expect(hardening).toMatch(/REVOKE INSERT, UPDATE, DELETE ON TABLE public\.communication_recipients FROM authenticated/);
    expect(hardening).toMatch(/fn_recipient_record_resend_callback\([\s\S]*TO service_role/);
    expect(hardening).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_recipient_mark_ead_notice_result\([\s\S]*authenticated, service_role/,
    );
    expect(hardening).toContain("user_role.expires_at IS NULL OR user_role.expires_at > clock_timestamp()");
    expect(hardening).toContain("zero attachments are allowed only for explicit EAD BASIC_MESSAGE mode");
    expect(hardening).toContain("EAD attachments require explicit PACKAGE_WITH_ATTACHMENTS mode");
    expect(hardening).toContain("EAD completed e-archive hash differs from the exact message/package hash");
  });

  it("rejects expired operators, substituted DOCX binaries and mismatched EAD archive callbacks", () => {
    expect(hardening).toContain(
      "user_role.expires_at IS NULL OR user_role.expires_at > clock_timestamp()",
    );
    expect(hardening).toContain(
      "final DOCX differs from its authoritative precommitted candidate",
    );
    expect(hardening).toContain(
      "EAD callback archive hash differs from the exact message/package hash",
    );
    expect(probe).toContain("v_expired_role_blocked");
    expect(probe).toContain("v_substitution_blocked");
    expect(probe).toContain("v_archive_hash_blocked");
    expect(probe).toContain("v_callback_archive_hash_blocked");
    expect(probe).toContain("v_basic_atomic_communication_id");
    expect(probe).toContain("la RPC atómica no admitió mensajería EAD BASIC_MESSAGE sin adjuntos");
  });

  it("ships a rollback-only behavioral probe for stable idempotency, stale-token rejection and expired leases", () => {
    expect(probe).toContain("BEGIN;");
    expect(probe).toContain("ROLLBACK;");
    expect(probe).toContain("v_second_claim.provider_idempotency_key = v_first_claim.provider_idempotency_key");
    expect(probe).toContain("v_ok IS FALSE");
    expect(probe).toContain("dispatch_lease_expires_at = now() - interval '1 second'");
    expect(probe).toContain("RECONCILIATION_REQUIRED");
    expect(probe).not.toMatch(/\bCOMMIT\b/);
  });
});
