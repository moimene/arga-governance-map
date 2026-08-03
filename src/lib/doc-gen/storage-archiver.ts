import { supabase } from "@/integrations/supabase/client";
import { resolveSandboxSafeEvidencePersistence } from "@/lib/secretaria/evidence-sandbox-gate";
import {
  resolveArchiveBinaryDescriptor,
  type ArchivedBufferKind,
} from "./archive-binary-contract";

export interface ArchiveResult {
  ok: boolean;
  documentUrl?: string;
  hash512?: string;
  evidenceBundleId?: string;
  reused?: boolean;
  error?: string;
}

export interface ArchiveMetadata {
  processKind?: string;
  evidenceStatus?: "DEMO_OPERATIVA";
  recordId?: string;
  templateId?: string | null;
  templateBindingId?: string | null;
  templateTipo?: string;
  templateVersion?: string;
  contentHash?: string;
  /** Actor que registra el binario en custodia. No atribuye firma. */
  archivedBy?: string;
  signedBy?: string;
  /** ITEM-109: true cuando la firma provino del adaptador sandbox de demo
   *  (no es una transacción EAD Trust real). Marca el manifest con sandbox:true
   *  vía el gate de custodia para que la cadena deje constancia explícita. */
  sandbox?: boolean;
  qesSrId?: string;
  qesSrStatus?: string;
  qesSignatureProduced?: boolean;
  qesDocumentId?: string;
  qesDocumentHash?: string;
  qesSignatoryIds?: string[];
  qesSignedAt?: string;
  /** Trazabilidad de una actuación EAD por interposición. Estos campos no
   *  atribuyen firma al binario custodiado ni lo convierten en output final. */
  eadInterpositionRequestId?: string;
  eadInterpositionStatus?: string;
  eadDocumentId?: string;
  eadDocumentHash?: string;
  eadParticipantIds?: string[];
  archivedBufferKind?: ArchivedBufferKind;
  normativeSnapshotId?: string | null;
  normativeProfileId?: string | null;
  normativeProfileHash?: string | null;
  normativeFrameworkStatus?: string | null;
  normativeSourceLayers?: string[];
  formalizationRequirements?: string[];
  registryStatus?: string | null;
  rulePackId?: string | null;
  rulePackName?: string | null;
  rulePackVersionId?: string | null;
  rulePackVersionLabel?: string | null;
  rulePackOrgano?: string | null;
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

    if (metadata.contentHash) {
      const { data: existing, error: existingError } = await supabase
        .from("evidence_bundles")
        .select("id, document_url, hash_sha512")
        .eq("tenant_id", tenantId)
        .eq("agreement_id", agreementId)
        .eq("manifest->metadata->>contentHash", metadata.contentHash)
        // El hash lógico del body no basta para reutilizar el artefacto: dos
        // DOCX pueden renderizar el mismo texto y diferir en una hoja técnica,
        // propiedades OpenXML o firmas. Solo se reutilizan bytes idénticos.
        .eq("hash_sha512", hashHex)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!existingError && existing?.id) {
        return {
          ok: true,
          documentUrl: existing.document_url ?? undefined,
          hash512: existing.hash_sha512 ?? hashHex,
          evidenceBundleId: existing.id,
          reused: true,
        };
      }
    }

    // F3.G3: path schema con tenant prefix (era `agreements/${id}/...`).
    // Forma nueva: `<tenant_id>/<agreement_id>/<filename>__<hash8>.docx`.
    // ITEM-108: el filename antiguo tenía granularidad de día (sin hora ni
    // hash), de modo que regenerar el mismo día con contenido distinto (tras
    // editar el borrador) colisionaba en un path idéntico con upsert:false →
    // dead-end 'The resource already exists'. Incluir 8 chars del SHA-512 del
    // contenido hace que cada contenido distinto tenga su propio path, y
    // permite upsert:true seguro: como el path identifica el contenido, un
    // re-upload solo puede sobreescribir bytes idénticos (caso de fallo parcial:
    // upload OK pero INSERT falló → reintento idempotente en vez de bucle).
    const contentFragment = hashHex.slice(0, 8);
    const binary = resolveArchiveBinaryDescriptor(
      filename,
      metadata.archivedBufferKind ?? "ORIGINAL_DOCX",
    );
    const storagePath = `${tenantId}/${agreementId}/${binary.baseFilename}__${contentFragment}${binary.extension}`;
    const archivedAt = new Date().toISOString();
    const { error: uploadError, data } = await supabase.storage
      .from("matter-documents")
      .upload(storagePath, buffer, {
        contentType: binary.mimeType,
        upsert: true,
      });

    if (uploadError) {
      return {
        ok: false,
        error: `No se pudo archivar el documento: ${uploadError.message}. Si el problema persiste, revisa permisos de almacenamiento o vuelve a generarlo.`,
      };
    }

    // F3.G3: ya NO se llama supabase.storage public URL helper — el bucket es
    // privado y la URL pública devuelve 403. El acceso pasa por la Edge
    // Function `sign-evidence-url` invocada vía `useEvidenceBundleSignedUrl`.
    // Para mantener la condición legacy `if (document_url)` en componentes que
    // aún no se han refactorizado, poblamos `document_url` con un sentinel
    // `evidence-bundle://<path>` que no es navegable pero permite distinguir
    // "archivado" de "no archivado".
    const sentinelUrl = `evidence-bundle://${storagePath}`;

    const manifest = {
      version: "docgen-process-v2",
      created_at: archivedAt,
      agreement_id: agreementId,
      tenant_id: tenantId,
      evidence_status: metadata.evidenceStatus ?? "DEMO_OPERATIVA",
      artifacts: [
        {
          type: binary.artifactType,
          ref: data?.path ?? storagePath,
          filename: `${binary.baseFilename}${binary.extension}`,
          mime_type: binary.mimeType,
          hash_sha512: hashHex,
          timestamp_iso: archivedAt,
        },
      ],
      // Estos metadatos describen el binario local, pero NO fabrican una firma
      // ni un e-archive verificable: la custodia EAD vive en su flujo source-bound.
      metadata: {
        ...metadata,
        archivedArtifactType: binary.artifactType,
        archivedMimeType: binary.mimeType,
        signedQtspArtifact: binary.signedQtspArtifact,
      },
    };
    // ITEM-109 legacy: un resultado sandbox queda OPEN y nunca se presenta
    // como evidencia EAD productiva ni como firma.
    const persistence = resolveSandboxSafeEvidencePersistence({
      sandbox: metadata.sandbox === true,
      status: "OPEN",
      manifest,
    });
    const effectiveManifest = persistence.manifest;

    // La tabla WORM no admite INSERT del navegador. Este RPC registra el
    // binario únicamente como UNSIGNED_INPUT/OPEN; la finalización y custodia
    // EAD de una fuente canónica usa otro trust boundary server-side.
    const { data: bundle, error: insertError } = await supabase.rpc(
      "fn_secretaria_register_unsigned_input_custody",
      {
        p_tenant_id: tenantId,
        p_agreement_id: agreementId,
        p_storage_path: storagePath,
        p_document_url: sentinelUrl,
        p_binary_hash_sha512: hashHex,
        p_manifest: effectiveManifest,
      },
    );

    if (insertError) {
      return {
        ok: false,
        documentUrl: sentinelUrl,
        hash512: hashHex,
        error: `Evidence bundle no creado: ${insertError.message}`,
      };
    }

    const custody = bundle as { evidence_bundle_id?: string } | null;
    if (!custody?.evidence_bundle_id) {
      return {
        ok: false,
        documentUrl: sentinelUrl,
        hash512: hashHex,
        error: "Evidence bundle no creado: la inserción no devolvió identificador",
      };
    }

    return {
      ok: true,
      documentUrl: sentinelUrl,
      hash512: hashHex,
      evidenceBundleId: custody.evidence_bundle_id,
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
