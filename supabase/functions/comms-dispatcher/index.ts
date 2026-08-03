// comms-dispatcher
// Invoked by pg_cron every minute (service_role JWT) and ad-hoc by SECRETARIO/
// ADMIN_TENANT staff after programming a communication.
//
// AUTH: this function must be deployed WITHOUT --no-verify-jwt. Supabase gateway
// rejects calls without a valid JWT. Inside, we additionally require:
//   - service_role JWT (pg_cron) → allowed
//   - authenticated user JWT with SECRETARIO or ADMIN_TENANT role → allowed
//   - anything else → 403
//
// TRANSACTIONAL SAFETY: every worker is fenced by dispatch_attempt_id. A lease
// expiry or a provider-accepted/DB-unknown result enters
// RECONCILIATION_REQUIRED and is never re-sent automatically.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EAD_TRUST_BASE = Deno.env.get('EAD_TRUST_API_URL') ?? '';
const EAD_TRUST_KEY = Deno.env.get('EAD_TRUST_API_KEY') ?? '';
// Full, contract-specific Notice Manager endpoint. We deliberately do not
// derive this from the Evidence Manager base URL: custody is not delivery.
const EAD_NOTICE_MANAGER_SEND_URL = Deno.env.get('EAD_NOTICE_MANAGER_SEND_URL') ?? '';
const EAD_NOTICE_MANAGER_PACKAGE_SEND_URL = Deno.env.get('EAD_NOTICE_MANAGER_PACKAGE_SEND_URL') ?? '';
const EAD_NOTICE_MANAGER_PACKAGE_CONTRACT = Deno.env.get('EAD_NOTICE_MANAGER_PACKAGE_CONTRACT') ?? '';
// Notice Manager has its own trust boundary. A generic Evidence/Timestamp key
// must never authorize delivery when the dedicated Notice secret is absent.
const EAD_NOTICE_MANAGER_API_KEY = Deno.env.get('EAD_NOTICE_MANAGER_API_KEY') ?? '';
const REMITENTE_NOMBRE = Deno.env.get('REMITENTE_NOMBRE') ?? 'Secretaría TGMS';
const REMITENTE_EMAIL = Deno.env.get('REMITENTE_EMAIL') ?? 'secretaria@tgms.es';
const BATCH_LIMIT = Number(Deno.env.get('DISPATCHER_BATCH_LIMIT') ?? '50');

interface Adjunto {
  id: string;
  tipo: string;
  label: string;
  storage_uri: string;
  source_attachment_id: string | null;
  hash_sha256: string | null;
  hash_sha512: string;
  mime_type: string;
  size_bytes: number | null;
  modo_entrega: 'ADJUNTO' | 'LINK_FIRMADO';
  signed_url_expiry_hours: number;
}

interface ResendResponse { id?: string; error?: string }
interface ResendAttachment {
  filename: string;
  path?: string;
  content?: string;
}
interface VerifiedAttachment {
  communication_attachment_id: string;
  source_attachment_id: string;
  label: string;
  mime_type: string;
  size_bytes: number;
  content_base64: string;
  hash_sha256: string;
  hash_sha512: string;
  storage_uri: string;
}
type EADNoticeStatus = 'REQUESTED' | 'DELIVERED';
type EADEarchiveStatus = 'PENDING' | 'COMPLETED' | 'ERROR';

interface EADNoticeAccepted {
  requestId: string;
  providerEventId: string | null;
  status: EADNoticeStatus;
  requestedAt: string;
  deliveredAt: string | null;
  earchiveStatus: EADEarchiveStatus;
  earchiveEvidenceId: string | null;
  earchiveArchivedAt: string | null;
  earchiveHashSha512: string | null;
}

interface AuthCheckResult {
  allowed: boolean;
  isServiceRole?: boolean;
  tenantId?: string | null;
  reason?: string;
  status?: number;
}

interface SafeProviderFailure {
  ok: false;
  retriable: boolean;
  error: string;
  acceptedUnknown?: false;
}

interface AcceptedUnknownProviderResult {
  ok: false;
  acceptedUnknown: true;
  provider: 'RESEND' | 'EAD_TRUST';
  providerEventId: string | null;
  error: string;
}

async function authorizeCaller(req: Request): Promise<AuthCheckResult> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { allowed: false, reason: 'Missing Authorization header', status: 401 };
  }
  const token = authHeader.replace(/^Bearer\s+/i, '');

  // Service role JWT (pg_cron uses this via app.service_role_key GUC)
  if (token === SERVICE_ROLE_KEY) {
    return { allowed: true, isServiceRole: true, tenantId: null };
  }

  // Otherwise verify as user JWT
  const verify = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error } = await verify.auth.getUser(token);
  if (error || !user) {
    return { allowed: false, reason: `Invalid JWT: ${error?.message ?? 'no user'}`, status: 401 };
  }

  // Check user has SECRETARIO or ADMIN_TENANT role
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile, error: profileErr } = await admin
    .from('user_profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileErr || !profile?.tenant_id) {
    return {
      allowed: false,
      reason: `Tenant resolution failed: ${profileErr?.message ?? 'no user profile'}`,
      status: profileErr ? 500 : 403,
    };
  }
  const { data: roles, error: rolesErr } = await admin
    .from('rbac_user_roles')
    .select('rbac_roles(role_code), is_active, expires_at')
    .eq('user_id', user.id)
    .eq('tenant_id', profile.tenant_id);
  if (rolesErr) {
    return { allowed: false, reason: `Role check failed: ${rolesErr.message}`, status: 500 };
  }
  type RoleRow = {
    rbac_roles: { role_code: string } | null;
    is_active: boolean | null;
    expires_at: string | null;
  };
  const allowedCodes = new Set(['SECRETARIO', 'ADMIN_TENANT']);
  const authorizationTime = Date.now();
  const hasRole = ((roles ?? []) as RoleRow[]).some(
    (r) => r.rbac_roles?.role_code
      && allowedCodes.has(r.rbac_roles.role_code)
      && r.is_active === true
      && (!r.expires_at || Date.parse(r.expires_at) > authorizationTime),
  );
  if (!hasRole) {
    return { allowed: false, reason: 'User lacks SECRETARIO or ADMIN_TENANT role', status: 403 };
  }
  return { allowed: true, isServiceRole: false, tenantId: profile.tenant_id };
}

async function resendSend(opts: {
  destino: string; asunto: string; cuerpoHtml: string; idempotencyKey: string;
  tags: Array<{ name: string; value: string }>; metadata: Record<string, string>;
  adjuntos: ResendAttachment[];
}): Promise<
  | { ok: true; eventId: string }
  | SafeProviderFailure
  | AcceptedUnknownProviderResult
> {
  if (!RESEND_API_KEY) return { ok: false, retriable: false, error: 'RESEND_API_KEY not configured' };
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': opts.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${REMITENTE_NOMBRE} <${REMITENTE_EMAIL}>`,
        to: [opts.destino],
        subject: opts.asunto,
        html: opts.cuerpoHtml,
        attachments: opts.adjuntos,
        tags: opts.tags,
        headers: opts.metadata,
      }),
    });
    const raw = await resp.text();
    let json: ResendResponse = {};
    try {
      json = JSON.parse(raw) as ResendResponse;
    } catch {
      if (resp.ok) {
        return {
          ok: false,
          acceptedUnknown: true,
          provider: 'RESEND',
          providerEventId: null,
          error: 'Resend accepted the request but returned a non-JSON success body',
        };
      }
    }
    if (!resp.ok) {
      if (resp.status >= 500) {
        return {
          ok: false,
          acceptedUnknown: true,
          provider: 'RESEND',
          providerEventId: nonEmptyString(json.id),
          error: `Resend returned ${resp.status}; provider acceptance cannot be ruled out`,
        };
      }
      return {
        ok: false,
        retriable: resp.status === 429,
        error: `Resend ${resp.status}: ${json.error ?? (raw.slice(0, 300) || 'unknown')}`,
      };
    }
    const eventId = nonEmptyString(json.id);
    if (!eventId) {
      return {
        ok: false,
        acceptedUnknown: true,
        provider: 'RESEND',
        providerEventId: null,
        error: 'Resend accepted the request but did not return its provider message id',
      };
    }
    return { ok: true, eventId };
  } catch (err) {
    return {
      ok: false,
      acceptedUnknown: true,
      provider: 'RESEND',
      providerEventId: null,
      error: `Resend transport outcome is unknown: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function digestHex(algorithm: 'SHA-256' | 'SHA-512', bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(algorithm, bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isRetriablePreProviderFailure(message: string): boolean {
  return /attachments read failed|stored attachment download failed|temporary access URL failed/i.test(message);
}

// Discriminador ERDS derivado de la clave estable del envío lógico. Todos los
// reintentos conocidos reutilizan la misma clave; un resultado externo incierto
// queda en conciliación y nunca genera otra solicitud automática.
function shortHashIdempotencyKey(key: string): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function canonicalProviderTimestamp(value: unknown, field: string): string {
  const raw = nonEmptyString(value);
  if (!raw || Number.isNaN(Date.parse(raw))) {
    throw new Error(`EAD Notice Manager response missing valid ${field}`);
  }
  return new Date(raw).toISOString();
}

function parseEADNoticeAccepted(value: unknown, expectedArchiveHashSha512: string): EADNoticeAccepted {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('EAD Notice Manager returned an invalid response body');
  }
  const raw = value as Record<string, unknown>;
  const requestId = nonEmptyString(raw.requestId ?? raw.request_id ?? raw.id);
  if (!requestId) throw new Error('EAD Notice Manager response missing requestId');

  const statusRaw = nonEmptyString(raw.status)?.toUpperCase();
  if (statusRaw !== 'REQUESTED' && statusRaw !== 'DELIVERED') {
    throw new Error(`EAD Notice Manager did not accept the message (status=${statusRaw ?? 'missing'})`);
  }
  const status = statusRaw as EADNoticeStatus;
  const requestedAt = canonicalProviderTimestamp(raw.requestedAt ?? raw.requested_at, 'requestedAt');
  const deliveredAt = status === 'DELIVERED'
    ? canonicalProviderTimestamp(raw.deliveredAt ?? raw.delivered_at, 'deliveredAt')
    : null;
  if (deliveredAt && Date.parse(deliveredAt) < Date.parse(requestedAt)) {
    throw new Error('EAD Notice Manager deliveredAt precedes requestedAt');
  }

  const archiveRaw = raw.earchive && typeof raw.earchive === 'object' && !Array.isArray(raw.earchive)
    ? raw.earchive as Record<string, unknown>
    : {};
  const archiveStatusRaw = nonEmptyString(
    archiveRaw.status ?? raw.earchiveStatus ?? raw.earchive_status,
  )?.toUpperCase() ?? 'PENDING';
  if (!['PENDING', 'COMPLETED', 'ERROR'].includes(archiveStatusRaw)) {
    throw new Error(`EAD Evidence Manager returned an invalid archive status (${archiveStatusRaw})`);
  }
  const earchiveStatus = archiveStatusRaw as EADEarchiveStatus;
  const earchiveEvidenceId = nonEmptyString(
    archiveRaw.evidenceId ?? archiveRaw.evidence_id ?? raw.earchiveEvidenceId ?? raw.earchive_evidence_id,
  );
  const earchiveArchivedAtRaw =
    archiveRaw.archivedAt ?? archiveRaw.archived_at ?? raw.earchiveArchivedAt ?? raw.earchive_archived_at;
  const earchiveArchivedAt = earchiveArchivedAtRaw == null
    ? null
    : canonicalProviderTimestamp(earchiveArchivedAtRaw, 'earchive.archivedAt');
  const earchiveHashSha512 = nonEmptyString(
    archiveRaw.hashSha512 ?? archiveRaw.hash_sha512 ?? raw.earchiveHashSha512 ?? raw.earchive_hash_sha512,
  )?.toLowerCase() ?? null;
  if (earchiveHashSha512 && !/^[a-f0-9]{128}$/.test(earchiveHashSha512)) {
    throw new Error('EAD Evidence Manager returned an invalid SHA-512 hash');
  }
  if (earchiveStatus === 'COMPLETED' && (!earchiveEvidenceId || !earchiveArchivedAt)) {
    throw new Error('EAD Evidence Manager marked archive COMPLETED without evidenceId/archivedAt');
  }
  if (
    earchiveStatus === 'COMPLETED'
    && earchiveHashSha512 !== expectedArchiveHashSha512.toLowerCase()
  ) {
    throw new Error('EAD Evidence Manager COMPLETED hash differs from the exact message/package hash');
  }

  return {
    requestId,
    providerEventId: nonEmptyString(raw.eventId ?? raw.event_id),
    status,
    requestedAt,
    deliveredAt,
    earchiveStatus,
    earchiveEvidenceId,
    earchiveArchivedAt,
    earchiveHashSha512,
  };
}

async function eadTrustErdsSend(opts: {
  recipientId: string; cuerpoHtml: string; cuerpoSha512: string; asunto: string; destino: string; idempotencyKey: string;
  metadata: Record<string, string>;
  deliveryMode: 'BASIC_MESSAGE' | 'PACKAGE_WITH_ATTACHMENTS';
  packageRevision: number;
  packageHashSha512: string;
  verifiedAttachments: VerifiedAttachment[];
}): Promise<
  | { ok: true; notice: EADNoticeAccepted }
  | SafeProviderFailure
  | AcceptedUnknownProviderResult
> {
  const packageMode = opts.deliveryMode === 'PACKAGE_WITH_ATTACHMENTS';
  if (opts.deliveryMode === 'BASIC_MESSAGE' && opts.verifiedAttachments.length !== 0) {
    return {
      ok: false,
      retriable: false,
      error: 'EAD BASIC_MESSAGE cannot carry attachments',
    };
  }
  if (packageMode && opts.verifiedAttachments.length === 0) {
    return { ok: false, retriable: false, error: 'EAD PACKAGE_WITH_ATTACHMENTS requires the verified package' };
  }
  if (
    packageMode
    && (
      EAD_NOTICE_MANAGER_PACKAGE_CONTRACT !== 'TGMS_EAD_NOTICE_PACKAGE_V1'
      || !EAD_NOTICE_MANAGER_PACKAGE_SEND_URL
    )
  ) {
    return {
      ok: false,
      retriable: false,
      error: 'EAD Notice Manager attachment contract is not explicitly configured; refusing package delivery/e-archive',
    };
  }
  const endpoint = packageMode
    ? EAD_NOTICE_MANAGER_PACKAGE_SEND_URL
    : EAD_NOTICE_MANAGER_SEND_URL;
  if (!endpoint || !EAD_NOTICE_MANAGER_API_KEY) {
    return { ok: false, retriable: false, error: 'EAD Trust Notice Manager not configured' };
  }
  const expectedArchiveHashSha512 = packageMode
    ? opts.packageHashSha512
    : opts.cuerpoSha512;
  if (!/^[0-9a-f]{128}$/.test(expectedArchiveHashSha512)) {
    return { ok: false, retriable: false, error: 'EAD expected archive hash is unavailable' };
  }
  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EAD_NOTICE_MANAGER_API_KEY}`,
        'Idempotency-Key': opts.idempotencyKey,
      },
      body: JSON.stringify({
        clientRequestId: `ERDS-${opts.recipientId}-${shortHashIdempotencyKey(opts.idempotencyKey)}`,
        recipient: { address: opts.destino },
        sender: { name: REMITENTE_NOMBRE, address: REMITENTE_EMAIL },
        message: {
          subject: opts.asunto,
          html: opts.cuerpoHtml,
          hashSha512: opts.cuerpoSha512,
        },
        ...(packageMode ? {
          package: {
            contractVersion: EAD_NOTICE_MANAGER_PACKAGE_CONTRACT,
            revision: opts.packageRevision,
            hashSha512: opts.packageHashSha512,
          },
          attachments: opts.verifiedAttachments.map((attachment) => ({
            id: attachment.communication_attachment_id,
            sourceAttachmentId: attachment.source_attachment_id,
            fileName: attachment.label,
            mimeType: attachment.mime_type,
            sizeBytes: attachment.size_bytes,
            contentBase64: attachment.content_base64,
            hashSha256: attachment.hash_sha256,
            hashSha512: attachment.hash_sha512,
          })),
        } : {}),
        earchive: {
          requested: true,
          service: 'EAD_TRUST_EVIDENCE_MANAGER',
          scope: packageMode ? 'MESSAGE_AND_ATTACHMENTS' : 'MESSAGE_BODY',
          expectedHashSha512: expectedArchiveHashSha512,
        },
        metadata: {
          recipient_id: opts.recipientId,
          destino: opts.destino,
          delivery_mode: opts.deliveryMode,
          ...opts.metadata,
        },
      }),
    });
  } catch (err) {
    return {
      ok: false,
      acceptedUnknown: true,
      provider: 'EAD_TRUST',
      providerEventId: null,
      error: `EAD Notice Manager transport outcome is unknown: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const raw = await resp.text();
  if (!resp.ok) {
    if (resp.status >= 500) {
      return {
        ok: false,
        acceptedUnknown: true,
        provider: 'EAD_TRUST',
        providerEventId: null,
        error: `EAD Notice Manager returned ${resp.status}; provider acceptance cannot be ruled out`,
      };
    }
    return {
      ok: false,
      retriable: resp.status === 429,
      error: `EAD Notice Manager ${resp.status}: ${raw.slice(0, 500)}`,
    };
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      acceptedUnknown: true,
      provider: 'EAD_TRUST',
      providerEventId: null,
      error: 'EAD Notice Manager accepted the request but returned a non-JSON success body',
    };
  }
  try {
    return { ok: true, notice: parseEADNoticeAccepted(data, expectedArchiveHashSha512) };
  } catch (error) {
    const value = data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown>
      : {};
    return {
      ok: false,
      acceptedUnknown: true,
      provider: 'EAD_TRUST',
      providerEventId: nonEmptyString(value.requestId ?? value.request_id ?? value.id),
      error: `EAD Notice Manager accepted the request but its response cannot be reconciled: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

serve(async (req) => {
  // 1. Auth gate
  const auth = await authorizeCaller(req);
  if (!auth.allowed) {
    return new Response(JSON.stringify({ error: auth.reason }), {
      status: auth.status ?? 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: claimed, error: claimErr } = await sb.rpc('fn_claim_recipients_for_dispatch', {
    p_limit: BATCH_LIMIT,
    p_tenant_id: auth.isServiceRole ? null : auth.tenantId,
  });
  if (claimErr) {
    return new Response(JSON.stringify({ error: claimErr.message, processed: 0 }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  const recipients = (claimed as Array<{
    id: string; communication_id: string; canal_original: string;
    canal_primario: string; canal_fallback: string | null; canal_usado: string | null;
    destino_primario: string; destino_fallback: string | null; intento_reenvio_n: number;
    dispatch_attempt_id: string; provider_idempotency_key: string;
  }>) ?? [];

  let processed = 0;
  const orphaned: Array<{ recipientId: string; reason: string }> = [];

  for (const r of recipients) {
    try {
    const canalEfectivo = r.canal_usado ?? r.canal_primario;
    const destinoEfectivo = canalEfectivo === r.canal_fallback
      ? r.destino_fallback ?? r.destino_primario
      : r.destino_primario;
    if (!r.dispatch_attempt_id || !r.provider_idempotency_key) {
      console.error(`Claim ${r.id} did not include its fencing token/idempotency key`);
      continue;
    }
    if (canalEfectivo === 'PORTAL_PUSH') {
      await sb.rpc('fn_recipient_handle_error_attempt', {
        p_recipient_id: r.id,
        p_dispatch_attempt_id: r.dispatch_attempt_id,
        p_error_message: 'PORTAL_PUSH adapter is not configured',
        p_retriable: false,
      });
      continue;
    }

    const { data: comm, error: communicationReadError } = await sb
      .from('communications')
      .select('id, tenant_id, convocatoria_id, tipo_comunicacion, asunto, cuerpo_render, cuerpo_hash_sha512, package_revision, package_hash_sha512, metadata')
      .eq('id', r.communication_id)
      .single();
    if (communicationReadError || !comm) {
      await sb.rpc('fn_recipient_handle_error_attempt', {
        p_recipient_id: r.id,
        p_dispatch_attempt_id: r.dispatch_attempt_id,
        p_error_message: `Communication read failed: ${communicationReadError?.message ?? 'not found'}`,
        p_retriable: true,
      });
      continue;
    }
    const { data: adjs, error: attachmentsReadError } = await sb
      .from('communication_attachments')
      .select('id, tipo, label, storage_uri, source_attachment_id, hash_sha256, hash_sha512, size_bytes, mime_type, modo_entrega, signed_url_expiry_hours, orden')
      .eq('communication_id', r.communication_id)
      .order('orden', { ascending: true });

    const allAdjs = (adjs as Adjunto[]) ?? [];
    const verifiedBinaryByAttachment = new Map<string, string>();
    const verifiedAttachments: VerifiedAttachment[] = [];
    const actualBodyHash = await digestHex(
      'SHA-512',
      new TextEncoder().encode(comm.cuerpo_render),
    );
    const generatedDocumentCount = allAdjs.filter(
      (attachment) => attachment.tipo === 'DOCUMENTO_GENERADO',
    ).length;
    let attachmentIntegrityError: string | null = attachmentsReadError
      ? `Communication attachments read failed: ${attachmentsReadError.message}`
      : actualBodyHash !== comm.cuerpo_hash_sha512
        ? 'Communication body SHA-512 mismatch'
      : comm.tipo_comunicacion === 'CONVOCATORIA' && allAdjs.length === 0
        ? 'Convocatoria communication has no stored attachment'
        : comm.tipo_comunicacion === 'CONVOCATORIA' && generatedDocumentCount !== 1
          ? `Convocatoria communication requires exactly one generated final document (found ${generatedDocumentCount})`
        : null;
    for (const attachment of allAdjs) {
      if (attachmentIntegrityError) break;
      if (!attachment.source_attachment_id) {
        if (comm.tipo_comunicacion === 'CONVOCATORIA') {
          attachmentIntegrityError = `Convocatoria attachment '${attachment.label}' lacks source_attachment_id`;
          break;
        }
        continue;
      }
      if (
        !attachment.storage_uri.startsWith('evidence-bundle://') ||
        !/^[0-9a-f]{64}$/.test(attachment.hash_sha256 ?? '') ||
        !/^[0-9a-f]{128}$/.test(attachment.hash_sha512)
      ) {
        attachmentIntegrityError = `Stored attachment contract invalid for '${attachment.label}'`;
        break;
      }
      const storagePath = attachment.storage_uri.replace(/^evidence-bundle:\/\//, '');
      const { data: storedBinary, error: downloadError } = await sb.storage
        .from('matter-documents')
        .download(storagePath);
      if (downloadError || !storedBinary) {
        attachmentIntegrityError = `Stored attachment download failed for '${attachment.label}': ${downloadError?.message ?? 'no binary returned'}`;
        break;
      }
      const bytes = new Uint8Array(await storedBinary.arrayBuffer());
      const [sha256, sha512] = await Promise.all([
        digestHex('SHA-256', bytes),
        digestHex('SHA-512', bytes),
      ]);
      if (sha256 !== attachment.hash_sha256 || sha512 !== attachment.hash_sha512) {
        attachmentIntegrityError = `Stored attachment hash mismatch for '${attachment.label}'`;
        break;
      }
      if (attachment.size_bytes !== null && attachment.size_bytes !== bytes.byteLength) {
        attachmentIntegrityError = `Stored attachment size mismatch for '${attachment.label}'`;
        break;
      }
      verifiedBinaryByAttachment.set(attachment.id, bytesToBase64(bytes));
      verifiedAttachments.push({
        communication_attachment_id: attachment.id,
        source_attachment_id: attachment.source_attachment_id,
        label: attachment.label,
        mime_type: attachment.mime_type,
        size_bytes: bytes.byteLength,
        content_base64: bytesToBase64(bytes),
        hash_sha256: sha256,
        hash_sha512: sha512,
        storage_uri: attachment.storage_uri,
      });
    }

    const adjuntos: ResendAttachment[] = allAdjs
      .filter((a) => a.modo_entrega === 'ADJUNTO')
      .map((a) => {
        const verifiedContent = verifiedBinaryByAttachment.get(a.id) ?? null;
        return verifiedContent
          ? { filename: a.label, content: verifiedContent }
          : { filename: a.label, path: a.storage_uri };
      });

    // ITEM-128: entrega de adjuntos en el modo legacy LINK_FIRMADO, que aquí
    // significa exclusivamente URL temporal de acceso; no firma electrónica.
    // Antes el dispatcher descartaba estos enlaces. Ahora generamos una URL
    // temporal por cada objeto privado y la inyectamos en el cuerpo. Fail-closed:
    // si la creación de algún enlace falla,
    // marcamos el destinatario como error RETRIABLE en lugar de enviar un correo
    // que promete un documento ausente.
    const linkFirmados = allAdjs.filter((a) => a.modo_entrega === 'LINK_FIRMADO');
    let linkSectionHtml = '';
    let linkSigningError: string | null = attachmentIntegrityError;
    for (const a of linkFirmados) {
      if (linkSigningError) break;
      const storagePath = a.storage_uri.replace(/^evidence-bundle:\/\//, '');
      const expirySeconds = Math.max(1, Math.round((a.signed_url_expiry_hours ?? 168) * 3600));
      const { data: signed, error: signErr } = await sb.storage
        .from('matter-documents')
        .createSignedUrl(storagePath, expirySeconds);
      if (signErr || !signed?.signedUrl) {
        linkSigningError = `Temporary access URL failed for '${a.label}': ${signErr?.message ?? 'no url returned'}`;
        break;
      }
      linkSectionHtml += `<p style="margin:4px 0"><a href="${escapeHtml(signed.signedUrl)}">${escapeHtml(a.label)}</a></p>`;
    }
    if (linkSectionHtml) {
      linkSectionHtml = `<hr/><p style="font-size:13px;margin:8px 0 4px"><strong>Documentos disponibles (enlace temporal con caducidad):</strong></p>${linkSectionHtml}`;
    }
    // Cuerpo entregado = cuerpo canónico + sección de enlaces. El hash sellado
    // (cuerpo_hash_sha512) sigue refiriéndose al cuerpo canónico; la sección de
    // enlaces es presentación, igual que el pie QTSP del canal EMAIL_CERTIFICADO.
    const cuerpoEntregado = comm.cuerpo_render + linkSectionHtml;

    // Stable for the logical recipient/package across known-safe retries.
    const idempotencyKey = r.provider_idempotency_key;
    const tags = [
      { name: 'recipient_id', value: r.id },
      { name: 'communication_id', value: comm.id },
    ];
    const metadata = { 'X-Communication-Id': comm.id, 'X-Tenant-Id': comm.tenant_id };

    if (!linkSigningError) {
      const { data: aggregateStillValid, error: revalidationError } = await sb.rpc(
        'fn_revalidate_recipient_dispatch_attempt',
        {
          p_recipient_id: r.id,
          p_dispatch_attempt_id: r.dispatch_attempt_id,
          p_expected_tenant_id: auth.isServiceRole ? comm.tenant_id : auth.tenantId,
          p_body_hash_sha512: actualBodyHash,
          p_package_revision: comm.package_revision,
          p_package_hash_sha512: comm.package_hash_sha512,
          p_verified_attachments: verifiedAttachments,
        },
      );
      if (revalidationError || aggregateStillValid !== true) {
        linkSigningError = `Pre-provider aggregate revalidation failed: ${revalidationError?.message ?? 'authoritative binding changed'}`;
      }
    }

    let result:
      | {
          ok: true;
          proveedor: 'RESEND';
          eventId: string;
          evidenceHashSha512?: string;
        }
      | {
          ok: true;
          proveedor: 'EAD_TRUST';
          eventId: string;
          notice: EADNoticeAccepted;
          evidenceHashSha512?: string;
        }
      | SafeProviderFailure
      | AcceptedUnknownProviderResult;

    if (linkSigningError) {
      // ITEM-128 fail-closed: no enviar si una URL temporal prometida no se
      // pudo crear. Retriable: la siguiente pasada del cron lo reintenta.
      result = {
        ok: false,
        retriable: isRetriablePreProviderFailure(linkSigningError),
        error: linkSigningError,
      };
    } else if (canalEfectivo === 'EMAIL_NORMAL') {
      const send = await resendSend({
        destino: destinoEfectivo, asunto: comm.asunto, cuerpoHtml: cuerpoEntregado,
        idempotencyKey, tags, metadata, adjuntos,
      });
      result = send.ok ? { ok: true, proveedor: 'RESEND', eventId: send.eventId } : send;
    } else if (canalEfectivo === 'EMAIL_CERTIFICADO') {
      // Canal histórico en cuarentena. Se reabrirá únicamente mediante una
      // migración posterior que vincule una configuración contractual EAD
      // autoritativa; nunca basta con que existan secretos en la Edge.
      result = {
        ok: false,
        retriable: false,
        error: 'EMAIL_CERTIFICADO is read-only until authoritative provider contract evidence is configured',
      };
    } else if (canalEfectivo === 'BUROFAX_ERDS') {
      const deliveryMode = comm.metadata?.ead_delivery_mode;
      if (deliveryMode !== 'BASIC_MESSAGE' && deliveryMode !== 'PACKAGE_WITH_ATTACHMENTS') {
        result = {
          ok: false,
          retriable: false,
          error: 'EAD communication lacks an explicit BASIC_MESSAGE/PACKAGE_WITH_ATTACHMENTS mode',
        };
      } else {
        const erds = await eadTrustErdsSend({
          recipientId: r.id, cuerpoHtml: cuerpoEntregado, cuerpoSha512: comm.cuerpo_hash_sha512,
          asunto: comm.asunto, destino: destinoEfectivo, idempotencyKey, metadata,
          deliveryMode,
          packageRevision: comm.package_revision,
          packageHashSha512: comm.package_hash_sha512,
          verifiedAttachments,
        });
        result = erds.ok
          ? {
              ok: true,
              proveedor: 'EAD_TRUST',
              eventId: erds.notice.requestId,
              notice: erds.notice,
              evidenceHashSha512: erds.notice.earchiveStatus === 'COMPLETED'
                ? erds.notice.earchiveHashSha512 ?? undefined
                : undefined,
            }
          : erds;
      }
    } else {
      result = { ok: false, retriable: false, error: `Unknown canal: ${canalEfectivo}` };
    }

    if (!result.ok && 'acceptedUnknown' in result && result.acceptedUnknown) {
      orphaned.push({ recipientId: r.id, reason: result.error });
      const { data: reconciled, error: reconciliationError } = await sb.rpc(
        'fn_recipient_mark_reconciliation_required',
        {
          p_recipient_id: r.id,
          p_dispatch_attempt_id: r.dispatch_attempt_id,
          p_provider: result.provider,
          p_provider_event_id: result.providerEventId,
          p_reason: result.error,
        },
      );
      if (reconciliationError || reconciled !== true) {
        console.error(
          `Failed to fence accepted-but-unknown provider result for ${r.id}:`,
          reconciliationError?.message ?? 'stale dispatch attempt',
        );
      }
      continue;
    }

    if (result.ok) {
      // CRITICAL: don't increment processed until the DB write succeeds.
      // If the provider accepted but the DB mark fails, fence the recipient in
      // RECONCILIATION_REQUIRED. It must never return to the automatic queue.
      const markResult = result.proveedor === 'EAD_TRUST'
        ? await sb.rpc('fn_recipient_mark_ead_notice_result_attempt', {
            p_recipient_id: r.id,
            p_dispatch_attempt_id: r.dispatch_attempt_id,
            p_idempotency_key: idempotencyKey,
            p_provider_request_id: result.notice.requestId,
            p_provider_event_id: result.notice.providerEventId,
            p_provider_status: result.notice.status,
            p_requested_at: result.notice.requestedAt,
            p_delivered_at: result.notice.deliveredAt,
            p_earchive_status: result.notice.earchiveStatus,
            p_earchive_evidence_id: result.notice.earchiveEvidenceId,
            p_earchive_archived_at: result.notice.earchiveArchivedAt,
            p_earchive_hash_sha512: result.notice.earchiveHashSha512,
          })
        : await sb.rpc('fn_recipient_mark_sent_attempt', {
            p_recipient_id: r.id,
            p_dispatch_attempt_id: r.dispatch_attempt_id,
            p_idempotency_key: idempotencyKey,
            p_canal_usado: canalEfectivo,
            p_proveedor: result.proveedor,
            p_proveedor_evento_id: result.eventId,
            p_evidence_hash: result.evidenceHashSha512 ?? null,
          });
      const markFailure = markResult.error?.message
        ?? (markResult.data === false ? 'stale dispatch attempt rejected by CAS' : null);
      if (markFailure) {
        orphaned.push({ recipientId: r.id, reason: `Sent but DB mark failed: ${markFailure}` });
        // Unknown external outcome is terminal until explicit reconciliation.
        const { error: reconciliationError } = await sb.rpc(
          'fn_recipient_mark_reconciliation_required',
          {
            p_recipient_id: r.id,
            p_dispatch_attempt_id: r.dispatch_attempt_id,
            p_provider: result.proveedor,
            p_provider_event_id: result.eventId,
            p_reason: `Provider accepted but DB mark failed: ${markFailure}`,
          },
        );
        if (reconciliationError) {
          console.error(`Failed to fence orphaned provider result for ${r.id}:`, reconciliationError.message);
        }
        // Insert internal alert
        try {
          const { data: t } = await sb.from('communications').select('tenant_id').eq('id', r.communication_id).single();
          if (t?.tenant_id) {
            const { error: notificationError } = await sb.from('notifications').insert({
              tenant_id: t.tenant_id,
              title: `Comunicación aceptada por el proveedor pero no conciliada (${r.id})`,
              body: markFailure,
              route: `/secretaria/comunicaciones/${r.communication_id}`,
              type: 'error',
            });
            if (notificationError) throw notificationError;
          }
        } catch (notifErr) {
          console.error(`Failed to insert internal alert:`, notifErr);
        }
        // DO NOT increment processed.
      } else {
        processed++;
      }
    } else {
      const { error: handleErr } = await sb.rpc('fn_recipient_handle_error_attempt', {
        p_recipient_id: r.id,
        p_dispatch_attempt_id: r.dispatch_attempt_id,
        p_error_message: result.error,
        p_retriable: result.retriable,
      });
      if (handleErr) {
        console.error(`fn_recipient_handle_error_attempt failed for ${r.id}:`, handleErr.message);
      }
    }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Unhandled dispatcher failure for recipient ${r.id}:`, message);
      const { error: handleErr } = await sb.rpc('fn_recipient_handle_error_attempt', {
        p_recipient_id: r.id,
        p_dispatch_attempt_id: r.dispatch_attempt_id,
        p_error_message: `Unhandled dispatcher failure: ${message}`,
        p_retriable: true,
      });
      if (handleErr) {
        console.error(`fn_recipient_handle_error_attempt failed for ${r.id}:`, handleErr.message);
      }
    }
  }

  return new Response(JSON.stringify({
    processed,
    claimed: recipients.length,
    orphaned: orphaned.length,
    orphaned_recipients: orphaned,
  }), { headers: { 'Content-Type': 'application/json' } });
});
