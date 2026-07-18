/**
 * E2E opt-in — reunión real del Consejo de Arga test A, SL.
 *
 * Continúa e2e/47: reutiliza la convocatoria de Consejo ya emitida para
 * celebrar sesión, registrar asistencia/quórum, aprobar dos acuerdos, generar
 * acta en borrador y verificar que la certificación queda bloqueada mientras
 * el acta no está aprobada o firmada.
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_REUNION_CONSEJO=1 bun run e2e -- e2e/49-secretaria-arga-test-a-reunion-consejo.spec.ts --project=chromium
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
  convocatoriaId: '0dcc11f0-b32d-46d6-a212-a21e3e3b9346',
  date: '2026-06-07',
};

const AGENDA = {
  ceoTitle: 'Nombramiento de consejera delegada',
  ceoMateria: 'DELEGACION_FACULTADES',
  budgetTitle: 'Aprobación del presupuesto anual 2026',
  budgetMateria: 'APROBACION_PRESUPUESTO',
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
  if (!key) throw new Error('Missing Supabase service role key for Arga test A reunion E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function goStep(page: Page, label: string | RegExp, heading: string | RegExp) {
  await page.getByRole('button', { name: label }).first().click();
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 20_000 });
}

async function clickIfVisibleAndEnabled(page: Page, buttonName: string | RegExp) {
  const button = page.getByRole('button', { name: buttonName }).first();
  if ((await button.isVisible().catch(() => false)) && (await button.isEnabled().catch(() => false))) {
    await button.scrollIntoViewIfNeeded();
    await button.click();
    return true;
  }
  return false;
}

async function ensureAllVisibleVotesFavor(page: Page) {
  const pointButtons = page.getByRole('button', { name: /Punto \d+/ });
  const pointCount = Math.max(await pointButtons.count(), 1);

  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    if (pointIndex > 0) await pointButtons.nth(pointIndex).click();
    const voteSelects = page.locator('tbody select');
    await expect(voteSelects.first()).toBeVisible({ timeout: 20_000 });
    const voteCount = await voteSelects.count();
    for (let index = 0; index < voteCount; index += 1) {
      await voteSelects.nth(index).selectOption('FAVOR');
    }
  }
}

async function verifyConvocatoria(client: ServiceClient) {
  const { data, error } = await client
    .from('convocatorias')
    .select('id, tenant_id, body_id, estado, fecha_1, agenda_items, governing_bodies(entity_id, body_type, entities(legal_name, tipo_social))')
    .eq('id', SOCIEDAD.convocatoriaId)
    .maybeSingle();
  expect(error).toBeNull();
  expect(data, `Missing convocatoria ${SOCIEDAD.convocatoriaId}; run e2e/47 first`).toBeTruthy();
  expect(data!.tenant_id).toBe(DEMO_TENANT_ID);
  expect(data!.body_id).toBe(SOCIEDAD.bodyId);
  expect(data!.estado).toBe('EMITIDA');
  expect(String(data!.fecha_1)).toContain(SOCIEDAD.date);
  expect(data!.governing_bodies?.entity_id).toBe(SOCIEDAD.entityId);
  expect(data!.governing_bodies?.entities?.legal_name).toBe(SOCIEDAD.legalName);

  const items = Array.isArray(data!.agenda_items) ? data!.agenda_items as Array<Record<string, unknown>> : [];
  expect(items.some((item) => item.titulo === AGENDA.ceoTitle && item.materia === AGENDA.ceoMateria)).toBe(true);
  expect(items.some((item) => item.titulo === AGENDA.budgetTitle && item.materia === AGENDA.budgetMateria)).toBe(true);
}

async function findMeetingForConvocatoria(client: ServiceClient): Promise<string | null> {
  const { data, error } = await client
    .from('meetings')
    .select('id, body_id, scheduled_start, quorum_data, created_at')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('body_id', SOCIEDAD.bodyId)
    .gte('scheduled_start', `${SOCIEDAD.date}T00:00:00.000Z`)
    .lt('scheduled_start', '2026-06-08T00:00:00.000Z')
    .order('created_at', { ascending: false });
  expect(error).toBeNull();

  const linked = (data ?? []).find((meeting) => {
    const links = asRecord(asRecord(meeting.quorum_data).source_links);
    const ids = Array.isArray(links.convocatoria_ids) ? links.convocatoria_ids : [];
    return links.convocatoria_id === SOCIEDAD.convocatoriaId || ids.includes(SOCIEDAD.convocatoriaId);
  });
  return linked?.id ?? data?.[0]?.id ?? null;
}

async function getMeetingProgress(client: ServiceClient, meetingId: string) {
  const [meetingRes, attendeesRes, agendaRes, resolutionsRes, minuteRes] = await Promise.all([
    client.from('meetings').select('id, status, body_id, scheduled_start, quorum_data').eq('id', meetingId).maybeSingle(),
    client.from('meeting_attendees').select('id, person_id, attendance_type').eq('meeting_id', meetingId),
    client.from('agenda_items').select('id, order_number, title, kind, decision_subtype').eq('meeting_id', meetingId),
    client.from('meeting_resolutions').select('id, agenda_item_index, resolution_text, status, agreement_id, required_majority_code').eq('meeting_id', meetingId),
    client.from('minutes').select('id, meeting_id, body_id, entity_id, signed_at, is_locked, content, canonical_minutes_hash').eq('meeting_id', meetingId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const [label, res] of Object.entries({ meetingRes, attendeesRes, agendaRes, resolutionsRes, minuteRes })) {
    expect((res as { error: unknown }).error, label).toBeNull();
  }
  return {
    meeting: meetingRes.data,
    attendees: attendeesRes.data ?? [],
    agenda: agendaRes.data ?? [],
    resolutions: resolutionsRes.data ?? [],
    minute: minuteRes.data,
  };
}

async function openOrCreateMeetingFromConvocatoria(page: Page, client: ServiceClient): Promise<string> {
  await page.goto(`/secretaria/convocatorias/${SOCIEDAD.convocatoriaId}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(page.getByText(AGENDA.ceoTitle)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(AGENDA.budgetTitle)).toBeVisible({ timeout: 20_000 });
  const action = page.getByRole('button', { name: /Programar reunión|Abrir reunión/ }).first();
  await expect(action).toBeEnabled({ timeout: 30_000 });
  await action.click();
  await expect(page).toHaveURL(/\/secretaria\/reuniones\/[a-f0-9-]{36}/, { timeout: 30_000 });
  const match = page.url().match(/\/secretaria\/reuniones\/([a-f0-9-]{36})/);
  expect(match).not.toBeNull();
  const meetingId = match![1];
  expect(await findMeetingForConvocatoria(client)).toBe(meetingId);
  return meetingId;
}

async function ensureMeetingWorkflow(page: Page, client: ServiceClient, meetingId: string): Promise<string> {
  await page.goto(`/secretaria/reuniones/${meetingId}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
    timeout: 20_000,
  });

  const initial = await getMeetingProgress(client, meetingId);
  if (initial.minute?.id) {
    // Idempotent reset: si la acta quedó firmada por un run posterior
    // (e.g. e2e/55 A1) las assertions de T2 que exigen acta en BORRADOR
    // fallarían en runs subsiguientes. Reset a estado borrador.
    if ((initial.minute as { signed_at?: string | null }).signed_at) {
      // Borrar certificaciones que A1 (e2e/55) emitió en runs previos.
      // T2 asserta que el minuteId no tiene certifications cuando el acta
      // está en BORRADOR; sin este DELETE la assertion final falla aunque
      // resetear signed_at sí desbloquea el bloqueo de UI.
      const { error: delCertsError } = await client
        .from('certifications')
        .delete()
        .eq('minute_id', initial.minute.id as string);
      expect(delCertsError, 'delete previous certifications for T2 idempotency').toBeNull();

      const { error: resetError } = await client
        .from('minutes')
        .update({
          signed_at: null,
          signed_by_secretary_id: null,
          signed_by_president_id: null,
          is_locked: false,
        })
        .eq('id', initial.minute.id as string);
      expect(resetError, 'reset acta to BORRADOR for T2 idempotency').toBeNull();
    }
    return initial.minute.id as string;
  }

  await clickIfVisibleAndEnabled(page, /Declarar apertura de la sesión/i);
  // ITEM-146: al declarar apertura el estado pasa a EN_CURSO (sesión abierta),
  // no a CELEBRADA — CELEBRADA se alcanza al cerrar (generar acta) en el Paso 6.
  await expect
    .poll(async () => {
      const progress = await getMeetingProgress(client, meetingId);
      return progress.meeting?.status;
    }, { timeout: 30_000 })
    .toBe('EN_CURSO');
  await expect(page.getByText(/Sesión declarada abierta|En curso|Estado actual/i).first()).toBeVisible({ timeout: 20_000 });

  await goStep(page, /Asistentes/, /Paso 2\. Asistentes/);
  await expect(page.getByText(/Clara Rivas Arga Test/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Mateo Soler Arga Test/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/ARGA Seguros S\.A\./i)).toBeVisible({ timeout: 20_000 });
  const saveAttendance = page.getByRole('button', { name: 'Guardar asistencia' });
  await expect(saveAttendance).toBeEnabled({ timeout: 20_000 });
  await saveAttendance.click();
  await expect(page.getByText(/Asistencia de \d+ miembros guardada/i).first()).toBeVisible({ timeout: 20_000 });

  await goStep(page, /Quórum/, /Paso 3\. Quórum/);
  await expect(page.getByText(/No hay lista de asistentes guardada/i)).toHaveCount(0);
  await expect(page.getByText(/Evaluación Motor V2|QUÓRUM ALCANZADO/i).first()).toBeVisible({ timeout: 20_000 });
  await clickIfVisibleAndEnabled(page, /Confirmar quórum y continuar/i);
  await expect
    .poll(async () => {
      const progress = await getMeetingProgress(client, meetingId);
      return asRecord(asRecord(progress.meeting?.quorum_data).quorum).reached === true;
    }, { timeout: 30_000 })
    .toBe(true);

  await goStep(page, /Agenda y debate/, /Paso 4\. Agenda y debate/);
  const agendaTitleInputs = page.locator(
    'main input[placeholder="p.ej. Aprobación de cuentas anuales ejercicio 2025"]',
  );
  await expect(agendaTitleInputs.nth(0)).toHaveValue(AGENDA.ceoTitle, { timeout: 20_000 });
  await expect(agendaTitleInputs.nth(1)).toHaveValue(AGENDA.budgetTitle, { timeout: 20_000 });
  await expect(page.locator('main select').nth(1)).toHaveValue(AGENDA.ceoMateria, { timeout: 20_000 });
  await expect(page.locator('main select').nth(4)).toHaveValue(AGENDA.budgetMateria, { timeout: 20_000 });
  const saveDebates = page.getByRole('button', { name: 'Guardar debates' });
  await expect(saveDebates).toBeEnabled({ timeout: 20_000 });
  await saveDebates.click();
  await expect(page.getByText(/Agenda, debate y constancias guardados|Agenda.*guardad/i).first()).toBeVisible({
    timeout: 30_000,
  });

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
    timeout: 20_000,
  });
  await goStep(page, /Votaciones/, /Paso 5\. Votaciones/);
  await expect(page.getByText('Evaluación de adopción por punto')).toBeVisible({ timeout: 20_000 });
  const unanimous = page.getByRole('button', { name: /Aprobar todo por unanimidad/i }).first();
  await expect(unanimous).toBeEnabled({ timeout: 20_000 });
  await unanimous.click();

  const saveResolutionButton = page
    .getByRole('button', {
      name: /Registrar resolución y crear expediente Acuerdo 360|Recalcular resolución y crear expediente Acuerdo 360/,
    })
    .first();
  await expect(saveResolutionButton).toBeEnabled({ timeout: 30_000 });
  await saveResolutionButton.click();
  await expect(
    page.getByText(/resolución\(es\) registrada\(s\)|resoluciones ya están registradas/i).first(),
  ).toBeVisible({ timeout: 45_000 });

  await goStep(page, /Cierre/, /Paso 6\. Cierre/);
  const existingMinuteButton = page.getByRole('button', { name: 'Ver acta existente' });
  if (await existingMinuteButton.isVisible().catch(() => false)) {
    await existingMinuteButton.click();
  } else {
    const generateButton = page.getByRole('button', { name: 'Confirmar cierre y generar acta' });
    await expect(generateButton).toBeEnabled({ timeout: 30_000 });
    await generateButton.click();
    await expect(page.locator('main').getByText('Acta generada en borrador')).toBeVisible({
      timeout: 45_000,
    });
    await page.getByRole('button', { name: 'Ver acta' }).click();
  }

  await expect(page).toHaveURL(/\/secretaria\/actas\/[a-f0-9-]{36}/, { timeout: 30_000 });
  const match = page.url().match(/\/secretaria\/actas\/([a-f0-9-]{36})/);
  expect(match).not.toBeNull();
  return match![1];
}

async function verifyCloudOutput(client: ServiceClient, meetingId: string, minuteId: string) {
  const progress = await getMeetingProgress(client, meetingId);
  expect(progress.meeting).toMatchObject({
    id: meetingId,
    body_id: SOCIEDAD.bodyId,
    status: 'CELEBRADA',
  });
  expect(String(progress.meeting!.scheduled_start)).toContain(SOCIEDAD.date);

  const sourceLinks = asRecord(asRecord(progress.meeting!.quorum_data).source_links);
  expect(sourceLinks.convocatoria_id).toBe(SOCIEDAD.convocatoriaId);

  expect(progress.agenda).toHaveLength(2);
  expect(progress.agenda.map((row) => row.title)).toEqual([AGENDA.ceoTitle, AGENDA.budgetTitle]);
  expect(progress.agenda.every((row) => row.kind === 'DECISORIO')).toBe(true);

  const attendeePersonIds = progress.attendees.map((row) => row.person_id).filter(Boolean);
  expect(progress.attendees).toHaveLength(3);
  expect(new Set(attendeePersonIds).size).toBe(3);
  expect(progress.attendees.every((row) => row.attendance_type === 'PRESENCIAL')).toBe(true);

  const quorum = asRecord(asRecord(progress.meeting!.quorum_data).quorum);
  expect(quorum.reached).toBe(true);
  expect(quorum.present).toBe(3);
  expect(quorum.total).toBe(3);

  expect(progress.resolutions).toHaveLength(2);
  const pointSnapshots = Array.isArray(asRecord(progress.meeting!.quorum_data).point_snapshots)
    ? asRecord(progress.meeting!.quorum_data).point_snapshots as Array<Record<string, unknown>>
    : [];
  const ceoResolution = progress.resolutions.find((row) => row.resolution_text === AGENDA.ceoTitle);
  const budgetResolution = progress.resolutions.find((row) => row.resolution_text === AGENDA.budgetTitle);
  const ceoSnapshot = pointSnapshots.find((snapshot) => snapshot.agenda_item_index === ceoResolution?.agenda_item_index);
  const budgetSnapshot = pointSnapshots.find((snapshot) => snapshot.agenda_item_index === budgetResolution?.agenda_item_index);
  expect(ceoResolution?.status).toBe('ADOPTED');
  expect(ceoResolution?.agreement_id).toBeTruthy();
  expect(ceoResolution?.required_majority_code).toBe(`${AGENDA.ceoMateria}:ORDINARIA`);
  expect(JSON.stringify(ceoSnapshot ?? {})).toMatch(/2\/3|dos tercios|tercios|delegaci/i);
  expect(budgetResolution?.status).toBe('ADOPTED');
  expect(budgetResolution?.agreement_id).toBeTruthy();
  expect(budgetResolution?.required_majority_code).toBe(`${AGENDA.budgetMateria}:ORDINARIA`);
  expect(asRecord(budgetSnapshot).materia_clase).toBe('ORDINARIA');

  expect(progress.minute?.id).toBe(minuteId);
  expect(progress.minute).toMatchObject({
    body_id: SOCIEDAD.bodyId,
    entity_id: SOCIEDAD.entityId,
    signed_at: null,
  });
  expect(String(progress.minute!.content)).toContain(AGENDA.ceoTitle);
  expect(String(progress.minute!.content)).toContain(AGENDA.budgetTitle);

  const { data: certs, error: certsError } = await client
    .from('certifications')
    .select('id')
    .eq('minute_id', minuteId);
  expect(certsError).toBeNull();
  expect(certs ?? []).toHaveLength(0);
}

test.describe.configure({ timeout: 300_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_REUNION_CONSEJO !== '1',
  'Opt-in: celebra reunión del Consejo de Arga test A en governance_OS',
);

test('Secretaría celebra Consejo, genera acta y bloquea certificación con acta en borrador', async ({ page }) => {
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
  await verifyConvocatoria(client);

  let meetingId = await findMeetingForConvocatoria(client);
  if (!meetingId) {
    meetingId = await openOrCreateMeetingFromConvocatoria(page, client);
  }
  expect(meetingId).toBeTruthy();

  const minuteId = await ensureMeetingWorkflow(page, client, meetingId!);
  await verifyCloudOutput(client, meetingId!, minuteId);

  await page.goto(`/secretaria/actas/${minuteId}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(page.getByRole('heading', { name: 'Revisión legal para certificación' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Borrador/i).first()).toBeVisible({ timeout: 20_000 });
  const emitir = page.getByRole('button', { name: 'Emitir certificación' }).first();
  await expect(emitir).toBeVisible({ timeout: 20_000 });
  await expect(emitir).toBeDisabled();
  await expect(page.getByText(/acta debe estar aprobada o firmada.*RRM arts\. 108-109/i)).toBeVisible({
    timeout: 20_000,
  });

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during Consejo reunion flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during Consejo reunion flow',
  ).toEqual([]);
});
