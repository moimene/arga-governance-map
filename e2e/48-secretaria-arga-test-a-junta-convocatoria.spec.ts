/**
 * E2E opt-in — convocatoria real de Junta SL de Arga test A, SL.
 *
 * Continúa el escenario de e2e/46: crea por UI una convocatoria de Junta
 * General ordinaria con notificación individual/ERDS, plazo legal SL de 15
 * días naturales y dos materias ordinarias:
 * - Aprobación de cuentas.
 * - Distribución de dividendos.
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_JUNTA_CONVOCATORIA=1 bun run e2e -- e2e/48-secretaria-arga-test-a-junta-convocatoria.spec.ts --project=chromium
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const EXPECTED_PROJECT_REF = cleanEnvValue(process.env.EXPECTED_PROJECT_REF) ?? DEFAULT_PROJECT_REF;
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';
const SOCIEDAD_LEGAL_NAME = 'Arga test A, SL';
const TARGET_DATE = '2026-06-26';
const TARGET_TIME = '10:00';
const TARGET_PLACE = 'Sede social, Calle Serrano 18, Madrid';

const AGENDA = {
  accountsTitle: 'Aprobación de cuentas anuales 2026',
  accountsMateria: 'APROBACION_CUENTAS',
  accountsProposal:
    'Aprobar las cuentas anuales de Arga test A, SL correspondientes al ejercicio cerrado a 31 de diciembre de 2026.',
  dividendTitle: 'Distribución de dividendos con preferencia de clase B',
  dividendMateria: 'DISTRIBUCION_DIVIDENDOS',
  dividendProposal:
    'Aprobar la distribución del resultado del ejercicio 2026 respetando el dividendo preferente de las participaciones clase B titularidad de ARGA Seguros S.A.',
};

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
  if (!key) throw new Error('Missing Supabase service role key for Arga test A Junta convocatoria E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

async function next(page: Page) {
  const button = page.getByRole('button', { name: /^Siguiente$/i });
  await expect(button).toBeEnabled({ timeout: 20_000 });
  await button.click();
}

async function selectOptionInAnySelect(page: Page, value: string) {
  const selects = page.locator('select');
  await expect
    .poll(
      async () => {
        const count = await selects.count();
        for (let index = 0; index < count; index += 1) {
          const values = await selects.nth(index).locator('option').evaluateAll((options) =>
            (options as HTMLOptionElement[]).map((option) => option.value),
          );
          if (values.includes(value)) return index;
        }
        return -1;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(0);

  const count = await selects.count();
  for (let index = 0; index < count; index += 1) {
    const values = await selects.nth(index).locator('option').evaluateAll((options) =>
      (options as HTMLOptionElement[]).map((option) => option.value),
    );
    if (values.includes(value)) {
      await selects.nth(index).selectOption(value);
      return;
    }
  }
  throw new Error(`Could not find select option ${value}`);
}

async function expectAnySelectValue(page: Page, value: string) {
  const selects = page.locator('select');
  await expect
    .poll(
      async () => {
        const count = await selects.count();
        for (let index = 0; index < count; index += 1) {
          if (await selects.nth(index).inputValue() === value) return true;
        }
        return false;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

async function setAgendaPoint(
  page: Page,
  index: number,
  input: { title: string; materia: string; proposal: string },
) {
  const titleInput = page.getByPlaceholder(/Descripción del punto del orden del día/i).nth(index);
  await expect(titleInput).toBeVisible({ timeout: 10_000 });
  await titleInput.fill(input.title);

  const acuerdoKind = page.getByRole('radio', { name: /Acuerdo:/i }).nth(index);
  await expect(acuerdoKind).toBeVisible({ timeout: 10_000 });
  await acuerdoKind.click();
  await expect(acuerdoKind).toHaveAttribute('aria-checked', 'true');

  const materia = page.getByLabel('Materia del acuerdo').nth(index);
  await expect(materia).toBeVisible({ timeout: 10_000 });
  await materia.selectOption(input.materia);

  const subtype = page.locator('select[id^="decision-subtype-"]').nth(index);
  if (await subtype.isVisible().catch(() => false)) {
    await subtype.selectOption('CONSTITUTIVE');
  }

  const proposal = page.locator('main textarea').nth(index);
  await expect(proposal).toBeVisible({ timeout: 10_000 });
  await proposal.fill(input.proposal);
}

async function checkChannel(page: Page, label: RegExp) {
  const channelLabel = page
    .locator('label')
    .filter({ has: page.locator('input[type="checkbox"]') })
    .filter({ hasText: label })
    .first();
  await expect(channelLabel).toBeVisible({ timeout: 10_000 });
  await channelLabel.locator('input[type="checkbox"]').check();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function findSociedadAndJunta(client: ServiceClient) {
  const { data: entity, error: entityError } = await client
    .from('entities')
    .select('id, legal_name, tipo_social, legal_form')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('legal_name', SOCIEDAD_LEGAL_NAME)
    .maybeSingle();
  expect(entityError).toBeNull();
  expect(entity?.id, `Missing ${SOCIEDAD_LEGAL_NAME}; run e2e/46 first`).toBeTruthy();
  expect(entity!.tipo_social ?? entity!.legal_form).toBe('SL');

  const { data: bodies, error: bodiesError } = await client
    .from('governing_bodies')
    .select('id, name, body_type, config')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('entity_id', entity!.id);
  expect(bodiesError).toBeNull();
  const junta = (bodies ?? []).find((body) => {
    const config = asRecord(body.config);
    return body.body_type === 'JUNTA' || config.organo_tipo === 'JUNTA_GENERAL';
  });
  expect(junta?.id, 'Missing Junta General body').toBeTruthy();
  return { entityId: entity!.id as string, bodyId: junta!.id as string };
}

async function findExistingConvocatoria(client: ServiceClient, bodyId: string): Promise<string | null> {
  const { data, error } = await client
    .from('convocatorias')
    .select('id, fecha_1, agenda_items')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('body_id', bodyId)
    .gte('fecha_1', `${TARGET_DATE}T00:00:00.000Z`)
    .lt('fecha_1', '2026-06-27T00:00:00.000Z')
    .order('created_at', { ascending: false });
  expect(error).toBeNull();
  const match = (data ?? []).find((row) => {
    const items = Array.isArray(row.agenda_items) ? row.agenda_items as Array<Record<string, unknown>> : [];
    return items.some((item) => item.titulo === AGENDA.accountsTitle) &&
      items.some((item) => item.titulo === AGENDA.dividendTitle);
  });
  return match?.id ?? null;
}

async function fillConvocatoriaWizardUntilBorrador(page: Page, entityId: string, bodyId: string): Promise<string> {
  await page.goto(`/secretaria/convocatorias/nueva?scope=sociedad&entity=${entityId}`);
  await expect(page.getByRole('heading', { name: /Asistente de convocatoria/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Modo Sociedad activo/i)).toBeVisible({ timeout: 20_000 });

  await selectOptionInAnySelect(page, bodyId);
  const ordinaria = page.getByRole('button', { name: /^ORDINARIA$/i }).or(page.getByRole('button', { name: /^Ordinaria$/i })).first();
  if (await ordinaria.isVisible().catch(() => false)) {
    await ordinaria.click();
  }
  await expectAnySelectValue(page, bodyId);
  await expect(page.getByText(/Preaviso mínimo.*15 días|15 días/i).first()).toBeVisible({ timeout: 20_000 });
  await next(page);

  await expect(page.getByRole('heading', { name: /Paso 2\. Fecha y plazo legal/i })).toBeVisible({ timeout: 10_000 });
  await page.locator('input[type="date"]').first().fill(TARGET_DATE);
  await page.locator('input[type="time"]').first().fill(TARGET_TIME);
  await page.locator('input[type="text"]').first().fill(TARGET_PLACE);
  await expect(page.getByText(/15 días requeridos|15 días/i).first()).toBeVisible({ timeout: 20_000 });
  await next(page);

  await expect(page.getByRole('heading', { name: /Paso 3\. Orden del día/i })).toBeVisible({ timeout: 10_000 });
  await setAgendaPoint(page, 0, {
    title: AGENDA.accountsTitle,
    materia: AGENDA.accountsMateria,
    proposal: AGENDA.accountsProposal,
  });
  await page.getByRole('button', { name: /Añadir punto|Anadir punto/i }).click();
  await setAgendaPoint(page, 1, {
    title: AGENDA.dividendTitle,
    materia: AGENDA.dividendMateria,
    proposal: AGENDA.dividendProposal,
  });
  await next(page);

  await expect(page.getByRole('heading', { name: /Paso 4\. Destinatarios/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Clara Rivas Arga Test/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/ARGA Seguros S\.A\./i)).toBeVisible({ timeout: 20_000 });
  await next(page);

  await expect(page.getByRole('heading', { name: /Paso 5\. Canales de publicación/i })).toBeVisible({ timeout: 10_000 });
  await checkChannel(page, /Notificación ERDS/i);
  await next(page);

  await expect(page.getByRole('heading', { name: /Paso 6\. Adjuntos/i })).toBeVisible({ timeout: 10_000 });
  await next(page);

  await expect(page.getByRole('heading', { name: /Paso 7\. Borrador documento/i })).toBeVisible({ timeout: 10_000 });
  const borrador = page.getByPlaceholder(/Borrador generado desde plantilla|Sin plantilla aplicada/i).first();
  await expect(borrador).toBeVisible({ timeout: 20_000 });

  await expect
    .poll(async () => (await borrador.inputValue()).length, { timeout: 30_000 })
    .toBeGreaterThan(500);
  await expect(page.getByText(/Cargando motor de plantillas/i)).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('main [aria-invalid="true"]')).toHaveCount(0);
  await expect(page.getByText(/Faltan campos obligatorios/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Siguiente$/i })).toBeEnabled({ timeout: 30_000 });

  const generated = await borrador.inputValue();
  expect(generated).toMatch(/CONVOCATORIA/i);
  expect(generated).toMatch(/JUNTA GENERAL|Junta General/i);
  expect(generated).toContain(SOCIEDAD_LEGAL_NAME);
  expect(generated).toContain(AGENDA.accountsTitle);
  expect(generated).toContain(AGENDA.dividendTitle);
  expect(generated).toMatch(/quince|15/i);
  return generated;
}

async function createConvocatoriaViaUi(page: Page, entityId: string, bodyId: string): Promise<string> {
  await fillConvocatoriaWizardUntilBorrador(page, entityId, bodyId);
  await next(page);

  await expect(page.getByRole('heading', { name: /Paso 8\. Revisión y emisión/i })).toBeVisible({ timeout: 10_000 });
  const emitir = page.getByRole('button', { name: /Emitir convocatoria/i });
  await expect(emitir).toBeEnabled({ timeout: 60_000 });
  await emitir.click();
  await expect(page.getByText(/Convocatoria emitida correctamente/i).first()).toBeVisible({ timeout: 30_000 });

  const link = page.getByRole('link', { name: /Ver detalle|Abrir detalle|convocatoria/i }).first();
  if (await link.isVisible().catch(() => false)) {
    const href = await link.getAttribute('href');
    const match = href?.match(/convocatorias\/([a-f0-9-]{36})/);
    if (match) return match[1];
  }
  return '';
}

async function verifyConvocatoria(client: ServiceClient, id: string, bodyId: string) {
  const { data, error } = await client
    .from('convocatorias')
    .select('id, body_id, tipo_convocatoria, estado, fecha_1, lugar, modalidad, publication_channels, agenda_items, convocatoria_text, rule_trace, reminders_trace, statutory_basis')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('id', id)
    .maybeSingle();
  expect(error).toBeNull();
  expect(data).toBeTruthy();
  expect(data).toMatchObject({
    body_id: bodyId,
    tipo_convocatoria: 'ORDINARIA',
    estado: 'EMITIDA',
    lugar: TARGET_PLACE,
    modalidad: 'PRESENCIAL',
  });
  expect(String(data!.fecha_1)).toContain(TARGET_DATE);
  expect(Array.isArray(data!.publication_channels)).toBe(true);
  expect(data!.publication_channels).toContain('ERDS');

  const items = data!.agenda_items as Array<Record<string, unknown>>;
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({
    titulo: AGENDA.accountsTitle,
    materia: AGENDA.accountsMateria,
    tipo: 'ORDINARIA',
    inscribible: false,
    kind: 'DECISORIO',
    decision_subtype: 'CONSTITUTIVE',
    propuesta_acuerdo: AGENDA.accountsProposal,
  });
  expect(items[1]).toMatchObject({
    titulo: AGENDA.dividendTitle,
    materia: AGENDA.dividendMateria,
    tipo: 'ORDINARIA',
    inscribible: false,
    kind: 'DECISORIO',
    decision_subtype: 'CONSTITUTIVE',
    propuesta_acuerdo: AGENDA.dividendProposal,
  });

  const convocatoriaText = String(data!.convocatoria_text ?? '');
  expect(convocatoriaText).toContain(AGENDA.accountsTitle);
  expect(convocatoriaText).toContain(AGENDA.dividendTitle);
  expect(convocatoriaText).toMatch(/JUNTA GENERAL|Junta General/i);
  expect(convocatoriaText).toMatch(/quince|15/i);

  const ruleTrace = asRecord(data!.rule_trace);
  const context = asRecord(ruleTrace.context);
  const template = asRecord(context.borrador_template);
  expect(template.tipo).toBe('CONVOCATORIA_SL_NOTIFICACION');
  expect(context.tipo_social).toBe('SL');
  expect(context.organo_tipo).toBe('JUNTA_GENERAL');

  const evaluation = asRecord(ruleTrace.evaluation);
  expect(evaluation.antelacion_dias_requerida).toBe(15);
  const remindersTrace = asRecord(data!.reminders_trace);
  const noticePeriod = asRecord(remindersTrace.notice_period);
  expect(noticePeriod.ok).toBe(true);
  expect(noticePeriod.required_days).toBe(15);
}

test.describe.configure({ timeout: 240_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_JUNTA_CONVOCATORIA !== '1',
  'Opt-in: crea/verifica convocatoria Junta SL Arga test A en governance_OS',
);

test('Secretaría genera el borrador de convocatoria de Junta SL desde plantilla sin bloqueo', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (err) => browserErrors.push(`[pageerror] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/favicon|ResizeObserver/i.test(msg.text())) {
      browserErrors.push(`[console.error] ${msg.text()}`);
    }
  });

  const client = serviceClient();
  const { entityId, bodyId } = await findSociedadAndJunta(client);
  const generated = await fillConvocatoriaWizardUntilBorrador(page, entityId, bodyId);

  expect(generated).toContain('Notificación ERDS');
  expect(
    browserErrors.filter((e) => /TypeError|ReferenceError/i.test(e)),
    'no fatal browser errors during Junta document generation',
  ).toEqual([]);
});

test('Secretaría emite convocatoria de Junta SL ordinaria con plazo de 15 días y notificación individual', async ({ page }) => {
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
    if (status >= 400 && /supabase\.co\/rest\/|supabase\.co\/rpc\//.test(url)) {
      let body = '';
      try { body = await resp.text(); } catch { /* noop */ }
      networkFails.push(`[${status}] ${resp.request().method()} ${url} -> ${body.slice(0, 300)}`);
    }
  });

  const client = serviceClient();
  const { entityId, bodyId } = await findSociedadAndJunta(client);
  let convocatoriaId = await findExistingConvocatoria(client, bodyId);
  if (!convocatoriaId) {
    const createdFromUi = await createConvocatoriaViaUi(page, entityId, bodyId);
    convocatoriaId = createdFromUi || await findExistingConvocatoria(client, bodyId);
  }
  expect(convocatoriaId).toBeTruthy();

  await verifyConvocatoria(client, convocatoriaId!, bodyId);
  await page.goto(`/secretaria/convocatorias/${convocatoriaId}?scope=sociedad&entity=${entityId}`);
  await expect(page.getByText(AGENDA.accountsTitle)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(AGENDA.dividendTitle)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/26\/06\/2026|26\/6\/2026|2026-06-26/)).toBeVisible({ timeout: 20_000 });

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during Junta convocatoria flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during Junta convocatoria flow',
  ).toEqual([]);
});
