import { test, expect } from './fixtures/secretaria-isolated-tenant';

test.describe('Secretaría isolated tenant fixture', () => {
  test.skip(
    process.env.SECRETARIA_E2E_DESTRUCTIVE !== '1' || process.env.SECRETARIA_E2E_ISOLATED_TENANT !== '1',
    'Destructive isolated Secretaría E2E is opt-in only',
  );

  test('crea tenant no-ARGA con usuario ADMIN_TENANT y cleanup acotado', async ({ isolatedTenant, serviceClient }) => {
    expect(isolatedTenant.tenantId).not.toBe('00000000-0000-0000-0000-000000000001');
    expect(isolatedTenant.entityId).not.toBe('6d7ed736-f263-4531-a59d-c6ca0cd41602');

    const { data: profile, error } = await serviceClient
      .from('user_profiles')
      .select('tenant_id, entity_id, role_code')
      .eq('tenant_id', isolatedTenant.tenantId)
      .eq('role_code', 'ADMIN_TENANT')
      .maybeSingle();

    expect(error).toBeNull();
    expect(profile?.entity_id).toBe(isolatedTenant.entityId);
  });
});
