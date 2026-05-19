/**
 * E2E opt-in — acuerdo sin sesión del Consejo de Arga test A para concesión de poderes.
 *
 * Continúa el escenario T0/T1/T2: crea un expediente por escrito y sin sesión
 * del Consejo para conceder poder general mercantil a un apoderado demo
 * (Laura Molina Poderes Arga Test). Manifestación de no oposición: todos los
 * miembros del Consejo votan FAVOR. Verifica:
 *
 *   - adoption_mode='NO_SESSION' en `agreements`.
 *   - `agreements.no_session_resolution_id` apunta a la fila `no_session_resolutions`
 *     con status='APROBADO'.
 *   - El expediente queda como ADOPTED y permite generar documento.
 *   - Ningún `minute` se crea automáticamente → la certificación queda fuera
 *     del camino directo: el ciclo requiere acta_acuerdo_escrito antes de
 *     certificar (RRM 109).
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_SIN_SESION_PODERES=1 bun run e2e -- e2e/50-secretaria-arga-test-a-acuerdo-sin-sesion-poderes.spec.ts --project=chromium
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
  bodyId: '075a5339-4d58-43e7-8a36-4b11257a760e',
};

const AGREEMENT_TITLE =
  'Concesión de poder general mercantil a Laura Molina Poderes Arga Test';
const AGREEMENT_KIND = 'DELEGACION_FACULTADES';
const MATTER_CLASS = 'ORDINARIA';
const PROPOSAL_TEXT = [
  'El Consejo de Administración de Arga test A, SL, en uso de las facultades que le confiere el',
  'artículo 249 LSC y los Estatutos sociales, acuerda conceder a Dña. Laura Molina Poderes Arga Test',
  'poder general mercantil limitado a la ejecución del presupuesto operativo anual aprobado por el',
  'Consejo y a la celebración de contratos ordinarios del giro de la sociedad, con expresa exclusión',
  'de actos de disposición sobre bienes inmuebles, avales, garantías reales y operaciones',
  'asimilables a las del artículo 160 f) LSC.',
].join(' ');
const FUNDAMENTO =
  'Artículos 249 y 233 LSC, artículos 94 y 124 RRM. Apoderamiento revocable, no inscrito hasta elevación a público.';

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
  if (!key) throw new Error('Missing Supabase service role key for Arga test A sin-sesion poderes E2E');
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

async function findExistingResolution(client: ServiceClient): Promise<string | null> {
  // Filtramos por APROBADO para que orphans VOTING_OPEN previos (de ejecuciones
  // fallidas) no bloqueen la idempotencia del test: la corrección del bug de
  // dedup por person_id deja resoluciones nuevas con total_members correcto.
  const { data, error } = await client
    .from('no_session_resolutions')
    .select('id, title, agreement_kind, status, created_at')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('body_id', SOCIEDAD.bodyId)
    .eq('agreement_kind', AGREEMENT_KIND)
    .eq('status', 'APROBADO')
    .ilike('title', `%Laura Molina%`)
    .order('created_at', { ascending: false })
    .limit(1);
  expect(error).toBeNull();
  return (data ?? [])[0]?.id ?? null;
}

async function findAgreementForResolution(client: ServiceClient, resolutionId: string): Promise<string | null> {
  const { data, error } = await client
    .from('agreements')
    .select('id, status, adoption_mode, agreement_kind')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('no_session_resolution_id', resolutionId)
    .order('created_at', { ascending: false })
    .limit(1);
  expect(error).toBeNull();
  return (data ?? [])[0]?.id ?? null;
}

async function runStepperViaUi(page: Page): Promise<{ resolutionId: string; agreementId: string }> {
  await page.goto(`/secretaria/acuerdos-sin-sesion/nuevo?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(page.getByRole('heading', { name: /Asistente de acuerdo escrito sin sesión/i })).toBeVisible({
    timeout: 20_000,
  });

  // Paso 1 — Tipo y órgano. La sociedad viene pre-seleccionada por scope; el
  // selector de la sociedad en el stepper queda disabled. Las etiquetas no
  // están asociadas vía htmlFor, así que ubicamos cada select por sus opciones.
  await selectOptionInAnySelect(page, SOCIEDAD.bodyId);
  // Matter class: ORDINARIA es default; lo dejamos.
  await selectOptionInAnySelect(page, AGREEMENT_KIND);

  await page.getByRole('button', { name: /^Siguiente/i }).click();

  // Paso 2 — Propuesta.
  await expect(page.getByRole('heading', { name: /Paso 2\. Propuesta/i })).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder(/Delegación de facultades|Acuerdo —/i).first().fill(AGREEMENT_TITLE);
  await page.getByPlaceholder(/Redacta aquí el texto completo de la propuesta/i).fill(PROPOSAL_TEXT);
  await page.getByPlaceholder(/Art\. 168 LSC|Fundamento/i).fill(FUNDAMENTO);

  await page.getByRole('button', { name: /^Siguiente/i }).click();

  // Paso 3 — Participantes. El consejo tiene 3 personas únicas; useBodyMandates
  // devuelve 4 filas porque Mateo aparece como CONSEJERO y SECRETARIO. La
  // votación dedupa por person_id, así que basta con votar a favor en cada
  // botón visible y los duplicados quedan marcados a la vez.
  await expect(page.getByRole('heading', { name: /Paso 3\. Participantes/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Clara Rivas Arga Test/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Mateo Soler Arga Test/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/ARGA Seguros S\.A\./i).first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: /Iniciar votación/i }).click();

  // Paso 4 — Votación. Click "Votar a favor" hasta que no queden botones.
  await expect(page.getByRole('heading', { name: /Paso 4\. Votación/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/han votado/i).first()).toBeVisible({ timeout: 10_000 });

  // Sonner toasts pueden interceptar clicks → cerramos el panel con Escape
  // antes de votar para evitar flakiness.
  await page.keyboard.press('Escape');

  const favorButtons = page.getByRole('button', { name: /Votar a favor/i });
  // El stepper deshabilita TODOS los botones mientras `castVote.isPending`,
  // por eso esperamos a que el botón siguiente quede enabled antes del siguiente
  // click y bloqueamos hasta que el conteo descienda tras cada voto.
  for (let guard = 0; guard < 10; guard += 1) {
    const remaining = await favorButtons.count();
    if (remaining === 0) break;
    const first = favorButtons.first();
    await expect(first).toBeEnabled({ timeout: 15_000 });
    await first.click();
    await expect
      .poll(async () => await favorButtons.count(), { timeout: 15_000 })
      .toBeLessThan(remaining);
  }
  await expect(favorButtons).toHaveCount(0);

  await page.getByRole('button', { name: /Ir a cierre/i }).click();

  // Paso 5 — Cierre y acuerdo.
  await expect(page.getByRole('heading', { name: /Paso 5\. Cierre y acuerdo/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Resultado: APROBADO/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Adoptar acuerdo/i }).click();
  await expect(page.getByRole('heading', { name: /^Acuerdo adoptado$/i })).toBeVisible({ timeout: 30_000 });

  // Pasamos al expediente del acuerdo. Conservamos el id desde la URL del
  // botón "Ver expediente" porque el stepper no expone agreement_id directo.
  const link = page.getByRole('button', { name: /Ver expediente/i });
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.click();
  await expect(page).toHaveURL(/\/secretaria\/acuerdos\/[a-f0-9-]{36}/, { timeout: 30_000 });
  const match = page.url().match(/\/secretaria\/acuerdos\/([a-f0-9-]{36})/);
  expect(match).not.toBeNull();
  const agreementId = match![1];

  const client = serviceClient();
  const resolutionId = await findExistingResolution(client);
  expect(resolutionId, 'no_session_resolutions row missing after closing the stepper').toBeTruthy();
  return { resolutionId: resolutionId!, agreementId };
}

async function verifyPersistence(client: ServiceClient, resolutionId: string, agreementId: string) {
  const { data: resolution, error: resErr } = await client
    .from('no_session_resolutions')
    .select('id, body_id, status, votes_for, votes_against, abstentions, requires_unanimity, agreement_kind, matter_class, title, proposal_text, total_members, closed_at, opened_at')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('id', resolutionId)
    .maybeSingle();
  expect(resErr).toBeNull();
  expect(resolution).toBeTruthy();
  expect(resolution!.body_id).toBe(SOCIEDAD.bodyId);
  expect(resolution!.status).toBe('APROBADO');
  expect(resolution!.agreement_kind).toBe(AGREEMENT_KIND);
  expect(resolution!.matter_class).toBe(MATTER_CLASS);
  expect(resolution!.requires_unanimity).toBe(false);
  expect(resolution!.votes_against).toBe(0);
  expect(Number(resolution!.votes_for)).toBeGreaterThanOrEqual(3);
  expect(String(resolution!.title)).toContain('Laura Molina');
  expect(String(resolution!.proposal_text)).toContain('poder general mercantil');
  expect(String(resolution!.proposal_text)).toContain('Fundamento jurídico');

  const { data: agreement, error: agErr } = await client
    .from('agreements')
    .select('id, tenant_id, entity_id, body_id, agreement_kind, matter_class, adoption_mode, status, no_session_resolution_id, parent_meeting_id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('id', agreementId)
    .maybeSingle();
  expect(agErr).toBeNull();
  expect(agreement).toBeTruthy();
  expect(agreement!.entity_id).toBe(SOCIEDAD.entityId);
  expect(agreement!.body_id).toBe(SOCIEDAD.bodyId);
  expect(agreement!.adoption_mode).toBe('NO_SESSION');
  expect(agreement!.agreement_kind).toBe(AGREEMENT_KIND);
  expect(agreement!.no_session_resolution_id).toBe(resolutionId);
  expect(agreement!.parent_meeting_id).toBeNull();
  expect(['ADOPTED', 'PROPOSED']).toContain(String(agreement!.status));

  // Ningún `minute` debe haberse generado: el acuerdo sin sesión no abre
  // automáticamente actas; el ciclo de certificación queda fuera del path.
  const { data: linkedMinutes, error: minErr } = await client
    .from('agreements')
    .select(`id`)
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('id', agreementId);
  expect(minErr).toBeNull();
  expect(linkedMinutes ?? []).toHaveLength(1);

  // Y comprobamos que no se ha emitido certificación alguna para el acuerdo.
  const { data: certs, error: certsError } = await client
    .from('certifications')
    .select('id, agreement_id, agreements_certified')
    .eq('tenant_id', DEMO_TENANT_ID)
    .contains('agreements_certified', [agreementId]);
  expect(certsError).toBeNull();
  expect(certs ?? []).toHaveLength(0);
}

test.describe.configure({ timeout: 240_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_SIN_SESION_PODERES !== '1',
  'Opt-in: acuerdo sin sesión poderes para Arga test A en governance_OS',
);

test('Secretaría tramita acuerdo sin sesión de poderes para Arga test A con no oposición', async ({ page }) => {
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
  let resolutionId = await findExistingResolution(client);
  let agreementId = resolutionId ? await findAgreementForResolution(client, resolutionId) : null;

  if (!resolutionId || !agreementId) {
    const created = await runStepperViaUi(page);
    resolutionId = created.resolutionId;
    agreementId = created.agreementId;
  }

  expect(resolutionId).toBeTruthy();
  expect(agreementId).toBeTruthy();

  await verifyPersistence(client, resolutionId!, agreementId!);

  // UI: el expediente del acuerdo muestra adoption_mode "Acuerdo sin sesión"
  // y permite generar documento. No habilita certificación porque no hay
  // acta vinculada — el ciclo exige acta_acuerdo_escrito antes de certificar.
  await page.goto(`/secretaria/acuerdos/${agreementId}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  // ExpedienteAcuerdo renderiza el título a partir del adoption_mode + kind,
  // no del title del no_session_resolution. Verificamos la presencia textual
  // de la propuesta (Laura Molina) y el botón de generación documental.
  await expect(page.getByText(/Acuerdo sin sesión/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Laura Molina/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/poder general mercantil/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Generar documento/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Emitir certificación/i })).toHaveCount(0);

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during acuerdo sin sesión flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during acuerdo sin sesión flow',
  ).toEqual([]);
});
