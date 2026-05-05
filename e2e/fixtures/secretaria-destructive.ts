import { expect, test as base, type Page, type Route } from '@playwright/test';

export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_ENTITY_ID = '00000000-0000-0000-0000-000000000010';

const SUPABASE_REST_OR_RPC = /\/rest\/v1\/|\/rpc\//;
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export interface SecretariaDestructiveRun {
  runId: string;
  tenantIds: string[];
}

function parseTenantList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function destructiveRunFromEnv(): SecretariaDestructiveRun | null {
  if (process.env.SECRETARIA_E2E_DESTRUCTIVE !== '1') return null;

  const tenantIds = parseTenantList(process.env.SECRETARIA_E2E_TENANT_IDS);
  if (tenantIds.length < 1) {
    throw new Error('SECRETARIA_E2E_TENANT_IDS is required for destructive Secretaría E2E');
  }

  return {
    runId: process.env.SECRETARIA_E2E_RUN_ID ?? `secretaria-e2e-${Date.now()}`,
    tenantIds,
  };
}

function requestPayload(route: Route) {
  const request = route.request();
  return [request.url(), request.postData() ?? ''].join('\n');
}

function assertSafeMutation(route: Route, allowedTenantIds: string[]) {
  const request = route.request();
  if (!MUTATING_METHODS.has(request.method())) return;
  if (!SUPABASE_REST_OR_RPC.test(request.url())) return;

  const payload = requestPayload(route);
  if (payload.includes(DEMO_TENANT_ID) || payload.includes(DEMO_ENTITY_ID)) {
    throw new Error(`Blocked destructive Secretaría E2E write against ARGA demo tenant: ${request.method()} ${request.url()}`);
  }

  if (!allowedTenantIds.some((tenantId) => payload.includes(tenantId))) {
    throw new Error(`Blocked destructive Secretaría E2E write without allowed tenant marker: ${request.method()} ${request.url()}`);
  }
}

async function installNoDemoWriteGuard(page: Page, allowedTenantIds: string[]) {
  await page.route('**/*', async (route) => {
    assertSafeMutation(route, allowedTenantIds);
    await route.continue();
  });
}

export const test = base.extend<{
  secretariaDestructiveRun: SecretariaDestructiveRun;
}>({
  secretariaDestructiveRun: async ({ page }, use) => {
    const run = destructiveRunFromEnv();
    if (!run) {
      throw new Error('Set SECRETARIA_E2E_DESTRUCTIVE=1 and SECRETARIA_E2E_TENANT_IDS to run destructive Secretaría E2E');
    }
    await installNoDemoWriteGuard(page, run!.tenantIds);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(run!);
  },
});

export { expect, installNoDemoWriteGuard };
