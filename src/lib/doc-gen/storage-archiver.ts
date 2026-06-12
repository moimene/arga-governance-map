import { supabase } from "@/integrations/supabase/client";
import { resolveSandboxSafeEvidencePersistence } from "@/lib/secretaria/evidence-sandbox-gate";

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
  signedBy?: string;
  /** ITEM-109: true cuando la firma QES provino del adaptador sandbox de demo
   *  (no es una transacción EAD Trust real). Marca el manifest con sandbox:true
   *  vía el gate de custodia para que la cadena deje constancia explícita. */
  sandbox?: boolean;
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
  registryStatus?: string | null;
  rulePackId?: string | null;
  rulePackName?: string | null;
  rulePackVersionId?: string | null;
  rulePackVersionLabel?: string | null;
  rulePackOrgano?: string | null;
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

    if (metadata.contentHash) {
      const { data: existing, error: existingError } = await supabase
        .from("evidence_bundles")
        .select("id, document_url, hash_sha512")
        .eq("tenant_id", tenantId)
        .eq("agreement_id", agreementId)
        .eq("manifest->metadata->>contentHash", metadata.contentHash)
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
    const storagePath = `${tenantId}/${agreementId}/${filename}__${contentFragment}.docx`;
    const archivedAt = new Date().toISOString();
    const { error: uploadError, data } = await supabase.storage
      .from("matter-documents")
      .upload(storagePath, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
    // ITEM-109: si la firma fue sandbox, el gate marca el manifest con
    // sandbox:true + sandbox_reason (el status ya es OPEN, nunca SEALED). Así la
    // cadena de custodia no presenta un buffer sin firmar como QES real.
    const persistence = resolveSandboxSafeEvidencePersistence({
      sandbox: metadata.sandbox === true,
      status: "OPEN",
      manifest,
    });
    const effectiveManifest = persistence.manifest;
    const manifestHash = await computeSha256(canonicalJson(effectiveManifest));

    // Insert into evidence_bundles table.
    // F3.G15: populamos `storage_path` (forma nueva, source of truth para
    // la Edge Function sign-evidence-url) y `document_url` con sentinel
    // (compat con legacy callers).
    const { data: bundle, error: insertError } = await supabase.from("evidence_bundles").insert({
      tenant_id: tenantId,
      agreement_id: agreementId,
      // ITEM-044: provenance obligatoria — useAgreementSignedDocumentUrl
      // resuelve el bundle por source_object_type='AGREEMENT' +
      // source_object_id; sin estos campos el documento archivado quedaba
      // irrecuperable desde el expediente.
      source_module: "secretaria",
      source_object_type: "AGREEMENT",
      source_object_id: agreementId,
      manifest: effectiveManifest,
      manifest_hash: manifestHash,
      hash_sha512: hashHex,
      storage_path: storagePath,
      document_url: sentinelUrl,
      signed_by: metadata.signedBy ?? "SISTEMA",
      status: persistence.status,
    }).select("id").maybeSingle();

    if (insertError) {
      return {
        ok: false,
        documentUrl: sentinelUrl,
        hash512: hashHex,
        error: `Evidence bundle no creado: ${insertError.message}`,
      };
    }

    if (!bundle?.id) {
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
