// webhook-resend: receives Resend webhooks, verifies HMAC, updates recipient state, inserts WORM event.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';

const EVENT_MAP: Record<string, string> = {
  'email.sent': 'SENT',
  'email.delivered': 'DELIVERED',
  'email.bounced': 'BOUNCED',
  'email.complained': 'COMPLAINED',
  'email.opened': 'OPENED',
  'email.clicked': 'CLICKED',
};

function verifyHmac(rawBody: string, signature: string | null): boolean {
  if (!RESEND_WEBHOOK_SECRET) return true; // dev mode: skip if secret not configured
  if (!signature) return false;
  const expected = createHmac('sha256', RESEND_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return expected === signature;
}

interface ResendWebhookPayload {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    tags?: Array<{ name: string; value: string }>;
  };
}

serve(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get('resend-signature');
  if (!verifyHmac(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 });
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
    hash_self: '', // populated by tg_delivery_events_hash_chain
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
