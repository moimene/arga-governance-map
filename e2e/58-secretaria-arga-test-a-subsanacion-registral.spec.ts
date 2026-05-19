/**
 * E2E opt-in — subsanación registral del expediente T7 + respuesta.
 *
 * Camino negativo del tramitador: el Registro devuelve la escritura con
 * defectos (`status='SUBSANACION'`, `defect_details` puebla el motivo).
 * El test:
 *
 *   1. Marca el filing T7 como SUBSANACION via service-role.
 *   2. Verifica que el listado `/secretaria/tramitador?estado=SUBSANACION`
 *      incluye el expediente.
 *   3. Entra al stepper con `?agreement={id}` y comprueba que el motor
 *      hidrata el `filingStatus='SUBSANACION'` (corrige bug del stepper:
 *      no cargaba el filing existente al entrar) y que se renderiza la
 *      sección "Subsanación requerida por el Registro".
 *   4. Rellena motivo + docs, click "Preparar respuesta de subsanación",
 *      verifica que filing.status pasa a 'SUBMITTED'.
 *   5. Cleanup: restaura status='ELEVATED' para no romper e2e/54 (T7).
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_SUBSANACION=1 bun run e2e -- e2e/58-secretaria-arga-test-a-subsanacion-registral.spec.ts --project=chromium
 */
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const EXPECTED_PROJECT_REF = cleanEnvValue(process.env.EXPECTED_PROJECT_REF) ?? DEFAULT_PROJECT_REF;
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';

const SOCIEDAD = {
  entityId: '16b28a35-663d-426b-bbf8-9f0d6e8a5d25',
};

const DEFECT_DETAILS =
  'Defecto subsanable: falta literalidad del acuerdo en la certificación notarial — RRM art. 209';
const SUBSANACION_MOTIVO =
  'Aportamos certificación complementaria del Secretario con la transcripción literal del acuerdo de modificación de estatutos.';
const SUBSANACION_DOCS =
  'Certificación complementaria del Secretario (Notaría López García, ref. 2026/5432-bis)';

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
  if (!key) throw new Error('Missing Supabase service role key for subsanación E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

async function findExistingFiling(client: ServiceClient) {
  const { data, error } = await client
    .from('registry_filings')
    .select('id, agreement_id, status, defect_details')
    .eq('tenant_id', DEMO_TENANT_ID)
    .not('agreement_id', 'is', null)
    .in('status', ['ELEVATED', 'SUBSANACION', 'SUBMITTED', 'INSCRIBED'])
    .order('created_at', { ascending: false })
    .limit(20);
  expect(error).toBeNull();
  // Busca el filing del agreement T7 (MODIFICACION_ESTATUTOS Arga test A).
  const { data: agreements } = await client
    .from('agreements')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('entity_id', SOCIEDAD.entityId)
    .eq('agreement_kind', 'MODIFICACION_ESTATUTOS')
    .eq('adoption_mode', 'UNIVERSAL');
  const argaAgreementIds = new Set((agreements ?? []).map((a) => a.id));
  const row = (data ?? []).find((f) => argaAgreementIds.has(f.agreement_id ?? ''));
  expect(row, 'Sin filing T7 — corre e2e/54 antes').toBeTruthy();
  return row as { id: string; agreement_id: string; status: string; defect_details: string | null };
}

async function setSubsanacion(client: ServiceClient, filingId: string) {
  const { error } = await client
    .from('registry_filings')
    .update({ status: 'SUBSANACION', defect_details: DEFECT_DETAILS })
    .eq('id', filingId);
  expect(error).toBeNull();
}

async function restoreElevated(client: ServiceClient, filingId: string) {
  await client
    .from('registry_filings')
    .update({ status: 'ELEVATED', defect_details: null })
    .eq('id', filingId);
}

test.describe.configure({ timeout: 240_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_SUBSANACION !== '1',
  'Opt-in: subsanación registral Arga test A',
);

test('Secretaría procesa subsanación del Registro y registra respuesta', async ({ page }) => {
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
      networkFails.push(`[${status}] ${resp.request().method()} ${url} -> ${body.slice(0, 500)}`);
    }
  });

  const client = serviceClient();
  const filing = await findExistingFiling(client);
  await setSubsanacion(client, filing.id);

  try {
    // Verifica Cloud post-setup.
    const { data: filingAfter } = await client
      .from('registry_filings')
      .select('status, defect_details')
      .eq('id', filing.id)
      .maybeSingle();
    expect(filingAfter?.status).toBe('SUBSANACION');
    expect(filingAfter?.defect_details).toContain('Defecto subsanable');

    // UI 1: listado filtrado por SUBSANACION incluye nuestro expediente.
    await page.goto(`/secretaria/tramitador?estado=SUBSANACION&scope=sociedad&entity=${SOCIEDAD.entityId}`);
    await expect(page.getByRole('heading', { name: /Tramitador|Subsanaciones|Tramitaci[oó]n/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    // El listado típicamente muestra el agreement_kind/protocolo; verificamos
    // que aparece la palabra "Subsanación" o un row con MODIFICACION_ESTATUTOS.
    await expect(
      page.getByText(/MODIFICACION_ESTATUTOS|Modificaci[oó]n de estatutos|Subsanaci[oó]n/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // UI 2: stepper con ?agreement={id} hidrata el filing existente.
    await page.goto(`/secretaria/tramitador/nuevo?scope=sociedad&entity=${SOCIEDAD.entityId}&agreement=${filing.agreement_id}`);
    await expect(page.getByRole('heading', { name: /Tramitaci[oó]n registral|Asistente/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    // Click en el botón del agreement seleccionado.
    const agreementButton = page.getByRole('button', { name: /MODIFICACION_ESTATUTOS.*Adoptado/i }).first();
    await expect(agreementButton).toBeVisible({ timeout: 20_000 });
    await agreementButton.click();
    // Avanzamos hasta el paso 5 (Seguimiento) donde aparece la sección SUBSANACION.
    for (let step = 0; step < 4; step += 1) {
      await page.getByRole('button', { name: /^Siguiente$/i }).click();
      await page.waitForTimeout(150);
    }
    await expect(page.getByRole('heading', { name: /Paso 5\./i })).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText(/Subsanaci[oó]n requerida por el Registro/i).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Rellenamos motivo + docs y enviamos.
    await page.getByPlaceholder(/Describa la corrección realizada/i).fill(SUBSANACION_MOTIVO);
    await page.getByPlaceholder(/Escritura corregida|Certificado notarial/i).fill(SUBSANACION_DOCS);
    const submitBtn = page.getByRole('button', { name: /Preparar respuesta de subsanación/i });
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    // El click dispara handleSubsanacionSubmit → setFilingStatus("SUBMITTED").
    // Al cambiar filingStatus, el render condicional del bloque SUBSANACION
    // se desactiva y el motor muestra "Preparada para tramitación" (label
    // de SUBMITTED). Verificamos el cambio en Cloud directamente.
    await expect.poll(
      async () => {
        const { data } = await client
          .from('registry_filings')
          .select('status')
          .eq('id', filing.id)
          .maybeSingle();
        return data?.status ?? null;
      },
      { timeout: 30_000 },
    ).toBe('SUBMITTED');

    // Re-confirma con un assert simple.
    const { data: filingFinal } = await client
      .from('registry_filings')
      .select('status, defect_details')
      .eq('id', filing.id)
      .maybeSingle();
    expect(filingFinal?.status).toBe('SUBMITTED');
  } finally {
    // Cleanup: T7 espera status='ELEVATED' como precondición.
    await restoreElevated(client, filing.id);
  }

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during subsanación flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during subsanación flow',
  ).toEqual([]);
});
