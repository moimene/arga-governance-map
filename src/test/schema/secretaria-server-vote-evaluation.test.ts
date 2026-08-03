import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720122000_secretaria_server_vote_evaluation.sql",
  ),
  "utf8",
);

const legalArtifactSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720120000_authoritative_legal_artifact_gates.sql",
  ),
  "utf8",
);

const executableSql = sql.replace(/^\s*--.*$/gm, "");

function evaluationRpc(): string {
  const definition = executableSql.match(
    /CREATE OR REPLACE FUNCTION public\.fn_secretaria_server_resolution_evaluation\([\s\S]*?\$function\$;/i,
  )?.[0];
  expect(definition, "server-side resolution evaluator must exist").toBeTruthy();
  return definition ?? "";
}

function attendanceCanonicalizer(): string {
  const definition = legalArtifactSql.match(
    /CREATE OR REPLACE FUNCTION public\.fn_secretaria_canonical_attendance_type\([\s\S]*?\$function\$;/i,
  )?.[0];
  expect(definition, "shared attendance canonicalizer must exist").toBeTruthy();
  return definition ?? "";
}

describe("Secretaría — evaluación autoritativa server-side de votación", () => {
  it("aborta ante duplicados legacy y fija las dos claves naturales", () => {
    expect(executableSql).toContain("SERVER_VOTE_LEGACY_DUPLICATE_ATTENDEES");
    expect(executableSql).toContain("SERVER_VOTE_LEGACY_DUPLICATE_RESOLUTIONS");
    expect(executableSql).toMatch(
      /GROUP BY attendee\.tenant_id, attendee\.meeting_id, attendee\.person_id[\s\S]*HAVING count\(\*\) > 1/i,
    );
    expect(executableSql).toMatch(
      /GROUP BY resolution\.tenant_id, resolution\.meeting_id, resolution\.agenda_item_index[\s\S]*HAVING count\(\*\) > 1/i,
    );
    expect(executableSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS ux_meeting_attendees_tenant_meeting_person[\s\S]*ON public\.meeting_attendees\(tenant_id, meeting_id, person_id\)/i,
    );
    expect(executableSql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS ux_meeting_resolutions_tenant_meeting_agenda_item[\s\S]*ON public\.meeting_resolutions\(tenant_id, meeting_id, agenda_item_index\)/i,
    );
  });

  it("expone un helper STABLE SECURITY DEFINER, tenant-scoped y sin acceso anónimo", () => {
    const rpc = evaluationRpc();
    expect(rpc).toMatch(/RETURNS jsonb[\s\S]*LANGUAGE plpgsql[\s\S]*STABLE[\s\S]*SECURITY DEFINER/i);
    expect(rpc).toContain("SET search_path = pg_catalog, public, extensions");
    expect(rpc).toContain("public.fn_secretaria_is_service_role()");
    expect(rpc).toContain("public.fn_assert_current_tenant_id()");
    expect(rpc).toContain("SERVER_VOTE_TENANT_ACCESS_DENIED");
    expect(executableSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_server_resolution_evaluation\(uuid, uuid, uuid\)[\s\S]*FROM PUBLIC, anon/i,
    );
    expect(executableSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_secretaria_server_resolution_evaluation\(uuid, uuid, uuid\)[\s\S]*TO authenticated, service_role/i,
    );
  });

  it("falla cerrado fuera de órganos colegiados y de un snapshot POLITICO WORM exacto", () => {
    const rpc = evaluationRpc();
    expect(rpc).toContain("SERVER_VOTE_UNSUPPORTED_COLLEGIAL_BODY");
    expect(rpc).toContain("'CDA', 'CONSEJO_ADMIN', 'CONSEJO_ADMINISTRACION', 'COMISION', 'COMITE'");
    expect(rpc).toContain("snapshot.session_kind = 'MEETING'");
    expect(rpc).toContain("snapshot.snapshot_type = 'POLITICO'");
    expect(rpc).toContain("snapshot.meeting_id = p_meeting_id");
    expect(rpc).toContain("snapshot.entity_id = v_meeting.entity_id");
    expect(rpc).toContain("snapshot.body_id = v_meeting.body_id");
    expect(rpc).toContain("audit.id = v_snapshot.audit_worm_id");
    expect(rpc).toContain("v_audit_hash_sha512 !~ '^[0-9a-f]{128}$'");
    expect(rpc).toContain("SERVER_VOTE_UNKNOWN_OR_MISMATCHED_POLITICAL_SNAPSHOT");
    expect(rpc).toContain("SERVER_VOTE_POLITICAL_SNAPSHOT_NOT_WORM_OR_EMPTY");
  });

  it("usa exclusivamente pesos unitarios del WORM y reconcilia filas, personas y denominador", () => {
    const rpc = evaluationRpc();
    expect(rpc).toContain("payload_row.value ->> 'voting_weight'");
    expect(rpc).toContain("v_seat ->> 'denominator_weight'");
    expect(rpc).toContain("(v_seat ->> 'voting_weight')::numeric <> 1");
    expect(rpc).toContain("(v_seat ->> 'denominator_weight')::numeric <> 1");
    expect(rpc).toContain("v_snapshot.total_partes <> v_total_seats");
    expect(rpc).toContain("v_snapshot.capital_total_base IS DISTINCT FROM v_total_weight");
    expect(rpc).not.toMatch(/v_(favor|contra|abstencion)\s*:=.*v_attendee\.voting_rights/i);
    expect(rpc).not.toMatch(/sum\s*\(\s*(attendee|ma)\.voting_rights/i);
  });

  it("rechaza personas duplicadas, asientos externos con voto y votos ausentes o fuera de reunión", () => {
    const rpc = evaluationRpc();
    expect(rpc).toContain("SERVER_VOTE_DUPLICATE_ATTENDEE_PERSON");
    expect(rpc).toContain("SERVER_VOTE_ATTENDEE_OUTSIDE_CENSUS");
    expect(rpc).toContain("v_attendee.person_id IS DISTINCT FROM v_meeting.secretary_id");
    expect(rpc).toContain("SERVER_VOTE_NON_CENSUS_ATTENDEE_CANNOT_VOTE");
    expect(rpc).toContain("SERVER_VOTE_ABSENT_ATTENDEE_VOTED");
    expect(rpc).toContain("SERVER_VOTE_VOTE_REFERENCES_OUTSIDE_MEETING");
    expect(rpc).toContain("vote.attendee_id = v_attendee.id");
    expect(rpc).toContain("vote.resolution_id = p_resolution_id");
  });

  it("comparte un modelo de asistencia cerrado y no equipara remoto/telemático a presencia", () => {
    const canonicalizer = attendanceCanonicalizer();
    const rpc = evaluationRpc();

    expect(canonicalizer).toContain("WHEN 'PRESENTE' THEN 'PRESENCIAL'");
    expect(canonicalizer).toContain("WHEN 'PRESENCIAL' THEN 'PRESENCIAL'");
    expect(canonicalizer).toContain("WHEN 'REPRESENTADO' THEN 'REPRESENTADO'");
    expect(canonicalizer).toContain("WHEN 'AUSENTE' THEN 'AUSENTE'");
    expect(canonicalizer).not.toMatch(/WHEN\s+'(?:REMOTO|TELEMATICO)'/i);
    expect(rpc).toContain(
      "v_attendance_type := public.fn_secretaria_canonical_attendance_type(",
    );
    expect(rpc).toContain(
      "public.fn_secretaria_canonical_attendance_type(\n           v_representative.attendance_type\n         ) <> 'PRESENCIAL'",
    );
    expect(rpc).toContain("AND v_attendance_type = 'PRESENCIAL'");
    expect(rpc).not.toMatch(/'REMOTO'|'TELEMATICO'/);
  });

  it("exige representación puntual, efectiva y ejercida por otro asiento concurrente", () => {
    const rpc = evaluationRpc();
    expect(rpc).toContain("representation.scope = 'CONSEJO_DELEGACION'");
    expect(rpc).toContain("representation.meeting_id = p_meeting_id");
    expect(rpc).toContain("representation.represented_person_id = v_attendee.person_id");
    expect(rpc).toContain("representation.representative_person_id = v_attendee.represented_by_id");
    expect(rpc).toContain("representation.porcentaje_delegado = 100");
    expect(rpc).toContain("representation.effective_from <= v_meeting.scheduled_start::date");
    expect(rpc).toContain("SERVER_VOTE_REPRESENTATION_NOT_AUTHORITATIVE_OR_EFFECTIVE");
    expect(rpc).toContain("SERVER_VOTE_REPRESENTATIVE_NOT_PRESENT_ELIGIBLE_SEAT");
  });

  it("requiere exactamente un voto por asiento concurrente y documenta/excluye conflictos", () => {
    const rpc = evaluationRpc();
    expect(rpc).toContain("v_vote_count <> 1 OR v_vote_scope_count <> 1");
    expect(rpc).toContain("SERVER_VOTE_EXACTLY_ONE_VOTE_REQUIRED");
    expect(rpc).toContain("v_vote.conflict_flag IS TRUE");
    expect(rpc).toContain("SERVER_VOTE_CONFLICT_REASON_REQUIRED");
    expect(rpc).toContain("v_conflict_weight := v_conflict_weight + v_seat_weight");
    expect(rpc).toContain("v_eligible_weight := v_eligible_weight + v_seat_weight");
    expect(rpc).toContain("v_favor + v_contra + v_abstencion IS DISTINCT FROM v_eligible_weight");
  });

  it("recalcula quórum y mayoría absoluta de concurrentes sin confiar en quorum_data", () => {
    const rpc = evaluationRpc();
    expect(rpc).toContain("v_quorum_reached := v_concurrent_weight > (v_total_weight / 2)");
    expect(rpc).toContain("v_favor > (v_eligible_weight / 2)");
    expect(rpc).toContain("'reference', 'art. 247.2 LSC'");
    expect(rpc).toContain("'reference', 'art. 248.1 LSC'");
    expect(rpc).not.toContain("quorum_data");
    expect(rpc).not.toContain("adoption_snapshot");
  });

  it("solo usa voto de calidad explícito de config y el sentido real del presidente", () => {
    const rpc = evaluationRpc();
    expect(rpc).toContain("v_meeting.body_config ->> 'voto_calidad_presidente'");
    expect(rpc).toContain("v_attendee.person_id = v_meeting.president_id");
    expect(rpc).toContain("v_tie_before_casting_vote");
    expect(rpc).toContain("v_president_can_cast");
    expect(rpc).toContain("v_president_vote IN ('FAVOR', 'CONTRA')");
    expect(rpc).toContain("v_effective_favor := v_effective_favor + v_president_weight");
    expect(rpc).toContain("v_effective_contra := v_effective_contra + v_president_weight");
  });

  it("devuelve un contrato versionado con status_expected ADOPTED/REJECTED", () => {
    const rpc = evaluationRpc();
    expect(rpc).toContain("'secretaria.server-resolution-evaluation.v1'");
    expect(rpc).toContain("'SERVER_AUTHORITATIVE'");
    expect(rpc).toContain("THEN 'ADOPTED'");
    expect(rpc).toContain("ELSE 'REJECTED'");
    expect(rpc).toContain("'status_persisted', v_resolution.status");
    expect(rpc).toContain("'status_expected', v_status_expected");
    expect(rpc).toContain("'status_consistent', v_status_consistent");
    expect(rpc).toContain("'exactly_one_vote_per_eligible_concurrent_seat', true");
  });
});
