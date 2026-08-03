import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720149000_secretaria_supporting_attachment_intent_binding.sql",
  ),
  "utf8",
);
const renderer = readFileSync(
  resolve(process.cwd(), "supabase/functions/convocation-artifact-register/renderer.ts"),
  "utf8",
);
const edge = readFileSync(
  resolve(process.cwd(), "supabase/functions/convocation-artifact-register/index.ts"),
  "utf8",
);

function sqlFunction(signature: string) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION ${signature}`);
  expect(start, `${signature} must exist`).toBeGreaterThanOrEqual(0);
  const body = migration.indexOf("AS $function$", start);
  const end = migration.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return migration.slice(start, end + "$function$;".length);
}

describe("Secretaría — binding WORM de anexos previstos", () => {
  it("enriquece el manifiesto después del censo y antes del guard WORM", () => {
    const enrich = sqlFunction(
      "secretaria_private.fn_convocation_manifest_enrich_supporting_intents()",
    );
    expect(
      "trg_00_convocation_manifest_enrich_recipients".localeCompare(
        "trg_01_convocation_manifest_enrich_supporting_intents",
      ),
    ).toBeLessThan(0);
    expect(
      "trg_01_convocation_manifest_enrich_supporting_intents".localeCompare(
        "trg_convocation_manifest_worm",
      ),
    ).toBeLessThan(0);
    expect(enrich).toContain("uploaded_references");
    expect(enrich).toContain("hash_sha256");
    expect(enrich).toContain("hash_sha512");
    expect(enrich).toContain("EXACT_SET_REQUIRED_BEFORE_FINAL");
    expect(enrich).toContain("NEW.manifest_hash_sha512 :=");
    expect(enrich).toContain("'2026-07-21.1'::text");
  });

  it("rechaza intents ambiguos, binarios no previstos y reescritura de trazas", () => {
    const enrich = sqlFunction(
      "secretaria_private.fn_convocation_manifest_enrich_supporting_intents()",
    );
    const guard = sqlFunction(
      "secretaria_private.fn_supporting_attachment_open_guard()",
    );
    const traceGuard = sqlFunction(
      "secretaria_private.fn_convocation_trace_immutable_guard()",
    );
    expect(enrich).toContain("SUPPORTING_ATTACHMENT_INTENT_ID_DUPLICATE");
    expect(enrich).toContain("SUPPORTING_ATTACHMENT_INTENT_BINARY_IDENTITY_DUPLICATE");
    expect(guard).toContain("v_match_count <> 1");
    expect(guard).toContain("SUPPORTING_ATTACHMENT_DOES_NOT_MATCH_EXACT_WORM_INTENT");
    expect(guard).toContain("ASSEMBLED_CONVOCATION_PACKAGE_FREEZES_SUPPORTING_ATTACHMENTS");
    expect(guard).not.toContain("communication.estado <> 'CANCELADA'");
    expect(traceGuard).toContain("IMMUTABLE_CONVOCATION_TRACE_MUTATION_FORBIDDEN");
  });

  it("impone un anexo por intent y set exacto antes del DOCX final", () => {
    const validator = sqlFunction(
      "secretaria_private.fn_convocation_supporting_set_valid(",
    );
    const finalGuard = sqlFunction(
      "secretaria_private.fn_final_attachment_supporting_set_guard()",
    );
    expect(migration).toContain("ux_attachments_one_supporting_intent");
    expect(validator).toContain("artifact_verified_by_service IS TRUE");
    expect(validator).toContain("v_actual_count IS DISTINCT FROM v_expected_count");
    expect(finalGuard).toContain("fn_convocation_supporting_set_valid");
    expect(finalGuard).toContain("FINAL_CONVOCATION_REQUIRES_COMPLETE_EXACT_SUPPORTING_SET");
  });

  it("versiona y exige el contrato en Edge y renderer", () => {
    expect(renderer).toContain("RENDERER_CONTRACT_VERSION = '2026-07-21.1'");
    expect(renderer).toContain("secretaria.convocation-supporting-intents.v1");
    expect(renderer).toContain("Manifest supporting-document intent set is missing or inconsistent");
    expect(edge).toContain("Manifest supporting-document intent set is incomplete or legacy");
  });
});
