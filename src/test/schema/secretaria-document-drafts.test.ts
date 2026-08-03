// src/test/schema/secretaria-document-drafts.test.ts
/**
 * Cloud contract for editable Secretaria document drafts.
 *
 * This is intentionally read-only: Composer write behavior is covered by the
 * UI/persistence layer. Anonymous access is expected to fail closed after the
 * authorization hardening migration; the selected column list still makes
 * PostgREST resolve the Cloud schema contract before PostgreSQL denies access.
 */
import { describe, expect, it } from "vitest";
import { supabase } from "@/integrations/supabase/client";

type SchemaProbeClient = {
  from: (table: string) => {
    select: (columns: string) => {
      limit: (count: number) => Promise<{
        error: { code?: string; message: string } | null;
      }>;
    };
  };
};

describe("Secretaria document drafts — Cloud schema", () => {
  it("secretaria_document_drafts exposes the Composer persistence contract", async () => {
    const { error } = await (supabase as unknown as SchemaProbeClient)
      .from("secretaria_document_drafts")
      .select(
        [
          "id",
          "tenant_id",
          "document_request_id",
          "draft_key_sha256",
          "request_hash_sha256",
          "document_type",
          "agreement_id",
          "template_id",
          "template_tipo",
          "template_version",
          "version",
          "draft_state",
          "rendered_body_text",
          "system_trace_text",
          "capa3_values",
          "post_render_validation",
          "content_hash_sha256",
          "configured_at",
          "created_by",
          "updated_by",
          "created_at",
          "updated_at",
          "metadata",
        ].join(", "),
      )
      .limit(1);

    expect(error?.code).toBe("42501");
    expect(error?.message ?? "").toMatch(
      /permission denied for table secretaria_document_drafts/i,
    );
    expect(error?.message ?? "").not.toMatch(
      /column .* does not exist|could not find .* column|schema cache/i,
    );
  });
});
