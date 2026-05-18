/**
 * Phase B7 — UI driving destructive de SociedadNuevaStepper D6.
 *
 * Cubre el alta de una sociedad SA desde cero vía UI con el modelo vigente:
 * asistente de 11 pasos, RPC atómica TX1 `fn_crear_sociedad_legal_y_capital`
 * y TX2 post-commit para cargos/representaciones. El test verifica Cloud en
 * las tablas D6 relevantes y no presupone rollback compensatorio cliente.
 *
 * Marker scheme:
 *   - persons.tax_id = `Z-NS-<marker>-...`
 *   - entities.legal_name LIKE `PHASE-B7-NS-<runId>%`
 *   - runId = `NS-YYYYMMDD-HHMMSS-<4hex>-B7`
 *
 * Opt-in vía SECRETARIA_E2E_PHASE_B1=1 (mismo flag que B1/B3/B4).
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const EXPECTED_PROJECT_REF = cleanEnvValue(process.env.EXPECTED_PROJECT_REF) ?? DEFAULT_PROJECT_REF;
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';

type ServiceClient = SupabaseClient;

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
  if (!key) throw new Error('Missing Supabase service role key for B7 UI driving E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing destructive E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

function generateRunId(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `NS-${stamp}-${randomBytes(2).toString('hex')}-B7`;
}

async function fill(page: Page, label: string | RegExp, value: string) {
  const byAccessibleName = page.getByLabel(label).first();
  const input = (await byAccessibleName.count()) > 0
    ? byAccessibleName
    : page.locator('label', { hasText: label }).locator('input').first();
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(value);
}

async function next(page: Page) {
  const button = page.getByRole('button', { name: 'Siguiente' });
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
}

async function selectStepperStep(page: Page, name: string) {
  const button = page.getByRole('button', { name: new RegExp(`^\\d+\\s+${name}$|^${name}$`) });
  await expect(button).toBeVisible({ timeout: 10_000 });
  await button.click();
}

async function cleanLeftoverPhaseB7Residue(client: ServiceClient): Promise<void> {
  const { data: pjPersons } = await client.from('persons').select('id').like('tax_id', 'Z-NS-%');
  const pjIds = (pjPersons ?? []).map((p) => p.id);

  let purged = 0;
  if (pjIds.length > 0) {
    const { data: entities } = await client
      .from('entities')
      .select('id')
      .or(`legal_name.like.PHASE-B7-NS-*,person_id.in.(${pjIds.join(',')})`);
    const entityIds = (entities ?? []).map((e) => e.id);

    for (const entityId of entityIds) {
      await cleanupEntity(client, entityId, pjIds);
      purged += 1;
    }
  }

  const { data: deletedPjs } = await client.from('persons').delete().like('tax_id', 'Z-NS-%').select('id');
  purged += deletedPjs?.length ?? 0;

  if (purged > 0) {
    console.log(`[phase-b7] pre-cleanup OK: purged ${purged} legacy NS resources`);
  }
}

async function cleanupEntity(client: ServiceClient, entityId: string, knownPersonIds: string[] = []) {
  const { data: conditionPersons } = await client
    .from('condiciones_persona')
    .select('person_id, representative_person_id')
    .eq('entity_id', entityId);
  const personIds = new Set<string>(knownPersonIds);
  for (const row of conditionPersons ?? []) {
    if (row.person_id) personIds.add(row.person_id);
    if (row.representative_person_id) personIds.add(row.representative_person_id);
  }

  await client.from('authority_evidence').delete().eq('entity_id', entityId);
  await client.from('representaciones').delete().eq('entity_id', entityId);
  await client.from('condiciones_persona').delete().eq('entity_id', entityId);
  await client.from('capital_holdings').delete().eq('entity_id', entityId);
  await client.from('share_classes').delete().eq('entity_id', entityId);
  await client.from('entity_capital_profile').delete().eq('entity_id', entityId);
  await client.from('entity_settings').delete().eq('entity_id', entityId);
  await client.from('rule_param_overrides').delete().eq('entity_id', entityId);
  await client.from('governing_bodies').delete().eq('entity_id', entityId);
  await client.from('entities').delete().eq('id', entityId);

  if (personIds.size > 0) {
    await client.from('persons').delete().in('id', [...personIds]);
  }
}

interface CreatedEntity {
  runId: string;
  marker: string;
  taxId: string;
  legalName: string;
  holderTaxId: string;
  presidentTaxId: string;
  secretaryTaxId: string;
  pjPersonId: string | null;
  entityId: string | null;
}

test.describe.configure({ timeout: 180_000 });
test.skip(
  process.env.SECRETARIA_E2E_PHASE_B1 !== '1',
  'Opt-in: Phase B7 destructive UI driving — synthetic sociedad alta SociedadNuevaStepper D6',
);

test.describe('Phase B7 — UI driving destructive SociedadNuevaStepper D6', () => {
  let client: ServiceClient;
  let trace: CreatedEntity;

  test.beforeAll(async () => {
    client = serviceClient();
    await cleanLeftoverPhaseB7Residue(client);

    const runId = generateRunId();
    const marker = runId.split('-').slice(-2)[0].toUpperCase();
    trace = {
      runId,
      marker,
      taxId: `Z-NS-${marker}-SOC`,
      legalName: `PHASE-B7-NS-${runId} S.A.`,
      holderTaxId: `Z-NS-${marker}-HLD`,
      presidentTaxId: `Z-NS-${marker}-PRS`,
      secretaryTaxId: `Z-NS-${marker}-SEC`,
      pjPersonId: null,
      entityId: null,
    };
    console.log(`[phase-b7] runId=${trace.runId} taxId=${trace.taxId} legalName="${trace.legalName}"`);
  });

  test.afterAll(async () => {
    if (!client || !trace) return;
    if (trace.entityId) {
      await cleanupEntity(client, trace.entityId, trace.pjPersonId ? [trace.pjPersonId] : []);
    }
    await client
      .from('persons')
      .delete()
      .in('tax_id', [trace.taxId, trace.holderTaxId, trace.presidentTaxId, trace.secretaryTaxId]);
  });

  test('UI SociedadNuevaStepper D6: 11 pasos + TX1/TX2 + Cloud verification', async ({ page }) => {
    const browserErrors: string[] = [];
    const networkFails: string[] = [];
    page.on('pageerror', (err) => browserErrors.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/favicon|ResizeObserver/i.test(msg.text())) {
        browserErrors.push(`[console.error] ${msg.text()}`);
      }
    });
    page.on('response', async (resp) => {
      const url = resp.url();
      const status = resp.status();
      if (status >= 400 && /supabase\.co\/(rest\/v1|rpc)\//.test(url)) {
        let body = '';
        try { body = await resp.text(); } catch { /* noop */ }
        networkFails.push(`[${status}] ${resp.request().method()} ${url} -> ${body.slice(0, 400)}`);
      }
    });

    await page.goto('/secretaria/sociedades/nueva');
    await expect(page.getByRole('heading', { name: 'Alta de sociedad' })).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole('button', { name: /1\s+Identificacion/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /11\s+Revision/ })).toBeVisible();

    // 1. Identificacion
    await fill(page, /Denominacion legal/i, trace.legalName);
    await fill(page, /Nombre comun/i, `PHASE B7 NS ${trace.runId}`);
    await fill(page, /NIF\/CIF/i, trace.taxId);
    await page.getByLabel(/Tipo social/i).selectOption('SA');
    await fill(page, /Jurisdiccion/i, 'ES');
    await next(page);

    // 2. Domicilio
    await fill(page, /Calle/i, 'Calle D6 QA');
    await fill(page, /Numero/i, '1');
    await fill(page, /Codigo postal/i, '28001');
    await fill(page, /Ciudad/i, 'Madrid');
    await fill(page, /Pais/i, 'ES');
    await fill(page, /CNAE principal/i, '6511');
    await fill(page, /Objeto social/i, 'Actividad aseguradora de prueba D6');
    await next(page);

    // 3. Perfil
    await page.getByLabel(/Organo de administracion/i).selectOption('CDA');
    await next(page);

    // 4. Capital
    await fill(page, /Capital escriturado/i, '60000');
    await fill(page, /Capital desembolsado/i, '60000');
    await fill(page, /Numero total de titulos/i, '60000');
    await next(page);

    // 5. Clases
    await page.getByRole('button', { name: /Anadir clase/i }).click();
    await fill(page, /Codigo/i, 'ORD');
    await fill(page, /^Nombre$/i, 'Acciones ordinarias');
    await fill(page, /Titulos emitidos/i, '60000');
    await next(page);

    // 6. Cap table
    await page.getByRole('button', { name: /Anadir socio/i }).click();
    await page.getByRole('button', { name: 'Nueva' }).last().click();
    const holderName = page.locator('input#nombre').last();
    await expect(holderName).toBeVisible({ timeout: 10_000 });
    await holderName.fill(`Socio ${trace.runId}`);
    const holderTaxId = page.locator('input#nif-cif').last();
    await expect(holderTaxId).toBeVisible({ timeout: 10_000 });
    await holderTaxId.fill(trace.holderTaxId);
    await fill(page, /Titulos/i, '60000');
    await next(page);

    // 7. Organos
    await fill(page, /Consejeros minimo/i, '1');
    await next(page);

    // 8. Cargos
    await page.getByRole('button', { name: /Anadir cargo/i }).click();
    await page.getByRole('button', { name: /Anadir cargo/i }).click();
    await page.locator('select#cargo').nth(0).selectOption('PRESIDENTE');
    await page.locator('select#cargo').nth(1).selectOption('SECRETARIO');
    await page.getByRole('button', { name: 'Nueva' }).nth(0).click();
    await page.locator('input#nombre').nth(0).fill(`Presidenta ${trace.runId}`);
    await page.locator('input#nif-cif').nth(0).fill(trace.presidentTaxId);
    await page.getByRole('button', { name: 'Nueva' }).nth(1).click();
    await page.locator('input#nombre').nth(1).fill(`Secretario ${trace.runId}`);
    await page.locator('input#nif-cif').nth(1).fill(trace.secretaryTaxId);
    await next(page);

    // 9. Reglas
    const pactosAck = page.getByLabel(/Confirmo que los pactos no quedan modelados/i);
    if (await pactosAck.isVisible().catch(() => false)) {
      await pactosAck.check();
    }
    await next(page);

    // 10. Soporte
    await next(page);

    // 11. Revision + create
    await selectStepperStep(page, 'Revision');
    await expect(page.getByText(/Marco normativo inicial/i)).toBeVisible({ timeout: 10_000 });
    const crear = page.getByRole('button', { name: 'Crear sociedad' });
    await crear.scrollIntoViewIfNeeded();
    await expect(crear).toBeEnabled({ timeout: 15_000 });
    await crear.click();

    try {
      await page.waitForURL(/\/secretaria\/sociedades\/[a-f0-9-]{36}/, { timeout: 45_000 });
    } catch (error) {
      const toastErrors = await page.locator('[data-sonner-toast]').allTextContents().catch(() => []);
      console.error('[B7 debug] browserErrors:', JSON.stringify(browserErrors, null, 2));
      console.error('[B7 debug] networkFails:', JSON.stringify(networkFails, null, 2));
      console.error('[B7 debug] toastErrors:', JSON.stringify(toastErrors, null, 2));
      console.error('[B7 debug] current URL:', page.url());
      throw error;
    }

    const idMatch = page.url().match(/\/secretaria\/sociedades\/([a-f0-9-]{36})/);
    expect(idMatch, 'redirect a detalle de sociedad creada').not.toBeNull();
    const createdEntityId = idMatch![1];
    trace.entityId = createdEntityId;

    const { data: pj, error: pjErr } = await client
      .from('persons')
      .select('id, full_name, tax_id, person_type, denomination')
      .eq('tax_id', trace.taxId)
      .maybeSingle();
    expect(pjErr, 'read PJ').toBeNull();
    expect(pj, 'PJ creada con marker').not.toBeNull();
    expect(pj!.person_type).toBe('PJ');
    expect(pj!.denomination).toBe(trace.legalName);
    trace.pjPersonId = pj!.id;

    const { data: entity, error: eErr } = await client
      .from('entities')
      .select('id, person_id, legal_name, tipo_social, tipo_organo_admin, jurisdiction, entity_status, onboarding_status, materiality, forma_administracion, address, cnae_primary')
      .eq('id', createdEntityId)
      .maybeSingle();
    expect(eErr, 'read entity').toBeNull();
    expect(entity, 'entity creada').not.toBeNull();
    expect(entity!.person_id).toBe(pj!.id);
    expect(entity!.legal_name).toBe(trace.legalName);
    expect(entity!.tipo_social).toBe('SA');
    expect(entity!.tipo_organo_admin).toBe('CDA');
    expect(entity!.jurisdiction).toBe('ES');
    expect(entity!.entity_status).toBe('Active');
    expect(entity!.onboarding_status).toBe('OPERATIVA');
    expect(entity!.forma_administracion).toBe('CONSEJO');
    expect(entity!.address).toContain('Madrid');
    expect(entity!.cnae_primary).toBe('6511');

    const { data: profile, error: pfErr } = await client
      .from('entity_capital_profile')
      .select('entity_id, capital_escriturado, capital_desembolsado, numero_titulos, valor_nominal, estado, currency')
      .eq('entity_id', createdEntityId)
      .eq('estado', 'VIGENTE')
      .maybeSingle();
    expect(pfErr, 'read capital_profile').toBeNull();
    expect(profile, 'capital_profile VIGENTE').not.toBeNull();
    expect(profile!.capital_escriturado).toBe(60000);
    expect(profile!.capital_desembolsado).toBe(60000);
    expect(profile!.numero_titulos).toBe(60000);
    expect(profile!.currency).toBe('EUR');

    const { data: shares, error: shErr } = await client
      .from('share_classes')
      .select('id, class_code, name, votes_per_title, voting_rights')
      .eq('entity_id', createdEntityId);
    expect(shErr, 'read share_classes').toBeNull();
    const ord = shares?.find((s) => s.class_code === 'ORD');
    expect(ord, 'clase ORD ordinaria creada').toBeDefined();
    expect(ord!.voting_rights).toBe(true);

    const { data: holdings, error: hErr } = await client
      .from('capital_holdings')
      .select('holder_person_id, share_class_id, numero_titulos, voting_rights, is_treasury')
      .eq('entity_id', createdEntityId);
    expect(hErr, 'read capital_holdings').toBeNull();
    expect(holdings?.length ?? 0, 'holding inicial').toBe(1);
    expect(holdings![0].share_class_id).toBe(ord!.id);
    expect(holdings![0].numero_titulos).toBe(60000);
    expect(holdings![0].voting_rights).toBe(true);
    expect(holdings![0].is_treasury).toBe(false);

    const { data: bodies, error: bErr } = await client
      .from('governing_bodies')
      .select('id, name, body_type, slug, config')
      .eq('entity_id', createdEntityId);
    expect(bErr, 'read bodies').toBeNull();
    expect(bodies?.length ?? 0, '2 órganos seed creados').toBeGreaterThanOrEqual(2);
    const junta = bodies!.find((b) => b.body_type === 'JUNTA');
    const cda = bodies!.find((b) => b.body_type === 'CDA');
    expect(junta, 'Junta General creada').toBeDefined();
    expect(cda, 'CdA creado').toBeDefined();
    expect(junta!.name).toMatch(/Junta General/i);
    expect(cda!.config).toMatchObject({ organo_tipo: 'CONSEJO_ADMIN', min_consejeros: 1 });

    const { data: cargos, error: cErr } = await client
      .from('condiciones_persona')
      .select('tipo_condicion, estado, person_id, body_id')
      .eq('entity_id', createdEntityId)
      .in('tipo_condicion', ['PRESIDENTE', 'SECRETARIO']);
    expect(cErr, 'read condiciones_persona').toBeNull();
    expect(cargos?.map((cargo) => cargo.tipo_condicion).sort()).toEqual(['PRESIDENTE', 'SECRETARIO']);
    expect(cargos?.every((cargo) => cargo.estado === 'VIGENTE' && cargo.body_id === cda!.id)).toBe(true);

    const { data: settings, error: setErr } = await client
      .from('entity_settings')
      .select('key')
      .eq('entity_id', createdEntityId);
    expect(setErr, 'read entity_settings').toBeNull();
    expect(Array.isArray(settings), 'entity_settings D6 query returns an array').toBe(true);

    expect(
      browserErrors.filter((err) =>
        /relation .* does not exist|column .* does not exist|permission denied|RLS/i.test(err),
      ),
      'no fatal browser errors during sociedad alta UI flow',
    ).toEqual([]);
    expect(
      networkFails.filter((err) => !/permission denied for table migrations/i.test(err)),
      'no Supabase REST/RPC failures during sociedad alta UI flow',
    ).toEqual([]);
  });
});
