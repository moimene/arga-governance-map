import { supabase } from "@/integrations/supabase/client";
import type { CertificationRegistryIntake } from "./certification-registry-intake";

export interface RegistryFilingCertificationLink {
  schema_version: "registry_certification_link.v1";
  registry_filing_id: string;
  agreement_id: string;
  certification_id: string;
  minute_id: string | null;
  evidence_id: string | null;
  gate_hash: string | null;
  signature_status: string;
  agreement_refs: string[];
  point_refs: string[];
  linked_at: string;
}

export interface PersistRegistryFilingCertificationLinkInput {
  tenantId: string;
  registryFilingId: string;
  agreementId: string;
  certification: CertificationRegistryIntake;
  linkedAt?: string;
}

export interface PersistRegistryFilingCertificationLinkResult {
  link: RegistryFilingCertificationLink;
  artifactHash: string;
  auditLogged: boolean;
  evidenceArtifactCreated: boolean;
  errors: string[];
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

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function buildRegistryFilingCertificationLink(
  input: PersistRegistryFilingCertificationLinkInput,
): RegistryFilingCertificationLink {
  return {
    schema_version: "registry_certification_link.v1",
    registry_filing_id: input.registryFilingId,
    agreement_id: input.agreementId,
    certification_id: input.certification.id,
    minute_id: input.certification.minuteId,
    evidence_id: input.certification.evidenceId,
    gate_hash: input.certification.gateHash,
    signature_status: input.certification.signatureStatus,
    agreement_refs: input.certification.agreementIds,
    point_refs: input.certification.pointReferences,
    linked_at: input.linkedAt ?? new Date().toISOString(),
  };
}

export async function computeRegistryFilingCertificationLinkHash(
  link: RegistryFilingCertificationLink,
) {
  return sha256Hex(canonicalJson(link));
}

export async function persistRegistryFilingCertificationLink(
  input: PersistRegistryFilingCertificationLinkInput,
): Promise<PersistRegistryFilingCertificationLinkResult> {
  const link = buildRegistryFilingCertificationLink(input);
  const artifactHash = await computeRegistryFilingCertificationLinkHash(link);
  const errors: string[] = [];

  const auditPayload = {
    ...link,
    artifact_hash: artifactHash,
  };
  const { error: auditError } = await supabase.from("audit_log").insert({
    tenant_id: input.tenantId,
    action: "REGISTRY_FILING_CERTIFICATION_LINKED",
    object_type: "registry_filings",
    object_id: input.registryFilingId,
    delta: auditPayload,
  });
  if (auditError) errors.push(`audit_log: ${auditError.message}`);

  let evidenceArtifactCreated = false;
  if (input.certification.evidenceId) {
    const { error: artifactError } = await supabase
      .from("evidence_bundle_artifacts")
      .insert({
        bundle_id: input.certification.evidenceId,
        artifact_type: "COMPLIANCE_SNAPSHOT",
        artifact_ref: `registry_filing:${input.registryFilingId}:certification:${input.certification.id}`,
        artifact_hash: artifactHash,
        timestamp_iso: link.linked_at,
        metadata: auditPayload,
      });
    if (artifactError) {
      errors.push(`evidence_bundle_artifacts: ${artifactError.message}`);
    } else {
      evidenceArtifactCreated = true;
    }
  }

  return {
    link,
    artifactHash,
    auditLogged: !auditError,
    evidenceArtifactCreated,
    errors,
  };
}
