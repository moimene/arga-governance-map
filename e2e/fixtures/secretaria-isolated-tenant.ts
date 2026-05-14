import { test as base, expect, type Page, type Route } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const DEMO_ENTITY_ID = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
const EXPECTED_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';
const SUPABASE_REST_OR_RPC = /\/rest\/v1\/|\/rpc\//;
const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

type ServiceClient = SupabaseClient;

export interface IsolatedSecretariaTenant {
  runId: string;
  tenantId: string;
  userId: string | null;
  email: string;
  password: string;
  entityId: string;
  bodyId: string;
  persons: {
    society: string;
    shareholder: string;
    president: string;
    secretary: string;
    consejero: string;
  };
}

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readLocalSecretEnv(): Record<string, string> {
  try {
    const text = readFileSync(process.env.SECRETARIA_P0_ENV_FILE ?? DEFAULT_SECRET_ENV_FILE, 'utf8');
    const parsed: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      parsed[m[1]] = cleanEnvValue(m[2]) ?? '';
    }
    return parsed;
  } catch {
    return {};
  }
}

function projectRefFromUrl(rawUrl: string): string {
  return new URL(rawUrl).host.split('.')[0] ?? '';
}

export function serviceClient(): ServiceClient {
  const localEnv = readLocalSecretEnv();
  const url =
    cleanEnvValue(process.env.VITE_SUPABASE_URL) ??
    cleanEnvValue(process.env.SUPABASE_URL) ??
    cleanEnvValue(localEnv.VITE_SUPABASE_URL) ??
    cleanEnvValue(localEnv.SUPABASE_URL) ??
    `https://${EXPECTED_PROJECT_REF}.supabase.co`;
  const key =
    cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY) ??
    cleanEnvValue(process.env.SERVICE_ROLE_SECRET) ??
    cleanEnvValue(localEnv.SUPABASE_SERVICE_ROLE_KEY) ??
    cleanEnvValue(localEnv.SERVICE_ROLE_SECRET);
  if (!key) throw new Error('Missing Supabase service role key for isolated Secretaría E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing destructive E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

function requestPayload(route: Route) {
  const request = route.request();
  return [request.url(), request.postData() ?? ''].join('\n');
}

function assertSafeMutation(route: Route, allowedTenantId: string) {
  const request = route.request();
  if (!MUTATING_METHODS.has(request.method())) return;
  if (!SUPABASE_REST_OR_RPC.test(request.url())) return;

  const payload = requestPayload(route);
  if (payload.includes(DEMO_TENANT_ID) || payload.includes(DEMO_ENTITY_ID)) {
    throw new Error(`Blocked Secretaría E2E write against ARGA demo data: ${request.method()} ${request.url()}`);
  }
  if (!payload.includes(allowedTenantId)) {
    throw new Error(`Blocked Secretaría E2E write without isolated tenant marker: ${request.method()} ${request.url()}`);
  }
}

export async function installIsolatedTenantWriteGuard(page: Page, tenantId: string) {
  await page.route('**/*', async (route) => {
    assertSafeMutation(route, tenantId);
    await route.continue();
  });
}

async function insertOrThrow<T extends Record<string, unknown>>(
  client: ServiceClient,
  table: string,
  payload: T | T[],
) {
  const { error } = await client.from(table).insert(payload);
  if (error) throw error;
}

export async function createIsolatedSecretariaTenant(client: ServiceClient): Promise<IsolatedSecretariaTenant> {
  if (process.env.SECRETARIA_E2E_DESTRUCTIVE !== '1' || process.env.SECRETARIA_E2E_ISOLATED_TENANT !== '1') {
    throw new Error('Set SECRETARIA_E2E_DESTRUCTIVE=1 and SECRETARIA_E2E_ISOLATED_TENANT=1 to create isolated fixtures');
  }

  const runId = process.env.SECRETARIA_E2E_RUN_ID ?? `secretaria-${Date.now()}`;
  const tenantId = randomUUID();
  const entityId = randomUUID();
  const bodyId = randomUUID();
  const societyPersonId = randomUUID();
  const shareholderId = randomUUID();
  const presidentId = randomUUID();
  const secretaryId = randomUUID();
  const consejeroId = randomUUID();
  const shareClassId = randomUUID();
  const email = `secretaria-${runId}@example.test`;
  const password = `TGMS-${runId}-2026!`.slice(0, 72);

  let userId: string | null = null;
  const authResult = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { runId, tenantId },
  });
  if (authResult.error) throw authResult.error;
  userId = authResult.data.user?.id ?? null;
  if (!userId) throw new Error('Supabase did not return auth user id for isolated fixture');

  await insertOrThrow(client, 'tenants', {
    id: tenantId,
    name: `Secretaría E2E ${runId}`,
    tenant_type: 'group',
    country_code: 'ES',
    is_active: true,
  });

  await insertOrThrow(client, 'persons', [
    { id: societyPersonId, tenant_id: tenantId, full_name: `E2E Sociedad ${runId}`, tax_id: `E2E-SOC-${runId}`, person_type: 'PJ', denomination: `E2E Sociedad ${runId}` },
    { id: shareholderId, tenant_id: tenantId, full_name: `E2E Socio ${runId}`, tax_id: `E2E-SOCIO-${runId}`, person_type: 'PF' },
    { id: presidentId, tenant_id: tenantId, full_name: `E2E Presidente ${runId}`, tax_id: `E2E-PRES-${runId}`, person_type: 'PF' },
    { id: secretaryId, tenant_id: tenantId, full_name: `E2E Secretario ${runId}`, tax_id: `E2E-SEC-${runId}`, person_type: 'PF' },
    { id: consejeroId, tenant_id: tenantId, full_name: `E2E Consejero ${runId}`, tax_id: `E2E-CONS-${runId}`, person_type: 'PF' },
  ]);

  await insertOrThrow(client, 'entities', {
    id: entityId,
    tenant_id: tenantId,
    person_id: societyPersonId,
    slug: `secretaria-e2e-${runId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80),
    legal_name: `E2E Sociedad ${runId}, S.A.`,
    common_name: `E2E Sociedad ${runId}`,
    jurisdiction: 'ES',
    legal_form: 'SA',
    tipo_social: 'SA',
    entity_status: 'Active',
    materiality: 'Low',
    forma_administracion: 'CONSEJO',
    tipo_organo_admin: 'CDA',
    es_unipersonal: false,
    es_cotizada: false,
  });

  await insertOrThrow(client, 'user_profiles', {
    user_id: userId,
    tenant_id: tenantId,
    entity_id: entityId,
    person_id: secretaryId,
    role_code: 'ADMIN_TENANT',
  });

  await insertOrThrow(client, 'governing_bodies', {
    id: bodyId,
    slug: `cda-e2e-${runId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80),
    tenant_id: tenantId,
    entity_id: entityId,
    name: 'Consejo de Administración',
    body_type: 'CDA',
    quorum_rule: { type: 'MAJORITY' },
  });

  await insertOrThrow(client, 'entity_capital_profile', {
    tenant_id: tenantId,
    entity_id: entityId,
    capital_escriturado: 60000,
    capital_desembolsado: 60000,
    numero_titulos: 60000,
    valor_nominal: 1,
    effective_from: '2026-01-01',
  });

  await insertOrThrow(client, 'share_classes', {
    id: shareClassId,
    tenant_id: tenantId,
    entity_id: entityId,
    class_code: 'ORD',
    name: 'Ordinarias',
  });

  await insertOrThrow(client, 'capital_holdings', {
    tenant_id: tenantId,
    entity_id: entityId,
    holder_person_id: shareholderId,
    share_class_id: shareClassId,
    numero_titulos: 60000,
    porcentaje_capital: 100,
    effective_from: '2026-01-01',
    metadata: { runId },
  });

  await insertOrThrow(client, 'condiciones_persona', [
    { tenant_id: tenantId, person_id: shareholderId, entity_id: entityId, body_id: null, tipo_condicion: 'SOCIO', fecha_inicio: '2026-01-01', fuente_designacion: 'BOOTSTRAP', metadata: { runId } },
    { tenant_id: tenantId, person_id: presidentId, entity_id: entityId, body_id: bodyId, tipo_condicion: 'PRESIDENTE', fecha_inicio: '2026-01-01', fuente_designacion: 'BOOTSTRAP', metadata: { runId } },
    { tenant_id: tenantId, person_id: secretaryId, entity_id: entityId, body_id: bodyId, tipo_condicion: 'SECRETARIO', fecha_inicio: '2026-01-01', fuente_designacion: 'BOOTSTRAP', metadata: { runId } },
    { tenant_id: tenantId, person_id: consejeroId, entity_id: entityId, body_id: bodyId, tipo_condicion: 'CONSEJERO', fecha_inicio: '2026-01-01', fuente_designacion: 'BOOTSTRAP', metadata: { runId } },
  ]);

  return {
    runId,
    tenantId,
    userId,
    email,
    password,
    entityId,
    bodyId,
    persons: {
      society: societyPersonId,
      shareholder: shareholderId,
      president: presidentId,
      secretary: secretaryId,
      consejero: consejeroId,
    },
  };
}

export async function cleanupIsolatedSecretariaTenant(client: ServiceClient, fixture: IsolatedSecretariaTenant) {
  const tenantId = fixture.tenantId;
  for (const table of [
    'certifications',
    'minutes',
    'meeting_resolutions',
    'meeting_attendees',
    'meetings',
    'representaciones',
    'condiciones_persona',
    'capital_holdings',
    'share_classes',
    'entity_capital_profile',
    'user_profiles',
    'governing_bodies',
    'entities',
    'persons',
  ]) {
    const { error } = await client.from(table).delete().eq('tenant_id', tenantId);
    if (error && !/does not exist/i.test(error.message)) throw error;
  }
  if (fixture.userId) {
    const { error } = await client.auth.admin.deleteUser(fixture.userId);
    if (error) throw error;
  }
  const { error } = await client.from('tenants').delete().eq('id', tenantId);
  if (error) throw error;
}

export const test = base.extend<{
  serviceClient: ServiceClient;
  isolatedTenant: IsolatedSecretariaTenant;
}>({
  serviceClient: async ({ baseURL }, use) => {
    void baseURL;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(serviceClient());
  },
  isolatedTenant: async ({ page, serviceClient }, use) => {
    const fixture = await createIsolatedSecretariaTenant(serviceClient);
    await installIsolatedTenantWriteGuard(page, fixture.tenantId);
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      await use(fixture);
    } finally {
      if (process.env.SECRETARIA_E2E_KEEP_FIXTURE !== '1') {
        await cleanupIsolatedSecretariaTenant(serviceClient, fixture);
      }
    }
  },
});

export { expect };
