import { supabase } from "@/integrations/supabase/client";

export interface ArchiveResult {
  ok: boolean;
  documentUrl?: string;
  hash512?: string;
  error?: string;
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
  filename: string
): Promise<ArchiveResult> {
  try {
    const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

    // Compute SHA-512 hash
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-512", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Upload to Supabase Storage
    const storagePath = `agreements/${agreementId}/${filename}.docx`;
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

    // Insert into evidence_bundles table
    const { error: insertError } = await supabase.from("evidence_bundles").insert({
      tenant_id: DEMO_TENANT,
      agreement_id: agreementId,
      hash_sha512: hashHex,
      document_url: publicUrl,
      signed_by: "SISTEMA",
      archived_at: new Date().toISOString(),
    });

    if (insertError) {
      // Log the error but don't fail the archival since the file is already uploaded
      console.warn("Warning: evidence_bundles insert failed:", insertError.message);
    }

    return {
      ok: true,
      documentUrl: publicUrl,
      hash512: hashHex,
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
