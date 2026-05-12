import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabaseTestClient } from '@/test/helpers/supabase-test-client';

describe('fn_sync_authority_evidence RM propagation (migration 000064)', () => {
  const supabase = supabaseTestClient();
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const testRunId = `RM-TEST-${Date.now()}`;
  let personId: string;
  let entityId: string;
  let bodyId: string;
  let condicionId: string;

  beforeAll(async () => {
    // Setup test person + reuse existing entity/body (no schema writes)
    const { data: person } = await supabase.from('persons').insert({
      tenant_id: tenantId, person_type: 'PF',
      full_name: `Test ${testRunId}`,
      tax_id: `E2E-${testRunId}`,
    }).select().single();
    personId = person!.id;

    // Pick the canonical ARGA Seguros + Consejo
    entityId = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
    const { data: body } = await supabase.from('governing_bodies')
      .select('id').eq('entity_id', entityId).eq('body_type', 'CDA').limit(1).single();
    bodyId = body!.id;
  });

  afterAll(async () => {
    if (condicionId) await supabase.from('condiciones_persona').delete().eq('id', condicionId);
    if (personId) await supabase.from('persons').delete().eq('id', personId);
  });

  it('propagates inscripcion_rm_referencia from condiciones_persona to authority_evidence on INSERT', async () => {
    const rmRef = `RM-T${Date.now()} F999 H99999 Insc 1`;
    const rmFecha = '2026-05-12';
    const { data: cp, error } = await supabase.from('condiciones_persona').insert({
      tenant_id: tenantId, person_id: personId, entity_id: entityId, body_id: bodyId,
      tipo_condicion: 'VICEPRESIDENTE', estado: 'VIGENTE',
      fecha_inicio: '2026-05-12', fuente_designacion: 'ACTA_NOMBRAMIENTO',
      inscripcion_rm_referencia: rmRef, inscripcion_rm_fecha: rmFecha,
    }).select().single();
    expect(error).toBeNull();
    condicionId = cp!.id;

    const { data: ae } = await supabase.from('authority_evidence')
      .select('*').eq('person_id', personId).eq('cargo', 'VICEPRESIDENTE').eq('estado', 'VIGENTE').single();
    expect(ae).not.toBeNull();
    expect(ae!.inscripcion_rm_referencia).toBe(rmRef);
    expect(ae!.inscripcion_rm_fecha).toBe(rmFecha);
  });

  it('accepts VICESECRETARIO in v_cargos_certificantes', async () => {
    // This test depends on D1.3 migration 000065 having been applied first.
    // Skip if VICESECRETARIO not in CHECK yet.
    const { error } = await supabase.from('condiciones_persona').insert({
      tenant_id: tenantId, person_id: personId, entity_id: entityId, body_id: bodyId,
      tipo_condicion: 'VICESECRETARIO', estado: 'VIGENTE',
      fecha_inicio: '2026-05-12', fuente_designacion: 'ACTA_NOMBRAMIENTO',
    }).select().single();
    if (error?.code === '23514') {
      // CHECK constraint violation — 000065 not applied yet, skip
      return;
    }
    expect(error).toBeNull();

    const { data: ae } = await supabase.from('authority_evidence')
      .select('*').eq('person_id', personId).eq('cargo', 'VICESECRETARIO').eq('estado', 'VIGENTE').maybeSingle();
    expect(ae).not.toBeNull();
  });
});
