import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720127000_secretaria_future_demo_chronology_quarantine.sql",
  ),
  "utf8",
);

describe("future demo chronology quarantine", () => {
  it("is strictly scoped to the demo tenant, canonical ARGA entity and fixed control date", () => {
    expect(sql).toContain("'00000000-0000-0000-0000-000000000001'::uuid");
    expect(sql).toContain("'6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid");
    expect(sql).toContain("DATE '2026-07-20'");
    expect(sql).toContain("meeting.created_at < TIMESTAMPTZ '2026-07-20 00:00:00+02'");
    expect(
      sql.match(/meeting\.created_at < TIMESTAMPTZ '2026-07-20 00:00:00\+02'/g),
    ).toHaveLength(8);
    expect(sql).toContain("timezone('Europe/Madrid', meeting.scheduled_start)::date");
    expect(sql).toMatch(/JOIN public\.governing_bodies body[\s\S]*body\.entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'::uuid/);
  });

  it("keeps an immutable, idempotent WORM witness before changing projections", () => {
    const witnessInsert = sql.indexOf("INSERT INTO public.secretaria_demo_simulation_quarantine");
    const firstDomainUpdate = sql.indexOf("UPDATE public.certifications");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.secretaria_demo_simulation_quarantine");
    expect(sql).toContain("FUTURE_EVENT_IMPOSSIBLE_CHRONOLOGY");
    expect(sql).toContain("DEMO_SIMULATION_NO_LEGAL_EFFECT");
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.secretaria_demo_simulation_quarantine/);
    expect(sql).toMatch(/AFTER INSERT ON public\.secretaria_demo_simulation_quarantine/);
    expect(sql).toContain("EXECUTE FUNCTION public.fn_audit_worm()");
    expect(sql).toMatch(/ON CONFLICT \(tenant_id, entity_id, meeting_id, control_date, reason_code\)[\s\S]*DO NOTHING/);
    expect(witnessInsert).toBeGreaterThan(0);
    expect(firstDomainUpdate).toBeGreaterThan(witnessInsert);
  });

  it("returns future meetings only to a legally possible pre-session state", () => {
    expect(sql).toContain("original_meeting_status IN ('EN_CURSO', 'CELEBRADA')");
    expect(sql).toContain("THEN 'CONVOCADA'");
    expect(sql).toContain("ELSE 'DRAFT'");
    expect(sql).toMatch(/convocation\.estado = 'EMITIDA'[\s\S]*convocation\.immutable_at IS NOT NULL/);
    expect(sql).toMatch(/convocation\.body_id = meeting_scope\.body_id/);
    expect(sql).toMatch(/convocation\.fecha_1[\s\S]*scoped\.scheduled_start/);
    expect(sql).toMatch(/UPDATE public\.meetings meeting[\s\S]*meeting\.status IN \('EN_CURSO', 'CELEBRADA'\)/);
  });

  it("preserves signed projections in WORM and then neutralizes their legal presentation", () => {
    expect(sql).toContain("'signed_at', minute.signed_at");
    expect(sql).toContain("'is_locked', minute.is_locked");
    expect(sql).toContain("'signature_status', certification.signature_status");
    expect(sql).toContain("'emitted_at', certification.emitted_at");
    expect(sql).toMatch(/UPDATE public\.minutes minute[\s\S]*legal_gate_status = 'DEMO_SIMULATION'/);
    expect(sql).toMatch(/UPDATE public\.certifications certification[\s\S]*legal_gate_status = 'DEMO_SIMULATION'/);
    expect(sql).toMatch(/SET legal_gate_status = 'DEMO_SIMULATION',[\s\S]*signature_status = 'PENDING',[\s\S]*emitted_at = NULL/);
    expect(sql).toMatch(/SET legal_gate_status = 'DEMO_SIMULATION',[\s\S]*signed_at = NULL,[\s\S]*is_locked = false,[\s\S]*approval_effective_at = NULL/);
    expect(sql).toMatch(/book_destination_status = CASE[\s\S]*THEN 'LEGACY_REVIEW'/);
    expect(sql).toMatch(/UPDATE public\.meeting_resolutions resolution[\s\S]*SET status = 'DRAFT'/);
    expect(sql).toMatch(/UPDATE public\.agreements agreement[\s\S]*SET status = 'PROPOSED'/);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/SET\s+(content|hash_sha512)\s*=/i);
  });

  it("uses a transaction-scoped exception only for the exact immutable-domain triggers", () => {
    expect(sql).toMatch(/ALTER TABLE public\.certifications[\s\S]*DISABLE TRIGGER trg_certifications_authoritative_domain_guard/);
    expect(sql).toMatch(/ALTER TABLE public\.certifications[\s\S]*ENABLE TRIGGER trg_certifications_authoritative_domain_guard/);
    expect(sql).toMatch(/ALTER TABLE public\.minutes[\s\S]*DISABLE TRIGGER trg_minutes_authoritative_domain_guard/);
    expect(sql).toMatch(/ALTER TABLE public\.minutes[\s\S]*ENABLE TRIGGER trg_minutes_authoritative_domain_guard/);
    expect(sql).toMatch(/ALTER TABLE public\.minutes[\s\S]*DISABLE TRIGGER trg_minutes_lock_guard/);
    expect(sql).toMatch(/ALTER TABLE public\.minutes[\s\S]*ENABLE TRIGGER trg_minutes_lock_guard/);
    expect(sql).not.toContain("session_replication_role");
    expect(sql).not.toContain("DISABLE TRIGGER ALL");
  });

  it("never fabricates provider delivery, signing or archive evidence", () => {
    expect(sql).not.toMatch(/provider_reference|provider_completed_at|delivery_evidence|earchive_hash|evidence_bundle_id/i);
    expect(sql).not.toMatch(/INSERT INTO public\.(qtsp_signature_requests|secretaria_legal_artifacts|secretaria_qtsp_verifications|evidence_bundles)/i);
    expect(sql).not.toMatch(/UPDATE public\.convocatorias/i);
  });

  it("fails closed if any future legal projection or WORM marker remains inconsistent", () => {
    expect(sql).toContain("v_illegal_meetings");
    expect(sql).toContain("v_non_demo_minutes");
    expect(sql).toContain("v_non_demo_certifications");
    expect(sql).toContain("v_projected_signed_minutes");
    expect(sql).toContain("v_projected_signed_certifications");
    expect(sql).toContain("minute.signed_at IS NOT NULL");
    expect(sql).toContain("certification.signature_status IS DISTINCT FROM 'PENDING'");
    expect(sql).toContain("v_adopted_resolutions");
    expect(sql).toContain("v_adopted_agreements");
    expect(sql).toContain("v_missing_worm_markers");
    expect(sql).toContain("future demo chronology quarantine failed");
    expect(sql).toContain("audit.hash_sha512 ~ '^[0-9a-f]{128}$'");
  });
});
