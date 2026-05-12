import { describe, it, expect } from 'vitest';
import { supabaseTestClient } from '@/test/helpers/supabase-test-client';

describe('persons.tax_id UNIQUE constraint (migration 000063)', () => {
  it('rejects two persons with same real tax_id in same tenant', async () => {
    const supabase = supabaseTestClient();
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const taxId = `TEST-DUP-${Date.now()}`;

    const { error: e1 } = await supabase.from('persons').insert({
      tenant_id: tenantId,
      person_type: 'PF',
      full_name: 'Test Dup 1',
      tax_id: taxId,
    });
    expect(e1).toBeNull();

    const { error: e2 } = await supabase.from('persons').insert({
      tenant_id: tenantId,
      person_type: 'PF',
      full_name: 'Test Dup 2',
      tax_id: taxId,
    });
    expect(e2).not.toBeNull();
    expect(e2!.code).toBe('23505'); // unique_violation
    expect(e2!.message).toMatch(/ux_persons_tax_id_real/i);

    // Cleanup
    await supabase.from('persons').delete().eq('tax_id', taxId);
  });

  it('allows two persons with PENDIENTE- prefix tax_id', async () => {
    const supabase = supabaseTestClient();
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const taxId = `PENDIENTE-TEST-${Date.now()}`;

    const { error: e1, data: r1 } = await supabase.from('persons').insert({
      tenant_id: tenantId, person_type: 'PJ', full_name: 'Pending 1', tax_id: taxId,
    }).select().single();
    expect(e1).toBeNull();

    const { error: e2, data: r2 } = await supabase.from('persons').insert({
      tenant_id: tenantId, person_type: 'PJ', full_name: 'Pending 2', tax_id: taxId,
    }).select().single();
    expect(e2).toBeNull();

    // Cleanup
    if (r1) await supabase.from('persons').delete().eq('id', r1.id);
    if (r2) await supabase.from('persons').delete().eq('id', r2.id);
  });
});
