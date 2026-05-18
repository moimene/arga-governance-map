// webhook-ead-trust
// EAD Trust delivery callbacks with HMAC-SHA256 verification + timestamp tolerance.
//
// EAD Trust's exact webhook signature scheme is contract-specific (OQ pending).
// We implement a robust default: HMAC-SHA256 of `${timestamp}.${body}` with the
// shared secret, encoded as base64, in header `x-eadtrust-signature` along with
// `x-eadtrust-timestamp` for replay protection (±5 min window).
//
// If the production EAD Trust account uses a different scheme, this function
// must be updated before activating; until then it RJECTS calls without proper
// signature instead of allowing them through.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EAD_TRUST_WEBHOOK_SECRET = Deno.env.get('EAD_TRUST_WEBHOOK_SECRET') ?? '';
const TOLERANCE_SECONDS = 300;

interface EADWebhookPayload {
  type: string;
  evidenceId?: string;
  deliveredAt?: string;
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

  const evento = payload.type === 'evidence.delivered' ? 'DELIVERED'
               : payload.type === 'evidence.failed'    ? 'ERROR'
               : null;
  if (!evento || !payload.evidenceId) {
    return new Response(JSON.stringify({ skipped: 'unknown event or missing evidenceId' }), { status: 200 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: sentEvent } = await sb
    .from('communication_delivery_events')
    .select('recipient_id')
    .eq('proveedor', 'EAD_TRUST')
    .eq('proveedor_evento_id', payload.evidenceId)
    .eq('evento', 'SENT')
    .limit(1)
    .maybeSingle();
  if (!sentEvent) return new Response(JSON.stringify({ skipped: 'recipient not found' }), { status: 200 });

  const recipientId = sentEvent.recipient_id;
  if (evento === 'DELIVERED') {
    await sb.from('communication_recipients').update({
      estado_entrega: 'ENTREGADO',
      fecha_entrega: payload.deliveredAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', recipientId);
  }

  await sb.from('communication_delivery_events').insert({
    recipient_id: recipientId,
    evento,
    proveedor: 'EAD_TRUST',
    proveedor_evento_id: payload.evidenceId,
    payload: payload as unknown as Record<string, unknown>,
    hash_self: '',
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
