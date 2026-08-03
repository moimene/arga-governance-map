import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260719233000_secretaria_certification_multiagreement_artifact.sql"),
  "utf8",
);

describe("certification multi-agreement registry contract", () => {
  it("admite UUID directo y referencias meeting-point sin relajar tenant", () => {
    expect(migration).toContain("p_agreement_id::text = ANY");
    expect(migration).toContain("resolution.agreement_id = p_agreement_id");
    expect(migration).toContain("certification.tenant_id = p_tenant_id");
  });

  it("exige que una certificación usada como base corresponda a su bundle", () => {
    expect(migration).toContain("fn_registry_certification_artifact_matches");
    expect(migration).toContain("artifact.evidence_bundle_id = certification.evidence_id");
    expect(migration).toContain("certification base artifact does not match its evidence bundle");
  });
});
