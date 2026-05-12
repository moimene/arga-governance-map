import { describe, it, expect, afterAll } from 'vitest';
import {
  supabaseAdmin,
  hasAdminClient,
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
} from '@/test/helpers/supabase-test-client';

describe.skipIf(!hasAdminClient())('condiciones_persona accepts VICESECRETARIO (migration 000065)', () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) {
      await supabaseAdmin!.from('condiciones_persona').delete().eq('id', id);
    }
  });

  it('inserts VICESECRETARIO with body_id (coherente)', async () => {
    const { data: person } = await supabaseAdmin!.from('persons').insert({
      tenant_id: DEMO_TENANT, person_type: 'PF',
      full_name: `Test VS ${Date.now()}`, tax_id: `E2E-VS-${Date.now()}`,
    }).select().single();

    const { data: body } = await supabaseAdmin!.from('governing_bodies')
      .select('id').eq('entity_id', DEMO_ENTITY_ARGA).eq('body_type', 'CDA').limit(1).single();

    const { data, error } = await supabaseAdmin!.from('condiciones_persona').insert({
      tenant_id: DEMO_TENANT, person_id: person!.id, entity_id: DEMO_ENTITY_ARGA, body_id: body!.id,
      tipo_condicion: 'VICESECRETARIO', estado: 'VIGENTE',
      fecha_inicio: '2026-05-12', fuente_designacion: 'ACTA_NOMBRAMIENTO',
    }).select().single();
    expect(error).toBeNull();
    if (data) created.push(data.id);

    // Cleanup person too
    await supabaseAdmin!.from('persons').delete().eq('id', person!.id);
  });

  it('rejects VICESECRETARIO without body_id (coherencia chk_condicion_body_coherente)', async () => {
    const { data: person } = await supabaseAdmin!.from('persons').insert({
      tenant_id: DEMO_TENANT, person_type: 'PF',
      full_name: `Test VS2 ${Date.now()}`, tax_id: `E2E-VS2-${Date.now()}`,
    }).select().single();

    const { error } = await supabaseAdmin!.from('condiciones_persona').insert({
      tenant_id: DEMO_TENANT, person_id: person!.id, entity_id: DEMO_ENTITY_ARGA, body_id: null,
      tipo_condicion: 'VICESECRETARIO', estado: 'VIGENTE',
      fecha_inicio: '2026-05-12', fuente_designacion: 'ACTA_NOMBRAMIENTO',
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('23514'); // check_violation

    await supabaseAdmin!.from('persons').delete().eq('id', person!.id);
  });
});
