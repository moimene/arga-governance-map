// comms-dispatcher: invoked by pg_cron every minute (and ad-hoc by composer after INSERT).
// Reclaims PENDIENTE recipients with FOR UPDATE SKIP LOCKED via fn_claim_recipients_for_dispatch RPC.
// Calls adapter per recipient based on canal_primario, records SENT event via fn_recipient_mark_sent.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
        evidenceId: `ERDS-${opts.recipientId}-${opts.idempotencyKey.substring(0, 8)}`,
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

serve(async (_req) => {
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

    const adjuntos = ((adjs as Adjunto[]) ?? []).filter((a) => a.modo_entrega === 'ADJUNTO')
      .map((a) => ({ filename: a.label, path: a.storage_uri }));

    const idempotencyKey = `${r.id}-${comm.cuerpo_hash_sha512}-${r.intento_reenvio_n}`;
    const tags = [
      { name: 'recipient_id', value: r.id },
      { name: 'communication_id', value: comm.id },
    ];
    const metadata = { 'X-Communication-Id': comm.id, 'X-Tenant-Id': comm.tenant_id };

    let result:
      | { ok: true; proveedor: 'RESEND' | 'EAD_TRUST'; eventId: string; evidenceHashSha512?: string }
      | { ok: false; retriable: boolean; error: string };

    if (r.canal_primario === 'EMAIL_NORMAL') {
      const send = await resendSend({
        destino: r.destino_primario, asunto: comm.asunto, cuerpoHtml: comm.cuerpo_render,
        idempotencyKey, tags, metadata, adjuntos,
      });
      result = send.ok ? { ok: true, proveedor: 'RESEND', eventId: send.eventId } : send;
    } else if (r.canal_primario === 'EMAIL_CERTIFICADO') {
      const seal = await eadTrustTimestamp(comm.cuerpo_hash_sha512);
      if (!seal.ok) { result = seal; }
      else {
        const enrichedHtml = `${comm.cuerpo_render}<hr/><p style="font-size:11px;color:#666">Sello QTSP EAD Trust: ${seal.evidenceId}<br/>Emitido: ${seal.timestampedAt}</p>`;
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
        recipientId: r.id, cuerpoHtml: comm.cuerpo_render, cuerpoSha512: comm.cuerpo_hash_sha512,
        asunto: comm.asunto, destino: r.destino_primario, idempotencyKey, metadata,
      });
      result = erds.ok
        ? { ok: true, proveedor: 'EAD_TRUST', eventId: erds.eventId, evidenceHashSha512: erds.evidenceHashSha512 }
        : erds;
    } else {
      result = { ok: false, retriable: false, error: `Unknown canal: ${r.canal_primario}` };
    }

    if (result.ok) {
      await sb.rpc('fn_recipient_mark_sent', {
        p_recipient_id: r.id,
        p_canal_usado: r.canal_primario,
        p_proveedor: result.proveedor,
        p_proveedor_evento_id: result.eventId,
        p_evidence_hash: result.evidenceHashSha512 ?? null,
      });
      processed++;
    } else {
      await sb.rpc('fn_recipient_handle_error', {
        p_recipient_id: r.id,
        p_error_message: result.error,
        p_retriable: result.retriable,
      });
    }
  }

  return new Response(JSON.stringify({ processed, claimed: recipients.length }), { headers: { 'Content-Type': 'application/json' } });
});
