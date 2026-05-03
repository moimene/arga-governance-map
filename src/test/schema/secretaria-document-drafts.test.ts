// src/test/schema/secretaria-document-drafts.test.ts
/**
 * Cloud contract for editable Secretaria document drafts.
 *
 * This is intentionally read-only: Composer write behavior is covered by the
 * UI/persistence layer, while this schema probe catches missing table/columns
 * in Cloud without leaving test data behind.
 */
import { describe, expect, it } from "vitest";
import { supabase } from "@/integrations/supabase/client";

type SchemaProbeClient = {
  from: (table: string) => {
    select: (columns: string) => {
      limit: (count: number) => Promise<{ error: { message: string } | null }>;
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

    expect(error).toBeNull();
  });
});
