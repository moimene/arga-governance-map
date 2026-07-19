// ============================================================
// qtsp-proxy v2 — Proxy server-side para EAD Enterprise Suite (QTSP)
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
// Sin secretos → 503 { code: "QTSP_PROXY_NOT_CONFIGURED" } (el front cae a su
// semántica actual: sandbox solo en dev/flag). Un fallo REAL del flujo QTSP
// devuelve 502 con detalle — nunca se convierte en éxito.
//
// Flujo de firma (secuencia probada contra la Suite, skill gocertius-suite-api §5):
//   case-file → signature-request → document (+PUT S3 con x-amz-checksum-sha256)
//   → poll READY_TO_SIGN → participant SIGNATORY → signatoryId por documento
//   → coordinates → activate. El firmante recibe el enlace por email.
// ============================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000; // lección v1: sin timeout, un upstream colgado = 150s idle
const READY_TIMEOUT_MS = 90_000; // procesado async del documento (~30s típico)
const SIGN_DEADLINE_DAYS = 7; // la Suite rechaza deadlines a más de ~10 días

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

function splitName(full: string, surnames?: string): { firstName: string; lastName: string } {
  if (surnames?.trim()) return { firstName: full.trim(), lastName: surnames.trim() };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
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

interface SignBody {
  documentName?: string;
  documentBase64?: string;
  signatories?: Array<{ name?: string; email?: string; surnames?: string; sequence?: number }>;
  createdBy?: string;
  agreementId?: string;
}

async function handleSign(cfg: SuiteConfig, body: SignBody): Promise<Response> {
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

  // 0. Case file contenedor (uno por solicitud — trazable por agreementId)
  const caseFileId = crypto.randomUUID();
  const useCaseId = await resolveUseCaseId(cfg);
  await suiteFetch(cfg, "/case-files", {
    method: "POST",
    body: JSON.stringify({
      id: caseFileId,
      name: `Firma QES — ${documentName}`.slice(0, 120),
      // Algunos use-cases exigen description aunque el schema base la marque opcional.
      description: body.agreementId ? `Acuerdo ${body.agreementId}` : `Documento ${documentName}`,
      reference: body.agreementId ?? undefined,
      useCaseId,
    }),
  }, "createCaseFile");

  // 1. Signature request (build-then-activate)
  const srId = crypto.randomUUID();
  const deadline = new Date(Date.now() + SIGN_DEADLINE_DAYS * 86400000).toISOString();
  await suiteFetch(cfg, `/case-files/${caseFileId}/signature-requests`, {
    method: "POST",
    body: JSON.stringify({
      id: srId,
      name: `Firma QES — ${documentName}`.slice(0, 120),
      language: "es_ES",
      deadline,
      signatureType: "INTERPOSITION",
      sequence: "PARALLEL",
      closeCondition: "ALL_REQUIRED",
      dashboardUrl: "NONE",
    }),
  }, "createSignatureRequest");

  // 2. Documento + subida (convertToPdf para DOCX: las coordenadas exigen PDF)
  const documentId = crypto.randomUUID();
  const { hex, b64 } = await sha256(bytes);
  const doc = await suiteFetch(cfg, `/case-files/${caseFileId}/signature-requests/${srId}/documents`, {
    method: "POST",
    body: JSON.stringify({
      id: documentId,
      hash: hex,
      title: documentName,
      fileName: documentName,
      convertToPdf: !documentName.toLowerCase().endsWith(".pdf"),
      fileSize: bytes.length,
    }),
  }, "addDocument");
  await uploadToS3(doc.url as string, bytes, b64);

  // 3. Poll hasta READY_TO_SIGN (procesado async; activar antes falla)
  const deadlineMs = Date.now() + READY_TIMEOUT_MS;
  let ready = false;
  while (Date.now() < deadlineMs) {
    const list = await suiteFetch(cfg, `/case-files/${caseFileId}/signature-requests/${srId}/documents`, { method: "GET" }, "listDocuments");
    const docs = (list.data as Array<{ status?: string }> | undefined) ?? [];
    if (docs.length > 0 && docs.every((d) => d.status === "READY_TO_SIGN")) { ready = true; break; }
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!ready) throw new Error(`Documento en SR ${srId} no alcanzó READY_TO_SIGN en ${READY_TIMEOUT_MS}ms`);

  // 4. Participantes SIGNATORY
  for (const signer of signatories) {
    const { firstName, lastName } = splitName(signer.name!, signer.surnames);
    await suiteFetch(cfg, `/case-files/${caseFileId}/signature-requests/${srId}/participants`, {
      method: "POST",
      body: JSON.stringify({
        id: crypto.randomUUID(),
        role: "SIGNATORY",
        firstName,
        lastName,
        email: signer.email,
        linkToAllDocuments: true,
      }),
    }, "addParticipant");
  }

  // 5. signatoryId por documento (puede diferir del participantId) + coordenadas
  const sigList = await suiteFetch(
    cfg,
    `/case-files/${caseFileId}/signature-requests/${srId}/documents/${documentId}/signatories`,
    { method: "GET" },
    "listSignatories",
  );
  const signatoryIds = (((sigList.data ?? sigList) as Array<{ id?: string }>) ?? [])
    .map((s) => s.id)
    .filter((id): id is string => typeof id === "string");
  if (signatoryIds.length === 0) throw new Error("Suite: sin signatories tras añadir participantes");

  let offset = 0;
  for (const signatoryId of signatoryIds) {
    await suiteFetch(
      cfg,
      `/case-files/${caseFileId}/signature-requests/${srId}/documents/${documentId}/signatories/${signatoryId}/coordinates`,
      {
        method: "PUT",
        body: JSON.stringify({ coordinates: [{ page: 1, x: 30, y: 230 + offset }] }),
      },
      "setCoordinates",
    );
    offset += 60;
  }

  // 6. Activar (los firmantes reciben el enlace de firma).
  //
  // EAD pagina el documento subido de forma ASINCRONA y valida las coordenadas
  // contra esa paginacion. Desde un host rapido la activacion llega antes de que
  // termine y falla con un generico {"code":"Unknow"}. Ademas la activacion a
  // veces triunfa en servidor y falla en el transporte, asi que se SONDEA antes
  // de reintentar: reactivar a ciegas duplicaria trabajo.
  const srStatus = await activateWithRetry(cfg, caseFileId, srId);

  return jsonResponse(200, {
    srId,
    // Estado REAL devuelto por el proveedor. `ACTIVE` significa que los firmantes
    // han recibido el enlace y NADIE ha firmado todavia; solo `COMPLETED`
    // acredita firma. El cliente decide en funcion de esto, no de la ausencia de
    // error.
    srStatus,
    caseFileId,
    documentId,
    documentHash: hex,
    signatoryIds,
  });
}

const ACTIVATE_RETRY_DELAYS_MS = [0, 2000, 5000, 10000];

async function readSignatureRequestStatus(
  cfg: SuiteConfig,
  caseFileId: string,
  srId: string,
): Promise<string | null> {
  try {
    const detail = await suiteFetch(
      cfg,
      `/case-files/${caseFileId}/signature-requests/${srId}`,
      { method: "GET" },
      "getSignatureRequest",
    );
    const status = detail?.status;
    return typeof status === "string" ? status.toUpperCase() : null;
  } catch {
    return null;
  }
}

async function activateWithRetry(cfg: SuiteConfig, caseFileId: string, srId: string): Promise<string> {
  let lastError: unknown = null;
  for (const delay of ACTIVATE_RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      await suiteFetch(
        cfg,
        `/case-files/${caseFileId}/signature-requests/${srId}/activate`,
        { method: "PUT" },
        "activateSignatureRequest",
      );
      return (await readSignatureRequestStatus(cfg, caseFileId, srId)) ?? "ACTIVE";
    } catch (err) {
      lastError = err;
      // ¿Se activo pese al error de transporte? Si ya no esta en DRAFT, la
      // solicitud esta viva y reintentar solo duplicaria.
      const status = await readSignatureRequestStatus(cfg, caseFileId, srId);
      if (status && status !== "DRAFT") return status;
    }
  }
  throw lastError ?? new Error("activateSignatureRequest agoto los reintentos");
}

// ─── Acción: status ──────────────────────────────────────────────────────────

async function handleStatus(cfg: SuiteConfig, caseFileId: string, srId: string): Promise<Response> {
  if (!caseFileId || !srId) return jsonResponse(400, { error: "caseFileId y srId son obligatorios" });
  const detail = await suiteFetch(
    cfg,
    `/case-files/${encodeURIComponent(caseFileId)}/signature-requests/${encodeURIComponent(srId)}`,
    { method: "GET" },
    "getSignatureRequest",
  );
  const docs = await suiteFetch(
    cfg,
    `/case-files/${encodeURIComponent(caseFileId)}/signature-requests/${encodeURIComponent(srId)}/documents`,
    { method: "GET" },
    "listDocuments",
  );
  return jsonResponse(200, {
    srId,
    caseFileId,
    status: detail.status,
    documents: ((docs.data as Array<Record<string, unknown>> | undefined) ?? []).map((d) => ({ id: d.id, status: d.status })),
  });
}

// ─── Acción: artifacts (documento firmado + certificado) ────────────────────
//
// Una firma completada produce DOS PDF distintos y hay que capturar los dos:
//
//   · El DOCUMENTO FIRMADO: el acuerdo con los sellos visibles de cada firmante.
//     Es el que el abogado espera ver.
//   · El CERTIFICADO de finalizacion (hoja de firmas): un informe que acredita
//     el proceso —firmantes, evidencias, hashes— y que NO contiene el texto del
//     acuerdo.
//
// Guardar solo el certificado y llamarlo "contrato firmado" es un defecto legal
// y de UX. Se devuelven ambas URLs por separado, cada una no fatal respecto de
// la otra: que falte el certificado no debe impedir recuperar el documento.
//
// Ambos endpoints exigen que el documento este SIGNED; antes devuelven error.

async function handleArtifacts(
  cfg: SuiteConfig,
  caseFileId: string,
  srId: string,
  documentId: string,
): Promise<Response> {
  if (!caseFileId || !srId || !documentId) {
    return jsonResponse(400, { error: "caseFileId, srId y documentId son obligatorios" });
  }

  const base = `/case-files/${encodeURIComponent(caseFileId)}/signature-requests/${encodeURIComponent(srId)}/documents/${encodeURIComponent(documentId)}`;

  const pick = (payload: Record<string, unknown> | null, ...keys: string[]): string | null => {
    if (!payload) return null;
    for (const k of keys) {
      const v = payload[k];
      if (typeof v === "string" && v) return v;
    }
    return null;
  };

  const tryFetch = async (path: string, label: string) => {
    try {
      const r = await suiteFetch(cfg, path, { method: "GET" }, label);
      return { ok: true as const, data: r as Record<string, unknown> };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  };

  const [signed, cert, pkg] = await Promise.all([
    tryFetch(`${base}/signed-document-url`, "getSignedDocumentUrl"),
    tryFetch(`${base}/certificates/document-url`, "getCertificateUrl"),
    tryFetch(`${base}/certificates/package-url`, "getCertificatePackageUrl"),
  ]);

  // El nombre del campo cambia segun el endpoint: signedDocumentUrl / documentUrl
  // / packageUrl. No se puede asumir uno solo.
  return jsonResponse(200, {
    caseFileId,
    srId,
    documentId,
    signedDocumentUrl: signed.ok ? pick(signed.data, "signedDocumentUrl", "url") : null,
    signedDocumentError: signed.ok ? null : signed.error,
    certificateUrl: cert.ok ? pick(cert.data, "documentUrl", "url") : null,
    certificateError: cert.ok ? null : cert.error,
    certificatePackageUrl: pkg.ok ? pick(pkg.data, "packageUrl", "url") : null,
  });
}

// ─── Acción: evidence (grupo FILE → evidencia → subida → close → poll) ───────

interface EvidenceBody {
  title?: string;
  fileName?: string;
  documentBase64?: string;
  createdBy?: string;
}

async function handleEvidence(cfg: SuiteConfig, body: EvidenceBody): Promise<Response> {
  const title = (body.title ?? "").trim().slice(0, 200);
  const fileName = (body.fileName ?? "").trim().slice(0, 200);
  if (!title || !fileName || !body.documentBase64) {
    return jsonResponse(400, { error: "title, fileName y documentBase64 son obligatorios" });
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

  const caseFileId = crypto.randomUUID();
  const groupId = crypto.randomUUID();
  const evidenceId = crypto.randomUUID();
  const useCaseId = await resolveUseCaseId(cfg);
  const { hex, b64 } = await sha256(bytes);

  await suiteFetch(cfg, "/case-files", {
    method: "POST",
    body: JSON.stringify({ id: caseFileId, name: `Evidencia — ${title}`.slice(0, 120), description: title, useCaseId }),
  }, "createCaseFile");

  await suiteFetch(cfg, "/evidence-groups", {
    method: "POST",
    body: JSON.stringify({ id: groupId, caseFileId, evidenceType: "FILE", name: title.slice(0, 120) }),
  }, "createEvidenceGroup");

  await suiteFetch(cfg, "/evidences", {
    method: "POST",
    body: JSON.stringify({ id: evidenceId, caseFileId, evidenceGroupId: groupId, hash: hex, title, custodyType: "EXTERNAL", fileName }),
  }, "createEvidence");

  const uploadRes = await suiteFetch(
    cfg,
    `/case-files/${caseFileId}/evidence-groups/${groupId}/evidences/${evidenceId}/upload-url`,
    { method: "POST", body: JSON.stringify({ hash: hex, fileName }) },
    "getUploadUrl",
  );
  await uploadToS3(uploadRes.uploadFileUrl as string, bytes, b64);

  await suiteFetch(cfg, `/case-files/${caseFileId}/evidence-groups/${groupId}/close`, {
    method: "POST",
    body: JSON.stringify({ evidencesCount: 1 }),
  }, "closeEvidenceGroup");

  // Poll hasta COMPLETED (sellado async)
  let finalStatus = "PENDING";
  const deadlineMs = Date.now() + 60_000;
  while (Date.now() < deadlineMs) {
    const detail = await suiteFetch(
      cfg,
      `/case-files/${caseFileId}/evidence-groups/${groupId}/evidences/${evidenceId}`,
      { method: "GET" },
      "getEvidence",
    );
    finalStatus = typeof detail.status === "string" ? detail.status : ((detail.status as { status?: string } | undefined)?.status ?? "PENDING");
    if (finalStatus === "COMPLETED" || finalStatus === "ERROR") break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (finalStatus !== "COMPLETED") throw new Error(`Evidencia ${evidenceId} terminó en estado ${finalStatus}`);

  return jsonResponse(200, { evidenceId, caseFileId, evidenceGroupId: groupId, status: finalStatus, hash: hex });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const cfg = readConfig();
  if (!cfg) {
    return jsonResponse(503, {
      code: "QTSP_PROXY_NOT_CONFIGURED",
      error: "Secretos EAD Enterprise Suite sin provisionar (EAD_SUITE_AUTH_EMAIL / EAD_SUITE_AUTH_PASSWORD)",
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
        return await handleStatus(cfg, (body.caseFileId as string) ?? "", (body.srId as string) ?? "");
      case "artifacts":
        return await handleArtifacts(
          cfg,
          (body.caseFileId as string) ?? "",
          (body.srId as string) ?? "",
          (body.documentId as string) ?? "",
        );
      case "evidence":
        return await handleEvidence(cfg, body as EvidenceBody);
      default:
        return jsonResponse(400, { error: 'action debe ser "sign", "status", "artifacts" o "evidence"' });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`qtsp-proxy ${body.action} error:`, msg);
    return jsonResponse(502, { error: msg });
  }
});
