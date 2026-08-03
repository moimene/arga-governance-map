import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260720148000_secretaria_ead_interposition_system_policy.sql",
  ),
  "utf8",
);

const voteRpc = migration.match(
  /CREATE OR REPLACE FUNCTION public\.fn_no_session_cast_response[\s\S]*?\$function\$;/,
)?.[0] ?? "";

describe("no-session WORM voting census gate", () => {
  it("accepts voters only from the one exact political NO_SESSION snapshot", () => {
    expect(voteRpc).toContain("NO_SESSION_VOTE_REQUIRES_ONE_EXACT_WORM_CENSUS");
    expect(voteRpc).toContain("snapshot.meeting_id = p_resolution_id");
    expect(voteRpc).toContain("snapshot.session_kind = 'NO_SESSION'");
    expect(voteRpc).toContain("snapshot.snapshot_type = 'POLITICO'");
    expect(voteRpc).toContain("snapshot.entity_id = v_body.entity_id");
    expect(voteRpc).toContain("snapshot.body_id = v_body.id");
    expect(voteRpc).toContain("NO_SESSION_VOTER_NOT_IN_WORM_CENSUS");
    expect(voteRpc).toContain("member ->> 'person_id' = p_person_id::text");
    expect(voteRpc).toContain("member -> 'voting_rights' = 'true'::jsonb");
  });

  it("verifies the WORM audit mirror and recomputes its SHA-512 link", () => {
    expect(voteRpc).toContain("audit.id = v_snapshot.audit_worm_id");
    expect(voteRpc).toContain("audit.table_name = 'censo_snapshot'");
    expect(voteRpc).toContain("audit.action = 'CENSO_SNAPSHOT_CREATED'");
    expect(voteRpc).toContain("v_audit.delta #> '{new,payload}' IS DISTINCT FROM v_snapshot.payload");
    expect(voteRpc).toContain("previous.seq < v_audit.seq");
    expect(voteRpc).toContain("COALESCE(v_audit.action, '') || '|'");
    expect(voteRpc).toContain("extensions.digest(");
    expect(voteRpc).toContain("NO_SESSION_VOTE_WORM_CENSUS_HASH_INVALID");
  });

  it("derives eligibility and the denominator only from the immutable payload", () => {
    expect(voteRpc).toContain("v_snapshot_denominator");
    expect(voteRpc).toContain("v_total_required := v_snapshot.total_partes");
    expect(voteRpc).toContain(
      "v_resolution.total_members IS DISTINCT FROM v_snapshot.total_partes",
    );
    expect(voteRpc).toContain("NO_SESSION_RESPONSE_OUTSIDE_WORM_CENSUS");
    expect(voteRpc).not.toContain("FROM public.condiciones_persona");
    expect(voteRpc).not.toContain("FROM public.capital_holdings");
  });

  it("retires new QES/ERDS response facts while preserving legacy reads", () => {
    expect(voteRpc).toContain("NO_SESSION_QES_ERDS_REFERENCES_RETIRED_FOR_NEW_CAPTURES");
    expect(voteRpc).toMatch(/now\(\), NULL, NULL, NULL, NULL/);
    expect(migration).toContain("fn_secretaria_guard_no_session_response_legacy_refs");
    expect(migration).toContain("NO_SESSION_LEGACY_QES_ERDS_FIELDS_ARE_READ_ONLY");
    expect(migration).toContain("NEW.firma_qes_ref IS DISTINCT FROM OLD.firma_qes_ref");
    expect(migration).toMatch(
      /NEW\.notificacion_certificada_ref\s+IS DISTINCT FROM OLD\.notificacion_certificada_ref/,
    );
  });

  it("keeps the RPC authenticated and service-only, with no anonymous execute", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_no_session_cast_response\([\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_no_session_cast_response\([\s\S]*?TO authenticated, service_role;/,
    );
  });
});
