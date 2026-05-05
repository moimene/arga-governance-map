import { expect, test } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const EXPECTED_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';
const NO_SESSION_TEMPLATE_TYPE = 'ACTA_ACUERDO_ESCRITO';
const CERTIFICATION_TEMPLATE_TYPE = 'CERTIFICACION';

type ServiceClient = SupabaseClient;

interface EntityRow {
  id: string;
  legal_name: string;
  common_name: string | null;
}

interface UserProfileRow {
  person_id: string;
  role_code: string;
}

interface PersonRow {
  id: string;
  full_name: string;
}

interface TemplateRow {
  id: string;
  tipo?: string;
  version?: string;
}

interface PersonIdRow {
  person_id: string;
}

interface IdRow {
  id: string;
}

interface FixtureContext {
  runId: string;
  tenantId: string;
  entityId: string;
  entityName: string;
  demoPersonId: string;
  demoPersonName: string;
  bodyId: string;
  bodyName: string;
  noSessionTemplateId: string;
  sellerPersonId: string;
  sellerName: string;
  buyerPersonId: string;
  buyerName: string;
  sourceHoldingId: string;
  shareClassId: string | null;
}

test.skip(process.env.SECRETARIA_E2E_MUTATE_ARGA !== '1', 'Opt-in: mutates ARGA demo data in Cloud Supabase');

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readLocalSecretEnv(): Record<string, string> {
  try {
    const text = readFileSync(process.env.SECRETARIA_P0_ENV_FILE ?? DEFAULT_SECRET_ENV_FILE, 'utf8');
    const parsed: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      parsed[match[1]] = cleanEnvValue(match[2]) ?? '';
    }
    return parsed;
  } catch {
    return {};
  }
}

function projectRefFromUrl(rawUrl: string) {
  return new URL(rawUrl).host.split('.')[0] ?? '';
}

function serviceClient(): ServiceClient {
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

  if (!key) throw new Error('Missing Supabase service role key for ARGA destructive E2E');
  if (projectRefFromUrl(url) !== EXPECTED_PROJECT_REF && process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1') {
    throw new Error(`Refusing destructive E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as ServiceClient;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function requireSingle<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, label: string): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${(error as { message?: string }).message ?? String(error)}`);
  if (!data) throw new Error(`${label}: no data`);
  return data;
}

async function selectOptionByText(locator: Locator, pattern: RegExp) {
  await expect.poll(async () => locator.locator('option').count()).toBeGreaterThan(1);
  const value = await locator.evaluate((node: HTMLSelectElement, source: string) => {
    const regex = new RegExp(source, 'i');
    const options = Array.from(node.options);
    return (
      options.find((option) => option.value && regex.test(option.textContent ?? ''))?.value ??
      options.find((option) => option.value)?.value ??
      ''
    );
  }, pattern.source);
  expect(value).toBeTruthy();
  await locator.selectOption(value);
}

async function prepareFixture(client: ServiceClient): Promise<FixtureContext> {
  const runId = `arga-real-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const today = todayIsoDate();

  const entity = await requireSingle<EntityRow>(
    client
      .from('entities')
      .select('id, legal_name, common_name')
      .eq('tenant_id', DEMO_TENANT_ID)
      .eq('legal_name', 'ARGA Seguros, S.A.')
      .maybeSingle(),
    'ARGA entity',
  );

  const profile = await requireSingle<UserProfileRow>(
    client
      .from('user_profiles')
      .select('person_id, role_code')
      .eq('tenant_id', DEMO_TENANT_ID)
      .eq('role_code', 'SECRETARIO')
      .limit(1)
      .maybeSingle(),
    'demo secretario profile',
  );

  const demoPerson = await requireSingle<PersonRow>(
    client.from('persons').select('id, full_name').eq('id', profile.person_id).maybeSingle(),
    'demo secretario person',
  );

  const noSessionTemplate = await requireSingle<TemplateRow>(
    client
      .from('plantillas_protegidas')
      .select('id, tipo, version')
      .eq('estado', 'ACTIVA')
      .eq('tipo', NO_SESSION_TEMPLATE_TYPE)
      .eq('adoption_mode', 'NO_SESSION')
      .limit(1)
      .maybeSingle(),
    'active no-session template',
  );

  await requireSingle<IdRow>(
    client
      .from('plantillas_protegidas')
      .select('id')
      .eq('estado', 'ACTIVA')
      .eq('tipo', CERTIFICATION_TEMPLATE_TYPE)
      .limit(1)
      .maybeSingle(),
    'active certification template',
  );

  const president = await requireSingle<PersonIdRow>(
    client
      .from('authority_evidence')
      .select('person_id')
      .eq('tenant_id', DEMO_TENANT_ID)
      .eq('entity_id', entity.id)
      .eq('cargo', 'PRESIDENTE')
      .eq('estado', 'VIGENTE')
      .limit(1)
      .maybeSingle(),
    'presidente vigente',
  );

  const shareClass = await requireSingle<IdRow>(
    client
      .from('share_classes')
      .select('id')
      .eq('tenant_id', DEMO_TENANT_ID)
      .eq('entity_id', entity.id)
      .eq('class_code', 'ORD')
      .limit(1)
      .maybeSingle(),
    'ordinary share class',
  );

  const bodyId = randomUUID();
  const bodyName = `[E2E REAL] Consejo QA ${runId}`;
  const slug = `e2e-real-${runId}`;

  await requireSingle<IdRow>(
    client
      .from('governing_bodies')
      .insert({
        id: bodyId,
        slug,
        tenant_id: DEMO_TENANT_ID,
        entity_id: entity.id,
        name: bodyName,
        body_type: 'CDA',
        quorum_rule: { mode: 'E2E_REAL_SINGLE_VOTER', required: 1 },
        config: { e2e_real_run_id: runId, purpose: 'no-session-destructive-ui' },
      })
      .select('id')
      .single(),
    'insert QA body',
  );

  await requireSingle<IdRow>(
    client
      .from('condiciones_persona')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        person_id: demoPerson.id,
        entity_id: entity.id,
        body_id: bodyId,
        tipo_condicion: 'SECRETARIO',
        estado: 'VIGENTE',
        fecha_inicio: today,
        fuente_designacion: 'ACTA_NOMBRAMIENTO',
        metadata: { e2e_real_run_id: runId, purpose: 'single-voter-no-session' },
      })
      .select('id')
      .single(),
    'insert QA secretary condition',
  );

  await requireSingle<IdRow>(
    client
      .from('authority_evidence')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: entity.id,
        body_id: bodyId,
        person_id: president.person_id,
        cargo: 'PRESIDENTE',
        fecha_inicio: today,
        fuente_designacion: 'BOOTSTRAP',
        estado: 'VIGENTE',
        metadata: { e2e_real_run_id: runId, purpose: 'certification-visto-bueno' },
      })
      .select('id')
      .single(),
    'insert QA president authority',
  );

  const sellerName = `[E2E REAL] Transmitente ${runId}`;
  const buyerName = `[E2E REAL] Adquirente ${runId}`;
  const [seller, buyer] = await Promise.all([
    requireSingle<PersonRow>(
      client
        .from('persons')
        .insert({
          tenant_id: DEMO_TENANT_ID,
          full_name: sellerName,
          tax_id: `E2E-S-${runId.slice(-10)}`,
          person_type: 'PF',
          email: `seller-${runId}@arga.example`,
        })
        .select('id, full_name')
        .single(),
      'insert seller person',
    ),
    requireSingle<PersonRow>(
      client
        .from('persons')
        .insert({
          tenant_id: DEMO_TENANT_ID,
          full_name: buyerName,
          tax_id: `E2E-B-${runId.slice(-10)}`,
          person_type: 'PF',
          email: `buyer-${runId}@arga.example`,
        })
        .select('id, full_name')
        .single(),
      'insert buyer person',
    ),
  ]);

  await Promise.all([
    requireSingle<IdRow>(
      client
        .from('condiciones_persona')
        .insert({
          tenant_id: DEMO_TENANT_ID,
          person_id: seller.id,
          entity_id: entity.id,
          body_id: null,
          tipo_condicion: 'SOCIO',
          estado: 'VIGENTE',
          fecha_inicio: today,
          metadata: { e2e_real_run_id: runId, purpose: 'capital-transmission-source' },
        })
        .select('id')
        .single(),
      'insert seller shareholder condition',
    ),
    requireSingle<IdRow>(
      client
        .from('condiciones_persona')
        .insert({
          tenant_id: DEMO_TENANT_ID,
          person_id: buyer.id,
          entity_id: entity.id,
          body_id: null,
          tipo_condicion: 'SOCIO',
          estado: 'VIGENTE',
          fecha_inicio: today,
          metadata: { e2e_real_run_id: runId, purpose: 'capital-transmission-destination' },
        })
        .select('id')
        .single(),
      'insert buyer shareholder condition',
    ),
  ]);

  const sourceHolding = await requireSingle<IdRow>(
    client
      .from('capital_holdings')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: entity.id,
        holder_person_id: seller.id,
        share_class_id: shareClass.id,
        numero_titulos: 100,
        porcentaje_capital: 0.000001,
        voting_rights: true,
        is_treasury: false,
        effective_from: today,
        effective_to: null,
        metadata: { e2e_real_run_id: runId, purpose: 'capital-transmission-source' },
      })
      .select('id')
      .single(),
    'insert source holding',
  );

  return {
    runId,
    tenantId: DEMO_TENANT_ID,
    entityId: entity.id,
    entityName: entity.common_name ?? entity.legal_name,
    demoPersonId: demoPerson.id,
    demoPersonName: demoPerson.full_name,
    bodyId,
    bodyName,
    noSessionTemplateId: noSessionTemplate.id,
    sellerPersonId: seller.id,
    sellerName: seller.full_name,
    buyerPersonId: buyer.id,
    buyerName: buyer.full_name,
    sourceHoldingId: sourceHolding.id,
    shareClassId: shareClass.id,
  };
}

async function closeActiveTestHoldings(client: ServiceClient, runId: string) {
  await client
    .from('capital_holdings')
    .update({ effective_to: todayIsoDate() })
    .contains('metadata', { e2e_real_run_id: runId })
    .is('effective_to', null);
}

test.describe.configure({ mode: 'serial' });

test.describe('Secretaría ARGA real destructive E2E', () => {
  let client: ServiceClient;
  let fixture: FixtureContext;

  test.beforeAll(async () => {
    client = serviceClient();
    fixture = await prepareFixture(client);
  });

  test.afterAll(async () => {
    if (client && fixture?.runId) {
      await closeActiveTestHoldings(client, fixture.runId);
    }
  });

  test('acuerdo sin sesión: UI crea, vota, materializa, genera documento y emite certificación', async ({ page }) => {
    const diagnostics = { pageErrors: [] as string[], consoleErrors: [] as string[] };
    page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !/favicon|ResizeObserver/i.test(message.text())) {
        diagnostics.consoleErrors.push(message.text());
      }
    });

    const title = `[E2E REAL] Acuerdo sin sesión ${fixture.runId}`;
    await page.goto(
      `/secretaria/acuerdos-sin-sesion/nuevo?scope=sociedad&entity=${fixture.entityId}&plantilla=${fixture.noSessionTemplateId}`,
    );

    await expect(page.getByRole('heading', { name: 'Asistente de acuerdo escrito sin sesión' })).toBeVisible();
    await expect(page.getByText('Plantilla seleccionada:')).toBeVisible();

    const stepOneSelects = page.locator('main select');
    await selectOptionByText(stepOneSelects.nth(1), /\[E2E REAL\] Consejo QA/);
    await selectOptionByText(stepOneSelects.nth(2), /Aprobaci[oó]n de cuentas anuales/);
    await page.getByRole('button', { name: /Siguiente/ }).click();

    await page.locator('input[type="text"]').first().fill(title);
    await page.locator('textarea').first().fill(
      `Se aprueba por acuerdo escrito sin sesión el paquete QA ${fixture.runId}, con trazabilidad completa agreement-360 y evidencia demo-operativa EAD Trust.`,
    );
    await page.getByRole('button', { name: /Siguiente/ }).click();

    await expect(page.getByText(fixture.demoPersonName)).toBeVisible();
    await expect(page.getByText('1 votante(s) incluido(s)')).toBeVisible();
    await page.getByRole('button', { name: /Iniciar votación/ }).click();

    await expect(page.getByText('0 de 1 miembro(s) han votado')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Votar a favor' }).click();
    await expect(page.getByText('1 de 1 miembro(s) han votado')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Ir a cierre/ }).click();

    await expect(page.getByText('Resultado: APROBADO')).toBeVisible();
    await page.getByRole('button', { name: /Adoptar acuerdo/ }).click();
    await expect(page.getByRole('heading', { name: 'Acuerdo adoptado' })).toBeVisible({ timeout: 20_000 });

    const { data: resolution } = await client
      .from('no_session_resolutions')
      .select('id, status')
      .eq('tenant_id', fixture.tenantId)
      .eq('title', title)
      .maybeSingle();
    const { data: agreement } = await client
      .from('agreements')
      .select('id, status, adoption_mode')
      .eq('tenant_id', fixture.tenantId)
      .eq('no_session_resolution_id', resolution!.id)
      .maybeSingle();
    expect(resolution?.status).toBe('APROBADO');
    expect(agreement?.adoption_mode).toBe('NO_SESSION');
    expect(['ADOPTED', 'CERTIFIED', 'PROMOTED']).toContain(agreement?.status);

    await page.getByRole('button', { name: /Generar documento/ }).click();
    await expect(page.getByRole('heading', { name: 'Variables resueltas (Capa 2)' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await expect(page.getByRole('heading', { name: 'Campos editables (Capa 3)' })).toBeVisible();
    await page.getByRole('button', { name: /Crear borrador/ }).click();
    await expect(page.getByRole('heading', { name: 'Borrador editable del documento' })).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('#editable-document-draft')).toHaveValue(/ACUERDO|ACTA/i);

    const configureButton = page.getByRole('button', { name: /Configurar borrador/ });
    await expect(configureButton).toBeEnabled({ timeout: 20_000 });
    await configureButton.click();
    await expect(page.getByText('Borrador configurado correctamente')).toBeVisible({ timeout: 25_000 });

    await page.goto(`/secretaria/acuerdos-sin-sesion/${resolution!.id}?scope=sociedad&entity=${fixture.entityId}`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Emitir certificación/ }).click();
    await expect(page.getByText('Certificación emitida')).toBeVisible({ timeout: 25_000 });

    await expect
      .poll(
        async () => {
          const { data } = await client
            .from('certifications')
            .select('id, signature_status, agreement_id')
            .eq('tenant_id', fixture.tenantId)
            .eq('agreement_id', agreement!.id);
          return data?.length ?? 0;
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);

    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.consoleErrors).toEqual([]);
  });

  test('transmisión de capital: UI registra movimiento append-only y saldos derivados', async ({ page }) => {
    let rpcCalled = false;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/rpc/fn_registrar_transmision_capital')) {
        rpcCalled = true;
      }
    });

    await page.goto(`/secretaria/sociedades/${fixture.entityId}/transmision?scope=sociedad&entity=${fixture.entityId}`);
    await expect(page.getByRole('heading', { name: /Transmisión de titularidad/ })).toBeVisible({ timeout: 20_000 });

    await selectOptionByText(page.locator('main select').first(), new RegExp(fixture.sellerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await page.getByLabel('Títulos a transmitir *').fill('25');
    await page.getByLabel('Motivo').fill(`[E2E REAL] transmisión ${fixture.runId}`);
    await page.getByRole('button', { name: /Siguiente/ }).click();

    await selectOptionByText(page.locator('main select').first(), new RegExp(fixture.buyerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await expect(page.getByText(fixture.sellerName)).toBeVisible();
    await expect(page.getByText(fixture.buyerName)).toBeVisible();
    await page.getByRole('button', { name: /Registrar transmisión/ }).click();

    await expect(page.getByText('Transmisión registrada correctamente')).toBeVisible({ timeout: 25_000 });
    await expect(page).toHaveURL(new RegExp(`/secretaria/sociedades/${fixture.entityId}`), { timeout: 25_000 });
    expect(rpcCalled, 'la transmisión debe pasar por la RPC transaccional, no por fallback cliente').toBe(true);

    await expect
      .poll(
        async () => {
          const { data } = await client
            .from('capital_movements')
            .select('id, person_id, delta_shares, movement_type, notas')
            .eq('tenant_id', fixture.tenantId)
            .eq('entity_id', fixture.entityId)
            .eq('movement_type', 'TRANSMISION')
            .ilike('notas', `%${fixture.runId}%`);
          return data ?? [];
        },
        { timeout: 20_000 },
      )
      .toHaveLength(2);

    const { data: destinationHoldings, error } = await client
      .from('capital_holdings')
      .select('id, holder_person_id, numero_titulos, porcentaje_capital, metadata, effective_to')
      .eq('tenant_id', fixture.tenantId)
      .eq('entity_id', fixture.entityId)
      .eq('holder_person_id', fixture.buyerPersonId)
      .is('effective_to', null)
      .contains('metadata', { source_holding_id: fixture.sourceHoldingId, transmission_role: 'destination' });
    if (error) throw error;
    expect(destinationHoldings?.[0]?.numero_titulos).toBe(25);
  });
});
