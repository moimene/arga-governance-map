// webhook-resend
// Receives Resend webhooks with proper Svix verification.
// Resend uses Svix as their webhook delivery infrastructure. Verification requires:
//   - svix-id, svix-timestamp, svix-signature headers
//   - HMAC-SHA256 of `${id}.${timestamp}.${body}` with base64-decoded whsec_xxx secret
//   - timestamp within ±5 minutes for replay protection
// Docs: https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';
const TOLERANCE_SECONDS = 300;

const EVENT_MAP: Record<string, string> = {
  'email.sent': 'SENT',
  'email.delivered': 'DELIVERED',
  'email.bounced': 'BOUNCED',
  'email.complained': 'COMPLAINED',
  'email.opened': 'OPENED',
  'email.clicked': 'CLICKED',
};

interface ResendWebhookPayload {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    tags?: Array<{ name: string; value: string }>;
  };
}

async function verifySvix(rawBody: string, headers: Headers): Promise<{ ok: true } | { ok: false; reason: string; status: number }> {
  if (!RESEND_WEBHOOK_SECRET) {
    return { ok: false, reason: 'Webhook secret not configured', status: 503 };
  }
  if (!RESEND_WEBHOOK_SECRET.startsWith('whsec_')) {
    return { ok: false, reason: 'Webhook secret must start with whsec_', status: 503 };
  }

  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, reason: 'Missing Svix headers', status: 401 };
  }

  const tsNum = parseInt(svixTimestamp, 10);
  if (Number.isNaN(tsNum)) return { ok: false, reason: 'Invalid timestamp', status: 401 };
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > TOLERANCE_SECONDS) {
    return { ok: false, reason: 'Timestamp outside ±5min tolerance', status: 401 };
  }

  // Decode secret: strip `whsec_` then base64-decode
  const secretBase64 = RESEND_WEBHOOK_SECRET.replace(/^whsec_/, '');
  let secretBytes: Uint8Array;
  try {
    const binaryString = atob(secretBase64);
    secretBytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
  } catch {
    return { ok: false, reason: 'Failed to base64-decode webhook secret', status: 503 };
  }

  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  // svix-signature format: "v1,base64sig v1,base64sig2 …" (space-separated, multiple keys possible during rotation)
  const provided = svixSignature.split(' ').map((s) => s.replace(/^v1,/, '').trim()).filter(Boolean);
  if (!provided.some((s) => timingSafeEqual(s, expectedBase64))) {
    return { ok: false, reason: 'Signature mismatch', status: 401 };
  }
  return { ok: true };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  const rawBody = await req.text();
  const verify = await verifySvix(rawBody, req.headers);
  if (!verify.ok) {
    return new Response(JSON.stringify({ error: verify.reason }), {
      status: verify.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: ResendWebhookPayload;
  try { payload = JSON.parse(rawBody); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const evento = EVENT_MAP[payload.type];
  if (!evento) return new Response(JSON.stringify({ skipped: 'unknown event type' }), { status: 200 });

  const tags = payload.data?.tags ?? [];
  const recipientTag = tags.find((t) => t.name === 'recipient_id');
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let recipientId: string | null = recipientTag?.value ?? null;
  if (!recipientId && payload.data?.email_id) {
    const { data: sentEvent } = await sb
      .from('communication_delivery_events')
      .select('recipient_id')
      .eq('proveedor', 'RESEND')
      .eq('proveedor_evento_id', payload.data.email_id)
      .eq('evento', 'SENT')
      .limit(1)
      .maybeSingle();
    recipientId = sentEvent?.recipient_id ?? null;
  }

  if (!recipientId) return new Response(JSON.stringify({ skipped: 'recipient not found' }), { status: 200 });

  if (evento === 'DELIVERED') {
    await sb.from('communication_recipients').update({
      estado_entrega: 'ENTREGADO',
      fecha_entrega: payload.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', recipientId);
  } else if (evento === 'BOUNCED') {
    const { data: recipient } = await sb
      .from('communication_recipients')
      .select('canal_fallback')
      .eq('id', recipientId)
      .single();
    if (recipient?.canal_fallback) {
      await sb.rpc('fn_recipient_handle_error', {
        p_recipient_id: recipientId, p_error_message: 'Bounced by Resend', p_retriable: false,
      });
    } else {
      await sb.from('communication_recipients').update({
        estado_entrega: 'REBOTADO',
        ultimo_error: 'Bounced by Resend',
        updated_at: new Date().toISOString(),
      }).eq('id', recipientId);
    }
  }

  await sb.from('communication_delivery_events').insert({
    recipient_id: recipientId,
    evento,
    proveedor: 'RESEND',
    proveedor_evento_id: payload.data?.email_id ?? null,
    payload: payload as unknown as Record<string, unknown>,
    hash_self: '',
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
