/**
 * E2E opt-in — tramitador registral de Arga test A, SL.
 *
 * Continúa T4: el acuerdo MODIFICACION_ESTATUTOS (cambio a Administrador
 * Único, adoptado en Junta universal) se elige para tramitación registral.
 * Verifica:
 *
 *   - Step 1 preload por `?agreement=<id>`.
 *   - Steps 2-4 (vía notarial + datos de escritura + canal).
 *   - Click "Registrar escritura" → crea fila `registry_filings` ligada al
 *     acuerdo con `status='ELEVATED'` y datos notario/protocolo capturados.
 *
 * No se ejerce el gate de acta aprobada explícitamente (RRM 109) en el
 * Tramitador porque el motor lo deriva del propio acuerdo, no de la firma
 * del acta. La trazabilidad registry⇄certification queda como referencia
 * operativa demo (no evidencia productiva).
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_TRAMITADOR=1 bun run e2e -- e2e/54-secretaria-arga-test-a-tramitador-registro.spec.ts --project=chromium
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const EXPECTED_PROJECT_REF = cleanEnvValue(process.env.EXPECTED_PROJECT_REF) ?? DEFAULT_PROJECT_REF;
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';

const SOCIEDAD = {
  entityId: '16b28a35-663d-426b-bbf8-9f0d6e8a5d25',
  legalName: 'Arga test A, SL',
};

const FILING = {
  notary: 'Notaría López García, Madrid',
  deedDate: '2026-07-01',
  protocolNumber: '2026/5432-ARGA-TEST-A',
  channel: 'SIGER',
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
  if (!key) throw new Error('Missing Supabase service role key for tramitador E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

async function findInscribableAgreement(client: ServiceClient): Promise<string> {
  const { data, error } = await client
    .from('agreements')
    .select('id, agreement_kind, matter_class, status, adoption_mode, inscribable, created_at')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('entity_id', SOCIEDAD.entityId)
    .eq('agreement_kind', 'MODIFICACION_ESTATUTOS')
    .eq('adoption_mode', 'UNIVERSAL')
    .eq('status', 'ADOPTED')
    .order('created_at', { ascending: false })
    .limit(1);
  expect(error).toBeNull();
  const row = (data ?? [])[0];
  expect(row?.id, 'Sin acuerdo MODIFICACION_ESTATUTOS adoptado (run T4 primero)').toBeTruthy();
  return row!.id as string;
}

async function runTramitadorViaUi(page: Page, agreementId: string) {
  await page.goto(
    `/secretaria/tramitador/nuevo?scope=sociedad&entity=${SOCIEDAD.entityId}&agreement=${agreementId}`,
  );
  await expect(page.getByRole('heading', { name: /Tramitaci[oó]n registral|Asistente/i }).first()).toBeVisible({
    timeout: 20_000,
  });

  // Step 1 — Seleccionar acuerdo. La UI lista los acuerdos como botones
  // "MODIFICACION_ESTATUTOS ... Adoptado". Hacemos click en el primero
  // (la query ya retorna el más reciente vía orden de creación).
  const agreementButton = page.getByRole('button', { name: /MODIFICACION_ESTATUTOS.*Adoptado/i }).first();
  await expect(agreementButton).toBeVisible({ timeout: 20_000 });
  await agreementButton.click();
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // Step 2 — Vía de presentación: motor decide ESCRITURA por defecto para estatutos.
  await expect(page.getByRole('heading', { name: /Paso 2\./i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // Step 3 — Datos del instrumento.
  await expect(page.getByRole('heading', { name: /Paso 3\./i })).toBeVisible({ timeout: 10_000 });
  // El form solo aparece si instrumentoRequerido = ESCRITURA. Sin ese form,
  // los inputs no existen y nos saltamos a 4.
  const notaryInput = page.locator('input[placeholder*="Notar"]').first();
  if (await notaryInput.isVisible().catch(() => false)) {
    await notaryInput.fill(FILING.notary);
    await page.locator('input[type="date"]').first().fill(FILING.deedDate);
    await page.locator('input[placeholder*="2026/5432"]').first().fill(FILING.protocolNumber);
  }
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // Step 4 — Presentación: solo selecciona canal y avanza al paso 5.
  await expect(page.getByRole('heading', { name: /Paso 4\./i })).toBeVisible({ timeout: 10_000 });
  await page.locator('main select').first().selectOption(FILING.channel);
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // Step 5 — Seguimiento: aquí vive la card "Escritura pública" y el botón
  // "Registrar escritura" que materializa el `registry_filings` con status
  // ELEVATED.
  await expect(page.getByRole('heading', { name: /Paso 5\./i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Escritura pública/i).first()).toBeVisible({ timeout: 10_000 });
  const registerBtn = page.getByRole('button', { name: /Registrar escritura/i });
  await expect(registerBtn).toBeEnabled({ timeout: 20_000 });
  await registerBtn.click();
  await expect(page.getByText(/Persistida|Registrada en expediente/i).first()).toBeVisible({ timeout: 30_000 });
}

async function verifyRegistryFiling(client: ServiceClient, agreementId: string) {
  const { data, error } = await client
    .from('registry_filings')
    .select('id, agreement_id, status, filing_via, notary_name, protocol_number, elevated_at, tenant_id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('agreement_id', agreementId)
    .order('created_at', { ascending: false })
    .limit(1);
  expect(error).toBeNull();
  const row = (data ?? [])[0];
  expect(row, 'No se creó registry_filings tras la tramitación').toBeTruthy();
  expect(row!.agreement_id).toBe(agreementId);
  expect(row!.status).toBe('ELEVATED');
  expect(row!.filing_via).toBe(FILING.channel);
  expect(String(row!.notary_name ?? '')).toContain('Notaría');
  expect(String(row!.protocol_number ?? '')).toContain('2026/5432');
  expect(row!.elevated_at).toBeTruthy();
}

test.describe.configure({ timeout: 300_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_TRAMITADOR !== '1',
  'Opt-in: tramitador registral Arga test A en governance_OS',
);

test('Secretaría tramita registralmente la modificación estatutaria del Admin Único', async ({ page }) => {
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
  const agreementId = await findInscribableAgreement(client);

  // Si ya hay registry_filings ELEVATED para este acuerdo, idempotencia → skip stepper.
  const { data: existing } = await client
    .from('registry_filings')
    .select('id, status')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('agreement_id', agreementId)
    .eq('status', 'ELEVATED')
    .limit(1);
  const alreadyFiled = (existing ?? []).length > 0;
  if (!alreadyFiled) {
    await runTramitadorViaUi(page, agreementId);
  }

  await verifyRegistryFiling(client, agreementId);

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during tramitador flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during tramitador flow',
  ).toEqual([]);
});
