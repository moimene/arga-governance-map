import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720122100_secretaria_convocation_agenda_binding_backfill.sql",
  ),
  "utf8",
);

const hook = readFileSync(
  resolve(process.cwd(), "src/hooks/useReunionSecretaria.ts"),
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

describe("Secretaría — binding convocatoria a agenda", () => {
  it("persiste origen y hash canónico completos, nunca un binding parcial", () => {
    expect(migration).not.toMatch(/(?<!extensions\.)digest\(/);
    expect(migration).toContain("source_convocatoria_id uuid");
    expect(migration).toContain("source_convocatoria_item_index integer");
    expect(migration).toContain("source_item_hash_sha256 text");
    expect(migration).toContain("agenda_items_convocation_source_binding_complete");
    expect(migration).toMatch(/source_item_hash_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
    expect(migration).toContain("ux_agenda_items_convocation_source_item");
  });

  it("define una única forma canónica con los seis hechos de la convocatoria", () => {
    const canonical = sqlFunction("fn_secretaria_convocation_agenda_item_canonical");
    expect(canonical).toContain("'title', btrim(p_item ->> 'titulo')");
    expect(canonical).toContain("'matter_code', NULLIF(btrim(p_item ->> 'materia'), '')");
    expect(canonical).toContain("'kind', upper(");
    expect(canonical).toContain("'decision_subtype'");
    expect(canonical).toContain("'proposal_text', NULLIF(btrim(p_item ->> 'propuesta_acuerdo'), '')");
    expect(canonical).toContain("= 'FORMULACION_CUENTAS'");
    expect(canonical).toContain("'requires_attachments'");
  });

  it("congela agenda y texto al sellar una convocatoria emitida", () => {
    const guard = sqlFunction("fn_convocatoria_immutable_guard");
    expect(guard).toContain("TG_OP = 'DELETE'");
    expect(guard).toContain("CONVOCATORIA_EMITIDA_DELETE_FORBIDDEN");
    expect(guard).toContain("RETURN OLD");
    expect(guard).toContain("OLD.immutable_at IS NOT NULL");
    expect(guard).toContain("CONVOCATORIA_EMITIDA_STATUS_TRANSITION_FORBIDDEN");
    expect(guard).toContain("NEW.estado NOT IN ('CANCELADA', 'RECTIFICADA')");
    expect(guard).toContain("CONVOCATORIA_IMMUTABLE_SEAL_SERVER_ASSIGNED");
    expect(guard).toContain("ELSIF TG_OP = 'UPDATE' AND OLD.immutable_at IS NULL");
    expect(guard).toContain("NEW.tenant_id IS DISTINCT FROM OLD.tenant_id");
    expect(guard).toContain("NEW.agenda_items IS DISTINCT FROM OLD.agenda_items");
    expect(guard).toContain("NEW.convocatoria_text IS DISTINCT FROM OLD.convocatoria_text");
    expect(guard).toContain("NEW.statutory_basis IS DISTINCT FROM OLD.statutory_basis");
    expect(migration).toMatch(
      /CREATE TRIGGER trg_convocatoria_immutable\s+BEFORE INSERT OR UPDATE OR DELETE ON public\.convocatorias/i,
    );
  });

  it("reserva todo DML de agenda emitida a la RPC y prohíbe DELETE incluso al owner", () => {
    const directDmlGuard = sqlFunction("fn_secretaria_guard_emitted_agenda_dml");
    expect(directDmlGuard).toMatch(/SECURITY INVOKER/i);
    expect(directDmlGuard).toContain("OLD.source_convocatoria_id::text");
    expect(directDmlGuard).toContain("'{agenda_binding,convocatoria_id}'");
    expect(directDmlGuard).toContain("convocatoria.immutable_at IS NOT NULL");
    expect(directDmlGuard).toContain("AGENDA_EMITIDA_DELETE_FORBIDDEN");
    expect(directDmlGuard).toContain(
      "pg_catalog.to_regprocedure(\n     'public.fn_secretaria_materialize_convocation_agenda(uuid,uuid)'",
    );
    expect(directDmlGuard).toContain("current_user IS DISTINCT FROM v_rpc_owner");
    expect(directDmlGuard).toContain("AGENDA_EMITIDA_RPC_REQUIRED");
    expect(migration).toMatch(
      /CREATE TRIGGER trg_secretaria_00_guard_emitted_agenda_dml\s+BEFORE INSERT OR UPDATE OR DELETE ON public\.agenda_items/i,
    );
  });

  it("verifica server-side el scope y rechaza cualquier divergencia posterior", () => {
    const guard = sqlFunction("fn_secretaria_guard_convocation_agenda_binding");
    expect(guard).toContain("v_convocatoria.estado <> 'EMITIDA'");
    expect(guard).toContain("v_convocatoria.immutable_at IS NULL");
    expect(guard).toContain("v_convocatoria.fecha_1::date <> v_meeting.scheduled_start::date");
    expect(guard).toContain("el punto celebrado diverge de la convocatoria inmutable");
    expect(guard).toContain("digest(v_canonical::text, 'sha256')");
    expect(migration).toContain("trg_secretaria_guard_convocation_agenda_binding");
  });

  it("materializa atómicamente todos los campos y exige propuesta en decisiones", () => {
    const rpc = sqlFunction("fn_secretaria_materialize_convocation_agenda");
    expect(rpc).toContain("fn_secretaria_assert_role_allowed(");
    expect(rpc).toContain("ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]");
    expect(rpc).toContain("v_canonical ->> 'title'");
    expect(rpc).toContain("matter_code = v_canonical ->> 'matter_code'");
    expect(rpc).toContain("kind = v_canonical ->> 'kind'");
    expect(rpc).toContain("decision_subtype = v_canonical ->> 'decision_subtype'");
    expect(rpc).toContain("proposal_text = v_canonical ->> 'proposal_text'");
    expect(rpc).toContain("requires_attachments = (v_canonical ->> 'requires_attachments')::boolean");
    expect(rpc).toContain("v_canonical ->> 'kind' = 'DECISORIO'");
    expect(rpc).toContain("v_canonical ->> 'proposal_text'");
  });

  it("falla cerrado ante changelog, acta final, sesión iniciada y filas extra", () => {
    const rpc = sqlFunction("fn_secretaria_materialize_convocation_agenda");
    expect(rpc).toContain("agenda_item_kind_changelog");
    expect(rpc).toContain("minute.final_legal_artifact_id IS NOT NULL");
    expect(rpc).toContain("minute.legal_gate_status NOT IN ('DRAFT', 'MANIFEST_READY')");
    expect(rpc).toContain("v_meeting.status NOT IN ('DRAFT', 'CONVOCADA')");
    expect(rpc).toContain("existen puntos fuera del orden del día inmutable");
    expect(rpc).not.toMatch(/DELETE\s+FROM\s+public\.agenda_items/i);
  });

  it("no permite mezclar dos convocatorias en una reunión", () => {
    const rpc = sqlFunction("fn_secretaria_materialize_convocation_agenda");
    expect(rpc).toContain("'{source_links,convocatoria_id}'");
    expect(rpc).toContain("'{scheduled_from,convocatoria_id}'");
    expect(rpc).toContain("la reunión ya apunta a otra convocatoria");
    expect(rpc).toContain("'canonical_agenda_hash_sha256', v_agenda_hash");
  });

  it("backfill solo considera vínculos unívocos, reuniones abiertas y datos no divergentes", () => {
    expect(migration).toContain(
      "v_previous_claim_role text := current_setting('request.jwt.claim.role', true)",
    );
    expect(migration).toContain(
      "set_config('request.jwt.claim.role', 'service_role', true)",
    );
    expect(migration).toContain("COALESCE(v_previous_claim_role, '')");
    expect(migration).toContain("WHEN source_ref = scheduled_ref THEN source_ref");
    expect(migration).toContain("meeting.status IN ('DRAFT', 'CONVOCADA')");
    expect(migration).toContain("NULLIF(btrim(item.matter_code), '') IS NOT NULL");
    expect(migration).toContain("item.requires_attachments IS TRUE");
    expect(migration).toContain("agenda binding self-check");
  });

  it("el hook delega creación/reuso y agenda en una única RPC transaccional", () => {
    const start = hook.indexOf("export function useCreateMeetingFromConvocatoria");
    const end = hook.indexOf("export type CreateUniversalMeetingInput", start);
    const createMeeting = hook.slice(start, end);
    expect(createMeeting).toContain(
      '"fn_secretaria_create_or_reuse_meeting_from_convocation"',
    );
    expect(createMeeting).toContain("p_convocatoria_id: convocatoria.id");
    expect(createMeeting).toContain("result?.materialized_items !== expectedItems");
    expect(createMeeting).not.toContain('fn_secretaria_materialize_convocation_agenda');
    expect(createMeeting).not.toContain('.from("meetings")');
    expect(createMeeting).not.toContain('.from("agenda_items")');
  });
});
