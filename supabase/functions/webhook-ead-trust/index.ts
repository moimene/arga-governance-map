// webhook-ead-trust: receives EAD Trust delivery callbacks.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EAD_TRUST_WEBHOOK_SECRET = Deno.env.get('EAD_TRUST_WEBHOOK_SECRET') ?? '';

interface EADWebhookPayload {
  type: string;
  evidenceId?: string;
  deliveredAt?: string;
}

serve(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get('x-eadtrust-signature');

  // In production we'd verify HMAC with EAD_TRUST_WEBHOOK_SECRET.
  // For P1 dev: skip if secret not configured.
  if (EAD_TRUST_WEBHOOK_SECRET && signature !== EAD_TRUST_WEBHOOK_SECRET) {
    return new Response('Invalid signature', { status: 401 });
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
