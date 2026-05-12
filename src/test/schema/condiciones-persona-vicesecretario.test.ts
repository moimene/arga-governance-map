import { describe, it, expect, afterAll } from 'vitest';
import { supabaseTestClient } from '@/test/helpers/supabase-test-client';

describe('condiciones_persona accepts VICESECRETARIO (migration 000065)', () => {
  const supabase = supabaseTestClient();
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const entityId = '6d7ed736-f263-4531-a59d-c6ca0cd41602'; // ARGA Seguros
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) {
      await supabase.from('condiciones_persona').delete().eq('id', id);
    }
  });

  it('inserts VICESECRETARIO with body_id (coherente)', async () => {
    const { data: person } = await supabase.from('persons').insert({
      tenant_id: tenantId, person_type: 'PF',
      full_name: `Test VS ${Date.now()}`, tax_id: `E2E-VS-${Date.now()}`,
    }).select().single();

    const { data: body } = await supabase.from('governing_bodies')
      .select('id').eq('entity_id', entityId).eq('body_type', 'CDA').limit(1).single();

    const { data, error } = await supabase.from('condiciones_persona').insert({
      tenant_id: tenantId, person_id: person!.id, entity_id: entityId, body_id: body!.id,
      tipo_condicion: 'VICESECRETARIO', estado: 'VIGENTE',
      fecha_inicio: '2026-05-12', fuente_designacion: 'ACTA_NOMBRAMIENTO',
    }).select().single();
    expect(error).toBeNull();
    if (data) created.push(data.id);

    // Cleanup person too
    await supabase.from('persons').delete().eq('id', person!.id);
  });

  it('rejects VICESECRETARIO without body_id (coherencia chk_condicion_body_coherente)', async () => {
    const { data: person } = await supabase.from('persons').insert({
      tenant_id: tenantId, person_type: 'PF',
      full_name: `Test VS2 ${Date.now()}`, tax_id: `E2E-VS2-${Date.now()}`,
    }).select().single();

    const { error } = await supabase.from('condiciones_persona').insert({
      tenant_id: tenantId, person_id: person!.id, entity_id: entityId, body_id: null,
      tipo_condicion: 'VICESECRETARIO', estado: 'VIGENTE',
      fecha_inicio: '2026-05-12', fuente_designacion: 'ACTA_NOMBRAMIENTO',
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('23514'); // check_violation

    await supabase.from('persons').delete().eq('id', person!.id);
  });
});
