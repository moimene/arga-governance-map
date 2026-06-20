import { computeContentHash, generateDocx } from "@/lib/doc-gen/docx-generator";
import { computeSha512 } from "@/lib/doc-gen/storage-archiver";
import { SOURCE_OBJECT_TYPE } from "@/lib/secretaria/evidence-source-types";
import { supabase } from "@/integrations/supabase/client";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface StandaloneCertificationDocumentKind {
  kind_code: string;
  label: string;
  template_binding_key?: string | null;
  disclaimer_policy?: Record<string, unknown> | null;
}

export interface StandaloneCertificationDocumentArtifact {
  id: string;
  title: string;
  document_url?: string | null;
  content_hash?: string | null;
  hash_sha512?: string | null;
  evidence_bundle_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface StandaloneCertificationDocumentRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  body_id?: string | null;
  kind_code: string;
  source_domain: string;
  source_id?: string | null;
  source_payload: unknown;
  source_hash: string;
  source_summary: Record<string, unknown>;
  cutoff_at: string;
  issued_to?: string | null;
  legal_effect: string;
  capa3_payload: Record<string, unknown>;
  certificante_role: string;
  authority_evidence_id?: string | null;
  visto_bueno_persona_id?: string | null;
  requires_visto_bueno: boolean;
  requires_qes: boolean;
  artifact_id?: string | null;
  evidence_bundle_id?: string | null;
  status: string;
  artifact?: StandaloneCertificationDocumentArtifact | null;
  kind?: StandaloneCertificationDocumentKind | null;
}

export interface StandaloneCertificationArchiveInput {
  certification: StandaloneCertificationDocumentRow;
  entityName?: string | null;
  signedBy?: string;
}

export interface StandaloneCertificationArchiveResult {
  artifactId: string;
  evidenceBundleId: string;
  documentUrl: string;
  contentHash: string;
  hashSha512: string;
  storagePath: string;
  reused: boolean;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

async function computeSha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function exactArrayBuffer(buffer: Uint8Array): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function safeFilenamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .toLowerCase();
}

function prettyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "No informado";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function summaryLines(summary: Record<string, unknown>) {
  const entries = Object.entries(summary);
  if (entries.length === 0) return "Sin resumen adicional.";
  return entries.map(([key, value]) => `- ${key}: ${prettyValue(value)}`).join("\n");
}

export function buildStandaloneCertificationFilename(input: {
  certification: Pick<StandaloneCertificationDocumentRow, "id" | "kind_code" | "source_hash">;
  generatedAt?: string;
}) {
  const stamp = (input.generatedAt ?? new Date().toISOString()).replace(/\D/g, "").slice(0, 14);
  const kind = safeFilenamePart(input.certification.kind_code || "certificacion");
  return `${kind}_${stamp}_${input.certification.source_hash.slice(0, 12)}_${input.certification.id.slice(0, 8)}`;
}

export function buildStandaloneCertificationRenderedText(input: {
  certification: StandaloneCertificationDocumentRow;
  entityName?: string | null;
  generatedAt?: string;
}) {
  const { certification } = input;
  const kindLabel = certification.kind?.label ?? certification.artifact?.title ?? certification.kind_code;
  const issuedTo = certification.issued_to ?? certification.capa3_payload?.issued_to ?? "No informado";
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const disclaimer = certification.kind?.disclaimer_policy
    ? JSON.stringify(certification.kind.disclaimer_policy, null, 2)
    : "Certificación emitida con alcance demo operativo y evidencia trazable.";

  return [
    "CERTIFICACIÓN AUTÓNOMA",
    "",
    "DATOS DE EMISIÓN",
    `Tipo: ${kindLabel}`,
    `Sociedad: ${input.entityName ?? certification.entity_id}`,
    `Fecha de corte: ${certification.cutoff_at}`,
    `Fecha de generación: ${generatedAt}`,
    `Destinatario: ${prettyValue(issuedTo)}`,
    `Efecto legal: ${certification.legal_effect}`,
    "",
    "AUTORIDAD CERTIFICANTE",
    `Rol certificante: ${certification.certificante_role}`,
    `Authority evidence: ${certification.authority_evidence_id ?? "Pendiente"}`,
    `Visto bueno requerido: ${certification.requires_visto_bueno ? "Sí" : "No"}`,
    `Persona Vº Bº: ${certification.visto_bueno_persona_id ?? "No aplica"}`,
    `QES EAD Trust requerida: ${certification.requires_qes ? "Sí" : "No"}`,
    "",
    "FUENTE CERTIFICADA",
    `Dominio: ${certification.source_domain}`,
    `Identificador: ${certification.source_id ?? "No aplica"}`,
    `Source hash: ${certification.source_hash}`,
    "",
    "RESUMEN DE FUENTE",
    summaryLines(certification.source_summary ?? {}),
    "",
    "CONTENIDO CERTIFICADO",
    JSON.stringify(certification.source_payload ?? {}, null, 2),
    "",
    "CAMPOS DE EMISIÓN",
    JSON.stringify(certification.capa3_payload ?? {}, null, 2),
    "",
    "CLÁUSULA DE ALCANCE",
    disclaimer,
  ].join("\n");
}

export function buildStandaloneCertificationEvidenceManifest(input: {
  certification: StandaloneCertificationDocumentRow;
  entityName?: string | null;
  artifactId: string;
  storagePath: string;
  filename: string;
  contentHash: string;
  hashSha512: string;
  generatedAt: string;
}) {
  const { certification } = input;
  return {
    version: "standalone-certification-docgen-v1",
    created_at: input.generatedAt,
    tenant_id: certification.tenant_id,
    entity_id: certification.entity_id,
    standalone_certification_id: certification.id,
    artifact_id: input.artifactId,
    source: {
      domain: certification.source_domain,
      id: certification.source_id ?? null,
      hash: certification.source_hash,
      summary: certification.source_summary ?? {},
    },
    certification: {
      kind_code: certification.kind_code,
      label: certification.kind?.label ?? certification.kind_code,
      legal_effect: certification.legal_effect,
      cutoff_at: certification.cutoff_at,
      requires_qes: certification.requires_qes,
      requires_visto_bueno: certification.requires_visto_bueno,
    },
    artifacts: [
      {
        type: "DOCX",
        ref: input.storagePath,
        filename: `${input.filename}.docx`,
        mime_type: DOCX_MIME,
        content_hash: input.contentHash,
        hash_sha512: input.hashSha512,
        timestamp_iso: input.generatedAt,
      },
    ],
    metadata: {
      entity_name: input.entityName ?? null,
      qtsp: "EAD_TRUST",
      evidence_status: "DEMO_OPERATIVA",
      source_object_type: SOURCE_OBJECT_TYPE.STANDALONE_CERTIFICATION,
    },
  };
}

async function linkExistingArchive(input: {
  certification: StandaloneCertificationDocumentRow;
  artifactId: string;
  bundleId: string;
  documentUrl: string;
  contentHash: string;
  hashSha512: string;
  storagePath: string;
}) {
  const { certification } = input;
  const nextMetadata = {
    ...(certification.artifact?.metadata ?? {}),
    standalone_certification_id: certification.id,
    archive_channel: "standalone_certification_docx",
    storage_path: input.storagePath,
    rendered_text_hash: input.contentHash,
    hash_sha512: input.hashSha512,
  };

  const { error: artifactError } = await supabase
    .from("secretaria_document_artifacts")
    .update({
      status: "ARCHIVED",
      document_url: input.documentUrl,
      mime_type: DOCX_MIME,
      content_hash: input.contentHash,
      hash_sha512: input.hashSha512,
      evidence_bundle_id: input.bundleId,
      evidence_status: "DEMO_OPERATIVA",
      metadata: nextMetadata,
      generated_at: new Date().toISOString(),
    })
    .eq("id", input.artifactId)
    .eq("tenant_id", certification.tenant_id);
  if (artifactError) throw artifactError;

  const { error: certError } = await supabase
    .from("standalone_certifications")
    .update({
      evidence_bundle_id: input.bundleId,
      artifact_id: input.artifactId,
      status: certification.status === "EMITTED" ? "EMITTED" : "GENERATED",
    })
    .eq("id", certification.id)
    .eq("tenant_id", certification.tenant_id);
  if (certError) throw certError;
}

export async function archiveStandaloneCertificationDocument(
  input: StandaloneCertificationArchiveInput,
): Promise<StandaloneCertificationArchiveResult> {
  const { certification } = input;
  const artifactId = certification.artifact_id ?? certification.artifact?.id;
  if (!artifactId) throw new Error("La certificación no tiene artefacto documental asociado.");

  if (
    certification.artifact?.document_url &&
    certification.artifact.hash_sha512 &&
    certification.artifact.evidence_bundle_id
  ) {
    const storagePath = certification.artifact.document_url.replace(/^evidence-bundle:\/\//, "");
    const contentHash = certification.artifact.content_hash ?? certification.source_hash;
    await linkExistingArchive({
      certification,
      artifactId,
      bundleId: certification.artifact.evidence_bundle_id,
      documentUrl: certification.artifact.document_url,
      contentHash,
      hashSha512: certification.artifact.hash_sha512,
      storagePath,
    });
    return {
      artifactId,
      evidenceBundleId: certification.artifact.evidence_bundle_id,
      documentUrl: certification.artifact.document_url,
      contentHash,
      hashSha512: certification.artifact.hash_sha512,
      storagePath,
      reused: true,
    };
  }

  const generatedAt = new Date().toISOString();
  const renderedText = buildStandaloneCertificationRenderedText({
    certification,
    entityName: input.entityName,
    generatedAt,
  });
  const contentHash = await computeContentHash(renderedText);
  const buffer = await generateDocx({
    renderedText,
    title: certification.kind?.label ?? certification.artifact?.title ?? "Certificación autónoma",
    subtitle: input.entityName ?? undefined,
    templateTipo: "CERTIFICACION",
    templateVersion: certification.kind?.template_binding_key ?? "standalone-v1",
    contentHash,
    entityName: input.entityName ?? undefined,
    generatedAt: generatedAt.slice(0, 10),
  });
  const uploadBuffer = exactArrayBuffer(buffer);
  const hashSha512 = await computeSha512(uploadBuffer);
  const filename = buildStandaloneCertificationFilename({ certification, generatedAt });
  const storagePath = `${certification.tenant_id}/standalone-certifications/${certification.id}/${filename}__${hashSha512.slice(0, 8)}.docx`;
  const documentUrl = `evidence-bundle://${storagePath}`;

  const { data: existing, error: existingError } = await supabase
    .from("evidence_bundles")
    .select("id, document_url, hash_sha512, storage_path")
    .eq("tenant_id", certification.tenant_id)
    .eq("source_module", "secretaria")
    .eq("source_object_type", SOURCE_OBJECT_TYPE.STANDALONE_CERTIFICATION)
    .eq("source_object_id", certification.id)
    .eq("hash_sha512", hashSha512)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const existingDocumentUrl = existing.document_url ?? documentUrl;
    const existingStoragePath = existing.storage_path ?? storagePath;
    await linkExistingArchive({
      certification,
      artifactId,
      bundleId: existing.id,
      documentUrl: existingDocumentUrl,
      contentHash,
      hashSha512: existing.hash_sha512 ?? hashSha512,
      storagePath: existingStoragePath,
    });
    return {
      artifactId,
      evidenceBundleId: existing.id,
      documentUrl: existingDocumentUrl,
      contentHash,
      hashSha512: existing.hash_sha512 ?? hashSha512,
      storagePath: existingStoragePath,
      reused: true,
    };
  }

  const { error: uploadError } = await supabase.storage
    .from("matter-documents")
    .upload(storagePath, uploadBuffer, {
      contentType: DOCX_MIME,
      upsert: true,
    });
  if (uploadError) throw new Error(`No se pudo archivar el DOCX de certificación: ${uploadError.message}`);

  const manifest = buildStandaloneCertificationEvidenceManifest({
    certification,
    entityName: input.entityName,
    artifactId,
    storagePath,
    filename,
    contentHash,
    hashSha512,
    generatedAt,
  });
  const manifestHash = await computeSha256(canonicalJson(manifest));

  const { data: bundle, error: bundleError } = await supabase
    .from("evidence_bundles")
    .insert({
      tenant_id: certification.tenant_id,
      agreement_id: null,
      reference_code: `CERT-AUT-${certification.id.slice(0, 8).toUpperCase()}`,
      source_module: "secretaria",
      source_object_type: SOURCE_OBJECT_TYPE.STANDALONE_CERTIFICATION,
      source_object_id: certification.id,
      manifest,
      manifest_hash: manifestHash,
      hash_sha512: hashSha512,
      storage_path: storagePath,
      document_url: documentUrl,
      signed_by: input.signedBy ?? "SISTEMA",
      status: "OPEN",
    })
    .select("id")
    .maybeSingle();
  if (bundleError) throw bundleError;
  if (!bundle?.id) throw new Error("Evidence bundle no creado: la inserción no devolvió identificador.");

  await linkExistingArchive({
    certification,
    artifactId,
    bundleId: bundle.id,
    documentUrl,
    contentHash,
    hashSha512,
    storagePath,
  });

  return {
    artifactId,
    evidenceBundleId: bundle.id,
    documentUrl,
    contentHash,
    hashSha512,
    storagePath,
    reused: false,
  };
}
