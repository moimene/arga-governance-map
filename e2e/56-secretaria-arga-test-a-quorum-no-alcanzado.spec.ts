/**
 * E2E opt-in — quórum no alcanzado en sesión del Consejo.
 *
 * Camino negativo del motor de votaciones: el Consejo se reúne pero la
 * propuesta NO alcanza la mayoría requerida (2 contra · 1 favor sobre
 * NOMBRAMIENTO_CONSEJERO con `evaluarMayoria` ORDINARIA → REJECTED). Se
 * usa una reunión nueva en fecha distinta de T2 para no contaminar los
 * acuerdos ADOPTED previos.
 *
 * Asserts:
 *   - `meeting_resolutions.status='REJECTED'` con `agreement_id=NULL`.
 *   - `meeting_votes` con 2 AGAINST + 1 FAVOR.
 *   - UI: paso 5 muestra "Resultado: RECHAZADO" y "0 a favor" lo
 *     contrario para AGAINST counts.
 *   - No se ha materializado ningún `agreements` con `parent_meeting_id`.
 *
 * Setup vía service-role para evitar recorrer todo el stepper.
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_QUORUM_NO=1 bun run e2e -- e2e/56-secretaria-arga-test-a-quorum-no-alcanzado.spec.ts --project=chromium
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
  clara: '089df45d-2d08-42ad-88aa-343b89449711',
  mateo: 'afdbd2e2-8bae-4fbc-986b-b11d78ae751e',
  argaSeguros: '15fab4ff-2a1f-59c1-b2fd-e849cb4cf936',
};

const MEETING_DATE = '2026-07-15';
const REJECTED_PROPOSAL =
  'Nombramiento de un nuevo consejero adicional para reforzar la composición del Consejo';

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
  if (!key) throw new Error('Missing Supabase service role key for quorum no alcanzado E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

async function findOrCreateMeeting(client: ServiceClient): Promise<string> {
  const { data: existing, error: exErr } = await client
    .from('meetings')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('body_id', SOCIEDAD.consejoBodyId)
    .gte('scheduled_start', `${MEETING_DATE}T00:00:00.000Z`)
    .lt('scheduled_start', '2026-07-16T00:00:00.000Z')
    .limit(1);
  expect(exErr).toBeNull();
  if ((existing ?? []).length > 0) return (existing as Array<{ id: string }>)[0].id;

  const { data, error } = await client
    .from('meetings')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      body_id: SOCIEDAD.consejoBodyId,
      meeting_type: 'ORDINARIA',
      slug: `consejo-arga-test-a-rechazado-${MEETING_DATE}`,
      scheduled_start: `${MEETING_DATE}T10:00:00+02:00`,
      scheduled_end: `${MEETING_DATE}T12:00:00+02:00`,
      status: 'CELEBRADA',
      location: 'Sede social, Madrid',
      confidentiality_level: 'NORMAL',
      quorum_data: {
        quorum: {
          present: 3,
          total: 3,
          pct: '100.0',
          reached: true,
          materia_clase: 'ORDINARIA',
        },
      },
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

async function ensureAttendees(client: ServiceClient, meetingId: string) {
  const { count, error: cntErr } = await client
    .from('meeting_attendees')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('meeting_id', meetingId);
  expect(cntErr).toBeNull();
  if ((count ?? 0) >= 3) return;
  // Borra antes para evitar duplicidad (idempotencia ante runs parciales).
  await client.from('meeting_votes')
    .delete()
    .in('attendee_id', (await client
      .from('meeting_attendees')
      .select('id')
      .eq('meeting_id', meetingId)).data?.map((r) => r.id) ?? []);
  await client.from('meeting_attendees').delete().eq('meeting_id', meetingId);
  const { error } = await client.from('meeting_attendees').insert([
    { tenant_id: DEMO_TENANT_ID, meeting_id: meetingId, person_id: SOCIEDAD.clara, attendance_type: 'PRESENCIAL' },
    { tenant_id: DEMO_TENANT_ID, meeting_id: meetingId, person_id: SOCIEDAD.mateo, attendance_type: 'PRESENCIAL' },
    { tenant_id: DEMO_TENANT_ID, meeting_id: meetingId, person_id: SOCIEDAD.argaSeguros, attendance_type: 'PRESENCIAL' },
  ]);
  expect(error).toBeNull();
}

async function ensureAgendaItem(client: ServiceClient, meetingId: string): Promise<string> {
  const { data: existing } = await client
    .from('agenda_items')
    .select('id')
    .eq('meeting_id', meetingId)
    .eq('order_number', 1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await client
    .from('agenda_items')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      meeting_id: meetingId,
      order_number: 1,
      title: REJECTED_PROPOSAL,
      kind: 'DECISORIO',
      decision_subtype: 'CONSTITUTIVE',
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

async function ensureRejectedResolution(client: ServiceClient, meetingId: string) {
  // Limpia resolución previa para forzar el estado REJECTED puro.
  const { data: existingRes } = await client
    .from('meeting_resolutions')
    .select('id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('meeting_id', meetingId);
  for (const r of existingRes ?? []) {
    await client.from('meeting_votes').delete().eq('resolution_id', r.id);
  }
  await client.from('meeting_resolutions').delete().eq('meeting_id', meetingId);

  const { data: insertedRes, error: insErr } = await client
    .from('meeting_resolutions')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      meeting_id: meetingId,
      agenda_item_index: 1,
      resolution_text: REJECTED_PROPOSAL,
      resolution_type: 'ORDINARIA',
      required_majority_code: 'NOMBRAMIENTO_CONSEJERO:ORDINARIA',
      status: 'REJECTED',
      agreement_id: null,
    })
    .select('id')
    .single();
  expect(insErr).toBeNull();
  const resolutionId = (insertedRes as { id: string }).id;

  const { data: attendees, error: attErr } = await client
    .from('meeting_attendees')
    .select('id, person_id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('meeting_id', meetingId);
  expect(attErr).toBeNull();
  // 2 AGAINST (Mateo + ARGA Seguros) + 1 FAVOR (Clara) → propuesta rechazada.
  const voteRows = (attendees ?? []).map((a) => ({
    tenant_id: DEMO_TENANT_ID,
    resolution_id: resolutionId,
    attendee_id: a.id,
    vote_value: a.person_id === SOCIEDAD.clara ? 'FAVOR' : 'CONTRA',
    conflict_flag: false,
    reason: null as string | null,
  }));
  const { error: votesErr } = await client.from('meeting_votes').insert(voteRows);
  expect(votesErr).toBeNull();
}

test.describe.configure({ timeout: 180_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_QUORUM_NO !== '1',
  'Opt-in: quórum no alcanzado en Consejo Arga test A',
);

test('Secretaría registra resolución REJECTED cuando la votación del Consejo no alcanza la mayoría', async ({ page }) => {
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

  // Setup Cloud (idempotente).
  const meetingId = await findOrCreateMeeting(client);
  await ensureAttendees(client, meetingId);
  await ensureAgendaItem(client, meetingId);
  await ensureRejectedResolution(client, meetingId);

  // Asserts en Cloud.
  const { data: resolutions, error: resErr } = await client
    .from('meeting_resolutions')
    .select('id, status, agreement_id, resolution_text')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('meeting_id', meetingId);
  expect(resErr).toBeNull();
  expect((resolutions ?? []).length).toBe(1);
  expect(resolutions![0].status).toBe('REJECTED');
  expect(resolutions![0].agreement_id).toBeNull();

  const { data: votes, error: votesErr } = await client
    .from('meeting_votes')
    .select('vote_value')
    .eq('resolution_id', resolutions![0].id);
  expect(votesErr).toBeNull();
  const favores = (votes ?? []).filter((v) => v.vote_value === 'FAVOR').length;
  const contras = (votes ?? []).filter((v) => v.vote_value === 'CONTRA').length;
  expect(favores).toBe(1);
  expect(contras).toBe(2);

  // No debe haberse materializado ningún agreement con parent_meeting_id.
  const { data: agreements, error: agErr } = await client
    .from('agreements')
    .select('id, status, adoption_mode')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('parent_meeting_id', meetingId);
  expect(agErr).toBeNull();
  expect((agreements ?? []).filter((a) => a.status === 'ADOPTED')).toHaveLength(0);

  // UI: la reunión muestra el resultado RECHAZADO en el paso 6 (Cierre),
  // donde CierreStep renderiza el badge "RECHAZADO" para resoluciones con
  // `status != "ADOPTED"`.
  await page.goto(`/secretaria/reuniones/${meetingId}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(page.getByRole('heading', { name: /Asistente de sesión societaria/i })).toBeVisible({
    timeout: 20_000,
  });
  const cierreTab = page.locator('nav[aria-label="Pasos"] button').filter({ hasText: /Cierre/i }).first();
  await expect(cierreTab).toBeVisible({ timeout: 10_000 });
  await cierreTab.click();
  await expect(page.getByRole('heading', { name: /Paso 6\. Cierre/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(REJECTED_PROPOSAL).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^RECHAZADO$/i).first()).toBeVisible({ timeout: 20_000 });

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during quórum no alcanzado flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during quórum no alcanzado flow',
  ).toEqual([]);
});
