/**
 * E2E opt-in — alta real de Arga test A, SL.
 *
 * Crea por UI una SL con 4 socios: 3 PF y ARGA Seguros como PJ, dos clases de
 * participaciones y clase B con dividendo preferente para ARGA Seguros. Si la
 * sociedad ya existe, no duplica datos: verifica Cloud + ficha UI.
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A=1 bun run e2e -- e2e/46-secretaria-arga-test-a-sociedad.spec.ts --project=chromium
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const EXPECTED_PROJECT_REF = cleanEnvValue(process.env.EXPECTED_PROJECT_REF) ?? DEFAULT_PROJECT_REF;
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';
const ARGA_ENTITY_ID = '6d7ed736-f263-4531-a59d-c6ca0cd41602';

const SOCIEDAD = {
  legalName: 'Arga test A, SL',
  commonName: 'Arga test A',
  taxId: 'B01888818',
  capital: '10000',
  totalTitles: '10000',
};

const PF1 = { name: 'Clara Rivas Arga Test', taxId: '71111111A' };
const PF2 = { name: 'Mateo Soler Arga Test', taxId: '72222222B' };
const PF3 = { name: 'Nerea Vidal Arga Test', taxId: '73333333C' };

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
  if (!key) throw new Error('Missing Supabase service role key for Arga test A E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

async function fill(page: Page, label: string | RegExp, value: string) {
  const input = page.getByLabel(label).first();
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(value);
}

async function next(page: Page) {
  const button = page.getByRole('button', { name: 'Siguiente' });
  await expect(button).toBeEnabled({ timeout: 10_000 });
  await button.click();
}

async function fillNewPerson(container: Locator, person: { name: string; taxId: string }, target: 'first' | 'last' = 'first') {
  const buttons = container.getByRole('button', { name: 'Nueva' });
  const count = await buttons.count();
  await buttons.nth(target === 'last' ? count - 1 : 0).click();
  await container.getByLabel('Nombre').last().fill(person.name);
  await container.getByLabel('NIF/CIF').last().fill(person.taxId);
}

async function selectExistingPerson(container: Locator, searchText: string) {
  await container.locator('input[id$="-buscar"]').first().fill(searchText);
  const personSelect = container.locator('select[id$="-persona"]').first();
  const option = personSelect.locator('option', { hasText: searchText }).first();
  await expect(option).toBeAttached({ timeout: 10_000 });
  const value = await option.getAttribute('value');
  expect(value, `option value for ${searchText}`).toBeTruthy();
  await personSelect.selectOption(value!);
}

async function fillShareClass(
  page: Page,
  index: number,
  input: { code: string; name: string; titles: string; coeff: string; preferred?: boolean; description?: string },
) {
  const card = page.getByTestId(`share-class-card-${index}`);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByLabel('Codigo').fill(input.code);
  await card.getByLabel('Nombre').fill(input.name);
  await card.getByLabel('Titulos emitidos').fill(input.titles);
  await card.getByLabel('Coeficiente economico').fill(input.coeff);
  if (input.preferred) {
    await card.getByLabel('Dividendo preferente').check();
    await card.getByLabel(/Descripci[oó]n preferencia/i).fill(input.description ?? 'Dividendo preferente');
  }
}

async function fillHolding(
  page: Page,
  index: number,
  input: { person?: { name: string; taxId: string }; existingSearch?: string; shareClass: string; titles: string; representative?: { name: string; taxId: string } },
) {
  const card = page.getByTestId(`cap-table-card-${index}`);
  await expect(card).toBeVisible({ timeout: 10_000 });
  if (input.person) {
    await fillNewPerson(card, input.person);
  } else if (input.existingSearch) {
    await selectExistingPerson(card, input.existingSearch);
  }
  await card.getByLabel('Clase').selectOption(input.shareClass);
  await card.getByLabel('Titulos').fill(input.titles);
  if (input.representative) {
    await fillNewPerson(card, input.representative, 'last');
  }
}

async function fillCargo(
  page: Page,
  index: number,
  input: { cargo: string; person?: { name: string; taxId: string }; existingSearch?: string; representative?: { name: string; taxId: string } },
) {
  const card = page.getByTestId(`cargo-card-${index}`);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.locator('select[id$="-tipo"]').selectOption(input.cargo);
  if (input.person) {
    await fillNewPerson(card, input.person);
  } else if (input.existingSearch) {
    await selectExistingPerson(card, input.existingSearch);
  }
  if (input.representative) {
    await fillNewPerson(card, input.representative, 'last');
  }
}

async function existingEntityId(client: ServiceClient): Promise<string | null> {
  const { data, error } = await client
    .from('entities')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('legal_name', SOCIEDAD.legalName)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function createViaUi(page: Page): Promise<string> {
  await page.goto('/secretaria/sociedades/nueva');
  await expect(page.getByRole('heading', { name: 'Alta de sociedad' })).toBeVisible({ timeout: 20_000 });

  await fill(page, /Denominacion legal/i, SOCIEDAD.legalName);
  await fill(page, /Nombre comun/i, SOCIEDAD.commonName);
  await fill(page, /NIF\/CIF/i, SOCIEDAD.taxId);
  await page.getByLabel(/Tipo social/i).selectOption('SL');
  await fill(page, /Jurisdiccion/i, 'ES');
  await next(page);

  await fill(page, /Calle/i, 'Calle Serrano');
  await fill(page, /Numero/i, '18');
  await fill(page, /Codigo postal/i, '28001');
  await fill(page, /Ciudad/i, 'Madrid');
  await fill(page, /Pais/i, 'ES');
  await fill(page, /CNAE principal/i, '6420');
  await fill(page, /Objeto social/i, 'Sociedad holding de prueba para Secretaría Societaria ARGA');
  await next(page);

  await page.getByLabel(/Organo de administracion/i).selectOption('CDA');
  await page.getByLabel(/Sector regulado/i).selectOption('SEGUROS');
  await page.getByLabel(/Rol en grupo/i).selectOption('FILIAL');
  await next(page);

  await fill(page, /Capital escriturado/i, SOCIEDAD.capital);
  await fill(page, /Capital desembolsado/i, SOCIEDAD.capital);
  await fill(page, /Numero total de titulos/i, SOCIEDAD.totalTitles);
  await next(page);

  await page.getByRole('button', { name: /Anadir clase/i }).click();
  await page.getByRole('button', { name: /Anadir clase/i }).click();
  await fillShareClass(page, 0, {
    code: 'A',
    name: 'Participaciones clase A ordinarias',
    titles: '7500',
    coeff: '1',
  });
  await fillShareClass(page, 1, {
    code: 'B',
    name: 'Participaciones clase B - dividendo preferente ARGA',
    titles: '2500',
    coeff: '1.25',
    preferred: true,
    description: 'Dividendo preferente para ARGA Seguros antes de reparto ordinario',
  });
  await next(page);

  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: /Anadir socio/i }).click();
  }
  await fillHolding(page, 0, { person: PF1, shareClass: 'A', titles: '2500' });
  await fillHolding(page, 1, { person: PF2, shareClass: 'A', titles: '2500' });
  await fillHolding(page, 2, { person: PF3, shareClass: 'A', titles: '2500' });
  await fillHolding(page, 3, {
    existingSearch: 'A-00001001',
    shareClass: 'B',
    titles: '2500',
    representative: PF1,
  });
  await next(page);

  await fill(page, /Consejeros minimo/i, '3');
  await fill(page, /Consejeros maximo/i, '5');
  await next(page);

  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: /Anadir cargo/i }).click();
  }
  await fillCargo(page, 0, { cargo: 'PRESIDENTE', person: PF1 });
  await fillCargo(page, 1, { cargo: 'CONSEJERO', person: PF2 });
  await fillCargo(page, 2, { cargo: 'CONSEJERO', existingSearch: 'A-00001001', representative: PF1 });
  await fillCargo(page, 3, { cargo: 'SECRETARIO', person: PF2 });
  await next(page);

  const pactosAck = page.getByLabel(/Confirmo que los pactos no quedan modelados/i);
  if (await pactosAck.isVisible().catch(() => false)) {
    await pactosAck.check();
  }
  await next(page);

  await next(page);

  await expect(page.getByText(/Marco normativo inicial/i)).toBeVisible({ timeout: 10_000 });
  const crear = page.getByRole('button', { name: 'Crear sociedad' });
  await crear.scrollIntoViewIfNeeded();
  await expect(crear).toBeEnabled({ timeout: 15_000 });
  await crear.click();
  await page.waitForURL(/\/secretaria\/sociedades\/[a-f0-9-]{36}/, { timeout: 60_000 });
  const idMatch = page.url().match(/\/secretaria\/sociedades\/([a-f0-9-]{36})/);
  expect(idMatch).not.toBeNull();
  return idMatch![1];
}

async function verifyCloud(client: ServiceClient, entityId: string) {
  const { data: arga } = await client
    .from('entities')
    .select('person_id')
    .eq('id', ARGA_ENTITY_ID)
    .maybeSingle();
  const argaPersonId = arga?.person_id;
  expect(argaPersonId, 'ARGA Seguros canonical person').toBeTruthy();

  const { data: entity, error: entityError } = await client
    .from('entities')
    .select('id, legal_name, common_name, tax_id:person_id(tax_id), tipo_social, tipo_organo_admin, onboarding_status')
    .eq('id', entityId)
    .maybeSingle();
  expect(entityError).toBeNull();
  expect(entity).toMatchObject({
    legal_name: SOCIEDAD.legalName,
    common_name: SOCIEDAD.commonName,
    tipo_social: 'SL',
    tipo_organo_admin: 'CDA',
    onboarding_status: 'OPERATIVA',
  });

  const { data: classes, error: classError } = await client
    .from('share_classes')
    .select('id, class_code, name, economic_rights_coeff, restrictions')
    .eq('entity_id', entityId);
  expect(classError).toBeNull();
  expect(classes).toHaveLength(2);
  const classA = classes!.find((item) => item.class_code === 'A');
  const classB = classes!.find((item) => item.class_code === 'B');
  expect(classA).toMatchObject({ economic_rights_coeff: 1 });
  expect(classB).toMatchObject({
    economic_rights_coeff: 1.25,
    restrictions: {
      preferred_dividend: true,
      preferred_dividend_description: 'Dividendo preferente para ARGA Seguros antes de reparto ordinario',
    },
  });

  const { data: persons, error: personsError } = await client
    .from('persons')
    .select('id, full_name, tax_id, person_type')
    .in('tax_id', [PF1.taxId, PF2.taxId, PF3.taxId]);
  expect(personsError).toBeNull();
  const pf1 = persons!.find((item) => item.tax_id === PF1.taxId);
  const pf2 = persons!.find((item) => item.tax_id === PF2.taxId);
  const pf3 = persons!.find((item) => item.tax_id === PF3.taxId);
  expect([pf1?.id, pf2?.id, pf3?.id].every(Boolean)).toBe(true);

  const { data: holdings, error: holdingsError } = await client
    .from('capital_holdings')
    .select('holder_person_id, share_class_id, numero_titulos, voting_rights')
    .eq('entity_id', entityId)
    .is('effective_to', null);
  expect(holdingsError).toBeNull();
  expect(holdings).toHaveLength(4);
  const classById = new Map(classes!.map((item) => [item.id, item.class_code]));
  const titlesByClass = holdings!.reduce<Record<string, number>>((acc, item) => {
    const code = classById.get(item.share_class_id) ?? 'UNKNOWN';
    acc[code] = (acc[code] ?? 0) + Number(item.numero_titulos ?? 0);
    return acc;
  }, {});
  expect(titlesByClass).toMatchObject({ A: 7500, B: 2500 });
  const argaHolding = holdings!.find((item) => item.holder_person_id === argaPersonId);
  expect(argaHolding).toMatchObject({ numero_titulos: 2500, voting_rights: true });
  expect(classById.get(argaHolding!.share_class_id)).toBe('B');

  const { data: bodies, error: bodiesError } = await client
    .from('governing_bodies')
    .select('id, body_type, config')
    .eq('entity_id', entityId);
  expect(bodiesError).toBeNull();
  const cda = bodies!.find((body) => body.body_type === 'CDA');
  expect(cda?.config).toMatchObject({ organo_tipo: 'CONSEJO_ADMIN', min_consejeros: 3, max_consejeros: 5 });

  const { data: cargos, error: cargosError } = await client
    .from('condiciones_persona')
    .select('tipo_condicion, person_id, representative_person_id, body_id, estado')
    .eq('entity_id', entityId)
    .eq('estado', 'VIGENTE');
  expect(cargosError).toBeNull();
  expect(cargos?.filter((cargo) => cargo.body_id === cda!.id).map((cargo) => cargo.tipo_condicion).sort()).toEqual([
    'CONSEJERO',
    'CONSEJERO',
    'PRESIDENTE',
    'SECRETARIO',
  ]);
  const argaConsejero = cargos!.find((cargo) => cargo.tipo_condicion === 'CONSEJERO' && cargo.person_id === argaPersonId);
  expect(argaConsejero?.representative_person_id).toBe(pf1!.id);

  const { data: reps, error: repsError } = await client
    .from('representaciones')
    .select('represented_person_id, representative_person_id, scope, effective_to')
    .eq('entity_id', entityId)
    .eq('scope', 'ADMIN_PJ_REPRESENTANTE')
    .is('effective_to', null);
  expect(repsError).toBeNull();
  expect(reps?.some((rep) => rep.represented_person_id === argaPersonId && rep.representative_person_id === pf1!.id)).toBe(true);
}

test.describe.configure({ timeout: 240_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A !== '1',
  'Opt-in: crea/verifica Arga test A, SL en governance_OS',
);

test('Secretaría crea Arga test A, SL con clase B preferente para ARGA Seguros', async ({ page }) => {
  const client = serviceClient();
  let entityId = await existingEntityId(client);
  if (!entityId) {
    entityId = await createViaUi(page);
  } else {
    await page.goto(`/secretaria/sociedades/${entityId}`);
  }

  await verifyCloud(client, entityId);
  await page.goto(`/secretaria/sociedades/${entityId}`);
  await expect(page.getByRole('heading', { name: SOCIEDAD.commonName })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Capital/i }).click();
  await expect(page.getByText('Participaciones clase B - dividendo preferente ARGA')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Dividendo preferente para ARGA Seguros antes de reparto ordinario')).toBeVisible();
  await page.getByRole('button', { name: /Administradores/i }).click();
  await expect(page.getByText('ARGA Seguros S.A.')).toBeVisible({ timeout: 15_000 });
});
