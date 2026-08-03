import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720141000_secretaria_atomic_meeting_and_ead_sandbox_gates.sql",
  ),
  "utf8",
);

function sqlFunction(name: string) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const body = migration.indexOf("AS $function$", start);
  const end = migration.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return migration.slice(start, end + "$function$;".length);
}

describe("Secretaría — reunión + agenda atómicas y sandbox EAD", () => {
  it("crea o reutiliza la reunión y materializa la agenda en la misma RPC", () => {
    const rpc = sqlFunction(
      "fn_secretaria_create_or_reuse_meeting_from_convocation",
    );
    expect(rpc).toContain("pg_advisory_xact_lock");
    expect(rpc).toContain("FOR UPDATE");
    expect(rpc).toContain("INSERT INTO public.meetings");
    expect(rpc).toContain("fn_secretaria_materialize_convocation_agenda(");
    expect(rpc).toContain("v_materialization :=");
    expect(rpc).toContain("'reused', v_reused");
    expect(rpc).toContain("'materialized_items', v_materialization -> 'materialized_items'");
  });

  it("exige fecha futura e igualdad timestamptz exacta, no una comparación por día", () => {
    const rpc = sqlFunction(
      "fn_secretaria_create_or_reuse_meeting_from_convocation",
    );
    expect(rpc).toContain("v_convocatoria.fecha_1 <= now()");
    expect(rpc).toContain(
      "v_meeting.scheduled_start IS DISTINCT FROM v_convocatoria.fecha_1",
    );
    expect(rpc).toContain("meeting.scheduled_start IS NOT DISTINCT FROM v_convocatoria.fecha_1");
    expect(rpc).not.toContain("v_convocatoria.fecha_1::date <> v_meeting.scheduled_start::date");
    expect(rpc).not.toContain("date_trunc(");
  });

  it("falla cerrado ante vínculos múltiples o candidatos legacy ambiguos", () => {
    const rpc = sqlFunction(
      "fn_secretaria_create_or_reuse_meeting_from_convocation",
    );
    expect(rpc).toContain("v_candidate_count > 1");
    expect(rpc).toContain("convocatoria is linked to more than one meeting");
    expect(rpc).toContain("more than one unbound meeting exists at the exact convocatoria timestamp");
    expect(rpc).toContain("item.source_convocatoria_id IS NOT NULL");
  });

  it("fuerza el sandbox EAD a BORRADOR sin fechas ni promoción al dispatcher", () => {
    const rpc = sqlFunction("fn_create_communication_atomic");
    expect(rpc).toContain("v_is_ead_sandbox");
    expect(rpc).toContain("v_requested_state <> 'BORRADOR'");
    expect(rpc).toContain("NULLIF(p_comm ->> 'fecha_programada', '') IS NOT NULL");
    expect(rpc).toContain("WHEN v_is_ead_sandbox THEN NULL");
    expect(rpc).toContain("v_requested_state = 'PROGRAMADA' AND NOT v_is_ead_sandbox");
    expect(rpc).toContain("'dispatch_allowed', false");
    expect(rpc).toContain("'dispatcher_triggered', false");
  });

  it("impone EAD_INTERPOSITION y los tres servicios sin claims ni proveedor", () => {
    const rpc = sqlFunction("fn_create_communication_atomic");
    expect(rpc).toContain("'mode', 'EAD_INTERPOSITION'");
    expect(rpc).toContain(
      "jsonb_build_array('BASIC_MESSAGING', 'CUSTODY', 'EARCHIVING')",
    );
    expect(rpc).toContain("'delivery_allowed', false");
    expect(rpc).toContain("'provider_interaction', false");
    expect(rpc).toContain("'signature_claim', false");
    expect(rpc).toContain("'erds_claim', false");
    expect(rpc).toContain("'provider_contract_evidence', NULL");
    expect(rpc).toContain("fn_secretaria_jsonb_has_forbidden_signature_claim");
    expect(rpc).toContain("EAD sandbox metadata contradicts");
    expect(rpc).toContain("recipient ->> 'canal_primario' = 'BUROFAX_ERDS'");
  });

  it("impide que una actualización posterior promocione el borrador sandbox", () => {
    const guard = sqlFunction("fn_secretaria_guard_ead_sandbox_communication");
    expect(guard).toContain("NEW.estado <> 'BORRADOR'");
    expect(guard).toContain("NEW.fecha_programada IS NOT NULL");
    expect(guard).toContain("NEW.fecha_envio_efectiva IS NOT NULL");
    expect(guard).toContain("NEW.fecha_limite_respuesta IS NOT NULL");
    expect(guard).toContain("NEW.metadata -> 'dispatcher_triggered'");
    expect(guard).toContain("NEW.metadata #> '{ead_service,signature_claim}'");
    expect(migration).toMatch(
      /CREATE TRIGGER trg_secretaria_guard_ead_sandbox_communication\s+BEFORE INSERT OR UPDATE ON public\.communications/,
    );
  });

  it("expone solo las dos RPC de producto a roles autenticados", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_create_or_reuse_meeting_from_convocation\(uuid\)[\s\S]*?FROM PUBLIC, anon;/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_secretaria_create_or_reuse_meeting_from_convocation\(uuid\)[\s\S]*?TO authenticated, service_role;/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_create_communication_atomic\(jsonb, jsonb, jsonb\)[\s\S]*?FROM PUBLIC, anon;/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_materialize_convocation_agenda\(uuid, uuid\)[\s\S]*?FROM PUBLIC, anon, authenticated;/,
    );
    expect(migration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_secretaria_materialize_convocation_agenda\(uuid, uuid\)\s+TO authenticated/,
    );
  });
});
