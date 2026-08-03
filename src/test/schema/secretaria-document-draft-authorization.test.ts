import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260720145000_secretaria_document_draft_authorization.sql",
  ),
  "utf8",
);
const persistence = readFileSync(
  join(
    process.cwd(),
    "src/lib/motor-plantillas/document-draft-persistence.ts",
  ),
  "utf8",
);
const executableSql = migration.replace(/^\s*--.*$/gm, "");
const serverValidator = migration.match(
  /CREATE OR REPLACE FUNCTION public\.fn_secretaria_validate_document_draft_body\([\s\S]*?\n\$function\$;/,
)?.[0] ?? "";
const writeGuard = migration.match(
  /CREATE OR REPLACE FUNCTION public\.fn_secretaria_guard_document_draft_write\(\)[\s\S]*?\n\$function\$;/,
)?.[0] ?? "";
const saveRpc = migration.match(
  /CREATE OR REPLACE FUNCTION public\.fn_secretaria_save_document_draft\([\s\S]*?\n\$function\$;/,
)?.[0] ?? "";
const transitionRpc = migration.match(
  /CREATE OR REPLACE FUNCTION public\.fn_secretaria_transition_document_draft\([\s\S]*?\n\$function\$;/,
)?.[0] ?? "";

describe("Secretaria document drafts — autorización forward-only", () => {
  it("revoca completamente anon y deja authenticated sin escritura directa", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.secretaria_document_drafts\s+FROM PUBLIC, anon, authenticated, service_role/,
    );
    expect(migration).toContain(
      "GRANT SELECT ON TABLE public.secretaria_document_drafts TO authenticated",
    );
    expect(executableSql).not.toMatch(
      /GRANT\s+(?:[^;]*\b)?(?:INSERT|UPDATE|DELETE)(?:\b[^;]*)?\s+TO\s+(?:PUBLIC|anon|authenticated)\b/i,
    );
    expect(executableSql).not.toMatch(/GRANT[^;]+\sTO\s+anon\b/i);
    expect(migration.match(/CREATE POLICY secretaria_document_drafts_/g)).toHaveLength(1);
    expect(migration).toMatch(
      /CREATE POLICY secretaria_document_drafts_authenticated_select[\s\S]*FOR SELECT TO authenticated/,
    );
  });

  it("usa la cadena canónica JWT/app_metadata/user_profiles y nunca un tenant demo por defecto", () => {
    expect(migration).not.toContain("fn_secretaria_document_draft_jwt_tenant_id");
    expect(saveRpc).toContain("v_current_tenant_id := public.fn_assert_current_tenant_id()");
    expect(transitionRpc).toContain(
      "v_current_tenant_id := public.fn_assert_current_tenant_id()",
    );
    expect(migration).not.toContain("00000000-0000-0000-0000-000000000001");
    expect(migration).toMatch(
      /tenant_id = public\.fn_current_tenant_id\(\)/,
    );
    expect(migration).toContain("auth.uid() IS NOT NULL");
  });

  it("persiste contenido solo por RPC, con actor servidor y estados editables", () => {
    expect(saveRpc).toContain("v_actor_id uuid := auth.uid()");
    expect(saveRpc).not.toMatch(/p_(?:actor|user|created_by|updated_by)/i);
    expect(saveRpc).toContain("ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]");
    expect(saveRpc).toContain("v_current_tenant_id IS DISTINCT FROM v_tenant_id");
    expect(saveRpc).toContain(
      "v_draft_state NOT IN ('EDITABLE_DRAFT', 'DRAFT_CONFIGURED')",
    );
    expect(saveRpc).toContain("document draft content is immutable after submission to review");
    expect(saveRpc).toContain("FOR UPDATE");
    expect(saveRpc).toContain("pg_advisory_xact_lock");
    expect(saveRpc).toContain("agreement.tenant_id = v_tenant_id");
    expect(saveRpc).toContain("template.tenant_id = v_tenant_id");
    expect(saveRpc).toContain(
      "set_config('app.secretaria_document_draft_write_lane', 'SAVE_DRAFT', true)",
    );
  });

  it("recalcula validación y SHA-256 en PostgreSQL sin confiar en los campos del JSON", () => {
    expect(serverValidator).toContain("SERVER_RENDERED_BODY_V1");
    expect(serverValidator).toContain("extensions.digest(convert_to(v_body, 'UTF8'), 'sha256')");
    expect(serverValidator).toContain("UNSUPPORTED_DOCUMENT_TYPE");
    expect(serverValidator).toContain("RENDERED_TEXT_TOO_SHORT");
    expect(serverValidator).toContain("ORPHAN_TEMPLATE_VARIABLES");
    expect(serverValidator).toContain("DRAFT_PLACEHOLDER_REMAINS");
    expect(serverValidator).toContain("VISIBLE_INTERNAL_UUID");
    expect(serverValidator).toContain("REQUIRED_SECTION_MISSING");
    expect(serverValidator).toContain("CERTIFICATION_SIGNATURE_BLOCK_MISSING");
    expect(serverValidator).toContain("REGISTRY_SCOPE_NOTICE_MISSING");
    expect(saveRpc).toContain("fn_secretaria_validate_document_draft_body(");
    expect(saveRpc).toContain(
      "v_content_hash_sha256 := v_post_render_validation ->> 'validated_hash_sha256'",
    );
    expect(saveRpc).not.toContain("p_payload -> 'post_render_validation'");
    expect(saveRpc).not.toContain("p_payload ->> 'content_hash_sha256'");
  });

  it("gobierna aprobación/promoción con CAS y rol ADMIN_TENANT", () => {
    expect(transitionRpc).toContain("v_draft.draft_state IS DISTINCT FROM v_from");
    expect(transitionRpc).toContain("WHERE draft.id = p_draft_id");
    expect(transitionRpc).toContain("AND draft.draft_state = v_from");
    expect(transitionRpc).toContain("WHEN 'IN_REVIEW' THEN v_to IN ('APPROVED'");
    expect(transitionRpc).toContain("WHEN 'APPROVED' THEN v_to IN ('PROMOTED'");
    expect(transitionRpc).toContain("v_to IN ('APPROVED', 'PROMOTED')");
    expect(transitionRpc).toContain(
      "v_draft.draft_state IN ('APPROVED', 'PROMOTED')",
    );
    expect(transitionRpc).toMatch(
      /v_draft\.draft_state IN \('APPROVED', 'PROMOTED'\)[\s\S]*OR v_to IN \('APPROVED', 'PROMOTED'\)[\s\S]*ARRAY\['ADMIN_TENANT'\]::text\[\]/,
    );
    expect(transitionRpc).toContain("ARRAY['ADMIN_TENANT']::text[]");
    expect(transitionRpc).toContain("fn_secretaria_validate_document_draft_body(");
    expect(transitionRpc).toContain("v_server_validation ->> 'ok'");
    expect(transitionRpc).toContain(
      "v_draft.content_hash_sha256 IS DISTINCT FROM v_server_content_hash_sha256",
    );
    expect(transitionRpc).not.toContain(
      "v_draft.post_render_validation ->> 'ok'",
    );
    expect(transitionRpc).toContain("server_state_history");
  });

  it("mantiene service_role y bloquea escrituras que no provienen de las RPCs", () => {
    expect(migration).toContain(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.secretaria_document_drafts",
    );
    expect(migration).toMatch(/TO service_role;/);
    expect(migration).toContain("tr_secretaria_document_draft_write_guard");
    expect(migration).toContain("direct document draft write forbidden; use the governed RPC");
    expect(writeGuard).toContain("current_user = 'postgres'");
    expect(writeGuard).not.toContain("SECURITY DEFINER");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_save_document_draft\(jsonb\)\s+FROM PUBLIC, anon/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_transition_document_draft\(uuid, text, text, text\)\s+FROM PUBLIC, anon/,
    );
  });

  it("el cliente abandona el upsert de tabla y usa la RPC gobernada", () => {
    expect(persistence).toContain(
      'export const DOCUMENT_DRAFT_SAVE_RPC = "fn_secretaria_save_document_draft"',
    );
    expect(persistence).toContain("draftClient().rpc(DOCUMENT_DRAFT_SAVE_RPC");
    expect(persistence).not.toContain(".upsert(payload");
    expect(persistence).not.toContain("updated_by: input.actorId");
  });
});
