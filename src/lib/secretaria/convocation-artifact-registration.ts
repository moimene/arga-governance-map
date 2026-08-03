import { supabase } from "@/integrations/supabase/client";

export interface RenderAuthoritativeConvocationInput {
  convocatoriaId: string;
  expectedManifestHashSha512?: string | null;
}

export interface VerifiedConvocationArtifact {
  id: string;
  file_name: string;
  file_url: string;
  file_hash: string;
  file_hash_sha512: string;
  artifact_kind: "CONVOCATORIA_FINAL";
  agenda_item_index: number | null;
  artifact_verified_at: string;
  artifact_verified_by_service: true;
  artifact_verified_size_bytes: number;
  artifact_verified_mime_type: string;
  manifest_hash_sha512?: string;
}

export interface ServerRenderedConvocationArtifact extends VerifiedConvocationArtifact {
  artifact_kind: "CONVOCATORIA_FINAL";
  documentData: ArrayBuffer;
  reused: boolean;
}

interface RegistrationResponse {
  attachment?: VerifiedConvocationArtifact;
  download_url?: string;
  reused?: boolean;
  error?: string;
}

async function digestArrayBufferHex(
  algorithm: "SHA-256" | "SHA-512",
  data: ArrayBuffer,
): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(algorithm, data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Requests the authoritative server render.  No legal text, Word bytes,
 * binary hash, storage path or browser review context crosses this boundary.
 */
export async function renderAndRegisterAuthoritativeConvocation(
  input: RenderAuthoritativeConvocationInput,
): Promise<ServerRenderedConvocationArtifact> {
  const body: RenderAuthoritativeConvocationInput = {
    convocatoriaId: input.convocatoriaId,
    ...(input.expectedManifestHashSha512
      ? { expectedManifestHashSha512: input.expectedManifestHashSha512 }
      : {}),
  };
  const { data, error } = await supabase.functions.invoke<RegistrationResponse>(
    "convocation-artifact-register",
    { body },
  );
  if (error) throw new Error(`No se pudo generar el DOCX autoritativo: ${error.message}`);
  if (!data?.attachment?.id || !data.download_url) {
    throw new Error(data?.error ?? "El servidor no devolvió el DOCX autoritativo");
  }
  const response = await fetch(data.download_url, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`No se pudo descargar el DOCX autoritativo (${response.status})`);
  }
  const documentData = await response.arrayBuffer();
  if (documentData.byteLength !== data.attachment.artifact_verified_size_bytes) {
    throw new Error("El DOCX descargado no coincide en tamaño con el artefacto verificado");
  }
  const [downloadedSha256, downloadedSha512] = await Promise.all([
    digestArrayBufferHex("SHA-256", documentData.slice(0)),
    digestArrayBufferHex("SHA-512", documentData.slice(0)),
  ]);
  if (
    downloadedSha256 !== data.attachment.file_hash
    || downloadedSha512 !== data.attachment.file_hash_sha512
  ) {
    throw new Error("El DOCX descargado no coincide con las huellas binarias del servidor");
  }
  return {
    ...data.attachment,
    artifact_kind: "CONVOCATORIA_FINAL",
    documentData,
    reused: Boolean(data.reused),
  };
}
