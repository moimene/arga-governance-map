/**
 * E2E opt-in — conflicto de interés activo excluye al votante.
 *
 * Camino negativo: existe un conflict_of_interest ABIERTO para Mateo
 * Soler enlazado al meeting del Consejo de A2 (fecha 2026-07-15). El
 * registro persistido en `meeting_votes` para Mateo lleva
 * `conflict_flag=true` con motivo explícito. UI muestra la pill
 * "Conflicto de interés" en el paso 5.
 *
 * Para evitar contaminar otros runs de la suite Ruflo, el test deja el
 * conflict en `status='CERRADO'` al final (vía `try/finally`).
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_CONFLICTO=1 bun run e2e -- e2e/57-secretaria-arga-test-a-conflicto-interes.spec.ts --project=chromium
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
  consejoBodyId: '075a5339-4d58-43e7-8a36-4b11257a760e',
  mateo: 'afdbd2e2-8bae-4fbc-986b-b11d78ae751e',
};

const A2_MEETING_DATE = '2026-07-15';
const CONFLICT_REASON =
  'Operación vinculada con sociedad participada por el consejero — RLS art. 229 LSC';

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
  if (!key) throw new Error('Missing Supabase service role key for conflicto interés E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

async function findA2Meeting(client: ServiceClient): Promise<string> {
  const { data, error } = await client
    .from('meetings')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('body_id', SOCIEDAD.consejoBodyId)
    .gte('scheduled_start', `${A2_MEETING_DATE}T00:00:00.000Z`)
    .lt('scheduled_start', '2026-07-16T00:00:00.000Z')
    .limit(1);
  expect(error).toBeNull();
  const id = (data ?? [])[0]?.id;
  expect(id, 'No existe el meeting A2 — corre e2e/56 antes').toBeTruthy();
  return id as string;
}

async function markMateoConflictVote(client: ServiceClient, meetingId: string) {
  const { data: resolutions, error: resErr } = await client
    .from('meeting_resolutions')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('meeting_id', meetingId);
  expect(resErr).toBeNull();
  const resolutionIds = (resolutions ?? []).map((r) => r.id);
  expect(resolutionIds.length).toBeGreaterThan(0);

  const { data: attendees } = await client
    .from('meeting_attendees')
    .select('id')
    .eq('meeting_id', meetingId)
    .eq('person_id', SOCIEDAD.mateo)
    .limit(1);
  const mateoAttendeeId = (attendees ?? [])[0]?.id;
  expect(mateoAttendeeId).toBeTruthy();

  const { error: upErr } = await client
    .from('meeting_votes')
    .update({ conflict_flag: true, reason: CONFLICT_REASON })
    .eq('attendee_id', mateoAttendeeId)
    .in('resolution_id', resolutionIds);
  expect(upErr).toBeNull();
}

async function openConflict(client: ServiceClient, meetingId: string): Promise<string> {
  // La constraint canónica permite status ('Declarado', 'Pendiente', 'Resuelto')
  // y conflict_type ('Permanente', 'Situacional'). El hook `useActiveConflicts`
  // filtra ahora por no-Resuelto.
  const { data: existing } = await client
    .from('conflicts_of_interest')
    .select('id, status')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('person_id', SOCIEDAD.mateo)
    .eq('related_meeting_id', meetingId)
    .limit(1);
  if ((existing ?? []).length > 0) {
    const row = existing![0];
    if (row.status === 'Resuelto') {
      await client
        .from('conflicts_of_interest')
        .update({ status: 'Pendiente' })
        .eq('id', row.id);
    }
    return row.id as string;
  }
  const { data, error } = await client
    .from('conflicts_of_interest')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      code: 'COI-MATEO-2026-07',
      person_id: SOCIEDAD.mateo,
      conflict_type: 'Situacional',
      description: CONFLICT_REASON,
      status: 'Pendiente',
      related_meeting_id: meetingId,
      declared_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

async function closeConflict(client: ServiceClient, conflictId: string) {
  await client
    .from('conflicts_of_interest')
    .update({ status: 'Resuelto' })
    .eq('id', conflictId);
}

test.describe.configure({ timeout: 180_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_CONFLICTO !== '1',
  'Opt-in: conflicto de interés Arga test A',
);

test('Secretaría marca el voto de Mateo Soler con conflict_flag y la UI muestra la pill', async ({ page }) => {
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
  const meetingId = await findA2Meeting(client);
  await markMateoConflictVote(client, meetingId);
  const conflictId = await openConflict(client, meetingId);

  try {
    // Asserts Cloud.
    const { data: votes, error: votesErr } = await client
      .from('meeting_votes')
      .select('vote_value, conflict_flag, reason, attendee_id')
      .eq('tenant_id', DEMO_TENANT_ID);
    expect(votesErr).toBeNull();
    // Localiza el voto de Mateo (no podemos consultar attendee_id directamente
    // sin join, así que rederivamos).
    const { data: mateoAttendee } = await client
      .from('meeting_attendees')
      .select('id')
      .eq('meeting_id', meetingId)
      .eq('person_id', SOCIEDAD.mateo)
      .limit(1);
    const mateoAttendeeId = (mateoAttendee ?? [])[0]?.id;
    const mateoVote = (votes ?? []).find((v) => v.attendee_id === mateoAttendeeId);
    expect(mateoVote?.conflict_flag).toBe(true);
    expect(String(mateoVote?.reason ?? '')).toContain('Operación vinculada');

    const { data: conflict, error: confErr } = await client
      .from('conflicts_of_interest')
      .select('status, related_meeting_id, person_id, conflict_type, description')
      .eq('id', conflictId)
      .maybeSingle();
    expect(confErr).toBeNull();
    expect(['Declarado', 'Pendiente']).toContain(String(conflict?.status ?? ''));
    expect(conflict?.related_meeting_id).toBe(meetingId);
    expect(conflict?.person_id).toBe(SOCIEDAD.mateo);

    // UI: el stepper de la reunión debe mostrar a Mateo con la pill
    // "Conflicto de interés" marcada en el paso 5.
    await page.goto(`/secretaria/reuniones/${meetingId}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
    await expect(page.getByRole('heading', { name: /Asistente de sesión societaria/i })).toBeVisible({
      timeout: 20_000,
    });
    const votacionesTab = page.locator('nav[aria-label="Pasos"] button').filter({ hasText: /Votaciones/i }).first();
    await votacionesTab.click();
    await expect(page.getByRole('heading', { name: /Paso 5\. Votaciones/i })).toBeVisible({ timeout: 20_000 });

    // La tabla de votantes muestra a Mateo con la celda "Conflicto de interés"
    // como checkbox marcado (aria-checked=true o checked attr).
    const mateoRow = page.getByRole('row').filter({ hasText: /Mateo Soler Arga Test/i }).first();
    await expect(mateoRow).toBeVisible({ timeout: 20_000 });
    const conflictCheckbox = mateoRow.locator('input[type="checkbox"]').first();
    await expect(conflictCheckbox).toBeChecked({ timeout: 10_000 });
  } finally {
    await closeConflict(client, conflictId);
  }

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during conflicto interés flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during conflicto interés flow',
  ).toEqual([]);
});
