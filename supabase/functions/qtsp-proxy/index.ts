// ============================================================
// qtsp-proxy — Proxy server-side para la Digital Trust API de EAD Trust
//
// El browser NO puede ejecutar Okta client_credentials (el secret no puede
// vivir en el cliente): src/lib/qtsp/ead-trust-client.ts lanza
// QTSP_SERVER_PROXY_REQUIRED por diseño. Esta función ejecuta el mismo flujo
// QES de 6 pasos (crear SR → hash → añadir doc → subir S3 → READY_TO_SIGN →
// firmantes → activar) con los secretos provisionados en Supabase.
//
// Secretos requeridos (supabase secrets set …):
//   EAD_TRUST_OKTA_TOKEN_URL, EAD_TRUST_CLIENT_ID, EAD_TRUST_CLIENT_SECRET,
//   EAD_TRUST_SCOPE (default "token"),
//   EAD_TRUST_EVIDENCE_API_BASE_URL, EAD_TRUST_SIGNATURE_API_BASE_URL
//
// Sin secretos → 503 { code: "QTSP_PROXY_NOT_CONFIGURED" } (el front cae a su
// semántica actual: sandbox solo en dev/flag). Un fallo REAL del flujo QTSP
// devuelve 502 con detalle — nunca se convierte en éxito.
//
// Referencia del flujo: mismo contrato que g-mcp-server (@g-digital) y que el
// cliente browser ead-trust-client.ts (paths /api/v1/private/*).
// ============================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024; // 15MB tras decodificar
const POLL_INTERVAL_MS = Number(Deno.env.get("EAD_TRUST_POLL_INTERVAL_MS") ?? 3000);
const POLL_MAX_ATTEMPTS = Number(Deno.env.get("EAD_TRUST_POLL_MAX_ATTEMPTS") ?? 20);
const READY_TIMEOUT_MS = 60_000;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8" },
  });
}

// ─── Config ──────────────────────────────────────────────────────────────────

interface EADConfig {
  oktaTokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  evidenceApiBaseUrl: string;
  signatureApiBaseUrl: string;
}

function readConfig(): EADConfig | null {
  const oktaTokenUrl = Deno.env.get("EAD_TRUST_OKTA_TOKEN_URL") ?? "";
  const clientId = Deno.env.get("EAD_TRUST_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("EAD_TRUST_CLIENT_SECRET") ?? "";
  const signatureApiBaseUrl = Deno.env.get("EAD_TRUST_SIGNATURE_API_BASE_URL") ?? "";
  const evidenceApiBaseUrl = Deno.env.get("EAD_TRUST_EVIDENCE_API_BASE_URL") ?? "";
  if (!oktaTokenUrl || !clientId || !clientSecret || !signatureApiBaseUrl) return null;
  return {
    oktaTokenUrl,
    clientId,
    clientSecret,
    scope: Deno.env.get("EAD_TRUST_SCOPE") ?? "token",
    evidenceApiBaseUrl,
    signatureApiBaseUrl,
  };
}

// ─── Okta token (cache por instancia) ────────────────────────────────────────

let tokenCache: { accessToken: string; expiresAt: number } | null = null;
const TOKEN_SAFETY_MARGIN_MS = 60_000;

async function getOktaToken(cfg: EADConfig): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + TOKEN_SAFETY_MARGIN_MS) {
    return tokenCache.accessToken;
  }
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: cfg.scope,
  });
  const response = await fetch(cfg.oktaTokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: params.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Okta auth failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  tokenCache = { accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return tokenCache.accessToken;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

async function eadFetch(cfg: EADConfig, url: string, init: RequestInit, step: string): Promise<Record<string, unknown>> {
  const token = await getOktaToken(cfg);
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${step} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return response.json();
}

async function uploadToS3(presignedUrl: string, bytes: Uint8Array, sha256Base64: string): Promise<void> {
  // La URL prefirmada exige el checksum: sin x-amz-checksum-sha256 → 403.
  const response = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "x-amz-checksum-sha256": sha256Base64 },
    body: bytes.buffer as ArrayBuffer,
  });
  if (!response.ok) throw new Error(`S3 upload failed (${response.status})`);
}

// ─── Acción: sign (flujo QES de 6 pasos) ─────────────────────────────────────

interface SignBody {
  documentName?: string;
  documentBase64?: string;
  signatories?: Array<{ name?: string; email?: string; surnames?: string; sequence?: number }>;
  createdBy?: string;
  agreementId?: string;
}

async function handleSign(cfg: EADConfig, body: SignBody): Promise<Response> {
  const documentName = (body.documentName ?? "").trim().slice(0, 200);
  const createdBy = (body.createdBy ?? "").trim().slice(0, 120);
  const signatories = (body.signatories ?? []).filter((s) => s?.name && s?.email);
  if (!documentName || !body.documentBase64 || signatories.length === 0 || !createdBy) {
    return jsonResponse(400, { error: "documentName, documentBase64, signatories y createdBy son obligatorios" });
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

  const base = cfg.signatureApiBaseUrl;

  // 1. Crear Signature Request
  const sr = await eadFetch(cfg, `${base}/api/v1/private/signature-requests`, {
    method: "POST",
    body: JSON.stringify({
      name: `Firma QES — ${documentName}`,
      createdBy,
      description: body.agreementId ? `Acuerdo ${body.agreementId}` : undefined,
      notifications: true,
      language: "ES",
    }),
  }, "createSignatureRequest");
  const srId = sr.id as string;

  // 2. Hash
  const hashHex = await sha256Hex(bytes);

  // 3. Añadir documento + subir a S3
  const doc = await eadFetch(cfg, `${base}/api/v1/private/signature-requests/${srId}/documents`, {
    method: "POST",
    body: JSON.stringify({
      filename: documentName,
      title: documentName,
      hash: hashHex,
      signatureType: "INTERPOSITION",
      provider: "EADTRUST",
    }),
  }, "addDocument");
  await uploadToS3(doc.url as string, bytes, hexToBase64(hashHex));

  // 4. Esperar READY_TO_SIGN
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let ready = false;
  while (Date.now() < deadline) {
    const detail = await eadFetch(cfg, `${base}/api/v1/private/signature-requests/${srId}`, { method: "GET" }, "getSignatureRequest");
    const docs = (detail.documents as Array<{ status?: string }> | undefined) ?? [];
    if (docs.length > 0 && docs.every((d) => d.status === "READY_TO_SIGN")) { ready = true; break; }
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!ready) throw new Error(`Documento en SR ${srId} no alcanzó READY_TO_SIGN en ${READY_TIMEOUT_MS}ms`);

  // 5. Añadir firmantes
  const signatoryIds: string[] = [];
  for (const signer of signatories) {
    const payload: Record<string, unknown> = { name: signer.name, email: signer.email };
    if (signer.surnames) payload.surnames = signer.surnames;
    if (signer.sequence !== undefined) payload.sequence = signer.sequence;
    const result = await eadFetch(
      cfg,
      `${base}/api/v1/private/signature-requests/${srId}/documents/${doc.id}/signatories`,
      { method: "POST", body: JSON.stringify(payload) },
      "addSignatory",
    );
    signatoryIds.push(result.id as string);
  }

  // 6. Activar
  await eadFetch(cfg, `${base}/api/v1/private/signature-requests/${srId}/activate`, { method: "POST" }, "activateSignatureRequest");

  return jsonResponse(200, {
    srId,
    srStatus: "ACTIVE",
    documentId: doc.id,
    documentHash: hashHex,
    signatoryIds,
  });
}

// ─── Acción: status (consulta de una SR para seguimiento) ────────────────────

async function handleStatus(cfg: EADConfig, srId: string): Promise<Response> {
  if (!srId) return jsonResponse(400, { error: "srId es obligatorio" });
  const detail = await eadFetch(
    cfg,
    `${cfg.signatureApiBaseUrl}/api/v1/private/signature-requests/${encodeURIComponent(srId)}`,
    { method: "GET" },
    "getSignatureRequest",
  );
  return jsonResponse(200, {
    srId: detail.id,
    status: detail.status,
    documents: ((detail.documents as Array<Record<string, unknown>> | undefined) ?? []).map((d) => ({
      id: d.id,
      status: d.status,
    })),
  });
}

// ─── Acción: evidence (crear evidencia TSP + subir + poll) ───────────────────

interface EvidenceBody {
  title?: string;
  fileName?: string;
  documentBase64?: string;
  createdBy?: string;
  metadata?: Record<string, string>;
}

async function handleEvidence(cfg: EADConfig, body: EvidenceBody): Promise<Response> {
  if (!cfg.evidenceApiBaseUrl) {
    return jsonResponse(503, { code: "QTSP_PROXY_NOT_CONFIGURED", error: "EAD_TRUST_EVIDENCE_API_BASE_URL sin configurar" });
  }
  const title = (body.title ?? "").trim().slice(0, 200);
  const fileName = (body.fileName ?? "").trim().slice(0, 200);
  const createdBy = (body.createdBy ?? "").trim().slice(0, 120);
  if (!title || !fileName || !body.documentBase64 || !createdBy) {
    return jsonResponse(400, { error: "title, fileName, documentBase64 y createdBy son obligatorios" });
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

  const evidenceId = crypto.randomUUID();
  const hashHex = await sha256Hex(bytes);

  const created = await eadFetch(cfg, `${cfg.evidenceApiBaseUrl}/api/v1/private/evidences`, {
    method: "POST",
    body: JSON.stringify({
      evidenceId,
      hash: hashHex,
      capturedAt: new Date().toISOString(),
      custodyType: "INTERNAL",
      title,
      fileName,
      createdBy,
      fileSize: bytes.length,
      ...(body.metadata ? { metadata: body.metadata } : {}),
      testimony: { TSP: { required: true, providers: ["EADTrust"] } },
    }),
  }, "createEvidence");

  await uploadToS3(created.url as string, bytes, hexToBase64(hashHex));

  // Poll hasta COMPLETED/ERROR
  let finalStatus = "PENDING";
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const detail = await eadFetch(
      cfg,
      `${cfg.evidenceApiBaseUrl}/api/v1/private/evidences/${evidenceId}`,
      { method: "GET" },
      "getEvidence",
    );
    finalStatus = ((detail.status as { status?: string } | undefined)?.status) ?? "PENDING";
    if (finalStatus === "COMPLETED" || finalStatus === "ERROR") break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  if (finalStatus !== "COMPLETED") {
    throw new Error(`Evidencia ${evidenceId} terminó en estado ${finalStatus}`);
  }

  return jsonResponse(200, { evidenceId, status: finalStatus, hash: hashHex });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const cfg = readConfig();
  if (!cfg) {
    return jsonResponse(503, {
      code: "QTSP_PROXY_NOT_CONFIGURED",
      error: "Secretos EAD Trust sin provisionar (EAD_TRUST_OKTA_TOKEN_URL/CLIENT_ID/CLIENT_SECRET/SIGNATURE_API_BASE_URL)",
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "JSON inválido" });
  }

  try {
    switch (body.action) {
      case "sign":
        return await handleSign(cfg, body as SignBody);
      case "status":
        return await handleStatus(cfg, (body.srId as string) ?? "");
      case "evidence":
        return await handleEvidence(cfg, body as EvidenceBody);
      default:
        return jsonResponse(400, { error: 'action debe ser "sign", "status" o "evidence"' });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`qtsp-proxy ${body.action} error:`, msg);
    return jsonResponse(502, { error: msg });
  }
});
