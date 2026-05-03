import { supabase } from "@/integrations/supabase/client";

export interface ArchiveResult {
  ok: boolean;
  documentUrl?: string;
  hash512?: string;
  evidenceBundleId?: string;
  error?: string;
}

export interface ArchiveMetadata {
  processKind?: string;
  evidenceStatus?: "DEMO_OPERATIVA";
  recordId?: string;
  templateId?: string | null;
  templateTipo?: string;
  templateVersion?: string;
  contentHash?: string;
  signedBy?: string;
  qesSrId?: string;
  qesDocumentId?: string;
  qesDocumentHash?: string;
  qesSignatoryIds?: string[];
  qesSignedAt?: string;
  archivedBufferKind?: "ORIGINAL_DOCX" | "QTSP_SIGNED_DOCX";
  normativeSnapshotId?: string | null;
  normativeProfileId?: string | null;
  normativeProfileHash?: string | null;
  normativeFrameworkStatus?: string | null;
  normativeSourceLayers?: string[];
  formalizationRequirements?: string[];
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

async function computeSha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * archiveDocxToStorage — Uploads a generated DOCX buffer to Supabase Storage
 * and inserts a record into evidence_bundles table
 *
 * @param buffer - The DOCX file buffer
 * @param agreementId - The agreement ID to link
 * @param filename - The filename (without extension)
 * @returns Promise<ArchiveResult>
 */
export async function archiveDocxToStorage(
  buffer: ArrayBuffer,
  agreementId: string,
  filename: string,
  tenantId: string,
  metadata: ArchiveMetadata = {}
): Promise<ArchiveResult> {
  try {

    // Compute SHA-512 hash
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-512", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Upload to Supabase Storage
    const storagePath = `agreements/${agreementId}/${filename}.docx`;
    const archivedAt = new Date().toISOString();
    const { error: uploadError, data } = await supabase.storage
      .from("matter-documents")
      .upload(storagePath, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (uploadError) {
      return {
        ok: false,
        error: `Upload fallido: ${uploadError.message}`,
      };
    }

    // Get signed URL (7 days validity)
    const { data: urlData } = supabase.storage
      .from("matter-documents")
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;

    if (!publicUrl) {
      return {
        ok: false,
        error: "No se pudo obtener la URL pública del documento",
      };
    }

    const manifest = {
      version: "docgen-process-v2",
      created_at: archivedAt,
      agreement_id: agreementId,
      tenant_id: tenantId,
      evidence_status: metadata.evidenceStatus ?? "DEMO_OPERATIVA",
      artifacts: [
        {
          type: "DOCX",
          ref: data?.path ?? storagePath,
          filename: `${filename}.docx`,
          mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          hash_sha512: hashHex,
          timestamp_iso: archivedAt,
        },
      ],
      metadata,
    };
    const manifestHash = await computeSha256(canonicalJson(manifest));

    // Insert into evidence_bundles table
    const { data: bundle, error: insertError } = await supabase.from("evidence_bundles").insert({
      tenant_id: tenantId,
      agreement_id: agreementId,
      manifest,
      manifest_hash: manifestHash,
      hash_sha512: hashHex,
      document_url: publicUrl,
      signed_by: metadata.signedBy ?? "SISTEMA",
      status: "OPEN",
    }).select("id").maybeSingle();

    if (insertError) {
      return {
        ok: false,
        documentUrl: publicUrl,
        hash512: hashHex,
        error: `Evidence bundle no creado: ${insertError.message}`,
      };
    }

    if (!bundle?.id) {
      return {
        ok: false,
        documentUrl: publicUrl,
        hash512: hashHex,
        error: "Evidence bundle no creado: la inserción no devolvió identificador",
      };
    }

    return {
      ok: true,
      documentUrl: publicUrl,
      hash512: hashHex,
      evidenceBundleId: bundle.id,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
    return {
      ok: false,
      error: errorMsg,
    };
  }
}

/**
 * computeSha512 — Compute SHA-512 hash of a buffer (utility function)
 */
export async function computeSha512(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-512", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
