/**
 * E2E opt-in — libros societarios de Arga test A, SL.
 *
 * Verifica las vistas operativas del libro de socios y del registro de actas
 * tras todos los pasos previos (T0-T5):
 *
 *   - LibroSocios: cap table actual con 4 socios al 25%, clase A (ordinaria)
 *     y clase B (dividendo preferente ARGA con coef. económico 1.25).
 *   - ActasLista: muestra el acta del Consejo (T2) y de la Junta universal (T4)
 *     en estado borrador (sin firmar) y bloqueando la certificación.
 *   - El acta sin firmar continúa renderizando el botón "Emitir certificación"
 *     deshabilitado con la razón RRM 108-109 al entrar a ActaDetalle.
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_LIBROS=1 bun run e2e -- e2e/53-secretaria-arga-test-a-libros.spec.ts --project=chromium
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
  legalName: 'Arga test A, SL',
  juntaBodyId: 'd3618c8c-cde7-420a-be0d-23137acbdd34',
  consejoBodyId: '075a5339-4d58-43e7-8a36-4b11257a760e',
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
  if (!key) throw new Error('Missing Supabase service role key for libros E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

test.describe.configure({ timeout: 180_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_LIBROS !== '1',
  'Opt-in: libros societarios Arga test A en governance_OS',
);

test('Secretaría muestra libro de socios con clases A/B y registro de actas', async ({ page }) => {
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

  // ── Comprobaciones Cloud (DB es la fuente de verdad).
  const { data: capTable, error: capErr } = await client
    .from('capital_holdings')
    .select('porcentaje_capital, voting_rights, is_treasury, holder:holder_person_id(full_name, person_type), share_class:share_class_id(class_code, name, economic_rights_coeff, restrictions)')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('entity_id', SOCIEDAD.entityId)
    .is('effective_to', null);
  expect(capErr).toBeNull();
  expect(capTable ?? []).toHaveLength(4);
  const classCodes = new Set((capTable ?? []).map((h) => (h.share_class as { class_code?: string })?.class_code));
  expect(classCodes).toContain('A');
  expect(classCodes).toContain('B');
  const classB = (capTable ?? []).find((h) => (h.share_class as { class_code?: string })?.class_code === 'B');
  const classBData = classB?.share_class as { economic_rights_coeff?: number | string; restrictions?: Record<string, unknown> } | undefined;
  expect(Number(classBData?.economic_rights_coeff)).toBeCloseTo(1.25, 2);
  expect(classBData?.restrictions).toMatchObject({ preferred_dividend: true });
  const sumCapital = (capTable ?? []).reduce((s, h) => s + Number(h.porcentaje_capital ?? 0), 0);
  expect(Math.round(sumCapital)).toBe(100);

  // El registro de actas (libro de actas operativo) tras T2/T4 debe incluir al menos
  // un acta del Consejo y otra de la Junta universal (ambas en BORRADOR).
  // Idempotent reset: A1 (e2e/55) firma la acta del Consejo. En runs
  // subsiguientes T6 ve acta firmada del run previo y falla. Reset a
  // BORRADOR antes de las assertions.
  const { error: resetActasErr } = await client
    .from('minutes')
    .update({
      signed_at: null,
      signed_by_secretary_id: null,
      signed_by_president_id: null,
      is_locked: false,
    })
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('entity_id', SOCIEDAD.entityId)
    .in('body_id', [SOCIEDAD.consejoBodyId, SOCIEDAD.juntaBodyId])
    .not('signed_at', 'is', null);
  expect(resetActasErr, 'reset actas to BORRADOR for T6 idempotency').toBeNull();

  const { data: actas, error: actaErr } = await client
    .from('minutes')
    .select('id, meeting_id, body_id, entity_id, signed_at')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('entity_id', SOCIEDAD.entityId)
    .order('created_at', { ascending: false });
  expect(actaErr).toBeNull();
  const actaConsejo = (actas ?? []).find((a) => a.body_id === SOCIEDAD.consejoBodyId);
  const actaJunta = (actas ?? []).find((a) => a.body_id === SOCIEDAD.juntaBodyId);
  expect(actaConsejo, 'Acta del Consejo (T2) no encontrada').toBeTruthy();
  expect(actaJunta, 'Acta de la Junta universal (T4) no encontrada').toBeTruthy();
  expect(actaConsejo!.signed_at).toBeNull();
  expect(actaJunta!.signed_at).toBeNull();

  // Libros obligatorios — la migración 20260519081000 auto-siembra los
  // libros LSC al crear una sociedad. Para una SL esperamos al menos
  // LIBRO_ACTAS + LIBRO_REGISTRO_SOCIOS, OPEN, con deadline 30/04 del año
  // siguiente.
  const currentYear = new Date().getFullYear();
  const { data: mandatoryBooks, error: booksErr } = await client
    .from('mandatory_books')
    .select('book_kind, period, status, legalization_status, legalization_deadline')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('entity_id', SOCIEDAD.entityId)
    .eq('period', currentYear);
  expect(booksErr).toBeNull();
  const kinds = new Set((mandatoryBooks ?? []).map((b) => b.book_kind));
  expect(kinds).toContain('LIBRO_ACTAS');
  expect(kinds).toContain('LIBRO_REGISTRO_SOCIOS');
  for (const book of mandatoryBooks ?? []) {
    expect(book.status).toBe('OPEN');
    expect(book.legalization_status).toBe('PENDIENTE');
    expect(String(book.legalization_deadline ?? '')).toMatch(/^\d{4}-04-30$/);
  }

  // ── UI: libro de socios.
  await page.goto(`/secretaria/libro-socios?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(page.getByRole('heading', { name: /Libro de socios de Arga test A/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('heading', { name: /^Cap table actual$/i })).toBeVisible({ timeout: 20_000 });
  for (const name of ['Clara Rivas Arga Test', 'Mateo Soler Arga Test', 'Nerea Vidal Arga Test', 'ARGA Seguros S.A.']) {
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });
  }
  await expect(page.getByText(/Participaciones clase A ordinarias/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/Participaciones clase B - dividendo preferente ARGA/i).first(),
  ).toBeVisible({ timeout: 20_000 });
  // Conteo de "4 socios vigentes" en el encabezado del cap table.
  await expect(page.getByText(/4 socios vigentes/i).first()).toBeVisible({ timeout: 10_000 });

  // ── UI: listado de actas.
  await page.goto(`/secretaria/actas?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(page.getByRole('heading', { name: /Actas/i }).first()).toBeVisible({ timeout: 20_000 });
  // Las actas deben listarse; verificamos al menos 2 filas con el body name.
  await expect(page.getByText(/Consejo de Administraci[oó]n/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Junta General/i).first()).toBeVisible({ timeout: 20_000 });

  // ── UI: una de las actas (Junta universal) en detalle, certificación bloqueada.
  await page.goto(`/secretaria/actas/${actaJunta!.id}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  const emitir = page.getByRole('button', { name: /Emitir certificación/i });
  await expect(emitir).toBeVisible({ timeout: 20_000 });
  await expect(emitir).toBeDisabled();
  await expect(
    page.getByText(/acta debe estar aprobada o firmada.*RRM arts\. 108-109/i).first(),
  ).toBeVisible({ timeout: 10_000 });

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during libros flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during libros flow',
  ).toEqual([]);
});
