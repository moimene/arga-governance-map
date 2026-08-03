// ============================================================
// qtsp-proxy — frontera server-side para EAD Enterprise Suite
//
// v1 apuntaba a la Digital Trust API de Factory (Okta client_credentials,
// host api.int.gcloudfactory.com). VERIFICADO EMPÍRICAMENTE 2026-07-06: ese
// host es interno (allowlist/VPN) e inalcanzable desde Supabase Edge y desde
// Internet público (timeout 15s) — la firma colgaba hasta el IDLE_TIMEOUT.
// v2 usa la EAD Enterprise Suite (https://api-eadcustody.eadtrust.gocertius.io,
// pública, 401 en 0.18s), el mismo backend que usa la plataforma de
// contratación (ADR-001 g_contract_review_platform) vía el MCP oficial
// @g-digital/mcp-ead-enterprise-suite.
//
// Secretos requeridos (supabase secrets set …):
//   EAD_SUITE_AUTH_EMAIL, EAD_SUITE_AUTH_PASSWORD,
//   EAD_SUITE_API_BASE_URL (default https://api-eadcustody.eadtrust.gocertius.io)
// (Los EAD_TRUST_* de v1 quedan ignorados a propósito.)
//
// Sin secretos → 503 { code: "QTSP_PROXY_NOT_CONFIGURED" }. Un fallo real del
// proveedor devuelve error y nunca se convierte en éxito o sandbox.
//
// Política vigente: EAD Trust actúa por interposición para mensajería y
// custodia/e-archiving. Las acciones genéricas sign/status/artifacts/evidence
// están retiradas. Los helpers históricos de solicitudes solo sirven para
// reconciliar filas source-bound preexistentes y nunca atribuyen QES, firma
// avanzada o firma simple al proveedor.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tgms-e2e-no-external",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000; // lección v1: sin timeout, un upstream colgado = 150s idle
const READY_TIMEOUT_MS = 90_000; // procesado async del documento (~30s típico)
const SIGN_DEADLINE_DAYS = 7; // la Suite rechaza deadlines a más de ~10 días
const DOCUMENT_BUCKET = "matter-documents";
const ANNUAL_ACCOUNTS_COMPONENT_KINDS = [
  "BALANCE_SHEET",
  "PROFIT_AND_LOSS_STATEMENT",
  "NOTES",
  "CHANGES_IN_EQUITY_STATEMENT",
  "CASH_FLOW_STATEMENT",
  "MANAGEMENT_REPORT",
] as const;
type AnnualAccountsComponentKind = (typeof ANNUAL_ACCOUNTS_COMPONENT_KINDS)[number];

const ANNUAL_ACCOUNTS_COMPONENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
  "text/plain",
  "application/octet-stream",
]);

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8" },
  });
}

// ─── Config ──────────────────────────────────────────────────────────────────

interface SuiteConfig {
  baseUrl: string;
  email: string;
  password: string;
}

function readConfig(): SuiteConfig | null {
  const email = Deno.env.get("EAD_SUITE_AUTH_EMAIL") ?? "";
  const password = Deno.env.get("EAD_SUITE_AUTH_PASSWORD") ?? "";
  const baseUrl = (Deno.env.get("EAD_SUITE_API_BASE_URL") ?? "https://api-eadcustody.eadtrust.gocertius.io").replace(/\/$/, "");
  if (!email || !password) return null;
  return { baseUrl, email, password };
}

// ─── Sesión (cache por instancia; el JWT dura ~1h) ───────────────────────────

let sessionCache: { jwt: string; expiresAt: number } | null = null;
const SESSION_TTL_MS = 50 * 60 * 1000;

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

async function getJwt(cfg: SuiteConfig): Promise<string> {
  const now = Date.now();
  if (sessionCache && sessionCache.expiresAt > now) return sessionCache.jwt;

  const response = await timedFetch(`${cfg.baseUrl}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cfg.email, password: cfg.password }),
  });
  if (response.status === 409) {
    // Gate de textos legales: la cuenta tiene términos pendientes de aceptar.
    // No se auto-aceptan términos desde un proxy: acción humana requerida.
    const text = await response.text();
    throw new Error(`Suite session 409 (términos legales pendientes de aceptación en la cuenta): ${text.slice(0, 300)}`);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Suite session failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  if (!data?.jwt) throw new Error("Suite session: respuesta sin jwt");
  sessionCache = { jwt: data.jwt, expiresAt: now + SESSION_TTL_MS };
  return data.jwt;
}

async function suiteFetch(cfg: SuiteConfig, path: string, init: RequestInit, step: string): Promise<Record<string, unknown>> {
  const jwt = await getJwt(cfg);
  const response = await timedFetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${step} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  if (response.status === 204) return {};
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256(data: Uint8Array): Promise<{ hex: string; b64: string }> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer));
  const hex = Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
  let binary = "";
  digest.forEach((b) => { binary += String.fromCharCode(b); });
  return { hex, b64: btoa(binary) };
}

async function sha512Hex(data: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-512", data.buffer as ArrayBuffer));
  return Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

async function sha256Text(value: string): Promise<string> {
  return (await sha256(new TextEncoder().encode(value))).hex;
}

function normalizedProviderTimestamp(
  payload: Record<string, unknown>,
  ...keys: string[]
): string | null {
  const nested = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data as Record<string, unknown>
    : {};
  for (const key of keys) {
    const value = payload[key] ?? nested[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const epoch = Date.parse(value);
    if (Number.isFinite(epoch) && epoch <= Date.now()) return new Date(epoch).toISOString();
  }
  return null;
}

async function deterministicUuid(key: string, namespace: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${namespace}:${key}`)),
  ).slice(0, 16);
  // EAD valida UUID v4 en los recursos creados por cliente. Conservamos una
  // identidad estable para reintentos, pero con versión/variante v4 válidas;
  // un UUID v5-shaped es rechazado por la API con `isUuid`.
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function providerReference(value: string | undefined): Promise<string | undefined> {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  // El campo `reference` de Case File es corto. La referencia completa se
  // conserva en el manifiesto TGMS; EAD recibe un handle estable y sin PII.
  return `TGMS-${(await sha256Text(normalized)).slice(0, 24)}`;
}

async function uploadToS3(presignedUrl: string, bytes: Uint8Array, sha256Base64: string): Promise<void> {
  // La URL prefirmada está firmada con SignedHeaders=host;x-amz-checksum-sha256:
  // sin ese header (base64, no hex) → 403 SignatureDoesNotMatch.
  const response = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "x-amz-checksum-sha256": sha256Base64 },
    body: bytes.buffer as ArrayBuffer,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`S3 upload failed (${response.status})`);
}

/** Resuelve un useCaseId utilizable (evita el use-case personal "PR", que solo
 *  admite un case file por cuenta). Cache por instancia. */
let useCaseCache: string | null = null;
async function resolveUseCaseId(cfg: SuiteConfig): Promise<string> {
  if (useCaseCache) return useCaseCache;
  const res = await suiteFetch(cfg, "/use-cases", { method: "GET" }, "listUseCases");
  const rows = (res.data as Array<{ id?: string; code?: string }> | undefined) ?? [];
  const general = rows.find((u) => u.code && u.code !== "PR") ?? rows[0];
  if (!general?.id) throw new Error("Suite: la cuenta no tiene use-cases disponibles");
  useCaseCache = general.id;
  return general.id;
}

// ─── Acción: sign ────────────────────────────────────────────────────────────

async function handleSign(req: Request, _cfg: SuiteConfig | null): Promise<Response> {
  const auth = await authenticateEdgeRequest(req);
  if (auth instanceof Response) return auth;
  return jsonResponse(410, {
    code: "GENERIC_PROVIDER_ACTION_RETIRED",
    error:
      "La acción genérica sign está retirada: no tiene fuente, participantes ni bytes "
      + "derivados de una reserva local autoritativa. Use únicamente acciones de custodia "
      + "EAD vinculadas a una fuente canónica.",
    providerMode: "INTERPOSITION",
    signatureClaim: false,
  });
}

// ─── Acción: status ──────────────────────────────────────────────────────────

async function handleStatus(
  req: Request,
  _cfg: SuiteConfig | null,
  _signatureRequestId: string,
): Promise<Response> {
  const auth = await authenticateEdgeRequest(req);
  if (auth instanceof Response) return auth;
  return jsonResponse(410, {
    code: "GENERIC_PROVIDER_ACTION_RETIRED",
    error: "La consulta genérica al proveedor está retirada; use la reconciliación ligada a fuente, tenant y hash.",
  });
}

// ─── Acción legacy: artifacts ────────────────────────────────────────────────
// Retirada: la recuperación admitida vive dentro de la reconciliación exacta de
// una fuente canónica y archiva por separado output y evidencias del proveedor.

async function handleArtifacts(
  req: Request,
  _cfg: SuiteConfig | null,
  _signatureRequestId: string,
): Promise<Response> {
  const auth = await authenticateEdgeRequest(req);
  if (auth instanceof Response) return auth;
  return jsonResponse(410, {
    code: "GENERIC_PROVIDER_ACTION_RETIRED",
    error: "La descarga genérica de artefactos está retirada; use la reconciliación source-bound y su custodia inmutable.",
  });
}

// ─── Acción: evidence (grupo FILE → evidencia → subida → close → poll) ───────

interface EadEvidenceResult {
  evidenceId: string;
  caseFileId: string;
  evidenceGroupId: string;
  status: "COMPLETED";
  hash: string;
  verifiedAt: string;
}

async function suiteMutationAllowConflict(
  cfg: SuiteConfig,
  path: string,
  body: Record<string, unknown>,
  step: string,
): Promise<{ reused: boolean; data: Record<string, unknown> }> {
  const jwt = await getJwt(cfg);
  const response = await timedFetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  if (response.status === 409) return { reused: true, data: {} };
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${step} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  if (response.status === 204) return { reused: false, data: {} };
  const text = await response.text();
  return { reused: false, data: text ? JSON.parse(text) : {} };
}

function extractEvidenceStatus(detail: Record<string, unknown>): string {
  if (typeof detail.status === "string") return detail.status.toUpperCase();
  const nested = (detail.status as { status?: unknown } | undefined)?.status;
  return typeof nested === "string" ? nested.toUpperCase() : "PENDING";
}

async function createEadEvidence(
  cfg: SuiteConfig,
  input: {
    title: string;
    fileName: string;
    bytes: Uint8Array;
    sha256Hex: string;
    sha256Base64: string;
    idempotencyKey: string;
    reference?: string;
  },
): Promise<EadEvidenceResult> {
  const caseFileId = await deterministicUuid(input.idempotencyKey, "ead-case-file");
  const groupId = await deterministicUuid(input.idempotencyKey, "ead-evidence-group");
  const evidenceId = await deterministicUuid(input.idempotencyKey, "ead-evidence");
  const useCaseId = await resolveUseCaseId(cfg);

  await suiteMutationAllowConflict(cfg, "/case-files", {
    id: caseFileId,
    name: `Custodia — ${input.title}`.slice(0, 120),
    description: `Custodia y e-archiving EAD Trust — ${input.title}`.slice(0, 300),
    reference: await providerReference(input.reference ?? input.idempotencyKey),
    useCaseId,
  }, "createCustodyCaseFile");

  await suiteMutationAllowConflict(cfg, "/evidence-groups", {
    id: groupId,
    caseFileId,
    evidenceType: "FILE",
    name: input.title.slice(0, 120),
  }, "createCustodyEvidenceGroup");

  await suiteMutationAllowConflict(cfg, "/evidences", {
    id: evidenceId,
    caseFileId,
    evidenceGroupId: groupId,
    hash: input.sha256Hex,
    title: input.title,
    custodyType: "EXTERNAL",
    fileName: input.fileName,
  }, "createCustodyEvidence");

  const evidencePath = `/case-files/${caseFileId}/evidence-groups/${groupId}/evidences/${evidenceId}`;
  let detail = await suiteFetch(cfg, evidencePath, { method: "GET" }, "getCustodyEvidence");
  let finalStatus = extractEvidenceStatus(detail);

  if (finalStatus !== "COMPLETED") {
    const uploadRes = await suiteFetch(
      cfg,
      `${evidencePath}/upload-url`,
      {
        method: "POST",
        body: JSON.stringify({ hash: input.sha256Hex, fileName: input.fileName }),
      },
      "getCustodyUploadUrl",
    );
    const uploadFileUrl = uploadRes.uploadFileUrl;
    if (typeof uploadFileUrl !== "string" || !uploadFileUrl) {
      throw new Error("EAD Trust Evidence Manager no devolvió uploadFileUrl");
    }
    await uploadToS3(uploadFileUrl, input.bytes, input.sha256Base64);

    await suiteMutationAllowConflict(
      cfg,
      `/case-files/${caseFileId}/evidence-groups/${groupId}/close`,
      { evidencesCount: 1 },
      "closeCustodyEvidenceGroup",
    );

    const deadlineMs = Date.now() + 60_000;
    while (Date.now() < deadlineMs) {
      detail = await suiteFetch(cfg, evidencePath, { method: "GET" }, "getCustodyEvidence");
      finalStatus = extractEvidenceStatus(detail);
      if (finalStatus === "COMPLETED" || finalStatus === "ERROR") break;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  if (finalStatus !== "COMPLETED") {
    throw new Error(`Evidencia ${evidenceId} terminó en estado ${finalStatus}`);
  }

  return {
    evidenceId,
    caseFileId,
    evidenceGroupId: groupId,
    status: "COMPLETED",
    hash: input.sha256Hex,
    verifiedAt: new Date().toISOString(),
  };
}

interface EvidenceBody {
  title?: string;
  fileName?: string;
  documentBase64?: string;
  createdBy?: string;
}

async function handleEvidence(req: Request, _cfg: SuiteConfig | null, _body: EvidenceBody): Promise<Response> {
  const auth = await authenticateEdgeRequest(req);
  if (auth instanceof Response) return auth;
  return jsonResponse(410, {
    code: "GENERIC_PROVIDER_ACTION_RETIRED",
    error:
      "La acción genérica evidence está retirada porque no puede vincularse a una fuente "
      + "canónica. Use una acción de custodia source-bound.",
    providerMode: "INTERPOSITION",
    signatureClaim: false,
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

// Custodia autoritativa SIN fabricar firma: Evidence Manager acredita la
// interposición de EAD Trust y la conservación del binario exacto.
type LegalArtifactSourceDomain = "MINUTE" | "CERTIFICATION";
type LegalArtifactKind = "MINUTE_FINAL" | "CERTIFICATION_FINAL";

interface ArchiveFinalLegalArtifactBody {
  sourceDomain?: string;
  sourceId?: string;
  artifactKind?: string;
  contentHash?: string;
}

// El tenant demo canónico usa un UUID semántico (0000…0001), por lo que no
// se restringen bits de versión/variante: sí se exige la forma UUID completa.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function nestedObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nestedString(value: unknown, ...path: string[]): string | null {
  let current: unknown = value;
  for (const part of path) current = nestedObject(current)[part];
  return typeof current === "string" ? current : null;
}

function normalizeArchiveFileName(value: unknown, artifactKind: LegalArtifactKind): string {
  const fallback = artifactKind === "MINUTE_FINAL" ? "acta-final.bin" : "certificacion-final.bin";
  if (typeof value !== "string") return fallback;
  const safe = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 160);
  return safe || fallback;
}

function resolveArchiveMimeType(fileName: string, requested: unknown): string {
  const allowed = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ]);
  if (typeof requested === "string" && allowed.has(requested)) return requested;
  if (fileName.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (fileName.toLowerCase().endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

function validateExistingCustodyBundle(
  bundle: Record<string, unknown>,
  expected: {
    tenantId: string;
    sourceDomain: LegalArtifactSourceDomain;
    sourceId: string;
    processKind: "ACTA" | "CERTIFICACION";
    contentHash: string;
    binaryHashSha256: string;
    binaryHashSha512: string;
    artifactRole: "UNSIGNED_INPUT" | "CUSTODIED_BINARY";
    legalHold: boolean;
  },
): boolean {
  const manifest = nestedObject(bundle.manifest);
  return bundle.tenant_id === expected.tenantId
    && bundle.source_object_type === expected.sourceDomain
    && bundle.source_object_id === expected.sourceId
    && bundle.status === "VERIFIED"
    && bundle.legal_hold === expected.legalHold
    && bundle.hash_sha512 === expected.binaryHashSha512
    && nestedString(manifest, "source", "domain") === expected.sourceDomain
    && nestedString(manifest, "source", "id") === expected.sourceId
    && nestedString(manifest, "source", "process_kind") === expected.processKind
    && nestedString(manifest, "source", "content_hash_sha256") === expected.contentHash
    && nestedString(manifest, "binary", "hash_sha256") === expected.binaryHashSha256
    && nestedString(manifest, "binary", "hash_sha512") === expected.binaryHashSha512
    && nestedString(manifest, "binary", "artifact_role") === expected.artifactRole
    && nestedString(manifest, "verification", "trust_boundary") === "SERVICE_EARCHIVE"
    && nestedString(manifest, "verification", "provider") === "EAD_TRUST"
    && nestedString(manifest, "verification", "service") === "EVIDENCE_MANAGER"
    && nestedString(manifest, "verification", "provider_mode") === "INTERPOSITION"
    && nestedObject(manifest.verification).signature_claim === false
    && nestedObject(manifest.verification).sandbox !== true;
}

async function handleArchiveFinalLegalArtifact(
  req: Request,
  _cfg: SuiteConfig | null,
  _body: ArchiveFinalLegalArtifactBody,
): Promise<Response> {
  const authenticated = await authenticateEdgeRequest(req);
  if (authenticated instanceof Response) return authenticated;

  // Fail closed: un hash del texto canónico no demuestra que un DOCX/PDF
  // construido en el navegador sea su render semánticamente equivalente.
  // Esta ruta se reabrirá únicamente cuando los bytes procedan de un renderer
  // server-side registrado y verificable. No se inspecciona el cuerpo binario,
  // no se contacta EAD y no se invoca ninguna RPC de finalización.
  return jsonResponse(409, {
    code: "AUTHORITATIVE_BINARY_REQUIRED",
    error:
      "La custodia final exige un binario generado y registrado de forma autoritativa en servidor; "
      + "un candidato del navegador no puede convertirse en artefacto legal final.",
    providerMode: "INTERPOSITION",
    signatureClaim: false,
    finalArtifactCreated: false,
  });
}

// ─── Compatibilidad histórica: reconciliar procesos EAD preexistentes ───────

interface ReconcileVerifiedSignatureBody {
  signatureRequestId?: string;
  sourceDomain?: string;
  sourceId?: string;
  artifactKind?: string;
  contentHash?: string;
  fileName?: string;
}

type EdgeSupabaseClient = ReturnType<typeof createClient>;

async function databaseJsonbHashSha256(
  adminClient: EdgeSupabaseClient,
  value: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await adminClient.rpc("fn_secretaria_jsonb_hash_sha256", {
    p_value: value,
  });
  if (error || typeof data !== "string" || !SHA256_PATTERN.test(data)) {
    throw new Error(
      `database JSONB hash failed: ${error?.message ?? "RPC did not return a SHA-256 digest"}`,
    );
  }
  return data;
}

interface AuthenticatedClients {
  userClient: EdgeSupabaseClient;
  adminClient: EdgeSupabaseClient;
  userId: string;
}

interface CanonicalLegalSource {
  sourceDomain: LegalArtifactSourceDomain;
  sourceId: string;
  artifactKind: LegalArtifactKind;
  tenantId: string;
  contentHash: string;
  legalGateStatus: string;
  entityId: string;
  bodyId: string;
  meetingId: string | null;
  agreementsCertified: string[];
  authorityEvidenceId: string | null;
  vistoBuenoPersonaId: string | null;
  certificanteRole: string | null;
}

interface PersistedSignatureRequest {
  id: string;
  tenant_id: string;
  agreement_id: string | null;
  source_domain: string | null;
  source_id: string | null;
  artifact_kind: string | null;
  content_hash_sha256: string | null;
  document_hash: string;
  document_type: string;
  sr_id: string;
  sr_status: string;
  document_id: string;
  signatories: unknown;
  evidence_id: string | null;
  evidence_status: string | null;
  requested_at: string;
  completed_at: string | null;
}

interface VerifiedSignerBinding {
  personId: string;
  signerRole: "PRESIDENTE" | "SECRETARIO" | "CERTIFICANTE" | "VISTO_BUENO";
  authorityEvidenceId: string;
  providerSignatoryId: string;
  providerParticipantId: string;
  caseFileId: string;
  providerMode: "INTERPOSITION";
}

interface ProviderSignatoryOutcome {
  providerSignatoryId: string;
  providerParticipantId: string;
  status: "SIGNED" | "COMPLETED" | "ACCEPTED" | "CONFIRMED";
  statusAt: string;
}

interface ProviderCompletion {
  status: "COMPLETED";
  providerMode: "INTERPOSITION";
  requestedAt: string;
  completedAt: string;
  outputDocumentUrl: string;
  completionEvidenceDocumentUrl: string;
  completionPackageUrl: string;
  providerSignatoryIds: Set<string>;
  providerSignatoryOutcomes: ProviderSignatoryOutcome[];
}

async function authenticateEdgeRequest(req: Request): Promise<AuthenticatedClients | Response> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { error: "missing bearer token" });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: "edge function misconfigured" });
  }
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return jsonResponse(401, { error: "invalid or expired token" });
  return {
    userClient,
    adminClient: createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } }),
    userId: data.user.id,
  };
}

type EadReservationSourceDomain =
  | "MINUTE"
  | "CERTIFICATION"
  | "ANNUAL_ACCOUNTS"
  | "ANNUAL_ACCOUNTS_COMPONENT";

type EadReservationActionKind =
  | "SOURCE_CUSTODY"
  | "EXTERNAL_SIGNATURE_CUSTODY"
  | "ANNUAL_ACCOUNTS_EXECUTION_EARCHIVE"
  | "ANNUAL_ACCOUNTS_COMPONENT_EARCHIVE";

async function reserveEadProviderAction(
  userClient: EdgeSupabaseClient,
  input: {
    sourceDomain: EadReservationSourceDomain;
    sourceId: string;
    actionKind: EadReservationActionKind;
    subjectKey?: string;
    sourceHashSha256: string;
    payloadHashSha256: string;
    context?: Record<string, unknown>;
  },
): Promise<string | Response> {
  const { data, error } = await userClient.rpc("fn_secretaria_reserve_ead_provider_action", {
    p_source_domain: input.sourceDomain,
    p_source_id: input.sourceId,
    p_action_kind: input.actionKind,
    p_subject_key: input.subjectKey ?? "",
    p_source_hash_sha256: input.sourceHashSha256,
    p_payload_hash_sha256: input.payloadHashSha256,
    p_reservation_context: input.context ?? {},
  });
  if (error || typeof data !== "string" || !UUID_PATTERN.test(data)) {
    return jsonResponse(409, {
      code: "EAD_PROVIDER_ACTION_NOT_RESERVED",
      error: "No se pudo reservar localmente la acción EAD sobre la fuente y hash exactos.",
      detail: error?.message ?? "reservation RPC did not return an id",
    });
  }
  return data;
}

function parseLegalArtifactCoordinates(body: ReconcileVerifiedSignatureBody): {
  sourceDomain: LegalArtifactSourceDomain;
  sourceId: string;
  artifactKind: LegalArtifactKind;
  contentHash: string;
  signatureRequestId: string;
} | null {
  const sourceDomain = (body.sourceDomain ?? "").trim().toUpperCase() as LegalArtifactSourceDomain;
  const sourceId = (body.sourceId ?? "").trim().toLowerCase();
  const artifactKind = (body.artifactKind ?? "").trim().toUpperCase() as LegalArtifactKind;
  const contentHash = (body.contentHash ?? "").trim().toLowerCase();
  const signatureRequestId = (body.signatureRequestId ?? "").trim().toLowerCase();
  if (
    !UUID_PATTERN.test(sourceId)
    || !UUID_PATTERN.test(signatureRequestId)
    || !SHA256_PATTERN.test(contentHash)
    || !(
      (sourceDomain === "MINUTE" && artifactKind === "MINUTE_FINAL")
      || (sourceDomain === "CERTIFICATION" && artifactKind === "CERTIFICATION_FINAL")
    )
  ) return null;
  return { sourceDomain, sourceId, artifactKind, contentHash, signatureRequestId };
}

async function readCanonicalLegalSource(
  userClient: EdgeSupabaseClient,
  coordinates: NonNullable<ReturnType<typeof parseLegalArtifactCoordinates>>,
): Promise<CanonicalLegalSource | Response> {
  const lookup = coordinates.sourceDomain === "MINUTE"
    ? await userClient
      .from("minutes")
      .select("id, tenant_id, entity_id, body_id, meeting_id, content_hash, legal_gate_status")
      .eq("id", coordinates.sourceId)
      .maybeSingle()
    : await userClient
      .from("certifications")
      .select("id, tenant_id, minute_id, body_id, entity_id, content, content_hash_sha256, legal_gate_status, agreements_certified, authority_evidence_id, visto_bueno_persona_id, certificante_role")
      .eq("id", coordinates.sourceId)
      .maybeSingle();
  if (lookup.error) return jsonResponse(500, { error: "source lookup failed", detail: lookup.error.message });
  if (!lookup.data) return jsonResponse(404, { error: "source not found or access denied" });

  const row = lookup.data as Record<string, unknown>;
  const tenantId = typeof row.tenant_id === "string" ? row.tenant_id : "";
  const entityId = typeof row.entity_id === "string" ? row.entity_id : "";
  const bodyId = typeof row.body_id === "string" ? row.body_id : "";
  const legalGateStatus = typeof row.legal_gate_status === "string"
    ? row.legal_gate_status.toUpperCase()
    : "";
  const expectedContentHash = coordinates.sourceDomain === "MINUTE"
    ? (typeof row.content_hash === "string" ? row.content_hash.toLowerCase() : "")
    : typeof row.content_hash_sha256 === "string" && SHA256_PATTERN.test(row.content_hash_sha256)
      ? row.content_hash_sha256.toLowerCase()
      : typeof row.content === "string"
        ? await sha256Text(row.content)
        : "";
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(entityId) || !UUID_PATTERN.test(bodyId)) {
    return jsonResponse(409, { error: "source has no valid tenant/entity/body" });
  }
  if (expectedContentHash !== coordinates.contentHash) {
    return jsonResponse(409, { error: "contentHash does not match canonical source content" });
  }
  const allowed = coordinates.sourceDomain === "MINUTE"
    ? new Set(["MANIFEST_READY", "ARTIFACT_FINAL"])
    : new Set(["DRAFT", "ARTIFACT_FINAL"]);
  if (!allowed.has(legalGateStatus)) {
    return jsonResponse(409, { error: "source legal gate is not finalizable" });
  }
  return {
    sourceDomain: coordinates.sourceDomain,
    sourceId: coordinates.sourceId,
    artifactKind: coordinates.artifactKind,
    tenantId,
    contentHash: expectedContentHash,
    legalGateStatus,
    entityId,
    bodyId,
    meetingId: typeof row.meeting_id === "string"
      ? row.meeting_id
      : typeof row.minute_id === "string" ? row.minute_id : null,
    agreementsCertified: Array.isArray(row.agreements_certified)
      ? row.agreements_certified.filter((value): value is string => typeof value === "string")
      : [],
    authorityEvidenceId: typeof row.authority_evidence_id === "string" ? row.authority_evidence_id : null,
    vistoBuenoPersonaId: typeof row.visto_bueno_persona_id === "string" ? row.visto_bueno_persona_id : null,
    certificanteRole: typeof row.certificante_role === "string" ? row.certificante_role.toUpperCase() : null,
  };
}

async function readVisibleSignatureRequest(
  userClient: EdgeSupabaseClient,
  signatureRequestId: string,
): Promise<PersistedSignatureRequest | Response> {
  const { data, error } = await userClient
    .from("qtsp_signature_requests")
    .select("id, tenant_id, agreement_id, source_domain, source_id, artifact_kind, content_hash_sha256, document_hash, document_type, sr_id, sr_status, document_id, signatories, evidence_id, evidence_status, requested_at, completed_at")
    .eq("id", signatureRequestId)
    .maybeSingle();
  if (error) return jsonResponse(500, { error: "signature request lookup failed", detail: error.message });
  if (!data) return jsonResponse(404, { error: "signature request not found or access denied" });
  const row = data as Record<string, unknown>;
  if (
    typeof row.id !== "string"
    || typeof row.tenant_id !== "string"
    || typeof row.document_hash !== "string"
    || !SHA256_PATTERN.test(row.document_hash.toLowerCase())
    || typeof row.requested_at !== "string"
    || !Number.isFinite(Date.parse(row.requested_at))
    || typeof row.sr_id !== "string" || !row.sr_id.trim()
    || typeof row.document_id !== "string" || !row.document_id.trim()
  ) return jsonResponse(409, { error: "persisted signature request is incomplete" });
  return row as unknown as PersistedSignatureRequest;
}

function providerField(payload: Record<string, unknown>, ...keys: string[]): unknown {
  const nested = nestedObject(payload.data);
  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null) return payload[key];
    if (nested[key] !== undefined && nested[key] !== null) return nested[key];
  }
  return undefined;
}

function providerString(payload: Record<string, unknown>, ...keys: string[]): string | null {
  const value = providerField(payload, ...keys);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickProviderUrl(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = providerString(payload, key);
    if (value && /^https:\/\//i.test(value)) return value;
  }
  return null;
}

async function downloadProviderBytes(url: string, label: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${label} download failed (${response.status})`);
  const declaredSize = Number(response.headers.get("content-length") ?? "0");
  if (declaredSize > MAX_DOCUMENT_BYTES) throw new Error(`${label} exceeds maximum size`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    throw new Error(`${label} size is outside the accepted range`);
  }
  return {
    bytes,
    mimeType: response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream",
  };
}

function parseVerifiedSignerBindings(
  request: PersistedSignatureRequest,
  source: CanonicalLegalSource,
): VerifiedSignerBinding[] | Response {
  if (!Array.isArray(request.signatories) || request.signatories.length === 0) {
    return jsonResponse(409, { error: "signature request has no persisted signer bindings" });
  }
  const allowedRoles = new Set(["PRESIDENTE", "SECRETARIO", "CERTIFICANTE", "VISTO_BUENO"]);
  const bindings: VerifiedSignerBinding[] = [];
  for (const raw of request.signatories) {
    const signer = nestedObject(raw);
    const personId = typeof signer.person_id === "string" ? signer.person_id.toLowerCase() : "";
    const signerRole = typeof signer.signer_role === "string" ? signer.signer_role.toUpperCase() : "";
    const authorityEvidenceId = typeof signer.authority_evidence_id === "string"
      ? signer.authority_evidence_id.toLowerCase()
      : "";
    const providerSignatoryId = typeof signer.provider_signatory_id === "string"
      ? signer.provider_signatory_id.trim()
      : "";
    const providerParticipantId = typeof signer.provider_participant_id === "string"
      ? signer.provider_participant_id.trim()
      : "";
    const caseFileId = typeof signer.case_file_id === "string" ? signer.case_file_id.trim() : "";
    const sourceDomain = typeof signer.source_domain === "string" ? signer.source_domain.toUpperCase() : "";
    const sourceId = typeof signer.source_id === "string" ? signer.source_id.toLowerCase() : "";
    const artifactKind = typeof signer.artifact_kind === "string" ? signer.artifact_kind.toUpperCase() : "";
    const contentHash = typeof signer.content_hash_sha256 === "string"
      ? signer.content_hash_sha256.toLowerCase()
      : "";
    // Campo legacy de la solicitud. En Secretaría solo se acepta el valor
    // INTERPOSITION y se proyecta como modo de servicio, nunca como nivel de firma.
    const persistedProviderMode = typeof signer.provider_signature_type === "string"
      ? signer.provider_signature_type.toUpperCase()
      : "";
    if (
      !UUID_PATTERN.test(personId)
      || !UUID_PATTERN.test(authorityEvidenceId)
      || !providerSignatoryId
      || !providerParticipantId
      || !caseFileId
      || !allowedRoles.has(signerRole)
      || sourceDomain !== source.sourceDomain
      || sourceId !== source.sourceId
      || artifactKind !== source.artifactKind
      || contentHash !== source.contentHash
      || persistedProviderMode !== "INTERPOSITION"
    ) {
      return jsonResponse(409, {
        error: "signer binding is incomplete or not bound to the canonical legal source",
      });
    }
    bindings.push({
      personId,
      signerRole: signerRole as VerifiedSignerBinding["signerRole"],
      authorityEvidenceId,
      providerSignatoryId,
      providerParticipantId,
      caseFileId,
      providerMode: "INTERPOSITION",
    });
  }

  const uniqueness = (values: string[]) => new Set(values).size === values.length;
  if (
    !uniqueness(bindings.map((signer) => signer.personId))
    || !uniqueness(bindings.map((signer) => signer.providerSignatoryId))
    || !uniqueness(bindings.map((signer) => signer.providerParticipantId))
    || !uniqueness(bindings.map((signer) => signer.signerRole))
    || new Set(bindings.map((signer) => signer.caseFileId)).size !== 1
  ) return jsonResponse(409, { error: "signer identities, roles and provider references must be unique" });

  const roles = new Set(bindings.map((signer) => signer.signerRole));
  if (source.sourceDomain === "MINUTE") {
    if (bindings.length !== 2 || !roles.has("PRESIDENTE") || !roles.has("SECRETARIO")) {
      return jsonResponse(409, { error: "minute requires distinct PRESIDENTE and SECRETARIO bindings" });
    }
  } else {
    const needsVistoBueno = Boolean(source.vistoBuenoPersonaId);
    if (
      !roles.has("CERTIFICANTE")
      || (needsVistoBueno && !roles.has("VISTO_BUENO"))
      || (!needsVistoBueno && roles.has("VISTO_BUENO"))
      || bindings.length !== (needsVistoBueno ? 2 : 1)
    ) return jsonResponse(409, { error: "certification signer bindings do not match its authority model" });
  }
  return bindings;
}

async function assertSignerAuthority(
  userClient: EdgeSupabaseClient,
  source: CanonicalLegalSource,
  signers: Array<VerifiedSignerBinding & { occurredAt: string }>,
): Promise<Response | null> {
  const authorityIds = signers.map((signer) => signer.authorityEvidenceId);
  const { data, error } = await userClient
    .from("authority_evidence")
    .select("id, tenant_id, entity_id, body_id, person_id, cargo, fecha_inicio, fecha_fin, estado, inscripcion_rm_referencia, inscripcion_rm_fecha")
    .in("id", authorityIds);
  if (error) return jsonResponse(500, { error: "authority evidence lookup failed", detail: error.message });
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length !== signers.length) {
    return jsonResponse(409, { error: "one or more persisted signer authorities are missing or inaccessible" });
  }
  const allowedCargo: Record<VerifiedSignerBinding["signerRole"], Set<string>> = {
    PRESIDENTE: new Set(["PRESIDENTE", "VICEPRESIDENTE"]),
    SECRETARIO: new Set(["SECRETARIO", "VICESECRETARIO"]),
    CERTIFICANTE: new Set(source.certificanteRole ? [source.certificanteRole] : []),
    VISTO_BUENO: new Set(["PRESIDENTE", "VICEPRESIDENTE"]),
  };
  for (const signer of signers) {
    const effectiveDate = signer.occurredAt.slice(0, 10);
    const authority = rows.find((row) => row.id === signer.authorityEvidenceId);
    const cargo = typeof authority?.cargo === "string" ? authority.cargo.toUpperCase() : "";
    const start = typeof authority?.fecha_inicio === "string" ? authority.fecha_inicio : "";
    const end = typeof authority?.fecha_fin === "string" ? authority.fecha_fin : null;
    if (
      !authority
      || authority.tenant_id !== source.tenantId
      || authority.entity_id !== source.entityId
      || authority.body_id !== source.bodyId
      || authority.person_id !== signer.personId
      || authority.estado !== "VIGENTE"
      || !allowedCargo[signer.signerRole].has(cargo)
      || !start || start > effectiveDate
      || (end !== null && end < effectiveDate)
    ) return jsonResponse(409, { error: `signer ${signer.signerRole} lacks effective persisted authority` });

    if (source.sourceDomain === "CERTIFICATION") {
      if (
        (signer.signerRole === "CERTIFICANTE" && authority.id !== source.authorityEvidenceId)
        || (signer.signerRole === "VISTO_BUENO" && authority.person_id !== source.vistoBuenoPersonaId)
        || typeof authority.inscripcion_rm_referencia !== "string"
        || !authority.inscripcion_rm_referencia.trim()
        || typeof authority.inscripcion_rm_fecha !== "string"
        || authority.inscripcion_rm_fecha > effectiveDate
      ) return jsonResponse(409, { error: `certification authority for ${signer.signerRole} lacks current registry evidence` });
    }
  }
  return null;
}

async function readProviderCompletion(
  cfg: SuiteConfig,
  request: PersistedSignatureRequest,
  signers: Array<{
    caseFileId: string;
    providerSignatoryId: string;
    providerParticipantId: string;
  }>,
): Promise<ProviderCompletion> {
  const caseFileId = signers[0].caseFileId;
  const cf = encodeURIComponent(caseFileId);
  const sr = encodeURIComponent(request.sr_id);
  const doc = encodeURIComponent(request.document_id);
  const detail = await suiteFetch(
    cfg,
    `/case-files/${cf}/signature-requests/${sr}`,
    { method: "GET" },
    "getSignatureRequestForReconciliation",
  );
  const status = providerString(detail, "status")?.toUpperCase();
  if (status !== "COMPLETED") throw new Error(`EAD interposition request is ${status ?? "UNKNOWN"}, not COMPLETED`);
  const providerMode = providerString(detail, "signatureType", "signature_type")?.toUpperCase();
  if (providerMode !== "INTERPOSITION") {
    throw new Error("Secretaría only accepts the EAD INTERPOSITION service mode");
  }
  const requestedAt = normalizedProviderTimestamp(detail, "requestedAt", "createdAt", "creationDate");
  const completedAt = normalizedProviderTimestamp(detail, "completedAt", "signedAt");
  if (!requestedAt || !completedAt) {
    throw new Error("EAD completion payload has no complete provider chronology");
  }
  if (Date.parse(requestedAt) > Date.parse(completedAt)) {
    throw new Error("EAD provider chronology is inconsistent");
  }

  const documentsPayload = await suiteFetch(
    cfg,
    `/case-files/${cf}/signature-requests/${sr}/documents`,
    { method: "GET" },
    "listCompletedDocuments",
  );
  const documents = Array.isArray(documentsPayload.data)
    ? documentsPayload.data as Array<Record<string, unknown>>
    : [];
  const providerDocument = documents.find((row) => row.id === request.document_id);
  const documentStatusRaw = typeof providerDocument?.status === "string"
    ? providerDocument.status.toUpperCase()
    : "";
  if (documentStatusRaw !== "SIGNED" && documentStatusRaw !== "CERTIFIED") {
    throw new Error(`EAD document is ${documentStatusRaw || "UNKNOWN"}, not completed`);
  }

  const signatoryPayload = await suiteFetch(
    cfg,
    `/case-files/${cf}/signature-requests/${sr}/documents/${doc}/signatories`,
    { method: "GET" },
    "listCompletedSignatories",
  );
  const signatoryRows = Array.isArray(signatoryPayload.data)
    ? signatoryPayload.data as Array<Record<string, unknown>>
    : Array.isArray(signatoryPayload) ? signatoryPayload as unknown as Array<Record<string, unknown>> : [];
  const providerSignatoryIds = new Set(
    signatoryRows.map((row) => row.id).filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  const allowedIndividualTerminalStatuses = new Set([
    "SIGNED",
    "COMPLETED",
    "ACCEPTED",
    "CONFIRMED",
  ]);
  const providerSignatoryOutcomes: ProviderSignatoryOutcome[] = signatoryRows.flatMap((row) => {
    const providerSignatoryId = providerString(row, "id", "signatoryId", "signatory_id");
    if (!providerSignatoryId) return [];
    const participant = nestedObject(row.participant);
    const providerParticipantId = [
      row.participantId,
      row.participant_id,
      participant.id,
    ].find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
    const individualStatus = providerString(
      row,
      "status",
      "signatoryStatus",
      "signatory_status",
      "signatureStatus",
      "signingStatus",
    )?.toUpperCase() ?? null;
    const individualStatusAt = normalizedProviderTimestamp(
      row,
      "signedAt",
      "completedAt",
      "acceptedAt",
      "confirmedAt",
      "updatedAt",
      "modifiedAt",
    );
    if (
      !providerParticipantId
      || !individualStatus
      || !allowedIndividualTerminalStatuses.has(individualStatus)
      || !individualStatusAt
      || Date.parse(individualStatusAt) < Date.parse(requestedAt)
      || Date.parse(individualStatusAt) > Date.parse(completedAt)
    ) {
      throw new Error(
        `EAD signatory ${providerSignatoryId} lacks an allowed individual terminal status, timestamp or participant identity`,
      );
    }
    return [{
      providerSignatoryId,
      providerParticipantId,
      status: individualStatus as ProviderSignatoryOutcome["status"],
      statusAt: individualStatusAt,
    }];
  });
  if (providerSignatoryOutcomes.length !== providerSignatoryIds.size) {
    throw new Error("EAD signatory resource contains duplicate or unbound identities");
  }
  if (signers.some((signer) => {
    const outcome = providerSignatoryOutcomes.find(
      (candidate) => candidate.providerSignatoryId === signer.providerSignatoryId,
    );
    return !outcome || outcome.providerParticipantId !== signer.providerParticipantId;
  })) {
    throw new Error(
      "EAD request does not contain every persisted signatory/participant identity with an individual terminal outcome",
    );
  }

  const base = `/case-files/${cf}/signature-requests/${sr}/documents/${doc}`;
  const [signedPayload, certificatePayload, packagePayload] = await Promise.all([
    suiteFetch(cfg, `${base}/signed-document-url`, { method: "GET" }, "getSignedDocumentUrl"),
    suiteFetch(cfg, `${base}/certificates/document-url`, { method: "GET" }, "getCompletionCertificateUrl"),
    suiteFetch(cfg, `${base}/certificates/package-url`, { method: "GET" }, "getCompletionPackageUrl"),
  ]);
  const outputDocumentUrl = pickProviderUrl(signedPayload, "signedDocumentUrl", "documentUrl", "url");
  const completionEvidenceDocumentUrl = pickProviderUrl(certificatePayload, "documentUrl", "certificateUrl", "url");
  const completionPackageUrl = pickProviderUrl(packagePayload, "packageUrl", "url");
  if (!outputDocumentUrl || !completionEvidenceDocumentUrl || !completionPackageUrl) {
    throw new Error("EAD completion is missing output document or completion-evidence references");
  }
  return {
    status: "COMPLETED",
    providerMode: "INTERPOSITION",
    requestedAt,
    completedAt,
    outputDocumentUrl,
    completionEvidenceDocumentUrl,
    completionPackageUrl,
    providerSignatoryIds,
    providerSignatoryOutcomes,
  };
}

interface CustodiedBinaryArchive {
  evidenceBundleId: string;
  storagePath: string;
  manifestHash: string;
  binaryHashSha256: string;
  binaryHashSha512: string;
  archivedAt: string;
  eadCaseFileId: string;
  eadEvidenceGroupId: string;
  eadEvidenceId: string;
  eadProviderHashSha256: string;
  reused: boolean;
}

async function archiveProviderInterpositionOutput(
  cfg: SuiteConfig,
  adminClient: EdgeSupabaseClient,
  source: CanonicalLegalSource,
  request: PersistedSignatureRequest,
  provider: ProviderCompletion,
  bytes: Uint8Array,
  requestedFileName: unknown,
  mimeType: string,
): Promise<CustodiedBinaryArchive> {
  const [{ hex: binaryHashSha256, b64: sha256Base64 }, binaryHashSha512] = await Promise.all([
    sha256(bytes),
    sha512Hex(bytes),
  ]);
  const idempotencyKey = [
    source.sourceDomain,
    source.sourceId,
    source.artifactKind,
    source.contentHash,
    request.id,
    "CUSTODIED_BINARY",
    binaryHashSha256,
    binaryHashSha512,
  ].join(":");
  const evidenceBundleId = await deterministicUuid(idempotencyKey, "tgms-evidence-bundle");
  const bundleColumns = "id, tenant_id, source_object_type, source_object_id, status, legal_hold, hash_sha512, manifest_hash, manifest, storage_path";
  const { data: existing, error: lookupError } = await adminClient
    .from("evidence_bundles")
    .select(bundleColumns)
    .eq("id", evidenceBundleId)
    .maybeSingle();
  if (lookupError) throw new Error(`interposition custody lookup failed: ${lookupError.message}`);
  const expected = {
    tenantId: source.tenantId,
    sourceDomain: source.sourceDomain,
    sourceId: source.sourceId,
    processKind: source.sourceDomain === "MINUTE" ? "ACTA" as const : "CERTIFICACION" as const,
    contentHash: source.contentHash,
    binaryHashSha256,
    binaryHashSha512,
    artifactRole: "CUSTODIED_BINARY" as const,
    legalHold: true,
  };
  if (existing && !validateExistingCustodyBundle(existing as Record<string, unknown>, expected)) {
    throw new Error("interposition output idempotency key is bound to different custody evidence");
  }
  if (existing) {
    const manifest = nestedObject((existing as Record<string, unknown>).manifest);
    const caseFileId = nestedString(manifest, "verification", "case_file_id");
    const evidenceGroupId = nestedString(manifest, "verification", "evidence_group_id");
    const evidenceId = nestedString(manifest, "verification", "evidence_id");
    const providerHashSha256 = nestedString(manifest, "verification", "provider_hash_sha256");
    const archivedAt = nestedString(manifest, "binary", "archived_at");
    if (!caseFileId || !evidenceGroupId || !evidenceId || !providerHashSha256 || !archivedAt) {
      throw new Error("existing interposition custody bundle is incomplete");
    }
    return {
      evidenceBundleId,
      storagePath: String((existing as Record<string, unknown>).storage_path),
      manifestHash: String((existing as Record<string, unknown>).manifest_hash),
      binaryHashSha256,
      binaryHashSha512,
      archivedAt,
      eadCaseFileId: caseFileId,
      eadEvidenceGroupId: evidenceGroupId,
      eadEvidenceId: evidenceId,
      eadProviderHashSha256: providerHashSha256,
      reused: true,
    };
  }

  const fileName = normalizeArchiveFileName(requestedFileName, source.artifactKind)
    .replace(/\.(docx|bin)$/i, ".pdf");
  const eadEvidence = await createEadEvidence(cfg, {
    title: `${source.artifactKind} custodiado ${source.sourceId}`,
    fileName,
    bytes,
    sha256Hex: binaryHashSha256,
    sha256Base64,
    idempotencyKey,
    reference: `${source.sourceDomain}:${source.sourceId}:CUSTODIED_BINARY`,
  });
  const extension = fileName.toLowerCase().endsWith(".pdf") ? ".pdf" : ".bin";
  const storagePath = `${source.tenantId}/secretaria/${source.sourceDomain.toLowerCase()}/${source.sourceId}/${source.artifactKind.toLowerCase()}__custodied__${binaryHashSha256}${extension}`;
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, bytes.buffer as ArrayBuffer, {
      contentType: mimeType === "application/pdf" ? mimeType : "application/pdf",
      upsert: false,
    });
  let reused = false;
  if (uploadError) {
    const { data: stored, error: downloadError } = await adminClient.storage
      .from(DOCUMENT_BUCKET)
      .download(storagePath);
    if (downloadError || !stored) throw new Error(`interposition output storage failed: ${uploadError.message}`);
    const storedBytes = new Uint8Array(await stored.arrayBuffer());
    const [storedSha256, storedSha512] = await Promise.all([sha256(storedBytes), sha512Hex(storedBytes)]);
    if (storedSha256.hex !== binaryHashSha256 || storedSha512 !== binaryHashSha512) {
      throw new Error("interposition output storage path collision with different bytes");
    }
    reused = true;
  }
  const effectiveStoragePath = uploadData?.path ?? storagePath;
  const archivedAt = new Date().toISOString();
  const manifest = {
    schema_version: "ead-trust-interposition-custody.v1",
    source: {
      domain: source.sourceDomain,
      id: source.sourceId,
      process_kind: expected.processKind,
      content_hash_sha256: source.contentHash,
    },
    binary: {
      artifact_role: "CUSTODIED_BINARY",
      storage_path: effectiveStoragePath,
      storage_object_id: effectiveStoragePath,
      storage_version: binaryHashSha256,
      archived_at: archivedAt,
      file_name: fileName,
      mime_type: "application/pdf",
      size_bytes: bytes.length,
      hash_sha256: binaryHashSha256,
      hash_sha512: binaryHashSha512,
    },
    verification: {
      trust_boundary: "SERVICE_EARCHIVE",
      provider: "EAD_TRUST",
      provider_name: "EAD Trust",
      service: "EVIDENCE_MANAGER",
      provider_status: eadEvidence.status,
      case_file_id: eadEvidence.caseFileId,
      evidence_group_id: eadEvidence.evidenceGroupId,
      evidence_id: eadEvidence.evidenceId,
      provider_hash_sha256: eadEvidence.hash,
      verified_at: eadEvidence.verifiedAt,
      provider_mode: provider.providerMode,
      signature_claim: false,
      sandbox: false,
    },
    process_evidence: {
      provider_request_id: request.sr_id,
      provider_document_id: request.document_id,
      request_input_hash_sha256: request.document_hash.toLowerCase(),
      provider_requested_at: provider.requestedAt,
      provider_completed_at: provider.completedAt,
      output_document_ref: provider.outputDocumentUrl,
      signature_claim: false,
    },
    metadata: {
      recordId: source.sourceId,
      processKind: expected.processKind,
      contentHash: source.contentHash,
      artifactKind: source.artifactKind,
      sandbox: false,
    },
  };
  const manifestHash = await databaseJsonbHashSha256(adminClient, manifest);
  const { data: inserted, error: insertError } = await adminClient
    .from("evidence_bundles")
    .insert({
      id: evidenceBundleId,
      tenant_id: source.tenantId,
      agreement_id: request.agreement_id,
      source_module: "secretaria",
      source_object_type: source.sourceDomain,
      source_object_id: source.sourceId,
      reference_code: `EAD-EARCHIVE-${eadEvidence.evidenceId}`,
      manifest,
      manifest_hash: manifestHash,
      hash_sha512: binaryHashSha512,
      storage_path: effectiveStoragePath,
      document_url: `evidence-bundle://${effectiveStoragePath}`,
      signed_by: null,
      signature_date: null,
      chain_of_custody: [{
        event: "EAD_INTERPOSITION_OUTPUT_CUSTODIED",
        ts: archivedAt,
        signature_request_id: request.id,
        provider_request_id: request.sr_id,
        case_file_id: eadEvidence.caseFileId,
        evidence_group_id: eadEvidence.evidenceGroupId,
        evidence_id: eadEvidence.evidenceId,
        custodied_binary_hash_sha256: binaryHashSha256,
        custodied_binary_hash_sha512: binaryHashSha512,
        storage_path: effectiveStoragePath,
        signature_claim: false,
      }],
      legal_hold: true,
      status: "VERIFIED",
    })
    .select(bundleColumns)
    .maybeSingle();
  if (insertError || !inserted) {
    const { data: raced, error: racedError } = await adminClient
      .from("evidence_bundles")
      .select(bundleColumns)
      .eq("id", evidenceBundleId)
      .maybeSingle();
    if (racedError || !raced || !validateExistingCustodyBundle(raced as Record<string, unknown>, expected)) {
      throw new Error(`interposition custody bundle insert failed: ${insertError?.message ?? "no row returned"}`);
    }
    reused = true;
  }
  return {
    evidenceBundleId,
    storagePath: effectiveStoragePath,
    manifestHash,
    binaryHashSha256,
    binaryHashSha512,
    archivedAt,
    eadCaseFileId: eadEvidence.caseFileId,
    eadEvidenceGroupId: eadEvidence.evidenceGroupId,
    eadEvidenceId: eadEvidence.evidenceId,
    eadProviderHashSha256: eadEvidence.hash,
    reused,
  };
}

async function handleReconcileVerifiedSignature(
  req: Request,
  cfg: SuiteConfig | null,
  body: ReconcileVerifiedSignatureBody,
): Promise<Response> {
  const auth = await authenticateEdgeRequest(req);
  if (auth instanceof Response) return auth;

  // Fail before reading provider state, downloading bytes, creating EAD
  // evidence or writing custody. Final acta/certificacion reconciliation stays
  // disabled until a server-authoritative renderer can bind the exact binary
  // to the canonical legal source. The legacy implementation below remains
  // unreachable only as implementation history for that future renderer.
  const authoritativeBinaryFinalizationEnabled = false;
  if (!authoritativeBinaryFinalizationEnabled) {
    return jsonResponse(409, {
      code: "AUTHORITATIVE_BINARY_REQUIRED",
      error:
        "La reconciliación final exige un binario generado y verificado autoritativamente en servidor; "
        + "no se contactó EAD Trust ni se creó custodia.",
      providerMode: "INTERPOSITION",
      signatureClaim: false,
      custodyCreated: false,
      finalArtifactCreated: false,
    });
  }
  const coordinates = parseLegalArtifactCoordinates(body);
  if (!coordinates) {
    return jsonResponse(400, {
      error: "signatureRequestId/sourceDomain/sourceId/artifactKind/contentHash inválidos",
    });
  }
  const sourceResult = await readCanonicalLegalSource(auth.userClient, coordinates);
  if (sourceResult instanceof Response) return sourceResult;
  const source = sourceResult;
  const requestResult = await readVisibleSignatureRequest(auth.userClient, coordinates.signatureRequestId);
  if (requestResult instanceof Response) return requestResult;
  const signatureRequest = requestResult;
  if (signatureRequest.tenant_id !== source.tenantId) {
    return jsonResponse(404, { error: "signature request not found for source tenant" });
  }
  if (
    signatureRequest.source_domain !== source.sourceDomain
    || signatureRequest.source_id !== source.sourceId
    || signatureRequest.artifact_kind !== source.artifactKind
    || signatureRequest.content_hash_sha256?.toLowerCase() !== source.contentHash
  ) {
    return jsonResponse(409, { error: "signature request is not bound to the canonical legal source" });
  }
  if (
    signatureRequest.evidence_status?.toUpperCase().includes("SANDBOX")
    || signatureRequest.sr_id.toUpperCase().startsWith("SR-SANDBOX")
  ) return jsonResponse(409, { error: "sandbox request cannot produce authoritative evidence" });

  const roleCheck = await auth.userClient.rpc("fn_secretaria_assert_role_allowed", {
    p_tenant_id: source.tenantId,
    p_allowed_roles: ["SECRETARIO", "ADMIN_TENANT"],
  });
  if (roleCheck.error) return jsonResponse(403, { error: "caller cannot reconcile this legal artifact" });

  const signerResult = parseVerifiedSignerBindings(signatureRequest, source);
  if (signerResult instanceof Response) return signerResult;
  const signers = signerResult;
  if (externalProviderCallsForbidden(req)) {
    return jsonResponse(409, {
      code: "EXTERNAL_PROVIDER_CALL_FORBIDDEN",
      error: "Cortafuegos E2E activo: no se contacta con EAD Trust.",
    });
  }
  if (!cfg) {
    return jsonResponse(503, {
      code: "QTSP_PROXY_NOT_CONFIGURED",
      error: "Secretos EAD Enterprise Suite sin provisionar (EAD_SUITE_AUTH_EMAIL / EAD_SUITE_AUTH_PASSWORD)",
    });
  }

  // Todo identificador EAD se deriva de la fila visible y del binding sellado
  // en signatories JSON. El navegador no aporta caseFileId/srId/documentId.
  const provider = await readProviderCompletion(cfg, signatureRequest, signers);
  if (signers.some((signer) => signer.providerMode !== provider.providerMode)) {
    return jsonResponse(409, { error: "persisted and provider interposition modes do not match" });
  }
  if (Date.parse(signatureRequest.requested_at) !== Date.parse(provider.requestedAt)) {
    return jsonResponse(409, { error: "persisted and provider request timestamps do not match" });
  }
  const signersWithOutcomes = signers.map((signer) => {
    const outcome = provider.providerSignatoryOutcomes.find(
      (candidate) => candidate.providerSignatoryId === signer.providerSignatoryId,
    );
    if (!outcome) throw new Error(`missing individual terminal outcome for ${signer.signerRole}`);
    return { ...signer, occurredAt: outcome.statusAt };
  });
  const authorityError = await assertSignerAuthority(auth.userClient, source, signersWithOutcomes);
  if (authorityError) return authorityError;

  const [outputDownload, evidenceDocumentDownload, packageDownload] = await Promise.all([
    downloadProviderBytes(provider.outputDocumentUrl, "EAD interposition output"),
    downloadProviderBytes(provider.completionEvidenceDocumentUrl, "EAD completion evidence"),
    downloadProviderBytes(provider.completionPackageUrl, "EAD completion package"),
  ]);
  const pdfHeader = new TextDecoder().decode(outputDownload.bytes.slice(0, 5));
  if (pdfHeader !== "%PDF-") throw new Error("EAD output endpoint did not return the expected PDF");
  const evidenceHeader = new TextDecoder().decode(evidenceDocumentDownload.bytes.slice(0, 5));
  if (evidenceHeader !== "%PDF-") {
    throw new Error("EAD completion-evidence endpoint did not return a PDF");
  }
  const [outputDigest, evidenceDocumentDigest, completionPackageDigest] = await Promise.all([
    sha256(outputDownload.bytes),
    sha256(evidenceDocumentDownload.bytes),
    sha256(packageDownload.bytes),
  ]);
  const completionEvidenceFingerprintSha256 = evidenceDocumentDigest.hex;
  const completionPackageFingerprintSha256 = completionPackageDigest.hex;
  if (outputDigest.hex === completionEvidenceFingerprintSha256
    || outputDigest.hex === completionPackageFingerprintSha256
    || completionEvidenceFingerprintSha256 === completionPackageFingerprintSha256) {
    throw new Error("EAD output and completion evidence must be independently hash-bound artifacts");
  }
  const providerEventId = await sha256Text(canonicalJson({
    provider_request_id: signatureRequest.sr_id,
    provider_document_id: signatureRequest.document_id,
    provider_completed_at: provider.completedAt,
    completion_evidence_fingerprint_sha256: completionEvidenceFingerprintSha256,
    completion_package_fingerprint_sha256: completionPackageFingerprintSha256,
  }));

  const custody = await archiveProviderInterpositionOutput(
    cfg,
    auth.adminClient,
    source,
    signatureRequest,
    provider,
    outputDownload.bytes,
    body.fileName,
    outputDownload.mimeType,
  );

  if (signatureRequest.evidence_id && signatureRequest.evidence_id !== custody.evidenceBundleId) {
    return jsonResponse(409, {
      error: "signature request is already bound to legacy or different evidence; create a fresh interposition request",
    });
  }

  // La elevación autoritativa se limita a custodia del binario recuperado. El
  // RPC exige CUSTODIED_BINARY y `signature_claim=false` y no acepta niveles de firma.
  const { data: legalArtifactId, error: artifactError } = await auth.adminClient.rpc(
    "fn_secretaria_register_custodied_legal_artifact",
    {
      p_source_domain: source.sourceDomain,
      p_source_id: source.sourceId,
      p_artifact_kind: source.artifactKind,
      p_evidence_bundle_id: custody.evidenceBundleId,
      p_content_hash_sha256: source.contentHash,
      p_binary_hash_sha256: custody.binaryHashSha256,
    },
  );
  if (artifactError || typeof legalArtifactId !== "string") {
    return jsonResponse(409, {
      error: "authoritative legal artifact registration failed",
      detail: artifactError?.message ?? "RPC did not return an artifact id",
    });
  }

  const commonProviderPayload = {
    provider: "EAD_TRUST",
    service: "EVIDENCE_MANAGER",
    provider_mode: "INTERPOSITION",
    provider_status: "COMPLETED",
    provider_hash_sha256: custody.eadProviderHashSha256,
    signature_claim: false,
    source: {
      domain: source.sourceDomain,
      id: source.sourceId,
      content_hash_sha256: source.contentHash,
    },
    process_evidence: {
      provider_request_id: signatureRequest.sr_id,
      provider_document_id: signatureRequest.document_id,
      case_file_id: signers[0].caseFileId,
      requested_at: provider.requestedAt,
      completed_at: provider.completedAt,
      request_input_hash_sha256: signatureRequest.document_hash.toLowerCase(),
      custodied_binary_hash_sha256: custody.binaryHashSha256,
      custodied_binary_hash_sha512: custody.binaryHashSha512,
      output_document_ref: provider.outputDocumentUrl,
      completion_evidence_document_ref: provider.completionEvidenceDocumentUrl,
      completion_evidence_package_ref: provider.completionPackageUrl,
      completion_evidence_fingerprint_sha256: completionEvidenceFingerprintSha256,
      completion_package_fingerprint_sha256: completionPackageFingerprintSha256,
    },
    sandbox: false,
  };

  const { data: custodyEvidenceId, error: custodyEvidenceError } = await auth.adminClient.rpc(
    "fn_secretaria_register_ead_interposition_evidence",
    {
      p_source_domain: source.sourceDomain,
      p_source_id: source.sourceId,
      p_legal_artifact_id: legalArtifactId,
      p_subject_person_id: null,
      p_subject_role: null,
      p_evidence_purpose: "EARCHIVE",
      p_evidence_bundle_id: custody.evidenceBundleId,
      p_provider_reference: `${signatureRequest.sr_id}:EARCHIVE`,
      p_provider_status: "COMPLETED",
      p_occurred_at: provider.completedAt,
      p_provider_payload: commonProviderPayload,
      p_signature_request_id: signatureRequest.id,
      p_provider_request_id: signatureRequest.sr_id,
      p_provider_event_id: providerEventId,
      p_verified_by: auth.userId,
    },
  );
  if (custodyEvidenceError || typeof custodyEvidenceId !== "string") {
    return jsonResponse(409, {
      error: "EAD interposition custody evidence registration failed",
      detail: custodyEvidenceError?.message ?? "RPC did not return an evidence id",
    });
  }

  const interpositionEvidences: Array<{
    signerRole: VerifiedSignerBinding["signerRole"];
    subjectPersonId: string;
    providerSignatoryId: string;
    evidencePurpose: "CONSENT" | "CONSTANCIA";
    evidenceId: string;
  }> = [];
  for (const signer of signers) {
    const evidencePurpose = signer.signerRole === "PRESIDENTE" ? "CONSENT" as const : "CONSTANCIA" as const;
    const providerOutcome = provider.providerSignatoryOutcomes.find(
      (candidate) => candidate.providerSignatoryId === signer.providerSignatoryId,
    );
    if (!providerOutcome) {
      return jsonResponse(409, {
        error: `individual terminal provider outcome is missing for ${signer.signerRole}`,
      });
    }
    const providerReference = `${signatureRequest.sr_id}:${signer.providerSignatoryId}:${evidencePurpose}`;
    const { data, error } = await auth.adminClient.rpc(
      "fn_secretaria_register_ead_interposition_evidence",
      {
        p_source_domain: source.sourceDomain,
        p_source_id: source.sourceId,
        p_legal_artifact_id: legalArtifactId,
        p_subject_person_id: signer.personId,
        p_subject_role: signer.signerRole,
        p_evidence_purpose: evidencePurpose,
        p_evidence_bundle_id: custody.evidenceBundleId,
        p_provider_reference: providerReference,
        p_provider_status: providerOutcome.status,
        p_occurred_at: providerOutcome.statusAt,
        p_provider_payload: {
          ...commonProviderPayload,
          provider_status: providerOutcome.status,
          provider_reference: providerReference,
          subject: {
            person_id: signer.personId,
            role: signer.signerRole,
            authority_evidence_id: signer.authorityEvidenceId,
            provider_signatory_id: signer.providerSignatoryId,
            provider_participant_id: providerOutcome.providerParticipantId,
            provider_participant_status: providerOutcome.status,
            provider_participant_status_at: providerOutcome.statusAt,
            evidence_purpose: evidencePurpose,
          },
        },
        p_signature_request_id: signatureRequest.id,
        p_provider_request_id: signatureRequest.sr_id,
        p_provider_event_id: providerEventId,
        p_verified_by: auth.userId,
      },
    );
    if (error || typeof data !== "string") {
      return jsonResponse(409, {
        error: `interposition evidence registration failed for ${signer.signerRole}`,
        detail: error?.message ?? "RPC did not return an evidence id",
      });
    }
    interpositionEvidences.push({
      signerRole: signer.signerRole,
      subjectPersonId: signer.personId,
      providerSignatoryId: signer.providerSignatoryId,
      evidencePurpose,
      evidenceId: data,
    });
  }

  const { data: updatedRequest, error: updateError } = await auth.adminClient
    .from("qtsp_signature_requests")
    .update({
      sr_status: "COMPLETED",
      completed_at: provider.completedAt,
      evidence_id: custody.evidenceBundleId,
      evidence_status: "INTERPOSITION_VERIFIED",
      error_message: null,
    })
    .eq("id", signatureRequest.id)
    .eq("tenant_id", source.tenantId)
    .eq("sr_id", signatureRequest.sr_id)
    .eq("document_id", signatureRequest.document_id)
    .select("id")
    .maybeSingle();
  if (updateError || !updatedRequest) {
    return jsonResponse(409, {
      error: "could not persist EAD interposition completion state",
      detail: updateError?.message ?? "request changed during reconciliation",
    });
  }

  return jsonResponse(200, {
    provider: "EAD_TRUST",
    providerName: "EAD Trust",
    service: "EVIDENCE_MANAGER",
    providerMode: "INTERPOSITION",
    signatureClaim: false,
    status: "VERIFIED",
    artifactRole: "CUSTODIED_BINARY",
    sourceDomain: source.sourceDomain,
    sourceId: source.sourceId,
    artifactKind: source.artifactKind,
    signatureRequestId: signatureRequest.id,
    providerRequestId: signatureRequest.sr_id,
    providerDocumentId: signatureRequest.document_id,
    providerStatus: provider.status,
    providerRequestedAt: provider.requestedAt,
    providerCompletedAt: provider.completedAt,
    requestInputHashSha256: signatureRequest.document_hash.toLowerCase(),
    custodiedBinaryHashSha256: custody.binaryHashSha256,
    custodiedBinaryHashSha512: custody.binaryHashSha512,
    legalArtifactId,
    custodyEvidenceBundleId: custody.evidenceBundleId,
    custodyEvidenceId,
    storagePath: custody.storagePath,
    completionEvidenceDocumentRef: provider.completionEvidenceDocumentUrl,
    completionEvidencePackageRef: provider.completionPackageUrl,
    completionEvidenceFingerprintSha256,
    completionPackageFingerprintSha256,
    interpositionEvidences,
    reusedCustody: custody.reused,
  });
}

// ─── Cuentas anuales: roster WORM, firma individual y e-archive final ───────

interface ReconcileAnnualAccountsSignatureBody {
  signatureRequestId?: string;
  annualAccountsSetId?: string;
  contentHash?: string;
  fileName?: string;
}

interface RecordAnnualAccountsExternalSignatureBody {
  annualAccountsSetId?: string;
  expectedSignerId?: string;
  signedAt?: string;
  signatureFactSource?: string;
  reviewEventId?: string;
  supersedesOutcomeId?: string | null;
  documentBase64?: string;
  fileName?: string;
  mimeType?: string;
}

interface RecordAnnualAccountsMissingCauseBody {
  annualAccountsSetId?: string;
  expectedSignerId?: string;
  causeCode?: string;
  causeText?: string;
  supersedesOutcomeId?: string | null;
}

interface ArchiveAnnualAccountsExecutionBody {
  annualAccountsSetId?: string;
  contentHash?: string;
}

interface ArchiveAnnualAccountsComponentInputBody {
  meetingId?: string;
  agendaItemId?: string;
  fiscalYear?: number;
  componentKind?: string;
  documentBase64?: string;
  fileName?: string;
  mimeType?: string;
}

interface CanonicalAnnualAccountsComponentSource {
  tenantId: string;
  entityId: string;
  bodyId: string;
  meetingId: string;
  agendaItemId: string;
  matterCode: "FORMULACION_CUENTAS";
  fiscalYear: number;
  componentKind: AnnualAccountsComponentKind;
}

interface AnnualAccountsExpectedSigner {
  id: string;
  personId: string;
  personName: string;
  seatRole: string;
}

interface CanonicalAnnualAccountsSource {
  setId: string;
  tenantId: string;
  contentHash: string;
  rosterId: string;
  rosterHash: string;
  expectedSigners: AnnualAccountsExpectedSigner[];
}

interface ArchivedAnnualAccountsBinary {
  storagePath: string;
  storageObjectId: string;
  storageVersion: string;
  binaryHashSha256: string;
  binaryHashSha512: string;
  archivedAt: string;
  eadCaseFileId: string;
  eadEvidenceGroupId: string;
  eadEvidenceId: string;
  eadProviderHashSha256: string;
  reusedStorage: boolean;
}

async function readCanonicalAnnualAccountsSource(
  userClient: EdgeSupabaseClient,
  setId: string,
  contentHash?: string,
): Promise<CanonicalAnnualAccountsSource | Response> {
  const { data: setData, error: setError } = await userClient
    .from("secretaria_annual_accounts_sets")
    .select("id, tenant_id, approval_status, immutability_status, manifest_hash_sha256")
    .eq("id", setId)
    .maybeSingle();
  if (setError) return jsonResponse(500, { error: "annual accounts set lookup failed", detail: setError.message });
  if (!setData) return jsonResponse(404, { error: "annual accounts set not found or access denied" });
  const set = setData as Record<string, unknown>;
  const tenantId = typeof set.tenant_id === "string" ? set.tenant_id.toLowerCase() : "";
  const canonicalHash = typeof set.manifest_hash_sha256 === "string"
    ? set.manifest_hash_sha256.toLowerCase()
    : "";
  if (
    !UUID_PATTERN.test(tenantId)
    || !SHA256_PATTERN.test(canonicalHash)
    || set.approval_status !== "APPROVED"
    || set.immutability_status !== "IMMUTABLE"
  ) return jsonResponse(409, { error: "annual accounts set is not immutable and approved" });
  if (contentHash !== undefined && canonicalHash !== contentHash) {
    return jsonResponse(409, { error: "contentHash does not match annual accounts set manifest" });
  }

  const { data: successorData, error: successorError } = await userClient
    .from("secretaria_annual_accounts_sets")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("supersedes_set_id", setId)
    .limit(1);
  if (successorError) {
    return jsonResponse(500, { error: "annual accounts set head lookup failed", detail: successorError.message });
  }
  if ((successorData ?? []).length > 0) return jsonResponse(409, { error: "annual accounts set is superseded" });

  const { data: rosterData, error: rosterError } = await userClient
    .from("secretaria_annual_accounts_signer_rosters")
    .select("id, roster_hash_sha256")
    .eq("tenant_id", tenantId)
    .eq("annual_accounts_set_id", setId)
    .maybeSingle();
  if (rosterError) return jsonResponse(500, { error: "annual accounts roster lookup failed", detail: rosterError.message });
  if (!rosterData) return jsonResponse(409, { error: "annual accounts frozen signer roster is missing" });
  const roster = rosterData as Record<string, unknown>;
  const rosterId = typeof roster.id === "string" ? roster.id.toLowerCase() : "";
  const rosterHash = typeof roster.roster_hash_sha256 === "string"
    ? roster.roster_hash_sha256.toLowerCase()
    : "";
  if (!UUID_PATTERN.test(rosterId) || !SHA256_PATTERN.test(rosterHash)) {
    return jsonResponse(409, { error: "annual accounts frozen signer roster is invalid" });
  }

  const { data: expectedData, error: expectedError } = await userClient
    .from("secretaria_annual_accounts_expected_signers")
    .select("id, person_id, person_name_snapshot, seat_role_snapshot")
    .eq("tenant_id", tenantId)
    .eq("signer_roster_id", rosterId)
    .order("id");
  if (expectedError) {
    return jsonResponse(500, { error: "annual accounts expected signers lookup failed", detail: expectedError.message });
  }
  const expectedSigners: AnnualAccountsExpectedSigner[] = [];
  for (const raw of (expectedData ?? []) as Array<Record<string, unknown>>) {
    if (
      typeof raw.id !== "string" || !UUID_PATTERN.test(raw.id)
      || typeof raw.person_id !== "string" || !UUID_PATTERN.test(raw.person_id)
      || typeof raw.person_name_snapshot !== "string" || !raw.person_name_snapshot.trim()
      || typeof raw.seat_role_snapshot !== "string" || !raw.seat_role_snapshot.trim()
    ) return jsonResponse(409, { error: "annual accounts frozen signer row is incomplete" });
    expectedSigners.push({
      id: raw.id.toLowerCase(),
      personId: raw.person_id.toLowerCase(),
      personName: raw.person_name_snapshot,
      seatRole: raw.seat_role_snapshot,
    });
  }
  if (expectedSigners.length === 0) return jsonResponse(409, { error: "annual accounts frozen roster is empty" });
  return { setId, tenantId, contentHash: canonicalHash, rosterId, rosterHash, expectedSigners };
}

function normalizeAnnualAccountsFileName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const safe = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 160);
  return safe || fallback;
}

async function uploadImmutablePrivateBinary(
  adminClient: EdgeSupabaseClient,
  storagePath: string,
  bytes: Uint8Array,
  mimeType: string,
  expectedSha256: string,
  expectedSha512: string,
): Promise<{ path: string; reused: boolean }> {
  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, bytes.buffer as ArrayBuffer, { contentType: mimeType, upsert: false });
  if (!uploadError) return { path: uploadData.path, reused: false };
  const { data: stored, error: downloadError } = await adminClient.storage
    .from(DOCUMENT_BUCKET)
    .download(storagePath);
  if (downloadError || !stored) throw new Error(`annual accounts immutable storage failed: ${uploadError.message}`);
  const storedBytes = new Uint8Array(await stored.arrayBuffer());
  const [storedSha256, storedSha512] = await Promise.all([sha256(storedBytes), sha512Hex(storedBytes)]);
  if (storedSha256.hex !== expectedSha256 || storedSha512 !== expectedSha512) {
    throw new Error("annual accounts storage path collision with different bytes");
  }
  return { path: storagePath, reused: true };
}

async function archiveAnnualAccountsBinary(
  cfg: SuiteConfig,
  adminClient: EdgeSupabaseClient,
  source: CanonicalAnnualAccountsSource,
  bytes: Uint8Array,
  input: {
    purpose: "EXTERNAL_SIGNATURE_CUSTODY" | "EXECUTION";
    idempotencySubject: string;
    fileName: string;
    mimeType: string;
  },
): Promise<ArchivedAnnualAccountsBinary> {
  const [{ hex: binaryHashSha256, b64: sha256Base64 }, binaryHashSha512] = await Promise.all([
    sha256(bytes),
    sha512Hex(bytes),
  ]);
  const idempotencyKey = [
    "ANNUAL_ACCOUNTS",
    source.setId,
    source.contentHash,
    input.purpose,
    input.idempotencySubject,
    binaryHashSha256,
    binaryHashSha512,
  ].join(":");
  const eadEvidence = await createEadEvidence(cfg, {
    title: input.purpose === "EXTERNAL_SIGNATURE_CUSTODY"
      ? `Evidencia externa revisada de cuentas anuales ${source.setId}`
      : `Ejecución final de cuentas anuales ${source.setId}`,
    fileName: input.fileName,
    bytes,
    sha256Hex: binaryHashSha256,
    sha256Base64,
    idempotencyKey,
    reference: `ANNUAL_ACCOUNTS:${source.setId}:${input.purpose}`,
  });
  const extension = input.fileName.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0]?.toLowerCase() ?? ".bin";
  const folder = input.purpose === "EXTERNAL_SIGNATURE_CUSTODY"
    ? "external-signature-evidence"
    : "execution";
  const storagePath = [
    source.tenantId,
    "secretaria",
    "annual_accounts",
    source.setId,
    folder,
    `${input.idempotencySubject}__${binaryHashSha256}${extension}`,
  ].join("/");
  const stored = await uploadImmutablePrivateBinary(
    adminClient,
    storagePath,
    bytes,
    input.mimeType,
    binaryHashSha256,
    binaryHashSha512,
  );
  return {
    storagePath: stored.path,
    storageObjectId: stored.path,
    storageVersion: binaryHashSha256,
    binaryHashSha256,
    binaryHashSha512,
    archivedAt: eadEvidence.verifiedAt,
    eadCaseFileId: eadEvidence.caseFileId,
    eadEvidenceGroupId: eadEvidence.evidenceGroupId,
    eadEvidenceId: eadEvidence.evidenceId,
    eadProviderHashSha256: eadEvidence.hash,
    reusedStorage: stored.reused,
  };
}

async function assertAnnualAccountsRole(
  userClient: EdgeSupabaseClient,
  tenantId: string,
): Promise<Response | null> {
  const { error } = await userClient.rpc("fn_secretaria_assert_role_allowed", {
    p_tenant_id: tenantId,
    p_allowed_roles: ["SECRETARIO", "ADMIN_TENANT"],
  });
  return error ? jsonResponse(403, { error: "caller cannot administer annual accounts execution" }) : null;
}

function normalizeAnnualAccountsComponentFileName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 160);
  return safe || null;
}

function normalizeAnnualAccountsComponentMimeType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ANNUAL_ACCOUNTS_COMPONENT_MIME_TYPES.has(normalized) ? normalized : null;
}

function externalProviderCallsForbidden(req: Request): boolean {
  const envFlag = (Deno.env.get("TGMS_E2E_NO_EXTERNAL") ?? "").trim().toLowerCase();
  const headerFlag = (req.headers.get("x-tgms-e2e-no-external") ?? "").trim().toLowerCase();
  return ["1", "true"].includes(envFlag) || ["1", "true"].includes(headerFlag);
}

async function readCanonicalAnnualAccountsComponentSource(
  userClient: EdgeSupabaseClient,
  body: ArchiveAnnualAccountsComponentInputBody,
): Promise<CanonicalAnnualAccountsComponentSource | Response> {
  const meetingId = (body.meetingId ?? "").trim().toLowerCase();
  const agendaItemId = (body.agendaItemId ?? "").trim().toLowerCase();
  const componentKind = (body.componentKind ?? "").trim().toUpperCase();
  const fiscalYear = body.fiscalYear;
  if (
    !UUID_PATTERN.test(meetingId)
    || !UUID_PATTERN.test(agendaItemId)
    || !Number.isInteger(fiscalYear)
    || (fiscalYear as number) < 1900
    || (fiscalYear as number) > 9999
    || !ANNUAL_ACCOUNTS_COMPONENT_KINDS.includes(componentKind as AnnualAccountsComponentKind)
  ) {
    return jsonResponse(400, {
      error: "meetingId/agendaItemId/fiscalYear/componentKind inválidos",
    });
  }

  const { data: meetingData, error: meetingError } = await userClient
    .from("meetings")
    .select("id, tenant_id, body_id, scheduled_start, status")
    .eq("id", meetingId)
    .maybeSingle();
  if (meetingError) {
    return jsonResponse(500, { error: "annual accounts meeting lookup failed", detail: meetingError.message });
  }
  if (!meetingData) return jsonResponse(404, { error: "meeting not found or access denied" });
  const meeting = meetingData as Record<string, unknown>;
  const tenantId = typeof meeting.tenant_id === "string" ? meeting.tenant_id.toLowerCase() : "";
  const bodyId = typeof meeting.body_id === "string" ? meeting.body_id.toLowerCase() : "";
  const scheduledStart = typeof meeting.scheduled_start === "string"
    ? Date.parse(meeting.scheduled_start)
    : Number.NaN;
  const meetingStatus = typeof meeting.status === "string" ? meeting.status.toUpperCase() : "";
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(bodyId)) {
    return jsonResponse(409, { error: "meeting has no valid tenant/body binding" });
  }
  if (
    !["DRAFT", "CONVOCADA"].includes(meetingStatus)
    || !Number.isFinite(scheduledStart)
    || scheduledStart <= Date.now()
  ) {
    return jsonResponse(409, {
      error: "annual accounts components can only be archived before the meeting starts",
    });
  }

  const { data: agendaData, error: agendaError } = await userClient
    .from("agenda_items")
    .select("id, tenant_id, meeting_id, matter_code, kind")
    .eq("id", agendaItemId)
    .eq("meeting_id", meetingId)
    .maybeSingle();
  if (agendaError) {
    return jsonResponse(500, { error: "annual accounts agenda lookup failed", detail: agendaError.message });
  }
  if (!agendaData) return jsonResponse(404, { error: "agenda item not found or access denied" });
  const agenda = agendaData as Record<string, unknown>;
  if (
    String(agenda.tenant_id ?? "").toLowerCase() !== tenantId
    || String(agenda.meeting_id ?? "").toLowerCase() !== meetingId
    || String(agenda.matter_code ?? "").trim().toUpperCase() !== "FORMULACION_CUENTAS"
    || String(agenda.kind ?? "").trim().toUpperCase() !== "DECISORIO"
  ) {
    return jsonResponse(409, {
      error: "agenda item is not the exact FORMULACION_CUENTAS decision point",
    });
  }

  const { data: bodyData, error: bodyError } = await userClient
    .from("governing_bodies")
    .select("id, tenant_id, entity_id")
    .eq("id", bodyId)
    .maybeSingle();
  if (bodyError) {
    return jsonResponse(500, { error: "annual accounts governing body lookup failed", detail: bodyError.message });
  }
  if (!bodyData) return jsonResponse(404, { error: "governing body not found or access denied" });
  const bodyRow = bodyData as Record<string, unknown>;
  const entityId = typeof bodyRow.entity_id === "string" ? bodyRow.entity_id.toLowerCase() : "";
  if (
    String(bodyRow.tenant_id ?? "").toLowerCase() !== tenantId
    || String(bodyRow.id ?? "").toLowerCase() !== bodyId
    || !UUID_PATTERN.test(entityId)
  ) {
    return jsonResponse(409, { error: "governing body has no exact tenant/entity binding" });
  }

  return {
    tenantId,
    entityId,
    bodyId,
    meetingId,
    agendaItemId,
    matterCode: "FORMULACION_CUENTAS",
    fiscalYear: fiscalYear as number,
    componentKind: componentKind as AnnualAccountsComponentKind,
  };
}

function validateExistingAnnualAccountsComponentBundle(
  bundle: Record<string, unknown>,
  source: CanonicalAnnualAccountsComponentSource,
  binaryHashSha256: string,
  binaryHashSha512: string,
): boolean {
  const manifest = nestedObject(bundle.manifest);
  const manifestSource = nestedObject(manifest.source);
  const binary = nestedObject(manifest.binary);
  const verification = nestedObject(manifest.verification);
  return bundle.tenant_id === source.tenantId
    && bundle.source_object_type === "ANNUAL_ACCOUNTS_COMPONENT"
    && bundle.source_object_id === source.agendaItemId
    && bundle.status === "VERIFIED"
    && bundle.legal_hold === true
    && typeof bundle.manifest_hash === "string"
    && SHA256_PATTERN.test(bundle.manifest_hash)
    && bundle.hash_sha512 === binaryHashSha512
    && typeof bundle.storage_path === "string"
    && bundle.storage_path.length > 0
    && manifestSource.tenant_id === source.tenantId
    && manifestSource.entity_id === source.entityId
    && manifestSource.body_id === source.bodyId
    && manifestSource.meeting_id === source.meetingId
    && manifestSource.agenda_item_id === source.agendaItemId
    && manifestSource.matter_code === source.matterCode
    && manifestSource.fiscal_year === source.fiscalYear
    && binary.artifact_role === "ANNUAL_ACCOUNTS_COMPONENT"
    && binary.component_kind === source.componentKind
    && binary.hash_sha256 === binaryHashSha256
    && binary.hash_sha512 === binaryHashSha512
    && binary.storage_path === bundle.storage_path
    && binary.storage_object_id === bundle.storage_path
    && binary.storage_version === binaryHashSha256
    && verification.trust_boundary === "SERVICE_EARCHIVE"
    && verification.provider === "EAD_TRUST"
    && verification.service === "EVIDENCE_MANAGER"
    && verification.provider_mode === "INTERPOSITION"
    && verification.provider_status === "COMPLETED"
    && verification.provider_hash_sha256 === binaryHashSha256
    && verification.signature_claim === false
    && verification.sandbox === false
    && typeof verification.case_file_id === "string"
    && verification.case_file_id.length > 0
    && typeof verification.evidence_group_id === "string"
    && verification.evidence_group_id.length > 0
    && typeof verification.evidence_id === "string"
    && verification.evidence_id.length > 0
    && typeof verification.provider_action_reservation_id === "string"
    && UUID_PATTERN.test(verification.provider_action_reservation_id);
}

function annualAccountsComponentArchiveResponse(
  bundle: Record<string, unknown>,
  source: CanonicalAnnualAccountsComponentSource,
  reused: boolean,
): Response {
  const manifest = nestedObject(bundle.manifest);
  const binary = nestedObject(manifest.binary);
  const verification = nestedObject(manifest.verification);
  return jsonResponse(200, {
    provider: "EAD_TRUST",
    providerName: "EAD Trust",
    service: "EVIDENCE_MANAGER",
    custodyMode: "EARCHIVE",
    status: "VERIFIED",
    providerStatus: "COMPLETED",
    signatureClaim: false,
    artifactRole: "ANNUAL_ACCOUNTS_COMPONENT",
    componentKind: source.componentKind,
    tenantId: source.tenantId,
    entityId: source.entityId,
    bodyId: source.bodyId,
    meetingId: source.meetingId,
    agendaItemId: source.agendaItemId,
    matterCode: source.matterCode,
    fiscalYear: source.fiscalYear,
    evidenceBundleId: bundle.id,
    eadCaseFileId: verification.case_file_id,
    eadEvidenceGroupId: verification.evidence_group_id,
    eadEvidenceId: verification.evidence_id,
    providerActionReservationId: verification.provider_action_reservation_id,
    binaryHashSha256: binary.hash_sha256,
    binaryHashSha512: binary.hash_sha512,
    evidenceManifestHash: bundle.manifest_hash,
    storagePath: bundle.storage_path,
    storageObjectId: binary.storage_object_id,
    storageVersion: binary.storage_version,
    reused,
  });
}

async function handleArchiveAnnualAccountsComponentInput(
  req: Request,
  cfg: SuiteConfig | null,
  body: ArchiveAnnualAccountsComponentInputBody,
): Promise<Response> {
  const auth = await authenticateEdgeRequest(req);
  if (auth instanceof Response) return auth;

  const sourceResult = await readCanonicalAnnualAccountsComponentSource(auth.userClient, body);
  if (sourceResult instanceof Response) return sourceResult;
  const source = sourceResult;
  const roleError = await assertAnnualAccountsRole(auth.userClient, source.tenantId);
  if (roleError) return roleError;

  const fileName = normalizeAnnualAccountsComponentFileName(body.fileName);
  const mimeType = normalizeAnnualAccountsComponentMimeType(body.mimeType);
  if (!fileName || !mimeType || typeof body.documentBase64 !== "string" || !body.documentBase64) {
    return jsonResponse(400, { error: "fileName/mimeType/documentBase64 inválidos" });
  }
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(body.documentBase64);
  } catch {
    return jsonResponse(400, { error: "documentBase64 inválido" });
  }
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    return jsonResponse(400, { error: `Tamaño de documento fuera de rango (1B–${MAX_DOCUMENT_BYTES}B)` });
  }

  const [{ hex: binaryHashSha256, b64: binaryHashSha256Base64 }, binaryHashSha512] = await Promise.all([
    sha256(bytes),
    sha512Hex(bytes),
  ]);
  const idempotencyKey = [
    "ANNUAL_ACCOUNTS_COMPONENT",
    source.tenantId,
    source.entityId,
    source.bodyId,
    source.meetingId,
    source.agendaItemId,
    source.fiscalYear,
    source.componentKind,
    binaryHashSha256,
    binaryHashSha512,
  ].join(":");
  const evidenceBundleId = await deterministicUuid(idempotencyKey, "tgms-evidence-bundle");
  const bundleColumns = "id, tenant_id, source_object_type, source_object_id, status, legal_hold, hash_sha512, manifest_hash, manifest, storage_path";
  const { data: existingBundle, error: existingBundleError } = await auth.adminClient
    .from("evidence_bundles")
    .select(bundleColumns)
    .eq("id", evidenceBundleId)
    .maybeSingle();
  if (existingBundleError) {
    return jsonResponse(500, { error: "annual accounts custody lookup failed", detail: existingBundleError.message });
  }
  if (existingBundle) {
    if (!validateExistingAnnualAccountsComponentBundle(
      existingBundle as Record<string, unknown>,
      source,
      binaryHashSha256,
      binaryHashSha512,
    )) {
      return jsonResponse(409, { error: "idempotency key is bound to different annual accounts evidence" });
    }
    return annualAccountsComponentArchiveResponse(existingBundle as Record<string, unknown>, source, true);
  }

  if (externalProviderCallsForbidden(req)) {
    return jsonResponse(409, {
      code: "EXTERNAL_PROVIDER_CALL_FORBIDDEN",
      error: "Cortafuegos E2E activo: no se contacta con EAD Trust.",
    });
  }
  if (!cfg) {
    return jsonResponse(503, {
      code: "QTSP_PROXY_NOT_CONFIGURED",
      error: "Secretos EAD Enterprise Suite sin provisionar (EAD_SUITE_AUTH_EMAIL / EAD_SUITE_AUTH_PASSWORD)",
    });
  }

  const reservation = await reserveEadProviderAction(auth.userClient, {
    sourceDomain: "ANNUAL_ACCOUNTS_COMPONENT",
    sourceId: source.agendaItemId,
    actionKind: "ANNUAL_ACCOUNTS_COMPONENT_EARCHIVE",
    subjectKey: `${source.fiscalYear}:${source.componentKind}`,
    // El punto canónico es el ítem decisorio; antes de constituir el set aún no
    // existe un hash de conjunto, por lo que se fija el hash exacto del componente.
    sourceHashSha256: binaryHashSha256,
    payloadHashSha256: binaryHashSha256,
    context: {
      meeting_id: source.meetingId,
      fiscal_year: source.fiscalYear,
      component_kind: source.componentKind,
    },
  });
  if (reservation instanceof Response) return reservation;

  const eadEvidence = await createEadEvidence(cfg, {
    title: `${source.componentKind} cuentas ${source.fiscalYear}`,
    fileName,
    bytes,
    sha256Hex: binaryHashSha256,
    sha256Base64: binaryHashSha256Base64,
    idempotencyKey,
    reference: `ANNUAL_ACCOUNTS_COMPONENT:${source.agendaItemId}:${source.fiscalYear}:${source.componentKind}`,
  });
  if (eadEvidence.status !== "COMPLETED" || eadEvidence.hash !== binaryHashSha256) {
    return jsonResponse(409, { error: "EAD Evidence Manager did not verify the exact component bytes" });
  }

  const extension = fileName.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0]?.toLowerCase() ?? ".bin";
  const storagePath = [
    source.tenantId,
    "secretaria",
    "annual_accounts",
    source.meetingId,
    source.agendaItemId,
    "components",
    source.componentKind.toLowerCase(),
    `${binaryHashSha256}${extension}`,
  ].join("/");
  const stored = await uploadImmutablePrivateBinary(
    auth.adminClient,
    storagePath,
    bytes,
    mimeType,
    binaryHashSha256,
    binaryHashSha512,
  );
  const archivedAt = eadEvidence.verifiedAt;
  const manifest = {
    schema_version: "secretaria.annual-accounts-component-evidence.v1",
    source: {
      tenant_id: source.tenantId,
      entity_id: source.entityId,
      body_id: source.bodyId,
      meeting_id: source.meetingId,
      agenda_item_id: source.agendaItemId,
      matter_code: source.matterCode,
      fiscal_year: source.fiscalYear,
    },
    binary: {
      artifact_role: "ANNUAL_ACCOUNTS_COMPONENT",
      component_kind: source.componentKind,
      storage_path: stored.path,
      storage_object_id: stored.path,
      storage_version: binaryHashSha256,
      archived_at: archivedAt,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: bytes.length,
      hash_sha256: binaryHashSha256,
      hash_sha512: binaryHashSha512,
    },
    verification: {
      trust_boundary: "SERVICE_EARCHIVE",
      provider: "EAD_TRUST",
      provider_name: "EAD Trust",
      service: "EVIDENCE_MANAGER",
      provider_mode: "INTERPOSITION",
      provider_status: eadEvidence.status,
      case_file_id: eadEvidence.caseFileId,
      evidence_group_id: eadEvidence.evidenceGroupId,
      evidence_id: eadEvidence.evidenceId,
      provider_action_reservation_id: reservation,
      provider_hash_sha256: eadEvidence.hash,
      verified_at: eadEvidence.verifiedAt,
      signature_claim: false,
      sandbox: false,
    },
  };
  const manifestHash = await databaseJsonbHashSha256(auth.adminClient, manifest);
  const { data: insertedBundle, error: insertBundleError } = await auth.adminClient
    .from("evidence_bundles")
    .insert({
      id: evidenceBundleId,
      tenant_id: source.tenantId,
      agreement_id: null,
      source_module: "secretaria",
      source_object_type: "ANNUAL_ACCOUNTS_COMPONENT",
      source_object_id: source.agendaItemId,
      reference_code: `EAD-AA-${source.componentKind}-${eadEvidence.evidenceId}`,
      manifest,
      manifest_hash: manifestHash,
      hash_sha512: binaryHashSha512,
      storage_path: stored.path,
      document_url: `evidence-bundle://${stored.path}`,
      signed_by: null,
      signature_date: null,
      chain_of_custody: [{
        event: "EAD_ANNUAL_ACCOUNTS_COMPONENT_CUSTODY_VERIFIED",
        ts: archivedAt,
        actor: "EAD Trust Evidence Manager",
        case_file_id: eadEvidence.caseFileId,
        evidence_group_id: eadEvidence.evidenceGroupId,
        evidence_id: eadEvidence.evidenceId,
        provider_action_reservation_id: reservation,
        component_kind: source.componentKind,
        binary_hash_sha256: binaryHashSha256,
        binary_hash_sha512: binaryHashSha512,
        storage_path: stored.path,
        signature_claim: false,
      }],
      legal_hold: true,
      status: "VERIFIED",
    })
    .select(bundleColumns)
    .maybeSingle();

  let bundle = insertedBundle as Record<string, unknown> | null;
  let reused = stored.reused;
  if (insertBundleError || !bundle) {
    const { data: racedBundle, error: racedBundleError } = await auth.adminClient
      .from("evidence_bundles")
      .select(bundleColumns)
      .eq("id", evidenceBundleId)
      .maybeSingle();
    if (
      racedBundleError
      || !racedBundle
      || !validateExistingAnnualAccountsComponentBundle(
        racedBundle as Record<string, unknown>,
        source,
        binaryHashSha256,
        binaryHashSha512,
      )
    ) {
      throw new Error(`annual accounts evidence bundle insert failed: ${insertBundleError?.message ?? "no row returned"}`);
    }
    bundle = racedBundle as Record<string, unknown>;
    reused = true;
  }
  if (!validateExistingAnnualAccountsComponentBundle(bundle, source, binaryHashSha256, binaryHashSha512)) {
    return jsonResponse(409, { error: "annual accounts component custody bundle is incomplete" });
  }
  return annualAccountsComponentArchiveResponse(bundle, source, reused);
}

async function handleReconcileAnnualAccountsSignature(
  req: Request,
  _cfg: SuiteConfig | null,
  _body: ReconcileAnnualAccountsSignatureBody,
): Promise<Response> {
  const auth = await authenticateEdgeRequest(req);
  if (auth instanceof Response) return auth;
  return jsonResponse(409, {
    code: "REVIEWED_EXTERNAL_SIGNATURE_REQUIRED",
    error:
      "La finalización del proveedor no acredita por sí sola la firma de las cuentas. "
      + "Custodie un documento firmado externamente, revíselo por persona y registre "
      + "el hecho o su causa conforme al artículo 253.2 LSC.",
    signatureClaim: false,
    replacementAction: "record_annual_accounts_external_signature",
  });
}

function validateExistingAnnualAccountsExternalSignatureBundle(
  bundle: Record<string, unknown>,
  source: CanonicalAnnualAccountsSource,
  expectedSigner: AnnualAccountsExpectedSigner,
  binaryHashSha256: string,
  binaryHashSha512: string,
  signatureFactSource: string,
  signedAt: string,
  reviewEventId: string,
  reviewedBy: string,
  providerActionReservationId: string,
): boolean {
  const manifest = nestedObject(bundle.manifest);
  const manifestSource = nestedObject(manifest.source);
  const binary = nestedObject(manifest.binary);
  const verification = nestedObject(manifest.verification);
  const review = nestedObject(manifest.external_signature_review);
  return bundle.tenant_id === source.tenantId
    && bundle.source_object_type === "ANNUAL_ACCOUNTS"
    && bundle.source_object_id === source.setId
    && bundle.status === "VERIFIED"
    && bundle.legal_hold === true
    && typeof bundle.manifest_hash === "string"
    && SHA256_PATTERN.test(bundle.manifest_hash)
    && bundle.hash_sha512 === binaryHashSha512
    && manifestSource.domain === "ANNUAL_ACCOUNTS"
    && manifestSource.id === source.setId
    && manifestSource.content_hash_sha256 === source.contentHash
    && binary.artifact_role === "EXTERNAL_SIGNATURE_DOCUMENT"
    && binary.hash_sha256 === binaryHashSha256
    && binary.hash_sha512 === binaryHashSha512
    && verification.trust_boundary === "SERVICE_EARCHIVE"
    && verification.provider === "EAD_TRUST"
    && verification.service === "EVIDENCE_MANAGER"
    && verification.provider_mode === "INTERPOSITION"
    && verification.provider_action_reservation_id === providerActionReservationId
    && verification.signature_claim === false
    && verification.sandbox === false
    && review.status === "VERIFIED"
    && review.signature_observed === true
    && review.person_id === expectedSigner.personId
    && review.document_hash_sha256 === binaryHashSha256
    && review.fact_source === signatureFactSource
    && review.signed_at === signedAt
    && review.review_event_id === reviewEventId
    && review.reviewed_by === reviewedBy
    && typeof review.reviewed_at === "string"
    && Number.isFinite(Date.parse(review.reviewed_at));
}

async function handleRecordAnnualAccountsExternalSignature(
  req: Request,
  cfg: SuiteConfig | null,
  body: RecordAnnualAccountsExternalSignatureBody,
): Promise<Response> {
  const auth = await authenticateEdgeRequest(req);
  if (auth instanceof Response) return auth;
  const setId = (body.annualAccountsSetId ?? "").trim().toLowerCase();
  const expectedSignerId = (body.expectedSignerId ?? "").trim().toLowerCase();
  const reviewEventId = (body.reviewEventId ?? "").trim().toLowerCase();
  const signatureFactSource = (body.signatureFactSource ?? "").trim().toUpperCase();
  const signedAtEpoch = typeof body.signedAt === "string" ? Date.parse(body.signedAt) : Number.NaN;
  const signedAt = Number.isFinite(signedAtEpoch) ? new Date(signedAtEpoch).toISOString() : "";
  const supersedesOutcomeId = body.supersedesOutcomeId == null
    ? null
    : body.supersedesOutcomeId.trim().toLowerCase();
  const allowedFactSources = new Set([
    "REVIEWED_SIGNED_DOCUMENT",
    "REVIEWED_WET_INK_SCAN",
    "REVIEWED_EXTERNAL_SIGNATURE_REPORT",
  ]);
  if (
    !UUID_PATTERN.test(setId)
    || !UUID_PATTERN.test(expectedSignerId)
    || !UUID_PATTERN.test(reviewEventId)
    || !allowedFactSources.has(signatureFactSource)
    || !signedAt
    || Date.parse(signedAt) > Date.now()
    || (supersedesOutcomeId !== null && !UUID_PATTERN.test(supersedesOutcomeId))
    || typeof body.documentBase64 !== "string"
    || body.documentBase64.length === 0
  ) {
    return jsonResponse(400, {
      error: "annualAccountsSetId/expectedSignerId/document/reviewEventId/signedAt inválidos",
    });
  }

  const sourceResult = await readCanonicalAnnualAccountsSource(auth.userClient, setId);
  if (sourceResult instanceof Response) return sourceResult;
  const source = sourceResult;
  const roleError = await assertAnnualAccountsRole(auth.userClient, source.tenantId);
  if (roleError) return roleError;
  const expectedSigner = source.expectedSigners.find((candidate) => candidate.id === expectedSignerId);
  if (!expectedSigner) {
    return jsonResponse(409, { error: "expected signer is not part of the frozen annual-accounts roster" });
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(body.documentBase64);
  } catch {
    return jsonResponse(400, { error: "documentBase64 inválido" });
  }
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    return jsonResponse(400, { error: `Tamaño de documento fuera de rango (1B–${MAX_DOCUMENT_BYTES}B)` });
  }
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    return jsonResponse(400, { error: "La evidencia externa revisada debe aportarse en PDF" });
  }
  const reviewedDocumentHash = (await sha256(bytes)).hex;
  const { data: reviewData, error: reviewError } = await auth.userClient
    .from("secretaria_annual_accounts_signature_review_events")
    .select(
      "id, tenant_id, annual_accounts_set_id, expected_signer_id, document_hash_sha256, signed_at, signature_fact_source, review_note, review_status, reviewer_user_id, reviewer_person_id, reviewed_at",
    )
    .eq("id", reviewEventId)
    .maybeSingle();
  if (reviewError) {
    return jsonResponse(409, { error: "immutable external-signature review lookup failed", detail: reviewError.message });
  }
  const review = reviewData as Record<string, unknown> | null;
  const reviewedAt = typeof review?.reviewed_at === "string" ? review.reviewed_at : "";
  if (
    !review
    || review.tenant_id !== source.tenantId
    || review.annual_accounts_set_id !== source.setId
    || review.expected_signer_id !== expectedSigner.id
    || review.document_hash_sha256 !== reviewedDocumentHash
    || review.signature_fact_source !== signatureFactSource
    || review.review_status !== "VERIFIED"
    || review.reviewer_user_id === auth.userId
    || review.reviewer_person_id === expectedSigner.personId
    || typeof review.reviewer_user_id !== "string"
    || !UUID_PATTERN.test(review.reviewer_user_id)
    || typeof review.reviewer_person_id !== "string"
    || !UUID_PATTERN.test(review.reviewer_person_id)
    || !reviewedAt
    || !Number.isFinite(Date.parse(reviewedAt))
    || Date.parse(String(review.signed_at)) !== Date.parse(signedAt)
  ) {
    return jsonResponse(409, {
      error: "external signature custody requires an exact immutable review by another capable tenant user",
    });
  }
  if (externalProviderCallsForbidden(req)) {
    return jsonResponse(409, {
      code: "EXTERNAL_PROVIDER_CALL_FORBIDDEN",
      error: "Cortafuegos E2E activo: no se contacta con EAD Trust.",
    });
  }
  if (!cfg) {
    return jsonResponse(503, {
      code: "QTSP_PROXY_NOT_CONFIGURED",
      error: "Secretos EAD Enterprise Suite sin provisionar (EAD_SUITE_AUTH_EMAIL / EAD_SUITE_AUTH_PASSWORD)",
    });
  }

  const reservation = await reserveEadProviderAction(auth.userClient, {
    sourceDomain: "ANNUAL_ACCOUNTS",
    sourceId: source.setId,
    actionKind: "EXTERNAL_SIGNATURE_CUSTODY",
    subjectKey: `${expectedSigner.id}:${reviewEventId}`,
    sourceHashSha256: source.contentHash,
    payloadHashSha256: reviewedDocumentHash,
    context: {
      expected_signer_id: expectedSigner.id,
      review_event_id: reviewEventId,
      signed_at: signedAt,
      signature_fact_source: signatureFactSource,
    },
  });
  if (reservation instanceof Response) return reservation;

  const fileName = normalizeAnnualAccountsFileName(
    body.fileName,
    `cuentas-anuales-${source.setId}-${expectedSigner.id}.pdf`,
  ).replace(/\.(docx|bin)$/i, ".pdf");
  const archived = await archiveAnnualAccountsBinary(
    cfg,
    auth.adminClient,
    source,
    bytes,
    {
      purpose: "EXTERNAL_SIGNATURE_CUSTODY",
      idempotencySubject: expectedSigner.id,
      fileName,
      mimeType: "application/pdf",
    },
  );
  const evidenceBundleId = await deterministicUuid(
    [source.setId, expectedSigner.id, archived.binaryHashSha256, archived.binaryHashSha512].join(":"),
    "tgms-annual-accounts-external-signature-evidence",
  );
  if (archived.binaryHashSha256 !== reviewedDocumentHash) {
    throw new Error("archived binary differs from the immutable reviewed document hash");
  }
  const bundleColumns = "id, tenant_id, source_object_type, source_object_id, status, legal_hold, hash_sha512, manifest_hash, manifest, storage_path";
  let externalSignatureReview: Record<string, unknown> = {
    review_event_id: reviewEventId,
    status: "VERIFIED",
    signature_observed: true,
    person_id: expectedSigner.personId,
    expected_signer_id: expectedSigner.id,
    fact_source: signatureFactSource,
    signed_at: signedAt,
    reviewed_at: reviewedAt,
    reviewed_by: review.reviewer_user_id,
    reviewer_person_id: review.reviewer_person_id,
    review_note: review.review_note,
    document_hash_sha256: archived.binaryHashSha256,
  };
  const manifest = {
    schema_version: "secretaria.annual-accounts-external-signature-custody.v1",
    source: {
      domain: "ANNUAL_ACCOUNTS",
      id: source.setId,
      content_hash_sha256: source.contentHash,
      roster_id: source.rosterId,
      roster_hash_sha256: source.rosterHash,
    },
    binary: {
      artifact_role: "EXTERNAL_SIGNATURE_DOCUMENT",
      storage_path: archived.storagePath,
      storage_object_id: archived.storageObjectId,
      storage_version: archived.storageVersion,
      archived_at: archived.archivedAt,
      file_name: fileName,
      mime_type: "application/pdf",
      size_bytes: bytes.length,
      hash_sha256: archived.binaryHashSha256,
      hash_sha512: archived.binaryHashSha512,
    },
    verification: {
      trust_boundary: "SERVICE_EARCHIVE",
      provider: "EAD_TRUST",
      provider_name: "EAD Trust",
      service: "EVIDENCE_MANAGER",
      provider_mode: "INTERPOSITION",
      provider_status: "COMPLETED",
      case_file_id: archived.eadCaseFileId,
      evidence_group_id: archived.eadEvidenceGroupId,
      evidence_id: archived.eadEvidenceId,
      provider_action_reservation_id: reservation,
      provider_hash_sha256: archived.eadProviderHashSha256,
      verified_at: archived.archivedAt,
      signature_claim: false,
      sandbox: false,
    },
    external_signature_review: externalSignatureReview,
  };
  const manifestHash = await databaseJsonbHashSha256(auth.adminClient, manifest);
  const { data: existingBundle, error: existingError } = await auth.adminClient
    .from("evidence_bundles")
    .select(bundleColumns)
    .eq("id", evidenceBundleId)
    .maybeSingle();
  if (existingError) {
    return jsonResponse(500, { error: "external signature custody lookup failed", detail: existingError.message });
  }
  let bundle = existingBundle as Record<string, unknown> | null;
  let reused = Boolean(bundle) || archived.reusedStorage;
  if (bundle && !validateExistingAnnualAccountsExternalSignatureBundle(
    bundle,
    source,
    expectedSigner,
    archived.binaryHashSha256,
    archived.binaryHashSha512,
    signatureFactSource,
    signedAt,
    reviewEventId,
    String(review.reviewer_user_id),
    reservation,
  )) {
    return jsonResponse(409, { error: "external signature evidence idempotency key is already bound" });
  }
  if (!bundle) {
    const { data: inserted, error: insertError } = await auth.adminClient
      .from("evidence_bundles")
      .insert({
        id: evidenceBundleId,
        tenant_id: source.tenantId,
        agreement_id: null,
        source_module: "secretaria",
        source_object_type: "ANNUAL_ACCOUNTS",
        source_object_id: source.setId,
        reference_code: `EAD-AA-EXTERNAL-${archived.eadEvidenceId}`,
        manifest,
        manifest_hash: manifestHash,
        hash_sha512: archived.binaryHashSha512,
        storage_path: archived.storagePath,
        document_url: `evidence-bundle://${archived.storagePath}`,
        signed_by: null,
        signature_date: null,
        chain_of_custody: [{
          event: "EAD_ANNUAL_ACCOUNTS_EXTERNAL_SIGNATURE_DOCUMENT_CUSTODIED",
          ts: archived.archivedAt,
          expected_signer_id: expectedSigner.id,
          person_id: expectedSigner.personId,
          reviewed_at: reviewedAt,
          reviewed_by: review.reviewer_user_id,
          review_event_id: reviewEventId,
          provider_action_reservation_id: reservation,
          finalized_by: auth.userId,
          binary_hash_sha256: archived.binaryHashSha256,
          binary_hash_sha512: archived.binaryHashSha512,
          signature_claim: false,
        }],
        legal_hold: true,
        status: "VERIFIED",
      })
      .select(bundleColumns)
      .maybeSingle();
    if (insertError || !inserted) {
      const { data: raced, error: racedError } = await auth.adminClient
        .from("evidence_bundles")
        .select(bundleColumns)
        .eq("id", evidenceBundleId)
        .maybeSingle();
      if (racedError || !raced || !validateExistingAnnualAccountsExternalSignatureBundle(
        raced as Record<string, unknown>,
        source,
        expectedSigner,
        archived.binaryHashSha256,
        archived.binaryHashSha512,
        signatureFactSource,
        signedAt,
        reviewEventId,
        String(review.reviewer_user_id),
        reservation,
      )) {
        throw new Error(`external signature custody bundle insert failed: ${insertError?.message ?? "no row returned"}`);
      }
      bundle = raced as Record<string, unknown>;
      reused = true;
    } else {
      bundle = inserted as Record<string, unknown>;
    }
  }
  if (!bundle) throw new Error("external signature custody bundle is missing after registration");
  externalSignatureReview = nestedObject(nestedObject(bundle.manifest).external_signature_review);

  const providerReference = `${archived.eadEvidenceId}:${expectedSigner.id}:EXTERNAL_SIGNATURE_CUSTODY`;
  const providerEventId = await sha256Text([
    source.setId,
    expectedSigner.id,
    archived.eadEvidenceId,
    archived.binaryHashSha256,
    archived.archivedAt,
    reviewEventId,
  ].join(":"));
  const providerPayload = {
    provider: "EAD_TRUST",
    service: "EVIDENCE_MANAGER",
    provider_mode: "INTERPOSITION",
    provider_status: "COMPLETED",
    provider_reference: providerReference,
    provider_action_reservation_id: reservation,
    provider_hash_sha256: archived.eadProviderHashSha256,
    signature_claim: false,
    external_signature_review: externalSignatureReview,
    sandbox: false,
  };
  const { data: interpositionEvidenceId, error: evidenceError } = await auth.adminClient.rpc(
    "fn_secretaria_register_ead_interposition_evidence",
    {
      p_source_domain: "ANNUAL_ACCOUNTS",
      p_source_id: source.setId,
      p_legal_artifact_id: null,
      p_subject_person_id: expectedSigner.personId,
      p_subject_role: "ADMINISTRADOR",
      p_evidence_purpose: "EXTERNAL_SIGNATURE_CUSTODY",
      p_evidence_bundle_id: evidenceBundleId,
      p_provider_reference: providerReference,
      p_provider_status: "COMPLETED",
      p_occurred_at: archived.archivedAt,
      p_provider_payload: providerPayload,
      p_signature_request_id: null,
      p_provider_request_id: archived.eadCaseFileId,
      p_provider_event_id: providerEventId,
      p_verified_by: auth.userId,
    },
  );
  if (evidenceError || typeof interpositionEvidenceId !== "string") {
    return jsonResponse(409, {
      error: "external signature interposition evidence registration failed",
      detail: evidenceError?.message ?? "RPC did not return an evidence id",
    });
  }
  const { data: outcome, error: outcomeError } = await auth.adminClient.rpc(
    "fn_secretaria_record_annual_accounts_external_signature",
    {
      p_expected_signer_id: expectedSigner.id,
      p_interposition_evidence_id: interpositionEvidenceId,
      p_signed_at: signedAt,
      p_signature_fact_source: signatureFactSource,
      p_review_event_id: reviewEventId,
      p_finalizer_user_id: auth.userId,
      p_supersedes_outcome_id: supersedesOutcomeId,
    },
  );
  if (outcomeError || !outcome || typeof outcome !== "object") {
    return jsonResponse(409, {
      error: "reviewed external signature fact could not be persisted",
      detail: outcomeError?.message ?? "outcome RPC returned no result",
    });
  }
  const validation = await auth.userClient.rpc("fn_secretaria_validate_annual_accounts_execution", {
    p_annual_accounts_set_id: source.setId,
  });
  if (
    validation.error
    && !validation.error.message.includes("every administrator needs reviewed external signature evidence")
  ) {
    return jsonResponse(409, { error: "annual accounts roster validation failed", detail: validation.error.message });
  }
  return jsonResponse(200, {
    provider: "EAD_TRUST",
    providerName: "EAD Trust",
    service: "EVIDENCE_MANAGER",
    providerMode: "INTERPOSITION",
    signatureClaim: false,
    status: "EXTERNAL_SIGNATURE_EVIDENCE_RECORDED",
    sourceDomain: "ANNUAL_ACCOUNTS",
    sourceId: source.setId,
    expectedSignerId: expectedSigner.id,
    personId: expectedSigner.personId,
    evidenceBundleId,
    interpositionEvidenceId,
    outcome,
    signedAt,
    reviewedAt,
    reviewEventId,
    providerActionReservationId: reservation,
    signatureFactSource,
    binaryHashSha256: archived.binaryHashSha256,
    binaryHashSha512: archived.binaryHashSha512,
    storagePath: archived.storagePath,
    rosterComplete: !validation.error,
    executionState: validation.error ? null : validation.data,
    reused,
  });
}

async function handleRecordAnnualAccountsMissingCause(
  req: Request,
  body: RecordAnnualAccountsMissingCauseBody,
): Promise<Response> {
  const auth = await authenticateEdgeRequest(req);
  if (auth instanceof Response) return auth;
  const setId = (body.annualAccountsSetId ?? "").trim().toLowerCase();
  const expectedSignerId = (body.expectedSignerId ?? "").trim().toLowerCase();
  const causeCode = (body.causeCode ?? "").trim().toUpperCase();
  const causeText = (body.causeText ?? "").trim();
  const supersedesOutcomeId = body.supersedesOutcomeId == null
    ? null
    : body.supersedesOutcomeId.trim().toLowerCase();
  const allowedCauses = new Set([
    "DEATH",
    "ILLNESS_OR_INCAPACITY",
    "DISAGREEMENT",
    "UNREACHABLE",
    "OTHER_JUSTIFIED",
  ]);
  if (
    !UUID_PATTERN.test(setId)
    || !UUID_PATTERN.test(expectedSignerId)
    || !allowedCauses.has(causeCode)
    || causeText.length < 10
    || (supersedesOutcomeId !== null && !UUID_PATTERN.test(supersedesOutcomeId))
  ) return jsonResponse(400, { error: "annual accounts signer/coded cause input is invalid" });

  const sourceResult = await readCanonicalAnnualAccountsSource(auth.userClient, setId);
  if (sourceResult instanceof Response) return sourceResult;
  const source = sourceResult;
  const roleError = await assertAnnualAccountsRole(auth.userClient, source.tenantId);
  if (roleError) return roleError;
  if (!source.expectedSigners.some((signer) => signer.id === expectedSignerId)) {
    return jsonResponse(409, { error: "expected signer does not belong to the frozen annual accounts roster" });
  }
  const { data, error } = await auth.userClient.rpc(
    "fn_secretaria_record_annual_accounts_missing_signature_cause",
    {
      p_expected_signer_id: expectedSignerId,
      p_cause_code: causeCode,
      p_cause_text: causeText,
      p_supersedes_outcome_id: supersedesOutcomeId,
    },
  );
  if (error || !data) {
    return jsonResponse(409, {
      error: "annual accounts missing-signature cause could not be persisted",
      detail: error?.message ?? "outcome RPC returned no result",
    });
  }
  const validation = await auth.userClient.rpc("fn_secretaria_validate_annual_accounts_execution", {
    p_annual_accounts_set_id: source.setId,
  });
  if (
    validation.error
    && !validation.error.message.includes("every administrator needs reviewed external signature evidence")
  ) {
    return jsonResponse(409, { error: "annual accounts roster validation failed", detail: validation.error.message });
  }
  return jsonResponse(200, {
    status: "MISSING_SIGNATURE_CAUSE_RECORDED",
    sourceDomain: "ANNUAL_ACCOUNTS",
    sourceId: source.setId,
    expectedSignerId,
    causeCode,
    outcome: data,
    rosterComplete: !validation.error,
    executionState: validation.error ? null : validation.data,
  });
}

async function handleArchiveAnnualAccountsExecution(
  req: Request,
  _cfg: SuiteConfig | null,
  _body: ArchiveAnnualAccountsExecutionBody,
): Promise<Response> {
  const auth = await authenticateEdgeRequest(req);
  if (auth instanceof Response) return auth;
  return jsonResponse(409, {
    code: "AUTHORITATIVE_BINARY_REQUIRED",
    error:
      "La custodia final de las cuentas anuales exige un binario de ejecución generado y registrado de forma autoritativa en servidor; no se contactó EAD Trust ni se creó custodia.",
    providerMode: "INTERPOSITION",
    signatureClaim: false,
    custodyCreated: false,
    finalArtifactCreated: false,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "JSON inválido" });
  }

  const cfg = readConfig();
  try {
    if (body.action === "archive_final_legal_artifact") {
      // Esta acción autentica antes de revelar configuración o contactar EAD.
      return await handleArchiveFinalLegalArtifact(req, cfg, body as ArchiveFinalLegalArtifactBody);
    }
    if (body.action === "reconcile_verified_signature") {
      return await handleReconcileVerifiedSignature(req, cfg, body as ReconcileVerifiedSignatureBody);
    }
    if (body.action === "reconcile_annual_accounts_signature") {
      return await handleReconcileAnnualAccountsSignature(
        req,
        cfg,
        body as ReconcileAnnualAccountsSignatureBody,
      );
    }
    if (body.action === "record_annual_accounts_external_signature") {
      return await handleRecordAnnualAccountsExternalSignature(
        req,
        cfg,
        body as RecordAnnualAccountsExternalSignatureBody,
      );
    }
    if (body.action === "record_annual_accounts_missing_signature_cause") {
      return await handleRecordAnnualAccountsMissingCause(
        req,
        body as RecordAnnualAccountsMissingCauseBody,
      );
    }
    if (body.action === "archive_annual_accounts_execution") {
      return await handleArchiveAnnualAccountsExecution(
        req,
        cfg,
        body as ArchiveAnnualAccountsExecutionBody,
      );
    }
    if (body.action === "archive_annual_accounts_component_input") {
      return await handleArchiveAnnualAccountsComponentInput(
        req,
        cfg,
        body as ArchiveAnnualAccountsComponentInputBody,
      );
    }
    if (body.action === "status") {
      return await handleStatus(req, cfg, (body.signatureRequestId as string) ?? "");
    }
    if (body.action === "artifacts") {
      return await handleArtifacts(req, cfg, (body.signatureRequestId as string) ?? "");
    }
    if (body.action === "sign") {
      return await handleSign(req, cfg);
    }
    if (body.action === "evidence") {
      return await handleEvidence(req, cfg, body as EvidenceBody);
    }
    return jsonResponse(400, {
      error: "acción no soportada; use únicamente un flujo source-bound de interposición, mensajería o e-archiving",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`qtsp-proxy ${body.action} error:`, msg);
    return jsonResponse(502, { error: msg });
  }
});
