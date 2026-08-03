import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260719234500_secretaria_document_artifact_bundle_hash_consistency.sql",
  ),
  "utf8",
);

describe("document artifact bundle hash consistency migration", () => {
  it("backfills the binary hash from the exact evidence bundle", () => {
    expect(migration).toContain("artifact.evidence_bundle_id = bundle.id");
    expect(migration).toContain("artifact.tenant_id = bundle.tenant_id");
    expect(migration).toContain("hash_sha512 = bundle.hash_sha512");
  });

  it("fails if a registral or certification artifact still diverges", () => {
    expect(migration).toContain("DOCUMENTO_REGISTRAL");
    expect(migration).toContain("CERTIFICACION_ACUERDO");
    expect(migration).toContain("artifact.hash_sha512 IS DISTINCT FROM bundle.hash_sha512");
    expect(migration).toContain("RAISE EXCEPTION");
  });
});
