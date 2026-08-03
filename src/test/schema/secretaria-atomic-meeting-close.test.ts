import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720126000_secretaria_atomic_meeting_close_minute.sql",
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

function rpc(name: string): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const body = migration.indexOf("AS $function$", start);
  const end = migration.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return migration.slice(start, end + "$function$;".length);
}

describe("atomic meeting close and authoritative minute", () => {
  it("serializes and scopes the operation using server-derived entity and body", () => {
    const close = rpc("fn_secretaria_close_meeting_and_generate_minute");

    expect(close).toContain("SECURITY DEFINER");
    expect(close).toContain("FOR UPDATE OF meeting");
    expect(close).toMatch(/JOIN public\.governing_bodies body[\s\S]*body\.tenant_id = meeting\.tenant_id/);
    expect(close).toMatch(/JOIN public\.entities entity[\s\S]*entity\.tenant_id = meeting\.tenant_id/);
    expect(close).toContain("v_meeting.resolved_entity_id");
    expect(close).toContain("v_meeting.body_id");
    expect(close).not.toMatch(/p_entity_id|p_body_id|p_snapshot_type/);
  });

  it("applies tenant and role guards and allows only an open session to close", () => {
    const close = rpc("fn_secretaria_close_meeting_and_generate_minute");

    expect(close).toContain("fn_secretaria_is_service_role() IS NOT TRUE");
    expect(close).toContain("fn_assert_current_tenant_id() <> v_meeting.tenant_id");
    expect(close).toContain("ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]");
    expect(close).toContain("v_meeting.status <> 'EN_CURSO'");
    expect(close).toContain("SET status = 'CELEBRADA'");
    expect(close).toContain("AND status = 'EN_CURSO'");
  });

  it("blocks future or still-open sessions both before and inside the existing minute engine", () => {
    const close = rpc("fn_secretaria_close_meeting_and_generate_minute");

    expect(close).toMatch(/scheduled_start > now\(\)[\s\S]*scheduled_end > now\(\)/);
    expect(close).toContain("a future or still-open meeting cannot be closed or produce legal minutes");
    expect(close).toContain("public.fn_generar_acta(");
  });

  it("orders close, WORM snapshot and minute generation in one server function", () => {
    const close = rpc("fn_secretaria_close_meeting_and_generate_minute");
    const statusIndex = close.indexOf("SET status = 'CELEBRADA'");
    const snapshotIndex = close.indexOf("public.fn_crear_censo_snapshot(");
    const minuteIndex = close.indexOf("public.fn_generar_acta(");

    expect(statusIndex).toBeGreaterThan(0);
    expect(snapshotIndex).toBeGreaterThan(statusIndex);
    expect(minuteIndex).toBeGreaterThan(snapshotIndex);
    expect(close).toContain("snapshot.audit_worm_id");
    expect(close).toContain("audit.hash_sha512 ~ '^[0-9a-f]{128}$'");
  });

  it("is idempotent only for an intact authoritative minute", () => {
    const close = rpc("fn_secretaria_close_meeting_and_generate_minute");

    expect(close).toContain("IF FOUND THEN");
    expect(close).toContain("v_meeting.status <> 'CELEBRADA'");
    expect(close).toContain("'MANIFEST_READY', 'ARTIFACT_FINAL', 'APPROVED_SIGNED'");
    expect(close).toContain("RETURN v_existing.id");
    expect(close.indexOf("RETURN v_existing.id")).toBeLessThan(
      close.indexOf("SET status = 'CELEBRADA'"),
    );
  });

  it("prevents direct client transition and direct authenticated minute generation", () => {
    const guard = rpc("fn_secretaria_guard_atomic_meeting_close");

    expect(guard).toContain("current_user <> 'postgres'");
    expect(guard).toContain("app.secretaria_atomic_close_rpc");
    expect(guard).toContain("ATOMIC_MEETING_CLOSE_REQUIRED");
    expect(migration).toMatch(/BEFORE UPDATE OF status ON public\.meetings/);
    expect(migration).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.fn_generar_acta\(uuid, text, uuid, text\)[\s\S]*FROM authenticated/,
    );
  });

  it("uses only the atomic RPC from the stepper and has no best-effort close", () => {
    expect(hook).toContain('supabase.rpc("fn_secretaria_close_meeting_and_generate_minute"');
    expect(hook).not.toContain('supabase.rpc("fn_crear_censo_snapshot"');
    expect(hook).not.toContain('supabase.rpc("fn_generar_acta"');
    expect(stepper).not.toContain("useCloseMeeting");
    expect(stepper).not.toContain("closeMeeting.mutateAsync");
    expect(stepper).not.toContain("Best-effort");
    expect(stepper).toContain("Reunión cerrada y acta generada en una única operación");
  });
});
