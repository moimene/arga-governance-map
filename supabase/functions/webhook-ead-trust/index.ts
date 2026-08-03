// webhook-ead-trust
// EAD Trust delivery callbacks with HMAC-SHA256 verification + timestamp tolerance.
//
// EAD Trust's exact webhook signature scheme is contract-specific (OQ pending).
// We implement a robust default: HMAC-SHA256 of `${timestamp}.${body}` with the
// shared secret, encoded as base64, in header `x-eadtrust-signature` along with
// `x-eadtrust-timestamp` for replay protection (±5 min window).
//
// If the production EAD Trust account uses a different scheme, this function
// must be updated before activating; until then it REJECTS calls without proper
// signature instead of allowing them through.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EAD_TRUST_WEBHOOK_SECRET = Deno.env.get('EAD_TRUST_WEBHOOK_SECRET') ?? '';
const TOLERANCE_SECONDS = 300;

interface EADWebhookPayload {
  type: string;
  requestId?: string;
  request_id?: string;
  eventId?: string;
  event_id?: string;
  occurredAt?: string;
  occurred_at?: string;
  deliveredAt?: string;
  delivered_at?: string;
  error?: string;
  earchive?: {
    status?: string;
    evidenceId?: string;
    evidence_id?: string;
    archivedAt?: string;
    archived_at?: string;
    hashSha512?: string;
    hash_sha512?: string;
  };
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function canonicalTimestamp(value: unknown): string | null {
  const raw = nonEmptyString(value);
  if (!raw || Number.isNaN(Date.parse(raw))) return null;
  return new Date(raw).toISOString();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyEAD(rawBody: string, headers: Headers): Promise<{ ok: true } | { ok: false; reason: string; status: number }> {
  if (!EAD_TRUST_WEBHOOK_SECRET) {
    return { ok: false, reason: 'EAD_TRUST_WEBHOOK_SECRET not configured', status: 503 };
  }
  const signature = headers.get('x-eadtrust-signature');
  const timestamp = headers.get('x-eadtrust-timestamp');
  if (!signature || !timestamp) {
    return { ok: false, reason: 'Missing x-eadtrust-signature or x-eadtrust-timestamp', status: 401 };
  }

  const tsNum = parseInt(timestamp, 10);
  if (Number.isNaN(tsNum)) return { ok: false, reason: 'Invalid timestamp', status: 401 };
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > TOLERANCE_SECONDS) {
    return { ok: false, reason: 'Timestamp outside ±5min tolerance', status: 401 };
  }

  const toSign = `${timestamp}.${rawBody}`;
  const secretBytes = new TextEncoder().encode(EAD_TRUST_WEBHOOK_SECRET);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  if (!timingSafeEqual(signature.trim(), expectedBase64)) {
    return { ok: false, reason: 'Signature mismatch', status: 401 };
  }
  return { ok: true };
}

serve(async (req) => {
  const rawBody = await req.text();
  const verify = await verifyEAD(rawBody, req.headers);
  if (!verify.ok) {
    return new Response(JSON.stringify({ error: verify.reason }), {
      status: verify.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: EADWebhookPayload;
  try { payload = JSON.parse(rawBody); } catch { return new Response('Invalid JSON', { status: 400 }); }

  // Evidence Manager callbacks prove custody, not message delivery. Only Notice
  // Manager delivery/failure event families are accepted here.
  const eventStatus = ['notice.delivered', 'notice.delivery.completed'].includes(payload.type)
    ? 'DELIVERED'
    : ['notice.failed', 'notice.delivery.failed'].includes(payload.type)
      ? 'ERROR'
      : null;
  if (!eventStatus) {
    return new Response(JSON.stringify({ skipped: 'unsupported Notice Manager event' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const requestId = nonEmptyString(payload.requestId ?? payload.request_id);
  const eventId = nonEmptyString(payload.eventId ?? payload.event_id);
  const occurredAt = canonicalTimestamp(payload.occurredAt ?? payload.occurred_at);
  const deliveredAt = canonicalTimestamp(payload.deliveredAt ?? payload.delivered_at);
  if (!requestId || !eventId || !occurredAt || (eventStatus === 'DELIVERED' && !deliveredAt)) {
    return new Response(JSON.stringify({ error: 'Notice Manager callback missing provider ids/timestamps' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const earchive = payload.earchive ?? {};
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await sb.rpc('fn_recipient_record_ead_notice_callback', {
    p_provider_request_id: requestId,
    p_provider_event_id: eventId,
    p_event_status: eventStatus,
    p_occurred_at: occurredAt,
    p_delivered_at: deliveredAt,
    p_earchive_status: nonEmptyString(earchive.status)?.toUpperCase() ?? 'PENDING',
    p_earchive_evidence_id: nonEmptyString(earchive.evidenceId ?? earchive.evidence_id),
    p_earchive_archived_at: canonicalTimestamp(earchive.archivedAt ?? earchive.archived_at),
    p_earchive_hash_sha512: nonEmptyString(earchive.hashSha512 ?? earchive.hash_sha512)?.toLowerCase() ?? null,
    p_provider_payload: payload as unknown as Record<string, unknown>,
  });
  if (error) {
    return new Response(JSON.stringify({ error: 'Notice Manager callback reconciliation failed', detail: error.message }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, reconciliation: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
