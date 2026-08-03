import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read(
  "supabase/migrations/20260720148000_secretaria_ead_interposition_system_policy.sql",
);
const hook = read("src/hooks/useERDSNotification.ts");
const detail = read("src/pages/secretaria/AcuerdoSinSesionDetalle.tsx");

describe("EAD_INTERPOSITION system policy", () => {
  it("exposes one governed, authenticated and tenant-scoped draft RPC", () => {
    expect(
      migration.match(/CREATE OR REPLACE FUNCTION public\.fn_create_ead_interposition_draft/g),
    ).toHaveLength(1);
    expect(migration).toContain("public.fn_assert_current_tenant_id() <> v_tenant_id");
    expect(migration).toContain("public.fn_secretaria_assert_communication_operator(v_tenant_id)");
    expect(migration).toContain("EAD_INTERPOSITION_DRAFT_REQUIRES_AUTHENTICATED_HUMAN");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_create_ead_interposition_draft\(jsonb, jsonb\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role;/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_create_ead_interposition_draft\(jsonb, jsonb\)[\s\S]*TO authenticated;/,
    );
    expect(migration).not.toMatch(/TO anon/);
    expect(migration).not.toContain("00000000-0000-0000-0000-000000000001");
  });

  it("persists only a neutral, immutable and non-dispatchable draft", () => {
    expect(migration).toContain("trg_secretaria_guard_nonconvocation_ead_draft");
    expect(migration).toContain("{channel_semantics,requested_minimum}");
    expect(migration).toContain("NEW.metadata -> 'sandbox_only' IS DISTINCT FROM 'true'::jsonb");
    expect(migration).toContain("app.secretaria_ead_draft_rpc");
    expect(migration).toContain("EAD_INTERPOSITION_DRAFT_IS_IMMUTABLE_EXCEPT_GOVERNED_CANCEL");
    expect(migration).toContain("'EMAIL_NORMAL', 'EMAIL_NORMAL', NULL");
    expect(migration).toContain("'delivery_allowed', false");
    expect(migration).toContain("'provider_interaction', false");
    expect(migration).toContain("'signature_claim', false");
    expect(migration).toContain("'erds_claim', false");
    expect(migration).toContain("'provider_status', 'NOT_REQUESTED'");
    expect(migration).toContain("'earchive_status', 'NOT_REQUESTED'");
    expect(migration).toContain("UNVERIFIED_CERTIFIED_CHANNEL_IS_READ_ONLY_FOR_NEW_CAPTURES");
  });

  it("keeps recipient delivery facts impossible in the sandbox draft", () => {
    expect(migration).toContain("trg_secretaria_guard_ead_draft_recipient");
    expect(migration).toContain("NEW.estado_entrega <> 'PENDIENTE'");
    expect(migration).toContain("NEW.canal_usado IS NOT NULL");
    expect(migration).toContain("NEW.fecha_entrega IS NOT NULL");
    expect(migration).toContain("NEW.acuse_evidence_id IS NOT NULL");
    expect(migration).toContain("NEW.respuesta_firma_qes_id IS NOT NULL");
  });

  it("makes source retries idempotent without accepting divergent recipients", () => {
    expect(migration).toContain("EAD_INTERPOSITION_DRAFT:");
    expect(migration).toContain("EAD_INTERPOSITION_DRAFT_IDEMPOTENCY_CONFLICT");
    expect(migration).toContain("EXCEPT");
    expect(migration).toContain("EAD_INTERPOSITION_DRAFT_RECIPIENT_CENSUS_MISMATCH");
    expect(migration).toContain("EAD_INTERPOSITION_DRAFT_SOURCE_NOT_FOUND_OR_SCOPE_INVALID");
    expect(migration).toContain("EAD_INTERPOSITION_DRAFT_REQUIRES_OPEN_VOTING_WINDOW");
    expect(migration).toContain("EAD_INTERPOSITION_DRAFT_AUTHORITATIVE_CENSUS_EMAIL_MISSING");
    expect(migration).toContain("agreement.no_session_resolution_id = v_source_id");
    expect(migration).toContain("v_existing_communication.entity_id IS DISTINCT FROM v_entity_id");
  });

  it("derives organ, voting census and offices on the server", () => {
    expect(migration).toContain("v_organo_tipo := CASE");
    expect(migration).toContain("public.fn_crear_censo_snapshot(");
    expect(migration).toContain("FROM public.capital_holdings holding");
    expect(migration).toContain("v_effective_date := v_resolution.opened_at::date");
    expect(migration).toContain("snapshot.session_kind = 'NO_SESSION'");
    expect(migration).toContain("FROM jsonb_array_elements(v_authoritative_recipients) recipient");
    expect(hook).not.toContain("organoTipo");
    expect(hook).not.toContain("cargo_en_organo");
    expect(hook).toContain('sourceDomain: "NO_SESSION_RESOLUTION"');
    expect(detail).toContain("isOpenVotingWindow");
    expect(detail).toContain("recipientsWithoutEmail");
  });

  it("retires new ERDS captures and quarantines legacy pending rows", () => {
    expect(migration).toContain("UNVERIFIED_CERTIFIED_LEVEL_IS_READ_ONLY_FOR_NEW_CAPTURES");
    expect(migration).toContain("UNVERIFIED_CERTIFIED_RECIPIENT_IS_QUARANTINED_READ_ONLY");
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_claim_recipients_for_dispatch/);
    expect(migration).toContain("NOT IN ('EMAIL_CERTIFICADO', 'ERDS', 'BUROFAX_ERDS')");
    expect(migration).toContain("fn_has_ead_interposition_marker(");
  });

  it("routes convocation cancellation only through its authoritative lifecycle", () => {
    expect(migration).toContain("CONVOCATION_COMMUNICATION_REQUIRES_CONVOCATORIA_LIFECYCLE_RPC");
    expect(migration).toContain("NOT COALESCE(");
    expect(migration).toContain("fn_guard_governed_communication_cancel");
  });

  it("keeps the active no-session UI outside ERDS and provider execution", () => {
    expect(hook).toContain("useEADInterpositionCommunication");
    expect(hook).toContain("fn_create_ead_interposition_draft");
    expect(hook).not.toContain("useProgramCommunication");
    expect(hook).not.toContain("BUROFAX_ERDS");
    expect(detail).toContain("Interposición EAD y custodia documental");
    expect(detail).toContain("Registrar borrador EAD");
    expect(detail).toContain("no envía, no programa el dispatcher");
    expect(detail).not.toContain("Notificación certificada ERDS");
  });

  it("freezes the no-session source and derives its opening census server-side", () => {
    expect(migration).toContain("NO_SESSION_OPEN_REQUIRES_GOVERNED_RPC");
    expect(migration).toContain("NO_SESSION_OPEN_SOURCE_IS_IMMUTABLE");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.fn_create_no_session_resolution(");
    expect(migration).toContain("REVOKE ALL ON TABLE public.no_session_resolutions");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS open_idempotency_key uuid");
    expect(migration).toContain("ux_no_session_resolutions_tenant_open_idempotency");
    expect(migration).toContain("p_open_idempotency_key uuid");
    expect(migration).toContain("NO_SESSION_OPEN_CENSUS_COUNT_WORM_MISMATCH");
    expect(migration).toContain("jsonb_array_length(v_snapshot_payload) IS DISTINCT FROM v_member_count");
    expect(migration).toContain("v_snapshot_total_partes IS DISTINCT FROM v_member_count");
    expect(migration).toContain("v_audit_snapshot_payload IS DISTINCT FROM v_snapshot_payload");
    expect(migration).toContain("v_audit_snapshot_total_partes IS DISTINCT FROM v_member_count");
    expect(migration).toContain("audit.record_id = snapshot.id");
    expect(migration).toContain("audit.action = 'CENSO_SNAPSHOT_CREATED'");
    expect(migration).toContain("JOIN public.audit_log audit");
  });

  it("makes no-session opening strongly idempotent and rejects divergent reuse", () => {
    expect(migration).toMatch(
      /DROP FUNCTION IF EXISTS public\.fn_create_no_session_resolution\(\s*uuid, text, text, text, text, boolean, timestamptz\s*\);/,
    );
    expect(migration).toContain("'NO_SESSION_OPEN:' || v_body.tenant_id::text");
    expect(migration).toMatch(
      /resolution\.open_idempotency_key = p_open_idempotency_key[\s\S]*FOR UPDATE;/,
    );
    expect(migration).toContain("NO_SESSION_OPEN_IDEMPOTENCY_CONFLICT");
    expect(migration).toContain("NO_SESSION_OPEN_IDEMPOTENT_REUSE_REQUIRES_VALID_WORM_CENSUS");
    expect(migration).toContain("v_existing_resolution.voting_deadline IS DISTINCT FROM p_voting_deadline");
    expect(migration).toContain("RETURN v_existing_resolution.id");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_create_no_session_resolution\(\s*uuid, text, text, text, text, boolean, timestamptz, uuid\s*\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role;/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_create_no_session_resolution\(\s*uuid, text, text, text, text, boolean, timestamptz, uuid\s*\) TO authenticated;/,
    );
  });

  it("rebuilds no-session table access as RPC-only mutation and exact-tenant read", () => {
    expect(migration).toContain(
      "ALTER TABLE public.no_session_resolutions ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "policy.polrelid = 'public.no_session_resolutions'::regclass",
    );
    expect(migration).toContain("CREATE POLICY no_session_resolutions_authenticated_select");
    expect(migration).toMatch(
      /FOR SELECT TO authenticated[\s\S]*auth\.uid\(\) IS NOT NULL[\s\S]*tenant_id = public\.fn_current_tenant_id\(\)/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.no_session_resolutions\s+FROM PUBLIC, anon, authenticated, service_role;/,
    );
    expect(migration).toContain(
      "GRANT SELECT ON TABLE public.no_session_resolutions TO authenticated",
    );
    expect(migration).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.no_session_resolutions",
    );
    expect(migration).not.toContain("CREATE POLICY no_session_resolutions_insert");
  });

  it("blocks external fact aliases and pre-deploy leases", () => {
    for (const key of [
      "provider_event_id",
      "provider_message_id",
      "provider_callback_event_id",
      "provider_contract_evidence",
      "earchive_evidence_id",
      "earchive_archived_at",
      "signature_fact_at",
      "signature_fact_source",
    ]) {
      expect(migration).toContain(`'${key}'`);
    }
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_revalidate_recipient_dispatch_attempt(",
    );
    expect(migration).toContain("EAD_INTERPOSITION_DRAFT_SOURCE_CONTENT_MISMATCH");
  });

  it("serializes EAD idempotency with cancellation without recipient lock inversion", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.fn_cancel_communication[\s\S]*DECLARE[\s\S]*v_source_domain text;[\s\S]*v_source_id text;/,
    );
    expect(migration).toContain("EAD_INTERPOSITION_DRAFT_SOURCE_ALREADY_CANCELLED");
    expect(migration).toMatch(
      /SELECT communication\.\* INTO v_existing_communication[\s\S]*LIMIT 1\s+FOR UPDATE;/,
    );
    const cancel = migration.split("CREATE OR REPLACE FUNCTION public.fn_cancel_communication")[1] ?? "";
    expect(cancel).not.toContain("FOR UPDATE OF recipient");
  });
});
