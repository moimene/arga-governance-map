// ============================================================
// EAD Trust Digital Trust API Client
// Real integration: Okta OAuth + Evidence Manager + Signature Manager
// Reference: skill y MCP EAD TRUST/ead-trust-mcp/g-mcp-server-main/src/
// ============================================================

// ─── Configuration ──────────────────────────────────────────────────────────

const EAD_CONFIG = {
  okta: {
    tokenUrl: import.meta.env.VITE_EAD_TRUST_OKTA_TOKEN_URL ?? '',
    clientId: import.meta.env.VITE_EAD_TRUST_CLIENT_ID ?? '',
    clientSecret: '',
    scope: import.meta.env.VITE_EAD_TRUST_SCOPE ?? 'token',
  },
  evidenceApiBaseUrl: import.meta.env.VITE_EAD_TRUST_EVIDENCE_API_BASE_URL ?? '',
  signatureApiBaseUrl: import.meta.env.VITE_EAD_TRUST_SIGNATURE_API_BASE_URL ?? '',
  pollIntervalMs: Number(import.meta.env.VITE_EAD_TRUST_POLL_INTERVAL_MS ?? 3000),
  pollMaxAttempts: Number(import.meta.env.VITE_EAD_TRUST_POLL_MAX_ATTEMPTS ?? 20),
} as const;

function assertServerSideQTSPProxyConfigured(): void {
  throw new EADTrustError(
    'EAD Trust client_credentials must run server-side through a QTSP proxy. Browser demo flows must use sandbox adapters.',
    'QTSP_SERVER_PROXY_REQUIRED'
  );
}

// ─── Token Cache ────────────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;
const TOKEN_SAFETY_MARGIN_MS = 60_000;

/**
 * Obtains an OAuth token from Okta using client_credentials flow.
 * Caches the token and reuses it until 60s before expiry.
 */
export async function getOktaToken(): Promise<string> {
  if (!EAD_CONFIG.okta.tokenUrl || !EAD_CONFIG.okta.clientId || !EAD_CONFIG.okta.clientSecret) {
    assertServerSideQTSPProxyConfigured();
  }

  const now = Date.now();

  if (tokenCache && tokenCache.expiresAt > now + TOKEN_SAFETY_MARGIN_MS) {
    return tokenCache.accessToken;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: EAD_CONFIG.okta.clientId,
    client_secret: EAD_CONFIG.okta.clientSecret,
    scope: EAD_CONFIG.okta.scope,
  });

  const response = await fetch(EAD_CONFIG.okta.tokenUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new EADTrustError(
      `Okta auth failed (${response.status}): ${text}`,
      'AUTH_FAILED'
    );
  }

  const data = await response.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

export function clearTokenCache(): void {
  tokenCache = null;
}

// ─── Error Type ─────────────────────────────────────────────────────────────

export class EADTrustError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'EADTrustError';
    this.code = code;
  }
}

// ─── Helper: build headers ──────────────────────────────────────────────────

function buildHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// ─── Helper: SHA-256 (Web Crypto API) ───────────────────────────────────────

export async function computeSha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function sha256HexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

// ============================================================
// Evidence Manager API
// ============================================================

export interface CreateEvidenceInput {
  evidenceId: string;
  hash: string;
  capturedAt: string;
  custodyType?: 'INTERNAL' | 'EXTERNAL';
  title: string;
  fileName: string;
  createdBy: string;
  fileSize?: number;
  metadata?: Record<string, string>;
}

export interface CreateEvidenceResponse {
  url: string;        // presigned S3 URL for upload
  expiration: string;
}

export interface EvidenceDetail {
  id: string;
  status: { status: string };
  [key: string]: unknown;
}

/**
 * Creates an evidence record in EAD Trust Evidence Manager.
 * Returns a presigned S3 URL for file upload.
 */
export async function createEvidence(
  input: CreateEvidenceInput
): Promise<CreateEvidenceResponse> {
  const token = await getOktaToken();

  const body: Record<string, unknown> = {
    evidenceId: input.evidenceId,
    hash: input.hash,
    capturedAt: input.capturedAt,
    custodyType: input.custodyType ?? 'INTERNAL',
    title: input.title,
    fileName: input.fileName,
    createdBy: input.createdBy,
    testimony: {
      TSP: { required: true, providers: ['EADTrust'] },
    },
  };

  if (input.fileSize !== undefined) body.fileSize = input.fileSize;
  if (input.metadata !== undefined) body.metadata = input.metadata;

  const response = await fetch(
    `${EAD_CONFIG.evidenceApiBaseUrl}/api/v1/private/evidences`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new EADTrustError(
      `createEvidence failed (${response.status}): ${text}`,
      'EVIDENCE_CREATE_FAILED'
    );
  }

  return response.json();
}

/**
 * Retrieves evidence details by ID.
 */
export async function getEvidence(evidenceId: string): Promise<EvidenceDetail> {
  const token = await getOktaToken();

  const response = await fetch(
    `${EAD_CONFIG.evidenceApiBaseUrl}/api/v1/private/evidences/${evidenceId}`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new EADTrustError(
      `getEvidence failed (${response.status}): ${text}`,
      'EVIDENCE_GET_FAILED'
    );
  }

  return response.json();
}

/**
 * Uploads a file to the presigned S3 URL returned by createEvidence.
 */
export async function uploadToS3(
  presignedUrl: string,
  fileData: ArrayBuffer,
  sha256Base64: string
): Promise<void> {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'x-amz-checksum-sha256': sha256Base64,
    },
    body: fileData,
  });

  if (!response.ok) {
    throw new EADTrustError(
      `S3 upload failed (${response.status})`,
      'S3_UPLOAD_FAILED'
    );
  }
}

/**
 * Polls evidence status until COMPLETED or ERROR.
 */
export async function pollEvidenceUntilDone(
  evidenceId: string
): Promise<EvidenceDetail> {
  for (let attempt = 0; attempt < EAD_CONFIG.pollMaxAttempts; attempt++) {
    const evidence = await getEvidence(evidenceId);
    const status = evidence.status?.status;

    if (status === 'COMPLETED' || status === 'ERROR') {
      return evidence;
    }

    await new Promise(resolve => setTimeout(resolve, EAD_CONFIG.pollIntervalMs));
  }

  throw new EADTrustError(
    `Evidence ${evidenceId} did not reach final state after ${EAD_CONFIG.pollMaxAttempts} attempts`,
    'EVIDENCE_POLL_TIMEOUT'
  );
}

/**
 * Full evidence workflow: create → upload → poll.
 * Works with browser-friendly ArrayBuffer (no fs dependency).
 */
export async function generateEvidence(
  input: CreateEvidenceInput,
  fileData: ArrayBuffer,
  onProgress?: (msg: string) => void
): Promise<EvidenceDetail> {
  onProgress?.('Autenticando con Okta…');
  // Force fresh token
  await getOktaToken();

  onProgress?.('Calculando SHA-256…');
  const hash = await computeSha256(fileData);
  const hashBase64 = sha256HexToBase64(hash);

  onProgress?.('Creando evidencia en Evidence Manager…');
  const { url } = await createEvidence({
    ...input,
    hash,
    fileSize: fileData.byteLength,
  });

  onProgress?.('Subiendo archivo a S3…');
  await uploadToS3(url, fileData, hashBase64);

  onProgress?.('Esperando confirmación QTSP…');
  const result = await pollEvidenceUntilDone(input.evidenceId);

  onProgress?.('Evidencia completada.');
  return result;
}

// ============================================================
// Signature Manager API
// ============================================================

export interface CreateSignatureRequestInput {
  name: string;
  createdBy: string;
  description?: string;
  notifications?: boolean;
  language?: string;
}

export interface SignatureRequestView {
  id: string;
  name: string;
  status: string;
  description?: string;
  createdBy: string;
  documents?: Array<{ id: string; status?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface AddDocumentInput {
  filename: string;
  title: string;
  hash: string;
  signatureType: 'INTERPOSITION' | 'ADVANCED' | 'OTHER';
  description?: string;
  signatureDeadline?: string;
  provider?: 'EADTRUST';
  convertToPdf?: boolean;
}

export interface AddDocumentResponse {
  id: string;
  url: string;  // presigned S3 URL
  expiration?: string;
}

export interface AddSignatoryInput {
  name: string;
  email: string;
  surnames?: string;
  phone?: string;
  sequence?: number;
}

export interface SignatoryView {
  id: string;
  name: string;
  email: string;
  documentId?: string;
  signatureStatus?: string;
  [key: string]: unknown;
}

/**
 * Creates a new Signature Request in DRAFT status.
 */
export async function createSignatureRequest(
  input: CreateSignatureRequestInput
): Promise<SignatureRequestView> {
  const token = await getOktaToken();

  const response = await fetch(
    `${EAD_CONFIG.signatureApiBaseUrl}/api/v1/private/signature-requests`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify({
        name: input.name,
        createdBy: input.createdBy,
        description: input.description,
        notifications: input.notifications ?? true,
        language: input.language ?? 'ES',
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new EADTrustError(
      `createSignatureRequest failed (${response.status}): ${text}`,
      'SR_CREATE_FAILED'
    );
  }

  return response.json();
}

/**
 * Gets full details of a Signature Request.
 */
export async function getSignatureRequest(
  srId: string
): Promise<SignatureRequestView> {
  const token = await getOktaToken();

  const response = await fetch(
    `${EAD_CONFIG.signatureApiBaseUrl}/api/v1/private/signature-requests/${srId}`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new EADTrustError(
      `getSignatureRequest failed (${response.status}): ${text}`,
      'SR_GET_FAILED'
    );
  }

  return response.json();
}

/**
 * Adds a document to a Signature Request and returns presigned upload URL.
 */
export async function addDocumentToSR(
  srId: string,
  input: AddDocumentInput
): Promise<AddDocumentResponse> {
  const token = await getOktaToken();

  const response = await fetch(
    `${EAD_CONFIG.signatureApiBaseUrl}/api/v1/private/signature-requests/${srId}/documents`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new EADTrustError(
      `addDocument failed (${response.status}): ${text}`,
      'SR_ADD_DOC_FAILED'
    );
  }

  return response.json();
}

/**
 * Adds a signatory to a document within a SR.
 */
export async function addSignatoryToDocument(
  srId: string,
  documentId: string,
  input: AddSignatoryInput
): Promise<SignatoryView> {
  const token = await getOktaToken();

  const body: Record<string, unknown> = {
    name: input.name,
    email: input.email,
  };
  if (input.surnames) body.surnames = input.surnames;
  if (input.phone) body.phone = input.phone;
  if (input.sequence !== undefined) body.sequence = input.sequence;

  const response = await fetch(
    `${EAD_CONFIG.signatureApiBaseUrl}/api/v1/private/signature-requests/${srId}/documents/${documentId}/signatories`,
    {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new EADTrustError(
      `addSignatory failed (${response.status}): ${text}`,
      'SR_ADD_SIGNATORY_FAILED'
    );
  }

  return response.json();
}

/**
 * Activates a Signature Request (DRAFT → ACTIVE).
 * Triggers notifications to all signatories.
 */
export async function activateSignatureRequest(
  srId: string
): Promise<{ id: string; status: string }> {
  const token = await getOktaToken();

  const response = await fetch(
    `${EAD_CONFIG.signatureApiBaseUrl}/api/v1/private/signature-requests/${srId}/activate`,
    {
      method: 'POST',
      headers: buildHeaders(token),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new EADTrustError(
      `activateSignatureRequest failed (${response.status}): ${text}`,
      'SR_ACTIVATE_FAILED'
    );
  }

  return response.json();
}

/**
 * Polls SR until all documents reach READY_TO_SIGN status.
 * Required before adding signatories after document upload.
 */
export async function waitForDocumentsReady(
  srId: string,
  timeoutMs = 30000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const sr = await getSignatureRequest(srId);
    const docs = sr.documents ?? [];
    const allReady = docs.length > 0 && docs.every(d => d.status === 'READY_TO_SIGN');

    if (allReady) return;

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new EADTrustError(
    `Documents in SR ${srId} did not reach READY_TO_SIGN within ${timeoutMs}ms`,
    'SR_DOCS_NOT_READY'
  );
}

// ============================================================
// Full QES Signing Flow (orchestrated)
// ============================================================

export interface QESSignFlowInput {
  documentName: string;
  documentData: ArrayBuffer;
  signatories: Array<{
    name: string;
    email: string;
    surnames?: string;
    sequence?: number;
  }>;
  createdBy: string;
  agreementId?: string;
  onProgress?: (step: string) => void;
}

export interface QESSignFlowResult {
  srId: string;
  srStatus: string;
  documentId: string;
  documentHash: string;
  signatoryIds: string[];
  signedDocumentData?: ArrayBuffer;
}

/**
 * Full QES signature flow:
 * 1. Create Signature Request
 * 2. Compute SHA-256 of document
 * 3. Add document + upload to S3
 * 4. Wait for document to be READY_TO_SIGN
 * 5. Add all signatories
 * 6. Activate SR
 */
export async function executeQESSignFlow(
  input: QESSignFlowInput
): Promise<QESSignFlowResult> {
  const { onProgress } = input;

  // 1. Create SR
  onProgress?.('Creando solicitud de firma…');
  const sr = await createSignatureRequest({
    name: `Firma QES — ${input.documentName}`,
    createdBy: input.createdBy,
    description: input.agreementId
      ? `Acuerdo ${input.agreementId}`
      : undefined,
    language: 'ES',
  });

  // 2. Hash document
  onProgress?.('Calculando hash SHA-256…');
  const hashHex = await computeSha256(input.documentData);

  // 3. Add document + upload
  onProgress?.('Registrando documento en Signature Manager…');
  const doc = await addDocumentToSR(sr.id, {
    filename: input.documentName,
    title: input.documentName,
    hash: hashHex,
    signatureType: 'INTERPOSITION',
    provider: 'EADTRUST',
  });

  onProgress?.('Subiendo documento a S3…');
  const hashBase64 = sha256HexToBase64(hashHex);
  await uploadToS3(doc.url, input.documentData, hashBase64);

  // 4. Wait for READY_TO_SIGN
  onProgress?.('Esperando procesamiento del documento…');
  await waitForDocumentsReady(sr.id);

  // 5. Add signatories
  const signatoryIds: string[] = [];
  for (const signer of input.signatories) {
    onProgress?.(`Añadiendo firmante: ${signer.name}…`);
    const result = await addSignatoryToDocument(sr.id, doc.id, signer);
    signatoryIds.push(result.id);
  }

  // 6. Activate
  onProgress?.('Activando solicitud de firma…');
  await activateSignatureRequest(sr.id);

  onProgress?.('Solicitud de firma QES activada.');

  return {
    srId: sr.id,
    srStatus: 'ACTIVE',
    documentId: doc.id,
    documentHash: hashHex,
    signatoryIds,
  };
}
