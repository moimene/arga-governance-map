// validate-comm-plazo: Edge Function invoked by trigger tg_communications_validate_plazo.
// Returns { isValid, minDate, reason, warnings } for a candidate communication.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calcularPlazoComunicacion, type TipoComunicacion, type OrganoTipo } from '../_shared/comms-plazo-engine.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Body {
  tipo_comunicacion: TipoComunicacion;
  organo_tipo: OrganoTipo;
  entity_id: string;
  meeting_date: string | null;
  template_id: string | null;
  fecha_programada: string;
}

serve(async (req) => {
  let input: Body;
  try {
    input = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ isValid: false, reason: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: entity } = await sb
    .from('entities')
    .select('tipo_social, es_cotizada, jurisdiction')
    .eq('id', input.entity_id)
    .single();

  if (!entity) {
    return new Response(JSON.stringify({ isValid: false, reason: 'Entity not found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let cfg: { plazo_legal_dias: number | null; referencia_legal: string } | null = null;
  if (input.template_id) {
    const { data: tpl } = await sb
      .from('plantillas_protegidas')
      .select('comunicacion_config')
      .eq('id', input.template_id)
      .maybeSingle();
    const c = tpl?.comunicacion_config as { plazo_legal_dias?: number | null; referencia_legal?: string } | null | undefined;
    if (c) cfg = { plazo_legal_dias: c.plazo_legal_dias ?? null, referencia_legal: c.referencia_legal ?? '' };
  }

  const result = calcularPlazoComunicacion({
    tipo_comunicacion: input.tipo_comunicacion,
    organo_tipo: input.organo_tipo,
    entity_id: input.entity_id,
    fecha_evento_referenciado: input.meeting_date ? new Date(input.meeting_date) : null,
    normative_profile: {
      tipo_social: (entity.tipo_social as string) ?? 'SA',
      es_cotizada: Boolean(entity.es_cotizada),
      jurisdiction: (entity.jurisdiction as string) ?? 'ES',
    },
    template_id: input.template_id,
    comunicacion_config: cfg,
  });

  const fechaProgramada = new Date(input.fecha_programada);
  // min_envio_date is the deadline (meeting - plazo_dias).
  // Valid if fecha_programada <= deadline (enough advance notice).
  // Invalid if fecha_programada > deadline (sent too late).
  const isValid = !result.min_envio_date || fechaProgramada <= result.min_envio_date;

  return new Response(
    JSON.stringify({
      isValid,
      minDate: result.min_envio_date?.toISOString() ?? null,
      reason: isValid
        ? 'OK'
        : `Plazo legal incumplido: envío debe ser a más tardar ${result.min_envio_date?.toISOString()} (${result.referencia_legal}, ${result.plazo_dias} días ${result.unidad.toLowerCase()})`,
      warnings: result.warnings,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
