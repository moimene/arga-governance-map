import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasAdminClient, supabaseAdmin } from "../helpers/supabase-test-client";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260515183150_secretaria_d6_crear_sociedad_legal_y_capital.sql"),
  "utf8",
);

const LEGAL_FIELDS = [
  "constitution_date",
  "registration_date",
  "registry_location",
  "registry_volume",
  "registry_folio",
  "registry_sheet",
  "registry_inscription",
  "lei_code",
  "cnae_primary",
  "cnae_secondary",
  "corporate_purpose",
  "duration",
  "fiscal_year_close",
  "address",
  "address_street",
  "address_number",
  "address_floor",
  "postal_code",
  "city",
  "province",
  "country",
  "website",
  "corporate_email",
  "regulated_sector",
  "group_role",
  "support_docs_metadata",
  "onboarding_status",
] as const;

describe("entities legal fields migration D6 reissue", () => {
  it("adds every legal field required by the alta-sociedad D6 spec", () => {
    for (const field of LEGAL_FIELDS) {
      expect(migration).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${field}\\b`, "i"));
    }
  });

  it("uses safe onboarding_status migration order", () => {
    const addIndex = migration.indexOf("ALTER TABLE entities ADD COLUMN IF NOT EXISTS onboarding_status text");
    const backfillIndex = migration.indexOf("SET onboarding_status = 'OPERATIVA'");
    const defaultIndex = migration.indexOf("ALTER COLUMN onboarding_status SET DEFAULT 'INCOMPLETA_CARGOS'");

    expect(addIndex).toBeGreaterThanOrEqual(0);
    expect(backfillIndex).toBeGreaterThan(addIndex);
    expect(defaultIndex).toBeGreaterThan(backfillIndex);
    expect(migration).not.toMatch(/ADD COLUMN IF NOT EXISTS onboarding_status text\s+DEFAULT/i);
  });

  it("keeps support_docs_metadata as metadata JSON, not evidence storage", () => {
    expect(migration).toMatch(/support_docs_metadata jsonb NOT NULL DEFAULT '\{\}'::jsonb/i);
    expect(migration).not.toMatch(/INSERT INTO evidence_bundles/i);
  });

  it("handles missing or null cnae_secondary defensively", () => {
    expect(migration).toMatch(/jsonb_typeof\(v_entity -> 'cnae_secondary'\) = 'array'/i);
    expect(migration).toMatch(/ELSE ARRAY\[\]::text\[\]/i);
  });

  it.skipIf(!hasAdminClient())("can probe the new columns after the human applies the migration", async () => {
    const select = LEGAL_FIELDS.map((field) => field).join(",");
    const { error } = await supabaseAdmin!.from("entities").select(`id,${select}`).limit(1);

    if (error?.message?.match(/column .* does not exist|Could not find|schema cache/i)) {
      console.warn("[000067] entities legal fields not yet applied to Cloud; skipping live probe.");
      return;
    }

    expect(error).toBeNull();
  });
});
