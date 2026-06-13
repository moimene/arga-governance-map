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
// TRANSACTIONAL SAFETY: if the adapter call succeeds but the post-send DB write
// fails, we DO NOT increment `processed`. Instead we insert a best-effort
// orphan-mark event and alert via notifications table so the operator can reconcile.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EAD_TRUST_BASE = Deno.env.get('EAD_TRUST_API_URL') ?? '';
const EAD_TRUST_KEY = Deno.env.get('EAD_TRUST_API_KEY') ?? '';
const REMITENTE_NOMBRE = Deno.env.get('REMITENTE_NOMBRE') ?? 'Secretaría TGMS';
const REMITENTE_EMAIL = Deno.env.get('REMITENTE_EMAIL') ?? 'secretaria@tgms.es';
const BATCH_LIMIT = Number(Deno.env.get('DISPATCHER_BATCH_LIMIT') ?? '50');

interface Adjunto {
  label: string;
  storage_uri: string;
  hash_sha512: string;
  mime_type: string;
  modo_entrega: 'ADJUNTO' | 'LINK_FIRMADO';
  signed_url_expiry_hours: number;
}

interface ResendResponse { id?: string; error?: string }
interface EADEvidence { id: string; hash: string; status?: { status: string } }

interface AuthCheckResult {
  allowed: boolean;
  reason?: string;
  status?: number;
}

async function authorizeCaller(req: Request): Promise<AuthCheckResult> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return { allowed: false, reason: 'Missing Authorization header', status: 401 };
  }
  const token = authHeader.replace(/^Bearer\s+/i, '');

  // Service role JWT (pg_cron uses this via app.service_role_key GUC)
  if (token === SERVICE_ROLE_KEY) {
    return { allowed: true };
  }

  // Otherwise verify as user JWT
  const verify = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error } = await verify.auth.getUser(token);
  if (error || !user) {
    return { allowed: false, reason: `Invalid JWT: ${error?.message ?? 'no user'}`, status: 401 };
  }

  // Check user has SECRETARIO or ADMIN_TENANT role
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: roles, error: rolesErr } = await admin
    .from('rbac_user_roles')
    .select('rbac_roles(role_code), is_active')
    .eq('user_id', user.id);
  if (rolesErr) {
    return { allowed: false, reason: `Role check failed: ${rolesErr.message}`, status: 500 };
  }
  type RoleRow = { rbac_roles: { role_code: string } | null; is_active: boolean | null };
  const allowedCodes = new Set(['SECRETARIO', 'ADMIN_TENANT']);
  const hasRole = ((roles ?? []) as RoleRow[]).some(
    (r) => r.rbac_roles?.role_code && allowedCodes.has(r.rbac_roles.role_code) && (r.is_active ?? true),
  );
  if (!hasRole) {
    return { allowed: false, reason: 'User lacks SECRETARIO or ADMIN_TENANT role', status: 403 };
  }
  return { allowed: true };
}

async function resendSend(opts: {
  destino: string; asunto: string; cuerpoHtml: string; idempotencyKey: string;
  tags: Array<{ name: string; value: string }>; metadata: Record<string, string>;
  adjuntos: Array<{ filename: string; path: string }>;
}): Promise<{ ok: true; eventId: string } | { ok: false; retriable: boolean; error: string }> {
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
    const json = (await resp.json()) as ResendResponse;
    if (!resp.ok) {
      return { ok: false, retriable: resp.status >= 500 || resp.status === 429, error: `Resend ${resp.status}: ${json.error ?? 'unknown'}` };
    }
    return { ok: true, eventId: json.id ?? '' };
  } catch (err) {
    return { ok: false, retriable: true, error: err instanceof Error ? err.message : String(err) };
  }
}

async function eadTrustTimestamp(bodyHash: string): Promise<{ ok: true; evidenceId: string; tsqTokenBase64: string; timestampedAt: string; hashSha512: string } | { ok: false; retriable: boolean; error: string }> {
  if (!EAD_TRUST_BASE || !EAD_TRUST_KEY) return { ok: false, retriable: false, error: 'EAD_TRUST not configured' };
  try {
    const resp = await fetch(`${EAD_TRUST_BASE}/timestamp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${EAD_TRUST_KEY}` },
      body: JSON.stringify({ hash: bodyHash }),
    });
    if (!resp.ok) return { ok: false, retriable: resp.status >= 500 || resp.status === 429, error: `EAD ${resp.status}` };
    const data = (await resp.json()) as { evidenceId: string; tsqTokenBase64: string; timestampedAt: string; hashSha512: string };
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, retriable: true, error: err instanceof Error ? err.message : String(err) };
  }
}

// ITEM-127: discriminador de idempotencia ERDS derivado de la clave COMPLETA.
// `idempotencyKey.substring(0,8)` solo capturaba los primeros 8 chars del UUID
// del recipient (constante por destinatario), ignorando cuerpo_hash e
// intento_reenvio_n que la clave pretende incorporar. Un hash corto djb2 (FNV-like)
// de la clave entera asegura que reintentos manuales (intento reseteado) o reenvíos
// con cuerpo distinto produzcan un evidenceId distinto, evitando que EAD Trust lo
// rechace como duplicado o lo asocie al envío equivocado.
function shortHashIdempotencyKey(key: string): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

async function eadTrustErdsSend(opts: {
  recipientId: string; cuerpoHtml: string; cuerpoSha512: string; asunto: string; destino: string; idempotencyKey: string;
  metadata: Record<string, string>;
}): Promise<{ ok: true; eventId: string; evidenceHashSha512: string } | { ok: false; retriable: boolean; error: string }> {
  if (!EAD_TRUST_BASE || !EAD_TRUST_KEY) return { ok: false, retriable: false, error: 'EAD_TRUST not configured' };
  const payload = new TextEncoder().encode(`Asunto: ${opts.asunto}\n\n${opts.cuerpoHtml}\n\nDestinatario: ${opts.destino}`);
  try {
    const resp = await fetch(`${EAD_TRUST_BASE}/evidences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${EAD_TRUST_KEY}` },
      body: JSON.stringify({
        // ITEM-127: discriminador con hash corto de la idempotencyKey COMPLETA
        // (recipient + cuerpo_hash + intento), no solo los primeros 8 chars del UUID.
        evidenceId: `ERDS-${opts.recipientId}-${shortHashIdempotencyKey(opts.idempotencyKey)}`,
        hash: opts.cuerpoSha512,
        capturedAt: new Date().toISOString(),
        custodyType: 'EXTERNAL',
        title: `ERDS: ${opts.asunto}`,
        fileName: `notificacion-${opts.recipientId}.eml`,
        createdBy: REMITENTE_EMAIL,
        fileSize: payload.byteLength,
        metadata: { recipient_id: opts.recipientId, destino: opts.destino, ...opts.metadata },
      }),
    });
    if (!resp.ok) return { ok: false, retriable: resp.status >= 500 || resp.status === 429, error: `EAD ${resp.status}` };
    const data = (await resp.json()) as EADEvidence;
    return { ok: true, eventId: data.id, evidenceHashSha512: data.hash };
  } catch (err) {
    return { ok: false, retriable: true, error: err instanceof Error ? err.message : String(err) };
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
  const { data: claimed, error: claimErr } = await sb.rpc('fn_claim_recipients_for_dispatch', { p_limit: BATCH_LIMIT });
  if (claimErr) {
    return new Response(JSON.stringify({ error: claimErr.message, processed: 0 }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  const recipients = (claimed as Array<{
    id: string; communication_id: string; canal_primario: string;
    destino_primario: string; intento_reenvio_n: number;
  }>) ?? [];

  let processed = 0;
  const orphaned: Array<{ recipientId: string; reason: string }> = [];

  for (const r of recipients) {
    if (r.canal_primario === 'PORTAL_PUSH') {
      console.warn(`Skipping PORTAL_PUSH recipient ${r.id} (no adapter in P1)`);
      continue;
    }

    const { data: comm } = await sb
      .from('communications')
      .select('id, tenant_id, asunto, cuerpo_render, cuerpo_hash_sha512')
      .eq('id', r.communication_id)
      .single();
    if (!comm) continue;
    const { data: adjs } = await sb
      .from('communication_attachments')
      .select('label, storage_uri, hash_sha512, mime_type, modo_entrega, signed_url_expiry_hours, orden')
      .eq('communication_id', r.communication_id)
      .order('orden', { ascending: true });

    const allAdjs = (adjs as Adjunto[]) ?? [];
    const adjuntos = allAdjs.filter((a) => a.modo_entrega === 'ADJUNTO')
      .map((a) => ({ filename: a.label, path: a.storage_uri }));

    // ITEM-128: entrega de adjuntos en modo LINK_FIRMADO. Antes el dispatcher
    // filtraba solo 'ADJUNTO' y descartaba silenciosamente los LINK_FIRMADO, de
    // modo que el Board Pack distribuido por enlace nunca llegaba al cuerpo del
    // email. Ahora generamos una signed URL por cada adjunto LINK_FIRMADO (bucket
    // privado 'matter-documents', misma vía que sign-evidence-url) y la inyectamos
    // como sección de enlaces. Fail-closed: si la firma de algún enlace falla,
    // marcamos el destinatario como error RETRIABLE en lugar de enviar un correo
    // que promete un documento ausente.
    const linkFirmados = allAdjs.filter((a) => a.modo_entrega === 'LINK_FIRMADO');
    let linkSectionHtml = '';
    let linkSigningError: string | null = null;
    for (const a of linkFirmados) {
      const storagePath = a.storage_uri.replace(/^evidence-bundle:\/\//, '');
      const expirySeconds = Math.max(1, Math.round((a.signed_url_expiry_hours ?? 168) * 3600));
      const { data: signed, error: signErr } = await sb.storage
        .from('matter-documents')
        .createSignedUrl(storagePath, expirySeconds);
      if (signErr || !signed?.signedUrl) {
        linkSigningError = `LINK_FIRMADO signed URL failed for '${a.label}': ${signErr?.message ?? 'no url returned'}`;
        break;
      }
      linkSectionHtml += `<p style="margin:4px 0"><a href="${signed.signedUrl}">${a.label}</a></p>`;
    }
    if (linkSectionHtml) {
      linkSectionHtml = `<hr/><p style="font-size:13px;margin:8px 0 4px"><strong>Documentos disponibles (enlace firmado, caduca):</strong></p>${linkSectionHtml}`;
    }
    // Cuerpo entregado = cuerpo canónico + sección de enlaces. El hash sellado
    // (cuerpo_hash_sha512) sigue refiriéndose al cuerpo canónico; la sección de
    // enlaces es presentación, igual que el pie QTSP del canal EMAIL_CERTIFICADO.
    const cuerpoEntregado = comm.cuerpo_render + linkSectionHtml;

    const idempotencyKey = `${r.id}-${comm.cuerpo_hash_sha512}-${r.intento_reenvio_n}`;
    const tags = [
      { name: 'recipient_id', value: r.id },
      { name: 'communication_id', value: comm.id },
    ];
    const metadata = { 'X-Communication-Id': comm.id, 'X-Tenant-Id': comm.tenant_id };

    let result:
      | { ok: true; proveedor: 'RESEND' | 'EAD_TRUST'; eventId: string; evidenceHashSha512?: string }
      | { ok: false; retriable: boolean; error: string };

    if (linkSigningError) {
      // ITEM-128 fail-closed: no enviar si un enlace LINK_FIRMADO prometido no se
      // pudo firmar. Retriable: la siguiente pasada del cron lo reintenta.
      result = { ok: false, retriable: true, error: linkSigningError };
    } else if (r.canal_primario === 'EMAIL_NORMAL') {
      const send = await resendSend({
        destino: r.destino_primario, asunto: comm.asunto, cuerpoHtml: cuerpoEntregado,
        idempotencyKey, tags, metadata, adjuntos,
      });
      result = send.ok ? { ok: true, proveedor: 'RESEND', eventId: send.eventId } : send;
    } else if (r.canal_primario === 'EMAIL_CERTIFICADO') {
      const seal = await eadTrustTimestamp(comm.cuerpo_hash_sha512);
      if (!seal.ok) {
        result = seal;
      } else {
        const enrichedHtml = `${cuerpoEntregado}<hr/><p style="font-size:11px;color:#666">Sello QTSP EAD Trust: ${seal.evidenceId}<br/>Emitido: ${seal.timestampedAt}</p>`;
        const adjuntosCert = [...adjuntos, { filename: 'timestamp.tsr', path: `data:application/timestamp-reply;base64,${seal.tsqTokenBase64}` }];
        const send = await resendSend({
          destino: r.destino_primario, asunto: comm.asunto, cuerpoHtml: enrichedHtml,
          idempotencyKey, tags, metadata, adjuntos: adjuntosCert,
        });
        result = send.ok
          ? { ok: true, proveedor: 'RESEND', eventId: send.eventId, evidenceHashSha512: seal.hashSha512 }
          : send;
      }
    } else if (r.canal_primario === 'BUROFAX_ERDS') {
      const erds = await eadTrustErdsSend({
        recipientId: r.id, cuerpoHtml: cuerpoEntregado, cuerpoSha512: comm.cuerpo_hash_sha512,
        asunto: comm.asunto, destino: r.destino_primario, idempotencyKey, metadata,
      });
      result = erds.ok
        ? { ok: true, proveedor: 'EAD_TRUST', eventId: erds.eventId, evidenceHashSha512: erds.evidenceHashSha512 }
        : erds;
    } else {
      result = { ok: false, retriable: false, error: `Unknown canal: ${r.canal_primario}` };
    }

    if (result.ok) {
      // CRITICAL: don't increment processed until the DB write succeeds.
      // If the DB write fails after the email/ERDS was sent, log an alert and
      // continue so the operator can reconcile (the recipient stays in ENVIANDO
      // with the proveedor_evento_id discoverable via Resend/EAD logs).
      const { error: markErr } = await sb.rpc('fn_recipient_mark_sent', {
        p_recipient_id: r.id,
        p_canal_usado: r.canal_primario,
        p_proveedor: result.proveedor,
        p_proveedor_evento_id: result.eventId,
        p_evidence_hash: result.evidenceHashSha512 ?? null,
      });
      if (markErr) {
        orphaned.push({ recipientId: r.id, reason: `Sent but DB mark failed: ${markErr.message}` });
        // Best-effort orphan event (WORM)
        try {
          await sb.from('communication_delivery_events').insert({
            recipient_id: r.id,
            evento: 'ERROR',
            proveedor: 'INTERNAL',
            proveedor_evento_id: result.eventId,
            payload: { orphan_after_send: true, db_error: markErr.message, proveedor_real: result.proveedor },
            hash_self: '',
          });
        } catch (logErr) {
          console.error(`Failed to log orphan event for recipient ${r.id}:`, logErr);
        }
        // Insert internal alert
        try {
          const { data: t } = await sb.from('communications').select('tenant_id').eq('id', r.communication_id).single();
          if (t?.tenant_id) {
            await sb.from('notifications').insert({
              tenant_id: t.tenant_id,
              title: `Recipient ${r.id} email enviado pero DB no actualizado`,
              body: markErr.message,
              route: `/secretaria/comunicaciones/${r.communication_id}`,
              type: 'error',
            });
          }
        } catch (notifErr) {
          console.error(`Failed to insert internal alert:`, notifErr);
        }
        // DO NOT increment processed.
      } else {
        processed++;
      }
    } else {
      const { error: handleErr } = await sb.rpc('fn_recipient_handle_error', {
        p_recipient_id: r.id,
        p_error_message: result.error,
        p_retriable: result.retriable,
      });
      if (handleErr) {
        console.error(`fn_recipient_handle_error failed for ${r.id}:`, handleErr.message);
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
