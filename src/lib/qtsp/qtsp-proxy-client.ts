// ============================================================
// QTSP Proxy Client — invoca la Edge Function `qtsp-proxy`
//
// Las credenciales EAD viven exclusivamente server-side. Esta capa invoca la
// Edge Function para interposición, e-archiving y compatibilidad histórica;
// las acciones genéricas de firma están retiradas y fallan cerrado.
//
// Contrato de fallback: si el proxy no está desplegado o no está configurado
// (503 QTSP_PROXY_NOT_CONFIGURED / función ausente), las funciones devuelven
// `null`. El caller debe mantener el cierre bloqueado; nunca se fabrica éxito
// ni se degrada una operación productiva a sandbox.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type {
  EADSignFlowResult,
} from "./ead-trust-client";

const EDGE_FUNCTION_NAME = "qtsp-proxy";
const BASE64_CHUNK = 0x8000; // 32K — evita reventar la pila con String.fromCharCode
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function proxyErrorText(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const error = typeof body.error === "string" ? body.error.trim() : "";
  const detail = typeof body.detail === "string" ? body.detail.trim() : "";
  const combined = [error, detail].filter(Boolean).join(" · ");
  return combined ? combined.slice(0, 800) : null;
}

export async function edgeFunctionErrorDetail(
  data: unknown,
  error: { message?: string; context?: unknown } | null,
): Promise<string> {
  const direct = proxyErrorText(data);
  if (direct) return direct;

  const context = error?.context;
  if (context && typeof context === "object") {
    const response = context as { clone?: () => Response; json?: () => Promise<unknown> };
    try {
      const readable = typeof response.clone === "function" ? response.clone() : response;
      if (typeof readable.json === "function") {
        const parsed = await readable.json();
        const parsedDetail = proxyErrorText(parsed);
        if (parsedDetail) return parsedDetail;
      }
    } catch {
      // El cuerpo puede haberse consumido o no ser JSON; conserva el mensaje del transporte.
    }
  }

  return error?.message?.trim() || "error desconocido";
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

export interface ProxySignInput {
  documentName: string;
  documentData: ArrayBuffer;
  signatories: Array<{
    name: string;
    email: string;
    surnames?: string;
    sequence?: number;
    personId?: string;
    signerRole?: "PRESIDENTE" | "SECRETARIO" | "CERTIFICANTE" | "VISTO_BUENO" | "ADMINISTRADOR";
    authorityEvidenceId?: string;
  }>;
  createdBy: string;
  agreementId?: string;
  /** Campo de transporte legacy; Secretaría solo admite INTERPOSITION. */
  providerSignatureType?: "INTERPOSITION";
  /** Ancla de firma calculada sobre el PDF real (espacio PDF, origen abajo-izq). */
  signatureAnchor?: { page: number; x: number; y: number };
}

export function buildProxySignPayload(input: ProxySignInput) {
  return {
    action: "sign" as const,
    documentName: input.documentName,
    documentBase64: arrayBufferToBase64(input.documentData),
    // Solo se envían a EAD los campos de su API. Los identificadores jurídicos
    // internos se persisten localmente y nunca se filtran al proveedor.
    signatories: input.signatories.map(({ name, email, surnames, sequence }) => ({
      name,
      email,
      ...(surnames ? { surnames } : {}),
      ...(sequence !== undefined ? { sequence } : {}),
    })),
    createdBy: input.createdBy,
    agreementId: input.agreementId,
    providerSignatureType: input.providerSignatureType ?? "INTERPOSITION",
    signaturePage: input.signatureAnchor?.page,
    signatureX: input.signatureAnchor?.x,
    signatureY: input.signatureAnchor?.y,
  };
}

export type FinalLegalArtifactArchiveInput = {
  sourceId: string;
  contentHash: string;
} & (
  | { sourceDomain: "MINUTE"; artifactKind: "MINUTE_FINAL" }
  | { sourceDomain: "CERTIFICATION"; artifactKind: "CERTIFICATION_FINAL" }
);

export interface FinalLegalArtifactArchiveResult {
  provider: "EAD_TRUST";
  providerName: "EAD Trust";
  service: "EVIDENCE_MANAGER";
  providerMode: "INTERPOSITION";
  custodyMode: "EARCHIVE";
  signatureClaim: false;
  status: "FINAL_IMMUTABLE";
  artifactRole: "CUSTODIED_BINARY";
  sourceDomain: "MINUTE" | "CERTIFICATION";
  sourceId: string;
  artifactKind: "MINUTE_FINAL" | "CERTIFICATION_FINAL";
  /** Artefacto final canónico; su finalización no afirma ni requiere firma. */
  legalArtifactId: string;
  evidenceBundleId: string;
  eadCaseFileId: string;
  eadEvidenceGroupId: string;
  eadEvidenceId: string;
  providerActionReservationId: string;
  contentHashSha256: string;
  binaryHashSha256: string;
  binaryHashSha512: string;
  evidenceManifestHash: string;
  storagePath: string;
  reused: boolean;
}

export function buildFinalLegalArtifactArchivePayload(input: FinalLegalArtifactArchiveInput) {
  return {
    action: "archive_final_legal_artifact" as const,
    sourceDomain: input.sourceDomain,
    sourceId: input.sourceId,
    artifactKind: input.artifactKind,
    contentHash: input.contentHash,
  };
}

export function normalizeFinalLegalArtifactArchiveResult(
  data: unknown,
): FinalLegalArtifactArchiveResult | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  const sourceDomain = value.sourceDomain;
  const artifactKind = value.artifactKind;
  const strings = [
    "sourceId",
    "legalArtifactId",
    "evidenceBundleId",
    "eadCaseFileId",
    "eadEvidenceGroupId",
    "eadEvidenceId",
    "providerActionReservationId",
    "contentHashSha256",
    "binaryHashSha256",
    "binaryHashSha512",
    "evidenceManifestHash",
    "storagePath",
  ] as const;
  if (
    value.provider !== "EAD_TRUST"
    || value.providerName !== "EAD Trust"
    || value.service !== "EVIDENCE_MANAGER"
    || value.providerMode !== "INTERPOSITION"
    || value.custodyMode !== "EARCHIVE"
    || value.signatureClaim !== false
    || value.status !== "FINAL_IMMUTABLE"
    || value.artifactRole !== "CUSTODIED_BINARY"
    || !(
      (sourceDomain === "MINUTE" && artifactKind === "MINUTE_FINAL")
      || (sourceDomain === "CERTIFICATION" && artifactKind === "CERTIFICATION_FINAL")
    )
    || strings.some((key) => typeof value[key] !== "string" || value[key] === "")
    || !UUID_RE.test(String(value.legalArtifactId))
    || !/^[0-9a-f]{64}$/.test(String(value.contentHashSha256))
    || !/^[0-9a-f]{64}$/.test(String(value.binaryHashSha256))
    || !/^[0-9a-f]{128}$/.test(String(value.binaryHashSha512))
    || !/^[0-9a-f]{64}$/.test(String(value.evidenceManifestHash))
    || typeof value.reused !== "boolean"
  ) {
    return null;
  }
  return value as unknown as FinalLegalArtifactArchiveResult;
}

export const ANNUAL_ACCOUNTS_COMPONENT_KINDS = [
  "BALANCE_SHEET",
  "PROFIT_AND_LOSS_STATEMENT",
  "NOTES",
  "CHANGES_IN_EQUITY_STATEMENT",
  "CASH_FLOW_STATEMENT",
  "MANAGEMENT_REPORT",
] as const;

export type AnnualAccountsComponentArchiveKind =
  (typeof ANNUAL_ACCOUNTS_COMPONENT_KINDS)[number];

export interface AnnualAccountsComponentArchiveInput {
  meetingId: string;
  agendaItemId: string;
  fiscalYear: number;
  componentKind: AnnualAccountsComponentArchiveKind;
  documentData: ArrayBuffer;
  documentName: string;
  mimeType: string;
}

export interface AnnualAccountsComponentArchiveResult {
  provider: "EAD_TRUST";
  providerName: "EAD Trust";
  service: "EVIDENCE_MANAGER";
  custodyMode: "EARCHIVE";
  status: "VERIFIED";
  providerStatus: "COMPLETED";
  signatureClaim: false;
  artifactRole: "ANNUAL_ACCOUNTS_COMPONENT";
  componentKind: AnnualAccountsComponentArchiveKind;
  tenantId: string;
  entityId: string;
  bodyId: string;
  meetingId: string;
  agendaItemId: string;
  matterCode: "FORMULACION_CUENTAS";
  fiscalYear: number;
  evidenceBundleId: string;
  eadCaseFileId: string;
  eadEvidenceGroupId: string;
  eadEvidenceId: string;
  providerActionReservationId: string;
  binaryHashSha256: string;
  binaryHashSha512: string;
  evidenceManifestHash: string;
  storagePath: string;
  storageObjectId: string;
  storageVersion: string;
  reused: boolean;
}

export function buildAnnualAccountsComponentArchivePayload(
  input: AnnualAccountsComponentArchiveInput,
) {
  return {
    action: "archive_annual_accounts_component_input" as const,
    meetingId: input.meetingId,
    agendaItemId: input.agendaItemId,
    fiscalYear: input.fiscalYear,
    componentKind: input.componentKind,
    documentBase64: arrayBufferToBase64(input.documentData),
    fileName: input.documentName,
    mimeType: input.mimeType,
  };
}

export function normalizeAnnualAccountsComponentArchiveResult(
  data: unknown,
): AnnualAccountsComponentArchiveResult | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  const uuidFields = [
    value.tenantId,
    value.entityId,
    value.bodyId,
    value.meetingId,
    value.agendaItemId,
    value.evidenceBundleId,
    value.providerActionReservationId,
  ];
  const providerIds = [value.eadCaseFileId, value.eadEvidenceGroupId, value.eadEvidenceId];
  const hashes64 = [value.binaryHashSha256, value.evidenceManifestHash, value.storageVersion];
  if (
    value.provider !== "EAD_TRUST"
    || value.providerName !== "EAD Trust"
    || value.service !== "EVIDENCE_MANAGER"
    || value.custodyMode !== "EARCHIVE"
    || value.status !== "VERIFIED"
    || value.providerStatus !== "COMPLETED"
    || value.signatureClaim !== false
    || value.artifactRole !== "ANNUAL_ACCOUNTS_COMPONENT"
    || !ANNUAL_ACCOUNTS_COMPONENT_KINDS.includes(
      value.componentKind as AnnualAccountsComponentArchiveKind,
    )
    || value.matterCode !== "FORMULACION_CUENTAS"
    || !Number.isInteger(value.fiscalYear)
    || (value.fiscalYear as number) < 1900
    || (value.fiscalYear as number) > 9999
    || uuidFields.some((item) => typeof item !== "string" || !UUID_RE.test(item))
    || providerIds.some((item) => typeof item !== "string" || item === "")
    || hashes64.some((hash) => typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash))
    || typeof value.binaryHashSha512 !== "string"
    || !/^[0-9a-f]{128}$/.test(value.binaryHashSha512)
    || typeof value.storagePath !== "string"
    || value.storagePath === ""
    || value.storagePath.includes("..")
    || /^https?:/i.test(value.storagePath)
    || value.storageObjectId !== value.storagePath
    || value.storageVersion !== value.binaryHashSha256
    || typeof value.reused !== "boolean"
  ) return null;
  return value as unknown as AnnualAccountsComponentArchiveResult;
}

export type VerifiedEADInterpositionReconciliationInput = {
  signatureRequestId: string;
  sourceId: string;
  contentHash: string;
  /** Nombre de archivo solo para la copia privada que recupera el Edge desde EAD. */
  fileName?: string;
} & (
  | { sourceDomain: "MINUTE"; artifactKind: "MINUTE_FINAL" }
  | { sourceDomain: "CERTIFICATION"; artifactKind: "CERTIFICATION_FINAL" }
);

/** Alias de transporte para consumidores anteriores; la semántica ya no es firma. */
export type VerifiedEADSignatureReconciliationInput =
  VerifiedEADInterpositionReconciliationInput;

export interface VerifiedEADInterpositionEvidenceResult {
  signerRole: "PRESIDENTE" | "SECRETARIO" | "CERTIFICANTE" | "VISTO_BUENO";
  subjectPersonId: string;
  providerSignatoryId: string;
  evidencePurpose: "CONSENT" | "CONSTANCIA";
  evidenceId: string;
}

export interface VerifiedEADInterpositionReconciliationResult {
  provider: "EAD_TRUST";
  providerName: "EAD Trust";
  service: "EVIDENCE_MANAGER";
  providerMode: "INTERPOSITION";
  signatureClaim: false;
  status: "VERIFIED";
  artifactRole: "CUSTODIED_BINARY";
  sourceDomain: "MINUTE" | "CERTIFICATION";
  sourceId: string;
  artifactKind: "MINUTE_FINAL" | "CERTIFICATION_FINAL";
  signatureRequestId: string;
  providerRequestId: string;
  providerDocumentId: string;
  providerStatus: "COMPLETED";
  providerRequestedAt: string;
  providerCompletedAt: string;
  requestInputHashSha256: string;
  custodiedBinaryHashSha256: string;
  custodiedBinaryHashSha512: string;
  legalArtifactId: string;
  custodyEvidenceBundleId: string;
  custodyEvidenceId: string;
  storagePath: string;
  completionEvidenceDocumentRef: string;
  completionEvidencePackageRef: string;
  completionEvidenceFingerprintSha256: string;
  completionPackageFingerprintSha256: string;
  interpositionEvidences: VerifiedEADInterpositionEvidenceResult[];
  reusedCustody: boolean;
}

/** Alias compatible: el resultado representa interposición/custodia, no firma. */
export type VerifiedEADSignatureReconciliationResult =
  VerifiedEADInterpositionReconciliationResult;

export function buildVerifiedEADSignatureReconciliationPayload(
  input: VerifiedEADInterpositionReconciliationInput,
) {
  return {
    action: "reconcile_verified_signature" as const,
    signatureRequestId: input.signatureRequestId,
    sourceDomain: input.sourceDomain,
    sourceId: input.sourceId,
    artifactKind: input.artifactKind,
    contentHash: input.contentHash,
    fileName: input.fileName,
  };
}

export function normalizeVerifiedEADInterpositionReconciliationResult(
  data: unknown,
): VerifiedEADInterpositionReconciliationResult | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  const sourceDomain = value.sourceDomain;
  const artifactKind = value.artifactKind;
  const uuidFields = [
    value.sourceId,
    value.signatureRequestId,
    value.legalArtifactId,
    value.custodyEvidenceBundleId,
    value.custodyEvidenceId,
  ];
  const hashes64 = [
    value.requestInputHashSha256,
    value.custodiedBinaryHashSha256,
    value.completionEvidenceFingerprintSha256,
    value.completionPackageFingerprintSha256,
  ];
  const requiredStrings = [
    value.providerRequestId,
    value.providerDocumentId,
    value.providerRequestedAt,
    value.providerCompletedAt,
    value.storagePath,
    value.completionEvidenceDocumentRef,
    value.completionEvidencePackageRef,
  ];
  const evidences = value.interpositionEvidences;
  const forbiddenSignatureClaims = [
    "providerSignatureType",
    "signaturePackaging",
    "signedAt",
    "signedOutputHashSha256",
    "signedOutputHashSha512",
    "signatureEvidenceBundleId",
    "signatoryVerifications",
  ];
  if (
    value.provider !== "EAD_TRUST"
    || value.providerName !== "EAD Trust"
    || value.service !== "EVIDENCE_MANAGER"
    || value.providerMode !== "INTERPOSITION"
    || value.signatureClaim !== false
    || value.status !== "VERIFIED"
    || value.artifactRole !== "CUSTODIED_BINARY"
    || value.providerStatus !== "COMPLETED"
    || !(
      (sourceDomain === "MINUTE" && artifactKind === "MINUTE_FINAL")
      || (sourceDomain === "CERTIFICATION" && artifactKind === "CERTIFICATION_FINAL")
    )
    || uuidFields.some((id) => typeof id !== "string" || !UUID_RE.test(id))
    || requiredStrings.some((item) => typeof item !== "string" || item === "")
    || hashes64.some((hash) => typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash))
    || typeof value.custodiedBinaryHashSha512 !== "string"
    || !/^[0-9a-f]{128}$/.test(value.custodiedBinaryHashSha512)
    || !Number.isFinite(Date.parse(String(value.providerRequestedAt)))
    || !Number.isFinite(Date.parse(String(value.providerCompletedAt)))
    || Date.parse(String(value.providerRequestedAt)) > Date.parse(String(value.providerCompletedAt))
    || Date.parse(String(value.providerCompletedAt)) > Date.now()
    || !/^https:\/\//i.test(String(value.completionEvidenceDocumentRef))
    || !/^https:\/\//i.test(String(value.completionEvidencePackageRef))
    || String(value.storagePath).includes("..")
    || /^https?:/i.test(String(value.storagePath))
    || forbiddenSignatureClaims.some((key) => key in value)
    || !Array.isArray(evidences)
    || evidences.length === 0
    || typeof value.reusedCustody !== "boolean"
  ) return null;

  const evidenceIds = new Set<string>();
  const persons = new Set<string>();
  for (const raw of evidences) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const evidence = raw as Record<string, unknown>;
    const role = String(evidence.signerRole);
    const purpose = String(evidence.evidencePurpose);
    if (
      !["PRESIDENTE", "SECRETARIO", "CERTIFICANTE", "VISTO_BUENO"].includes(role)
      || (role === "PRESIDENTE" ? purpose !== "CONSENT" : purpose !== "CONSTANCIA")
      || typeof evidence.subjectPersonId !== "string"
      || !UUID_RE.test(evidence.subjectPersonId)
      || typeof evidence.evidenceId !== "string"
      || !UUID_RE.test(evidence.evidenceId)
      || typeof evidence.providerSignatoryId !== "string"
      || evidence.providerSignatoryId === ""
      || evidenceIds.has(evidence.evidenceId)
      || persons.has(evidence.subjectPersonId)
    ) return null;
    evidenceIds.add(evidence.evidenceId);
    persons.add(evidence.subjectPersonId);
  }
  return value as unknown as VerifiedEADInterpositionReconciliationResult;
}

export const normalizeVerifiedEADSignatureReconciliationResult =
  normalizeVerifiedEADInterpositionReconciliationResult;

export interface AnnualAccountsSignatureReconciliationInput {
  signatureRequestId: string;
  annualAccountsSetId: string;
  contentHash: string;
  fileName?: string;
}

export interface AnnualAccountsSignatureReconciliationBlocked {
  code: "REVIEWED_EXTERNAL_SIGNATURE_REQUIRED";
  signatureClaim: false;
  replacementAction: "record_annual_accounts_external_signature";
  error: string;
}

export function buildAnnualAccountsSignatureReconciliationPayload(
  input: AnnualAccountsSignatureReconciliationInput,
) {
  return {
    action: "reconcile_annual_accounts_signature" as const,
    signatureRequestId: input.signatureRequestId,
    annualAccountsSetId: input.annualAccountsSetId,
    contentHash: input.contentHash,
    fileName: input.fileName,
  };
}

export function normalizeAnnualAccountsSignatureReconciliationResult(
  data: unknown,
): AnnualAccountsSignatureReconciliationBlocked | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (
    value.code !== "REVIEWED_EXTERNAL_SIGNATURE_REQUIRED"
    || value.signatureClaim !== false
    || value.replacementAction !== "record_annual_accounts_external_signature"
    || typeof value.error !== "string"
    || value.error.length === 0
  ) return null;
  return value as unknown as AnnualAccountsSignatureReconciliationBlocked;
}

export type AnnualAccountsExternalSignatureFactSource =
  | "REVIEWED_SIGNED_DOCUMENT"
  | "REVIEWED_WET_INK_SCAN"
  | "REVIEWED_EXTERNAL_SIGNATURE_REPORT";

export interface AnnualAccountsExternalSignatureReviewInput {
  expectedSignerId: string;
  signedAt: string;
  signatureFactSource: AnnualAccountsExternalSignatureFactSource;
  reviewNote: string;
  documentData: ArrayBuffer;
}

export interface AnnualAccountsExternalSignatureReviewResult {
  reviewEventId: string;
  reviewStatus: "VERIFIED";
  reviewedAt: string;
  reused: boolean;
}

export async function reviewAnnualAccountsExternalSignature(
  input: AnnualAccountsExternalSignatureReviewInput,
): Promise<AnnualAccountsExternalSignatureReviewResult> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", input.documentData));
  const documentHashSha256 = Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data, error } = await supabase.rpc(
    "fn_secretaria_review_annual_accounts_external_signature" as never,
    {
      p_expected_signer_id: input.expectedSignerId,
      p_document_hash_sha256: documentHashSha256,
      p_signed_at: input.signedAt,
      p_signature_fact_source: input.signatureFactSource,
      p_review_note: input.reviewNote,
    } as never,
  );
  if (error) throw new Error(`No se pudo registrar la revisión inmutable: ${error.message}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("La revisión inmutable no devolvió un evento válido.");
  }
  const value = data as Record<string, unknown>;
  if (
    typeof value.review_event_id !== "string"
    || !UUID_RE.test(value.review_event_id)
    || value.review_status !== "VERIFIED"
    || typeof value.reviewed_at !== "string"
    || !Number.isFinite(Date.parse(value.reviewed_at))
    || typeof value.reused !== "boolean"
  ) throw new Error("La revisión inmutable devolvió un contrato incompleto.");
  return {
    reviewEventId: value.review_event_id,
    reviewStatus: "VERIFIED",
    reviewedAt: value.reviewed_at,
    reused: value.reused,
  };
}

export interface AnnualAccountsExternalSignatureEvidenceInput {
  annualAccountsSetId: string;
  expectedSignerId: string;
  signedAt: string;
  signatureFactSource: AnnualAccountsExternalSignatureFactSource;
  reviewEventId: string;
  documentData: ArrayBuffer;
  fileName: string;
  mimeType?: "application/pdf";
  supersedesOutcomeId?: string | null;
}

export interface AnnualAccountsExternalSignatureEvidenceResult {
  provider: "EAD_TRUST";
  providerName: "EAD Trust";
  service: "EVIDENCE_MANAGER";
  providerMode: "INTERPOSITION";
  signatureClaim: false;
  status: "EXTERNAL_SIGNATURE_EVIDENCE_RECORDED";
  sourceDomain: "ANNUAL_ACCOUNTS";
  sourceId: string;
  expectedSignerId: string;
  personId: string;
  evidenceBundleId: string;
  interpositionEvidenceId: string;
  outcome: Record<string, unknown>;
  signedAt: string;
  reviewedAt: string;
  reviewEventId: string;
  providerActionReservationId: string;
  signatureFactSource: AnnualAccountsExternalSignatureFactSource;
  binaryHashSha256: string;
  binaryHashSha512: string;
  storagePath: string;
  rosterComplete: boolean;
  executionState: Record<string, unknown> | null;
  reused: boolean;
}

export function buildAnnualAccountsExternalSignatureEvidencePayload(
  input: AnnualAccountsExternalSignatureEvidenceInput,
) {
  return {
    action: "record_annual_accounts_external_signature" as const,
    annualAccountsSetId: input.annualAccountsSetId,
    expectedSignerId: input.expectedSignerId,
    signedAt: input.signedAt,
    signatureFactSource: input.signatureFactSource,
    reviewEventId: input.reviewEventId,
    supersedesOutcomeId: input.supersedesOutcomeId ?? null,
    documentBase64: arrayBufferToBase64(input.documentData),
    fileName: input.fileName,
    mimeType: input.mimeType ?? "application/pdf",
  };
}

export function normalizeAnnualAccountsExternalSignatureEvidenceResult(
  data: unknown,
): AnnualAccountsExternalSignatureEvidenceResult | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  const uuidFields = [
    value.sourceId,
    value.expectedSignerId,
    value.personId,
    value.evidenceBundleId,
    value.interpositionEvidenceId,
    value.reviewEventId,
    value.providerActionReservationId,
  ];
  if (
    value.provider !== "EAD_TRUST"
    || value.providerName !== "EAD Trust"
    || value.service !== "EVIDENCE_MANAGER"
    || value.providerMode !== "INTERPOSITION"
    || value.signatureClaim !== false
    || value.status !== "EXTERNAL_SIGNATURE_EVIDENCE_RECORDED"
    || value.sourceDomain !== "ANNUAL_ACCOUNTS"
    || uuidFields.some((id) => typeof id !== "string" || !UUID_RE.test(id))
    || typeof value.outcome !== "object"
    || value.outcome === null
    || Array.isArray(value.outcome)
    || ![
      "REVIEWED_SIGNED_DOCUMENT",
      "REVIEWED_WET_INK_SCAN",
      "REVIEWED_EXTERNAL_SIGNATURE_REPORT",
    ].includes(String(value.signatureFactSource))
    || typeof value.signedAt !== "string"
    || !Number.isFinite(Date.parse(value.signedAt))
    || typeof value.reviewedAt !== "string"
    || !Number.isFinite(Date.parse(value.reviewedAt))
    || Date.parse(value.signedAt) > Date.parse(value.reviewedAt)
    || Date.parse(value.reviewedAt) > Date.now()
    || typeof value.binaryHashSha256 !== "string"
    || !/^[0-9a-f]{64}$/.test(value.binaryHashSha256)
    || typeof value.binaryHashSha512 !== "string"
    || !/^[0-9a-f]{128}$/.test(value.binaryHashSha512)
    || typeof value.storagePath !== "string"
    || value.storagePath === ""
    || value.storagePath.includes("..")
    || /^https?:/i.test(value.storagePath)
    || typeof value.rosterComplete !== "boolean"
    || (value.rosterComplete && (
      !value.executionState
      || typeof value.executionState !== "object"
      || Array.isArray(value.executionState)
      || (value.executionState as Record<string, unknown>).status
        !== "EXTERNAL_SIGNATURE_ROSTER_COMPLETE"
    ))
    || (!value.rosterComplete && value.executionState !== null)
    || typeof value.reused !== "boolean"
    || "providerSignatureType" in value
    || "signaturePackaging" in value
  ) return null;
  return value as unknown as AnnualAccountsExternalSignatureEvidenceResult;
}

export type AnnualAccountsMissingSignatureCauseCode =
  | "DEATH"
  | "ILLNESS_OR_INCAPACITY"
  | "DISAGREEMENT"
  | "UNREACHABLE"
  | "OTHER_JUSTIFIED";

export interface AnnualAccountsMissingSignatureCauseInput {
  annualAccountsSetId: string;
  expectedSignerId: string;
  causeCode: AnnualAccountsMissingSignatureCauseCode;
  causeText: string;
  supersedesOutcomeId?: string | null;
}

export function buildAnnualAccountsMissingSignatureCausePayload(
  input: AnnualAccountsMissingSignatureCauseInput,
) {
  return {
    action: "record_annual_accounts_missing_signature_cause" as const,
    annualAccountsSetId: input.annualAccountsSetId,
    expectedSignerId: input.expectedSignerId,
    causeCode: input.causeCode,
    causeText: input.causeText,
    supersedesOutcomeId: input.supersedesOutcomeId ?? null,
  };
}

export interface AnnualAccountsMissingSignatureCauseResult {
  status: "MISSING_SIGNATURE_CAUSE_RECORDED";
  sourceDomain: "ANNUAL_ACCOUNTS";
  sourceId: string;
  expectedSignerId: string;
  causeCode: AnnualAccountsMissingSignatureCauseCode;
  outcome: Record<string, unknown>;
  rosterComplete: boolean;
  executionState: Record<string, unknown> | null;
}

export function normalizeAnnualAccountsMissingSignatureCauseResult(
  data: unknown,
): AnnualAccountsMissingSignatureCauseResult | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (
    value.status !== "MISSING_SIGNATURE_CAUSE_RECORDED"
    || value.sourceDomain !== "ANNUAL_ACCOUNTS"
    || typeof value.sourceId !== "string" || !UUID_RE.test(value.sourceId)
    || typeof value.expectedSignerId !== "string" || !UUID_RE.test(value.expectedSignerId)
    || !["DEATH", "ILLNESS_OR_INCAPACITY", "DISAGREEMENT", "UNREACHABLE", "OTHER_JUSTIFIED"]
      .includes(String(value.causeCode))
    || !value.outcome || typeof value.outcome !== "object" || Array.isArray(value.outcome)
    || typeof value.rosterComplete !== "boolean"
    || (value.rosterComplete && (
      !value.executionState
      || typeof value.executionState !== "object"
      || Array.isArray(value.executionState)
      || (value.executionState as Record<string, unknown>).status
        !== "EXTERNAL_SIGNATURE_ROSTER_COMPLETE"
    ))
    || (!value.rosterComplete && value.executionState !== null)
  ) return null;
  return value as unknown as AnnualAccountsMissingSignatureCauseResult;
}

export interface AnnualAccountsExecutionArchiveInput {
  annualAccountsSetId: string;
  contentHash: string;
}

export interface AnnualAccountsExecutionArchiveResult {
  provider: "EAD_TRUST";
  providerName: "EAD Trust";
  service: "EVIDENCE_MANAGER";
  status: "FINAL_ARCHIVED";
  sourceDomain: "ANNUAL_ACCOUNTS";
  sourceId: string;
  artifactKind: "ANNUAL_ACCOUNTS_EXECUTION";
  contentHashSha256: string;
  executionArtifactId: string;
  evidenceBundleId: string;
  executionManifestHashSha256: string;
  binaryHashSha256: string;
  binaryHashSha512: string;
  storagePath: string;
  eadCaseFileId: string;
  eadEvidenceGroupId: string;
  eadEvidenceId: string;
  providerActionReservationId: string;
  providerMode: "INTERPOSITION";
  signatureClaim: false;
  executionState: Record<string, unknown>;
  reused: boolean;
  reusedStorage: boolean;
}

export function buildAnnualAccountsExecutionArchivePayload(
  input: AnnualAccountsExecutionArchiveInput,
) {
  return {
    action: "archive_annual_accounts_execution" as const,
    annualAccountsSetId: input.annualAccountsSetId,
    contentHash: input.contentHash,
  };
}

export function normalizeAnnualAccountsExecutionArchiveResult(
  data: unknown,
): AnnualAccountsExecutionArchiveResult | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (
    value.provider !== "EAD_TRUST"
    || value.providerName !== "EAD Trust"
    || value.service !== "EVIDENCE_MANAGER"
    || value.status !== "FINAL_ARCHIVED"
    || value.sourceDomain !== "ANNUAL_ACCOUNTS"
    || value.artifactKind !== "ANNUAL_ACCOUNTS_EXECUTION"
    || [
      value.sourceId,
      value.executionArtifactId,
      value.evidenceBundleId,
      value.providerActionReservationId,
    ]
      .some((id) => typeof id !== "string" || !UUID_RE.test(id))
    || [value.contentHashSha256, value.executionManifestHashSha256, value.binaryHashSha256]
      .some((hash) => typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash))
    || typeof value.binaryHashSha512 !== "string"
    || !/^[0-9a-f]{128}$/.test(value.binaryHashSha512)
    || [value.storagePath, value.eadCaseFileId, value.eadEvidenceGroupId, value.eadEvidenceId]
      .some((item) => typeof item !== "string" || item === "")
    || String(value.storagePath).includes("..")
    || /^https?:/i.test(String(value.storagePath))
    || value.providerMode !== "INTERPOSITION"
    || value.signatureClaim !== false
    || !value.executionState
    || typeof value.executionState !== "object"
    || Array.isArray(value.executionState)
    || (value.executionState as Record<string, unknown>).status
      !== "EXTERNAL_SIGNATURE_ROSTER_COMPLETE"
    || typeof value.reused !== "boolean"
    || typeof value.reusedStorage !== "boolean"
  ) return null;
  return value as unknown as AnnualAccountsExecutionArchiveResult;
}

export function normalizeProxySignResult(data: unknown): EADSignFlowResult | null {
  if (!data || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  if (
    typeof r.srId !== "string"
    || typeof r.documentId !== "string"
    || typeof r.documentHash !== "string"
    || r.providerSignatureType !== "INTERPOSITION"
    || typeof r.providerRequestedAt !== "string"
    || !Number.isFinite(Date.parse(r.providerRequestedAt))
    || Date.parse(r.providerRequestedAt) > Date.now()
    || (
      r.providerActivatedAt !== undefined
      && (
        typeof r.providerActivatedAt !== "string"
        || !Number.isFinite(Date.parse(r.providerActivatedAt))
        || Date.parse(r.providerActivatedAt) < Date.parse(r.providerRequestedAt)
      )
    )
  ) {
    return null;
  }
  return {
    srId: r.srId,
    // El `caseFileId` permite consultar el estado y recuperar los artefactos
    // del proceso EAD. La finalización del proveedor no afirma nivel de firma.
    caseFileId: typeof r.caseFileId === "string" ? r.caseFileId : undefined,
    srStatus: typeof r.srStatus === "string" ? r.srStatus : "ACTIVE",
    documentId: r.documentId,
    documentHash: r.documentHash,
    providerSignatureType: r.providerSignatureType,
    providerRequestedAt: r.providerRequestedAt,
    providerActivatedAt: typeof r.providerActivatedAt === "string" ? r.providerActivatedAt : undefined,
    signatoryIds: Array.isArray(r.signatoryIds)
      ? r.signatoryIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [],
  };
}

/**
 * Solicita una actuación real de EAD Trust en modo INTERPOSITION. El resultado
 * de esta llamada no se presenta como firma electrónica ni como nivel eIDAS.
 * @returns el resultado del flujo, o `null` si el proxy no está disponible/configurado
 *          (el caller decide el fallback). Lanza si el proxy SÍ está configurado
 *          pero el flujo QTSP falla — un fallo real no debe degradar a sandbox.
 */
/**
 * ¿Está prohibido llamar al QTSP real en este entorno?
 *
 * Bajo e2e SÍ. Las pruebas apuntan al Supabase de Cloud, donde el proxy está
 * desplegado y con credenciales, de modo que cada ejecución creaba solicitudes
 * de firma REALES en EAD Trust —con expediente y aviso al firmante— por el mero
 * hecho de pasar un test. Una batería de pruebas no puede tener efectos
 * jurídicos en un proveedor externo.
 *
 * Sin proxy real, el flujo cae al adaptador sandbox, que es lo que una prueba
 * automática debe ejercitar.
 */
export function isRealQTSPForbidden(envOverride?: Record<string, unknown>): boolean {
  const env = envOverride ?? (import.meta as { env?: Record<string, unknown> }).env ?? {};
  return env.VITE_E2E === "1" || env.VITE_E2E === true;
}

export async function invokeQTSPProxySign(
  _input: ProxySignInput,
  onProgress?: (step: string) => void,
  _guard?: { forbidRealQTSP?: boolean },
): Promise<EADSignFlowResult | null> {
  const message = "La firma electrónica genérica está retirada; use custodia/e-archiving source-bound.";
  onProgress?.(message);
  throw new Error(message);
}

// ─── Reconciliación y artefactos ─────────────────────────────────────────────
//
// EAD **no emite webhooks**: la integración es de consulta. Sin reconciliar, un
// expediente se queda en "interposición solicitada" aunque EAD haya completado
// el proceso. Estas dos llamadas permiten consultar y custodiar el resultado.

export interface ProxySignatureStatus {
  signatureRequestId: string;
  providerRequestId: string;
  status: string;
  documents: Array<{ id: string; status: string }>;
}

export interface ProxySignatureArtifacts {
  signatureRequestId: string;
  providerRequestId: string;
  providerDocumentId: string;
  /** Output recuperable del proceso EAD. Su custodia no acredita firma. */
  signedDocumentUrl: string | null;
  signedDocumentError: string | null;
  /** Constancia del proceso; se conserva separada del documento. */
  certificateUrl: string | null;
  certificateError: string | null;
  certificatePackageUrl: string | null;
}

async function invokeProxy<T>(
  body: Record<string, unknown>,
  guard?: { forbidRealQTSP?: boolean },
): Promise<T | null> {
  if (guard?.forbidRealQTSP ?? isRealQTSPForbidden()) return null;
  let data: unknown;
  let error: { message?: string; context?: { status?: number } } | null;
  try {
    const res = await supabase.functions.invoke(EDGE_FUNCTION_NAME, { body });
    data = res.data;
    error = res.error as typeof error;
  } catch {
    return null;
  }
  if (error) {
    const status = error.context?.status;
    if (status === 503 || status === 404) return null;
    const detail = await edgeFunctionErrorDetail(data, error);
    throw new Error(`QTSP proxy: ${detail}`);
  }
  if ((data as { code?: string } | null)?.code === "QTSP_PROXY_NOT_CONFIGURED") return null;
  return (data ?? null) as T | null;
}

/**
 * Ruta deliberadamente cerrada: el navegador no es una fuente autoritativa de
 * bytes finales. Se conserva la firma nominal para que los consumidores fallen
 * de forma explícita mientras se implementa el renderer server-side.
 */
export async function archiveFinalLegalArtifactWithEADTrust(
  _input: FinalLegalArtifactArchiveInput,
  onProgress?: (step: string) => void,
  _guard?: { forbidRealQTSP?: boolean },
): Promise<FinalLegalArtifactArchiveResult | null> {
  const message =
    "AUTHORITATIVE_BINARY_REQUIRED: la custodia final exige un binario generado y registrado en servidor; "
    + "el candidato del navegador solo puede descargarse para revisión.";
  onProgress?.(message);
  throw new Error(message);
}

export const invokeQTSPProxyArchiveFinalLegalArtifact = archiveFinalLegalArtifactWithEADTrust;

/**
 * Custodia un componente de cuentas anuales en Evidence Manager. `VERIFIED`
 * solo se acepta cuando el Edge ha observado `COMPLETED` para esos mismos
 * bytes y ha creado el objeto privado content-addressed. No existe afirmación
 * de firma en este flujo.
 */
export async function archiveAnnualAccountsComponentWithEADTrust(
  input: AnnualAccountsComponentArchiveInput,
  onProgress?: (step: string) => void,
  guard?: { forbidRealQTSP?: boolean },
): Promise<AnnualAccountsComponentArchiveResult | null> {
  onProgress?.("Validando el punto de formulación y entregando el componente a EAD Trust…");
  const response = await invokeProxy<unknown>(
    buildAnnualAccountsComponentArchivePayload(input),
    guard,
  );
  if (response === null) return null;
  const normalized = normalizeAnnualAccountsComponentArchiveResult(response);
  if (!normalized) {
    throw new Error("QTSP proxy: respuesta inválida de custodia de componente de cuentas anuales");
  }
  onProgress?.("Componente verificado y conservado por EAD Trust Evidence Manager.");
  return normalized;
}

/** Consulta el estado real de la solicitud en el proveedor. */
export async function fetchQTSPSignatureStatus(
  signatureRequestId: string,
): Promise<ProxySignatureStatus | null> {
  if (!signatureRequestId) return null;
  return invokeProxy<ProxySignatureStatus>({ action: "status", signatureRequestId });
}

/**
 * Recupera las URLs de los artefactos de una interposición completada. El
 * output y la constancia del proceso se custodian y hash-vinculan por separado.
 */
export async function fetchQTSPSignatureArtifacts(
  signatureRequestId: string,
): Promise<ProxySignatureArtifacts | null> {
  if (!signatureRequestId) return null;
  return invokeProxy<ProxySignatureArtifacts>({
    action: "artifacts",
    signatureRequestId,
  });
}

/**
 * Cierra el ciclo autoritativo de interposición. El browser solo aporta el UUID
 * interno de una solicitud visible y las coordenadas del artefacto canónico. El
 * Edge recupera el output, lo custodia como CUSTODIED_BINARY y registra
 * consentimiento/constancia con `signatureClaim=false`.
 */
export async function reconcileVerifiedEADInterposition(
  input: VerifiedEADInterpositionReconciliationInput,
  onProgress?: (step: string) => void,
  guard?: { forbidRealQTSP?: boolean },
): Promise<VerifiedEADInterpositionReconciliationResult | null> {
  onProgress?.("Verificando la finalización real en EAD Trust…");
  const response = await invokeProxy<unknown>(
    buildVerifiedEADSignatureReconciliationPayload(input),
    guard,
  );
  if (response === null) return null;
  const normalized = normalizeVerifiedEADSignatureReconciliationResult(response);
  if (!normalized) throw new Error("QTSP proxy: respuesta inválida de reconciliación autoritativa");
  onProgress?.("Output EAD recuperado, custodiado y reconciliado sin claim de firma.");
  return normalized;
}

/** Alias de API para consumidores legacy; conserva semántica INTERPOSITION. */
export const reconcileVerifiedEADSignature = reconcileVerifiedEADInterposition;

/**
 * Ruta legacy cerrada: la mera finalización de una solicitud EAD no acredita la
 * firma de las cuentas anuales. Cada administrador requiere un hecho de firma
 * externa revisado sobre un documento custodiado o una causa individual.
 */
export async function reconcileAnnualAccountsEADSignature(
  input: AnnualAccountsSignatureReconciliationInput,
  onProgress?: (step: string) => void,
  guard?: { forbidRealQTSP?: boolean },
): Promise<AnnualAccountsSignatureReconciliationBlocked | null> {
  onProgress?.("Comprobando la política de evidencias de cuentas anuales…");
  const response = await invokeProxy<unknown>(
    buildAnnualAccountsSignatureReconciliationPayload(input),
    guard,
  );
  if (response === null) return null;
  const normalized = normalizeAnnualAccountsSignatureReconciliationResult(response);
  if (!normalized) {
    throw new Error("QTSP proxy: respuesta inválida de política de cuentas anuales");
  }
  onProgress?.("Se exige revisión humana de la firma externa; la custodia EAD no la sustituye.");
  return normalized;
}

/**
 * Registra, para una persona concreta del roster congelado, la firma externa
 * observada por un revisor autenticado y custodia el PDF en EAD Evidence
 * Manager. EAD no afirma la firma: `signatureClaim` permanece siempre `false`.
 */
export async function recordAnnualAccountsExternalSignatureEvidence(
  input: AnnualAccountsExternalSignatureEvidenceInput,
  onProgress?: (step: string) => void,
  guard?: { forbidRealQTSP?: boolean },
): Promise<AnnualAccountsExternalSignatureEvidenceResult | null> {
  onProgress?.("Custodiando en EAD el documento de firma externa revisado…");
  const response = await invokeProxy<unknown>(
    buildAnnualAccountsExternalSignatureEvidencePayload(input),
    guard,
  );
  if (response === null) return null;
  const normalized = normalizeAnnualAccountsExternalSignatureEvidenceResult(response);
  if (!normalized) {
    throw new Error("QTSP proxy: respuesta inválida de evidencia externa de cuentas anuales");
  }
  onProgress?.("Hecho de firma externa revisado y documento custodiado por interposición EAD.");
  return normalized;
}

/** Persists an explicit legal cause under the caller's authenticated identity. */
export async function recordAnnualAccountsMissingSignatureCause(
  input: AnnualAccountsMissingSignatureCauseInput,
  guard?: { forbidRealQTSP?: boolean },
): Promise<AnnualAccountsMissingSignatureCauseResult | null> {
  const response = await invokeProxy<unknown>(
    buildAnnualAccountsMissingSignatureCausePayload(input),
    guard,
  );
  if (response === null) return null;
  const normalized = normalizeAnnualAccountsMissingSignatureCauseResult(response);
  if (!normalized) throw new Error("QTSP proxy: respuesta inválida de causa individual de cuentas anuales");
  return normalized;
}

/**
 * Fail-closed until the server can render and register the execution binary.
 * Browser-generated bytes are never accepted as the final annual-accounts
 * artifact. The strict result normalizer remains for historical records only.
 */
export async function archiveAnnualAccountsExecutionWithEADTrust(
  _input: AnnualAccountsExecutionArchiveInput,
  onProgress?: (step: string) => void,
  _guard?: { forbidRealQTSP?: boolean },
): Promise<AnnualAccountsExecutionArchiveResult | null> {
  const message =
    "AUTHORITATIVE_BINARY_REQUIRED: la custodia final de cuentas anuales requiere un binario generado y registrado de forma autoritativa en servidor.";
  onProgress?.(message);
  throw new Error(message);
}
