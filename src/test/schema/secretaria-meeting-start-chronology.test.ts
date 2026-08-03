import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720146000_secretaria_meeting_start_chronology.sql",
  ),
  "utf8",
);
const hook = readFileSync(
  resolve(process.cwd(), "src/hooks/useReunionSecretaria.ts"),
  "utf8",
);
const stepper = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ReunionStepper.tsx"),
  "utf8",
);

function sqlFunction(name: string): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const body = migration.indexOf("AS $function$", start);
  const end = migration.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return migration.slice(start, end + "$function$;".length);
}

describe("authoritative meeting opening chronology", () => {
  it("derives and locks scope, then enforces auth, tenant and an active role", () => {
    const rpc = sqlFunction("fn_secretaria_open_meeting");

    expect(rpc).toContain("SECURITY DEFINER");
    expect(rpc).toContain("FOR UPDATE OF meeting");
    expect(rpc).toMatch(/JOIN public\.governing_bodies body[\s\S]*body\.tenant_id = meeting\.tenant_id/);
    expect(rpc).toMatch(/JOIN public\.entities entity[\s\S]*entity\.tenant_id = meeting\.tenant_id/);
    expect(rpc).toContain("auth.uid() IS NULL");
    expect(rpc).toContain("fn_assert_current_tenant_id() IS DISTINCT FROM v_meeting.tenant_id");
    expect(rpc).toContain("ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]");
  });

  it("takes the shared advisory and meeting lock but only reads convocatoria", () => {
    const rpc = sqlFunction("fn_secretaria_open_meeting");
    const guard = sqlFunction("fn_secretaria_guard_meeting_open_transition");
    const preflightIndex = rpc.indexOf("INTO v_meeting_probe");
    const advisoryIndex = rpc.indexOf("pg_advisory_xact_lock", preflightIndex);
    const meetingLockIndex = rpc.indexOf("INTO v_meeting\n", advisoryIndex);
    const lockedSourceRevalidationIndex = rpc.indexOf(
      "v_locked_source_convocatoria_id :=",
      meetingLockIndex,
    );
    const convocationReadIndex = rpc.indexOf(
      "SELECT * INTO v_source_convocatoria",
      lockedSourceRevalidationIndex,
    );

    expect(preflightIndex).toBeGreaterThanOrEqual(0);
    expect(advisoryIndex).toBeGreaterThan(preflightIndex);
    expect(meetingLockIndex).toBeGreaterThan(advisoryIndex);
    expect(lockedSourceRevalidationIndex).toBeGreaterThan(meetingLockIndex);
    expect(convocationReadIndex).toBeGreaterThan(lockedSourceRevalidationIndex);
    expect(rpc.slice(preflightIndex, advisoryIndex)).not.toContain("FOR UPDATE OF meeting");
    expect(rpc.slice(meetingLockIndex, lockedSourceRevalidationIndex)).toContain(
      "FOR UPDATE OF meeting",
    );
    const convocationRead = rpc.slice(
      convocationReadIndex,
      rpc.indexOf("IF NOT FOUND", convocationReadIndex),
    );
    expect(convocationRead).not.toContain("FOR UPDATE");
    expect(convocationRead).not.toContain("FOR SHARE");
    expect(rpc).toContain("'COMMUNICATION:CONVOCATORIA:' || v_lock_tenant_id::text");
    expect(rpc).toContain("MEETING_OPEN_CONVOCATION_CHANGED_WHILE_LOCKING");
    expect(rpc.match(/fn_secretaria_assert_role_allowed\(/g)).toHaveLength(2);
    expect(guard).not.toContain("FOR SHARE");
  });

  it("resolves one source-bound convocatoria and fails closed on conflicting traces", () => {
    const resolver = sqlFunction(
      "fn_secretaria_bound_convocation_id_for_meeting",
    );

    expect(resolver).toContain("SECURITY DEFINER");
    expect(resolver).toContain("fn_assert_current_tenant_id() IS DISTINCT FROM p_tenant_id");
    expect(resolver).toContain("MEETING_CONVOCATION_BINDING_TRACE_MISMATCH");
    expect(resolver).toContain("count(DISTINCT item.source_convocatoria_id)");
    expect(resolver).toContain("MEETING_CONVOCATION_BINDING_MULTIPLE_AGENDA_SOURCES");
    expect(resolver).toContain("MEETING_CONVOCATION_BINDING_AGENDA_MISMATCH");
  });

  it("rejects an early or incoherently scheduled opening before the update", () => {
    const rpc = sqlFunction("fn_secretaria_open_meeting");
    const updateIndex = rpc.indexOf("UPDATE public.meetings");

    expect(rpc).toMatch(/scheduled_end < v_meeting\.scheduled_start/);
    expect(rpc).toContain("v_meeting.scheduled_start > now()");
    expect(rpc).toContain("MEETING_OPEN_TOO_EARLY");
    expect(rpc.indexOf("MEETING_OPEN_TOO_EARLY")).toBeLessThan(updateIndex);
    expect(rpc).toContain("status IN ('DRAFT', 'CONVOCADA')");
    expect(rpc).toContain("AND scheduled_start <= now()");
  });

  it("allows ordinary INSERT only in DRAFT and rejects terminal/open/unknown initial states", () => {
    const guard = sqlFunction("fn_secretaria_guard_meeting_open_transition");
    const insertGuard = guard.slice(
      guard.indexOf("IF TG_OP = 'INSERT'"),
      guard.indexOf("-- Una vez abierta"),
    );
    const directInsertAllowed = (status: string) => status === "DRAFT";

    expect(insertGuard).toContain("TG_OP = 'INSERT'");
    expect(insertGuard).toMatch(
      /IF NEW\.status = 'DRAFT' THEN\s+RETURN NEW;\s+END IF;/,
    );
    expect(insertGuard).toContain("MEETING_INITIAL_STATE_REQUIRED");
    expect(insertGuard).not.toMatch(
      /NEW\.status\s*=\s*'(?:EN_CURSO|CELEBRADA|CANCELADA)'/,
    );
    expect(directInsertAllowed("DRAFT")).toBe(true);
    for (const forbidden of ["EN_CURSO", "CELEBRADA", "CANCELADA", "CONVOCADA_DIRECTA", "OTRO"]) {
      expect(directInsertAllowed(forbidden), forbidden).toBe(false);
    }
  });

  it("preserves only the source-bound CONVOCADA insert made by the accredited RPC", () => {
    const guard = sqlFunction("fn_secretaria_guard_meeting_open_transition");

    expect(guard).toContain("NEW.status = 'CONVOCADA' AND current_user = 'postgres'");
    expect(guard).toContain("v_convocation_insert_accredited IS TRUE");
    expect(guard).toContain("convocatoria.estado = 'EMITIDA'");
    expect(guard).toContain("convocatoria.immutable_at IS NOT NULL");
    expect(guard).toContain("NEW.scheduled_start IS NOT DISTINCT FROM convocatoria.fecha_1");
    expect(guard).toContain("NEW.quorum_data #>> '{source_links,convocatoria_id}' = convocatoria.id::text");
  });

  it("blocks direct UPDATE to EN_CURSO, including a same-query date rewrite", () => {
    const guard = sqlFunction("fn_secretaria_guard_meeting_open_transition");

    expect(guard).toContain("NEW.status = 'EN_CURSO'");
    expect(guard).toContain("NEW.scheduled_start > now()");
    expect(guard).toContain("current_user <> 'postgres'");
    expect(guard).toContain("app.secretaria_open_meeting_rpc");
    expect(guard).toContain("MEETING_OPEN_RPC_REQUIRED");
    expect(migration).toMatch(/BEFORE INSERT ON public\.meetings/);
    expect(migration).toMatch(
      /BEFORE UPDATE OF status, scheduled_start, scheduled_end, tenant_id, body_id, slug, quorum_data\s+ON public\.meetings/,
    );
  });

  it("blocks update-date-to-past then open for a source-bound CONVOCADA meeting", () => {
    const guard = sqlFunction("fn_secretaria_guard_meeting_open_transition");
    const rpc = sqlFunction("fn_secretaria_open_meeting");

    expect(guard).toContain("IF v_source_convocatoria_id IS NOT NULL THEN");
    expect(guard).toContain("CONVOCADA -> DRAFT");
    expect(guard).toContain(
      "NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start",
    );
    expect(guard).toContain(
      "MEETING_CONVOCATION_BINDING_IMMUTABLE",
    );
    expect(guard).toContain(
      "NEW.scheduled_start IS DISTINCT FROM v_bound_convocatoria.fecha_1",
    );
    expect(guard).toContain(
      "NEW.scheduled_end IS DISTINCT FROM v_bound_convocatoria.fecha_1 + interval '2 hours'",
    );
    expect(guard).toContain(
      "NEW.quorum_data #> '{source_links,convocatoria_ids}' IS DISTINCT FROM jsonb_build_array(v_bound_convocatoria.id)",
    );

    expect(rpc).toContain(
      "fn_secretaria_bound_convocation_id_for_meeting(",
    );
    const convocationReadIndex = rpc.indexOf(
      "SELECT * INTO v_source_convocatoria",
    );
    const convocationRead = rpc.slice(
      convocationReadIndex,
      rpc.indexOf("IF NOT FOUND", convocationReadIndex),
    );
    expect(convocationRead).not.toContain("FOR UPDATE");
    expect(convocationRead).not.toContain("FOR SHARE");
    expect(rpc).toContain(
      "v_source_convocatoria.estado IS DISTINCT FROM 'EMITIDA'",
    );
    expect(rpc).toContain(
      "v_meeting.scheduled_start IS DISTINCT FROM v_source_convocatoria.fecha_1",
    );
    expect(rpc).toContain(
      "v_meeting.scheduled_end IS DISTINCT FROM v_source_convocatoria.fecha_1 + interval '2 hours'",
    );
    expect(rpc).toContain(
      "v_meeting.quorum_data #>> '{scheduled_from,estado_convocatoria}' IS DISTINCT FROM 'EMITIDA'",
    );
    expect(rpc).toContain("MEETING_OPEN_CONVOCATION_BINDING_INVALID");
  });

  it("makes the planned schedule immutable after a meeting has opened", () => {
    const guard = sqlFunction("fn_secretaria_guard_meeting_open_transition");

    expect(guard).toContain("OLD.status = 'EN_CURSO'");
    expect(guard).toContain(
      "NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start",
    );
    expect(guard).toContain(
      "NEW.scheduled_end IS DISTINCT FROM OLD.scheduled_end",
    );
    expect(guard).toContain("MEETING_OPEN_SCHEDULE_IMMUTABLE");
  });

  it("exposes only the governed RPC to authenticated operators", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_open_meeting\(uuid\)[\s\S]*FROM PUBLIC, anon/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_secretaria_open_meeting\(uuid\)[\s\S]*TO authenticated, service_role/,
    );
  });

  it("uses the RPC from the hook and removes the direct status update", () => {
    const start = hook.indexOf("export function useOpenMeeting");
    const end = hook.indexOf("export function useReplaceAttendees", start);
    const openHook = hook.slice(start, end);

    expect(openHook).toContain('supabase.rpc("fn_secretaria_open_meeting"');
    expect(openHook).toContain("p_meeting_id: meetingId");
    expect(openHook).not.toContain('.from("meetings")');
    expect(openHook).not.toContain('.update({ status: "EN_CURSO" })');
  });

  it("disables and explains the action in the stepper before scheduled_start", () => {
    expect(stepper).toContain("getMeetingOpeningAvailability(");
    expect(stepper).toContain("!openingAvailability.allowed");
    expect(stepper).toContain("aria-describedby={!openingAvailability.allowed ? openingHelpId : undefined}");
    expect(stepper).toContain("role=\"status\"");
    expect(stepper).toContain("disabled={openMeeting.isPending || !openingAvailability.allowed}");
    expect(stepper).toContain("focus-visible:ring-[var(--g-brand-3308)]");
  });
});
