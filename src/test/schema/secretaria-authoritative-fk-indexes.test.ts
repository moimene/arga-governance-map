import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720131000_secretaria_authoritative_fk_indexes.sql",
  ),
  "utf8",
);

const coverage = [
  "cargo_rm_registration_events(audit_worm_id)",
  "cargo_rm_registration_events(authority_evidence_id)",
  "cargo_rm_registration_events(condicion_id)",
  "secretaria_annual_accounts_components(evidence_bundle_id)",
  "secretaria_annual_accounts_execution_artifacts(annual_accounts_set_id)",
  "secretaria_annual_accounts_execution_artifacts(evidence_bundle_id)",
  "secretaria_annual_accounts_expected_signers(person_id)",
  "secretaria_annual_accounts_sets(agenda_item_id)",
  "secretaria_annual_accounts_sets(body_id)",
  "secretaria_annual_accounts_sets(entity_id)",
  "secretaria_annual_accounts_sets(meeting_id)",
  "secretaria_annual_accounts_sets(supersedes_set_id)",
  "secretaria_annual_accounts_signer_outcomes(provider_evidence_bundle_id)",
  "secretaria_annual_accounts_signer_outcomes(supersedes_outcome_id)",
  "secretaria_annual_accounts_signer_outcomes(signature_request_id)",
  "secretaria_annual_accounts_signer_outcomes(expected_signer_id)",
  "secretaria_annual_accounts_signer_rosters(annual_accounts_set_id)",
  "secretaria_annual_accounts_signer_rosters(agreement_id)",
  "secretaria_annual_accounts_signer_rosters(resolution_id)",
  "secretaria_annual_accounts_signer_rosters(snapshot_id)",
  "secretaria_demo_simulation_quarantine(entity_id)",
  "secretaria_demo_simulation_quarantine(meeting_id)",
  "secretaria_legal_artifacts(evidence_bundle_id)",
  "secretaria_qtsp_verifications(provider_evidence_bundle_id)",
  "secretaria_qtsp_verifications(signature_request_id)",
  "secretaria_qtsp_verifications(signer_person_id)",
];

describe("authoritative schema FK index coverage", () => {
  it.each(coverage)("covers %s", (target) => {
    expect(sql.replaceAll(/\s+/g, " ")).toContain(`public.${target}`);
  });

  it("creates every index idempotently", () => {
    expect(sql.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(coverage.length);
  });
});
