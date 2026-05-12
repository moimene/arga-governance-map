import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  supabaseAdmin,
  hasAdminClient,
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
} from '@/test/helpers/supabase-test-client';

describe.skipIf(!hasAdminClient())('fn_sync_authority_evidence RM propagation (migration 000064)', () => {
  const testRunId = `RM-TEST-${Date.now()}`;
  let personId: string;
  let entityId: string;
  let bodyId: string;
  const createdCondiciones: string[] = [];
  let vicesecretarioAccepted = true;

  beforeAll(async () => {
    // Setup test person + reuse existing entity/body (no schema writes)
    const { data: person } = await supabaseAdmin!.from('persons').insert({
      tenant_id: DEMO_TENANT, person_type: 'PF',
      full_name: `Test ${testRunId}`,
      tax_id: `E2E-${testRunId}`,
    }).select().single();
    personId = person!.id;

    // Pick the canonical ARGA Seguros + Consejo
    entityId = DEMO_ENTITY_ARGA;
    const { data: body } = await supabaseAdmin!.from('governing_bodies')
      .select('id').eq('entity_id', entityId).eq('body_type', 'CDA').limit(1).single();
    bodyId = body!.id;

    // Probe: detect whether migration 000065 (VICESECRETARIO in CHECK) has been
    // applied. Use a separate throwaway person so the probe never collides with
    // the real test fixtures or leaks state into the real-test cleanup.
    const probeTaxId = `E2E-PROBE-VS-${testRunId}`;
    const { data: probePerson } = await supabaseAdmin!.from('persons').insert({
      tenant_id: DEMO_TENANT, person_type: 'PF',
      full_name: `Probe VS ${testRunId}`, tax_id: probeTaxId,
    }).select().single();

    if (probePerson) {
      const probeResult = await supabaseAdmin!.from('condiciones_persona').insert({
        tenant_id: DEMO_TENANT, person_id: probePerson.id, entity_id: entityId, body_id: bodyId,
        tipo_condicion: 'VICESECRETARIO', estado: 'VIGENTE',
        fecha_inicio: '2026-05-12', fuente_designacion: 'ACTA_NOMBRAMIENTO',
      }).select().single();

      if (probeResult.error?.code === '23514') {
        // CHECK constraint violation — 000065 not yet applied
        vicesecretarioAccepted = false;
      } else if (probeResult.data?.id) {
        // Probe succeeded; clean up the probe condicion + AE row created by trigger
        await supabaseAdmin!.from('condiciones_persona').delete().eq('id', probeResult.data.id);
        await supabaseAdmin!.from('authority_evidence')
          .delete().eq('person_id', probePerson.id).eq('cargo', 'VICESECRETARIO');
      }
      await supabaseAdmin!.from('persons').delete().eq('id', probePerson.id);
    }
  });

  afterAll(async () => {
    // Clean up authority_evidence rows produced by the trigger first
    if (personId) {
      await supabaseAdmin!.from('authority_evidence').delete().eq('person_id', personId);
    }
    for (const id of createdCondiciones) {
      await supabaseAdmin!.from('condiciones_persona').delete().eq('id', id);
    }
    if (personId) await supabaseAdmin!.from('persons').delete().eq('id', personId);
  });

  it('propagates inscripcion_rm_referencia from condiciones_persona to authority_evidence on INSERT', async () => {
    const rmRef = `RM-T${Date.now()} F999 H99999 Insc 1`;
    const rmFecha = '2026-05-12';
    const { data: cp, error } = await supabaseAdmin!.from('condiciones_persona').insert({
      tenant_id: DEMO_TENANT, person_id: personId, entity_id: entityId, body_id: bodyId,
      tipo_condicion: 'VICEPRESIDENTE', estado: 'VIGENTE',
      fecha_inicio: '2026-05-12', fuente_designacion: 'ACTA_NOMBRAMIENTO',
      inscripcion_rm_referencia: rmRef, inscripcion_rm_fecha: rmFecha,
    }).select().single();
    expect(error).toBeNull();
    if (cp) createdCondiciones.push(cp.id);

    const { data: ae } = await supabaseAdmin!.from('authority_evidence')
      .select('*').eq('person_id', personId).eq('cargo', 'VICEPRESIDENTE').eq('estado', 'VIGENTE').single();
    expect(ae).not.toBeNull();
    expect(ae!.inscripcion_rm_referencia).toBe(rmRef);
    expect(ae!.inscripcion_rm_fecha).toBe(rmFecha);
  });

  it('accepts VICESECRETARIO in v_cargos_certificantes', async (ctx) => {
    // Skipped explicitly when migration 000065 has not been applied yet.
    // The probe in beforeAll set vicesecretarioAccepted = false in that case.
    // Using ctx.skip(condition, note) so the reporter marks this test as SKIP
    // (not silent PASS) — prevents the regression flagged in Fix #4.
    ctx.skip(!vicesecretarioAccepted, 'migration 000065 (VICESECRETARIO CHECK) not yet applied');

    const { data: cp, error } = await supabaseAdmin!.from('condiciones_persona').insert({
      tenant_id: DEMO_TENANT, person_id: personId, entity_id: entityId, body_id: bodyId,
      tipo_condicion: 'VICESECRETARIO', estado: 'VIGENTE',
      fecha_inicio: '2026-05-12', fuente_designacion: 'ACTA_NOMBRAMIENTO',
    }).select().single();
    expect(error).toBeNull();
    if (cp) createdCondiciones.push(cp.id);

    const { data: ae } = await supabaseAdmin!.from('authority_evidence')
      .select('*').eq('person_id', personId).eq('cargo', 'VICESECRETARIO').eq('estado', 'VIGENTE').maybeSingle();
    expect(ae).not.toBeNull();
  });
});
