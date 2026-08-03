import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ATTACHMENT_MAX_BYTES,
  computeFileHashSha512,
  resolveAttachmentMime,
  sanitizeFileName,
} from "@/hooks/useConvocatorias";
import type { SecretariaDocumentArtifactRow } from "@/hooks/useSecretariaDocumentArtifacts";

export function useUploadRegistryEvidenceArtifact() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      file: File;
      entityId: string;
      title: string;
      artifactKind: "ANEXO_EXTERNO" | "SUBSANACION_REGISTRAL" | "DOCUMENTO_REGISTRAL";
      sourceDomain: string;
      sourceId: string;
      metadata?: Record<string, unknown>;
    }): Promise<SecretariaDocumentArtifactRow> => {
      if (!tenantId) throw new Error("tenant_id requerido para adjuntar evidencia registral");
      if (!params.entityId) throw new Error("entity_id requerido para adjuntar evidencia registral");
      if (params.file.size > ATTACHMENT_MAX_BYTES) {
        throw new Error("El archivo supera el límite de 25 MB.");
      }

      const mimeType = resolveAttachmentMime({
        name: params.file.name,
        type: params.file.type,
      });
      const hashSha512 = await computeFileHashSha512(params.file);
      const safeName = sanitizeFileName(params.file.name);
      const storagePath = `registry/${params.entityId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("matter-documents")
        .upload(storagePath, params.file, { contentType: mimeType, upsert: false });
      if (uploadError) throw uploadError;

      const documentUrl = `evidence-bundle://${storagePath}`;
      const { data, error } = await supabase
        .from("secretaria_document_artifacts")
        .insert({
          tenant_id: tenantId,
          entity_id: params.entityId,
          artifact_kind: params.artifactKind,
          title: params.title,
          status: "ATTACHED",
          document_url: documentUrl,
          mime_type: mimeType,
          content_hash: hashSha512,
          hash_sha512: hashSha512,
          evidence_status: "EVIDENCE_OPEN",
          source_domain: params.sourceDomain,
          source_id: params.sourceId,
          source_hash: hashSha512,
          metadata: {
            storage_bucket: "matter-documents",
            storage_path: storagePath,
            original_filename: params.file.name,
            uploaded_for_registry_lifecycle: true,
            ...(params.metadata ?? {}),
          },
        })
        .select("*")
        .single();

      if (error) {
        await supabase.storage.from("matter-documents").remove([storagePath]).catch(() => undefined);
        throw error;
      }

      return data as SecretariaDocumentArtifactRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretaria_document_artifacts", tenantId] });
    },
  });
}
