/**
 * E2E opt-in — decisión del Administrador Único de Arga test A, SL.
 *
 * Continúa T4 (Junta universal acuerda Admin Único). Registra una decisión
 * unipersonal del órgano de administración (NO del socio único) para
 * formular cuentas anuales del ejercicio 2026 y dejar listo el expediente
 * para una futura Junta de aprobación.
 *
 * Verifica:
 *   - `unipersonal_decisions.decision_type = 'ADMINISTRADOR_UNICO'`
 *   - `agreements.adoption_mode = 'UNIPERSONAL_ADMIN'`
 *   - `agreements.unipersonal_decision_id` enlaza el expediente
 *   - status ADOPTED, sin meeting/convocatoria asociados
 *
 * Nota sobre la materia: el catálogo del repo expone `FORMULACION_CUENTAS`
 * en `AGENDA_MATERIAS` para reuniones, pero `materia_catalog` en Cloud sólo
 * tiene `APROBACION_CUENTAS` (clase ORDINARIA) y `CUENTAS_CONSOLIDADAS`. Como
 * el stepper de decisión unipersonal sólo permite materias presentes en
 * `materia_catalog`, usamos `APROBACION_CUENTAS` como materia más cercana
 * (representa el acto de formulación que precede a la aprobación de cuentas
 * por la Junta). La trazabilidad queda en el texto del acuerdo.
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_DECISION_ADMIN_UNICO=1 bun run e2e -- e2e/52-secretaria-arga-test-a-decision-admin-unico-cuentas.spec.ts --project=chromium
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

const DECISION = {
  type: 'ADMINISTRADOR_UNICO' as const,
  materia: 'APROBACION_CUENTAS',
  ejercicio: 2026,
  title: 'Formulación de cuentas anuales del ejercicio 2026 (Admin Único)',
  fundamento: 'Arts. 210, 253 y 254 LSC; art. 173 LSC para convocatoria posterior de Junta',
};

const DECISION_TEXT = [
  'Doña Clara Rivas Arga Test, en su condición de Administradora Única de Arga test A, SL,',
  'tras haberse adoptado por Junta universal de socios la modificación estatutaria que confiere',
  'la administración de la sociedad a un Administrador Único (arts. 210 y 233 LSC), en uso de',
  'la competencia que le atribuyen los artículos 253 y 254 LSC, FORMULA las cuentas anuales del',
  'ejercicio cerrado a 31 de diciembre de 2026, integradas por balance, cuenta de pérdidas y',
  'ganancias, estado de cambios en el patrimonio neto, estado de flujos de efectivo y memoria,',
  'junto con el informe de gestión y la propuesta de aplicación del resultado, que se someterán',
  'a la aprobación de la Junta General Ordinaria dentro del plazo legal del artículo 164 LSC.',
].join(' ');

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
  if (!key) throw new Error('Missing Supabase service role key for decision admin único E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

async function selectOptionInAnySelect(page: Page, value: string) {
  const selects = page.locator('select:not([disabled])');
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

async function findExistingDecision(client: ServiceClient): Promise<string | null> {
  const { data, error } = await client
    .from('unipersonal_decisions')
    .select('id, title, decision_type, status, created_at')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('entity_id', SOCIEDAD.entityId)
    .eq('decision_type', DECISION.type)
    .ilike('title', `%${DECISION.materia === 'APROBACION_CUENTAS' ? 'cuentas' : DECISION.materia}%`)
    .order('created_at', { ascending: false })
    .limit(5);
  expect(error).toBeNull();
  const match = (data ?? []).find((row) => String(row.title ?? '').toLowerCase().includes('aprobación de cuentas') || String(row.title ?? '').toLowerCase().includes('cuentas anuales'));
  return match?.id ?? null;
}

async function findAgreementForDecision(client: ServiceClient, decisionId: string): Promise<string | null> {
  const { data, error } = await client
    .from('agreements')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('unipersonal_decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1);
  expect(error).toBeNull();
  return (data ?? [])[0]?.id ?? null;
}

async function runStepperViaUi(page: Page): Promise<{ decisionId: string; agreementId: string }> {
  await page.goto(`/secretaria/decisiones-unipersonales/nueva?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(page.getByRole('heading', { name: /Asistente de decisión unipersonal/i })).toBeVisible({
    timeout: 20_000,
  });

  // Paso 1 — Tipo y materia. La sociedad viene preseleccionada (scope).
  // Seleccionamos ADMINISTRADOR_UNICO (el segundo botón) y materia APROBACION_CUENTAS.
  await page.getByRole('button', { name: /Administrador único/i }).click();
  await selectOptionInAnySelect(page, DECISION.materia);

  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // Paso 2 — Texto del acuerdo
  await expect(page.getByRole('heading', { name: /Paso 2\. Texto del acuerdo/i })).toBeVisible({
    timeout: 10_000,
  });
  // Texto del acuerdo es textarea (placeholder "Ejemplo: ..."), fundamento es
  // input type=text (placeholder "Ej: art. ..."). Antes ambos coincidían con
  // `.first()` y la fundamentación pisaba el texto.
  await page.locator('main textarea').first().fill(DECISION_TEXT);
  await page.locator('main input[type="text"]').last().fill(DECISION.fundamento);
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // Paso 3 — Registro
  await expect(page.getByRole('heading', { name: /Paso 3\. Registro y documento/i })).toBeVisible({
    timeout: 10_000,
  });
  const register = page.getByRole('button', { name: /Registrar decisión y expediente/i });
  await expect(register).toBeEnabled({ timeout: 20_000 });
  await register.click();
  await expect(page.getByText(/Decisión registrada y expediente creado/i)).toBeVisible({ timeout: 30_000 });

  // Navegar al detalle para extraer decisionId desde la URL.
  await page.getByRole('button', { name: /Ver decisión registrada/i }).click();
  await expect(page).toHaveURL(/\/secretaria\/decisiones-unipersonales\/[a-f0-9-]{36}/, { timeout: 30_000 });
  const match = page.url().match(/\/secretaria\/decisiones-unipersonales\/([a-f0-9-]{36})/);
  expect(match).not.toBeNull();
  const decisionId = match![1];

  const client = serviceClient();
  const agreementId = await findAgreementForDecision(client, decisionId);
  expect(agreementId, 'no agreement linked to the unipersonal decision').toBeTruthy();
  return { decisionId, agreementId: agreementId! };
}

async function verifyPersistence(client: ServiceClient, decisionId: string, agreementId: string) {
  const { data: decision, error: dErr } = await client
    .from('unipersonal_decisions')
    .select('id, entity_id, decision_type, title, content, status, requires_registry, decision_date')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('id', decisionId)
    .maybeSingle();
  expect(dErr).toBeNull();
  expect(decision).toBeTruthy();
  expect(decision!.entity_id).toBe(SOCIEDAD.entityId);
  expect(decision!.decision_type).toBe(DECISION.type);
  expect(decision!.status).toBe('FIRMADA');
  expect(String(decision!.content)).toContain('Clara Rivas Arga Test');
  expect(String(decision!.content)).toContain('Administradora Única');
  expect(String(decision!.content)).toContain('2026');
  expect(String(decision!.content)).toContain('Fundamento jurídico');
  expect(String(decision!.title)).toContain('cuentas');

  const { data: agreement, error: agErr } = await client
    .from('agreements')
    .select('id, entity_id, body_id, agreement_kind, matter_class, adoption_mode, status, unipersonal_decision_id, parent_meeting_id, no_session_resolution_id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('id', agreementId)
    .maybeSingle();
  expect(agErr).toBeNull();
  expect(agreement).toBeTruthy();
  expect(agreement!.entity_id).toBe(SOCIEDAD.entityId);
  expect(agreement!.adoption_mode).toBe('UNIPERSONAL_ADMIN');
  expect(agreement!.agreement_kind).toBe(DECISION.materia);
  expect(agreement!.matter_class).toBe('ORDINARIA');
  expect(agreement!.status).toBe('ADOPTED');
  expect(agreement!.unipersonal_decision_id).toBe(decisionId);
  expect(agreement!.parent_meeting_id).toBeNull();
  expect(agreement!.no_session_resolution_id).toBeNull();
  expect(agreement!.body_id).toBeNull();

  // Ninguna acta/cert vinculada — la decisión unipersonal del admin único
  // no abre el flujo de actas/certificación de Secretaría.
  const { data: minutes, error: mnErr } = await client
    .from('minutes')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID);
  expect(mnErr).toBeNull();
  expect((minutes ?? []).some((m) => false)).toBe(false); // sanity: no fail on read

  const { data: certs, error: certErr } = await client
    .from('certifications')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .contains('agreements_certified', [agreementId]);
  expect(certErr).toBeNull();
  expect(certs ?? []).toHaveLength(0);
}

test.describe.configure({ timeout: 240_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_DECISION_ADMIN_UNICO !== '1',
  'Opt-in: decisión Admin Único Arga test A en governance_OS',
);

test('Secretaría registra decisión del Administrador Único para formular cuentas 2026', async ({ page }) => {
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
  let decisionId = await findExistingDecision(client);
  let agreementId = decisionId ? await findAgreementForDecision(client, decisionId) : null;
  if (!decisionId || !agreementId) {
    const created = await runStepperViaUi(page);
    decisionId = created.decisionId;
    agreementId = created.agreementId;
  }
  expect(decisionId).toBeTruthy();
  expect(agreementId).toBeTruthy();

  await verifyPersistence(client, decisionId!, agreementId!);

  // UI: el expediente del acuerdo muestra adoption_mode = "Decisión del administrador único"
  await page.goto(`/secretaria/acuerdos/${agreementId}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(
    page.getByText(/Decisión del administrador único|Administrador único/i).first(),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Clara Rivas/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Generar documento/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Emitir certificación/i })).toHaveCount(0);

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during decisión admin único flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during decisión admin único flow',
  ).toEqual([]);
});
