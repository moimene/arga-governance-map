/**
 * E2E opt-in — Junta universal de Arga test A, SL.
 *
 * Continúa T0/T1/T2/T3: tramita una Junta universal de Arga test A
 * (los 4 socios concurren con 100% del capital) que adopta dos acuerdos:
 *
 *   - MODIFICACION_ESTATUTOS — sustituye Consejo por Administrador Único.
 *   - NOMBRAMIENTO_CONSEJERO — designa a Clara Rivas Arga Test como
 *     Administradora Única (los enums actuales no exponen un kind
 *     dedicado para Admin Único; el catálogo solo conoce
 *     NOMBRAMIENTO_CONSEJERO, así que el agreement_kind queda como
 *     NOMBRAMIENTO_CONSEJERO y el detalle del cargo se refleja en el
 *     texto del acuerdo).
 *
 * Verifica:
 *   - meeting con `quorum_data.is_universal=true` y `junta_universal=true`.
 *   - 4 attendees PRESENCIAL, capital concurrente 100%.
 *   - 2 resoluciones ADOPTED con agreement_id materializado.
 *   - Acta en borrador (signed_at=null) y bloqueo de certificación
 *     RRM 108-109.
 *
 * Importante: la Junta universal cambia la forma de administración de la
 * sociedad demo. Sólo ejecutar tras T0/T1/T2/T3.
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_JUNTA_UNIVERSAL=1 bun run e2e -- e2e/51-secretaria-arga-test-a-junta-universal-admin-unico.spec.ts --project=chromium
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
  juntaBodyId: 'd3618c8c-cde7-420a-be0d-23137acbdd34',
};

const MEETING = {
  date: '2026-06-16',
  time: '10:00',
  place: 'Sede social, Calle Serrano 18, Madrid',
};

const AGENDA = {
  modificacion: {
    title:
      'Modificación de estatutos para sustituir el Consejo de Administración por Administrador Único',
    materia: 'MODIFICACION_ESTATUTOS',
    tipo: 'ESTATUTARIA',
    notas: [
      'Se modifican los artículos relativos al órgano de administración para',
      'que la sociedad pase a estar administrada por un Administrador Único',
      'con duración indefinida, conforme a los artículos 210 y 233 LSC y',
      '124 RRM. La modificación se aprueba por mayoría reforzada del',
      'artículo 199 LSC.',
    ].join(' '),
  },
  nombramiento: {
    title: 'Nombramiento de Clara Rivas Arga Test como Administradora Única',
    materia: 'NOMBRAMIENTO_CONSEJERO',
    tipo: 'ORDINARIA',
    notas: [
      'Se acuerda nombrar a Dña. Clara Rivas Arga Test, mayor de edad,',
      'con domicilio en Madrid, como Administradora Única de la sociedad',
      'por tiempo indefinido. La interesada acepta el cargo en este mismo',
      'acto. La inscripción en el Registro Mercantil se tramitará tras la',
      'firma del acta y elevación a público del acuerdo.',
    ].join(' '),
  },
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
  if (!key) throw new Error('Missing Supabase service role key for Junta universal E2E');
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

async function findExistingUniversalMeeting(client: ServiceClient): Promise<string | null> {
  const { data, error } = await client
    .from('meetings')
    .select('id, scheduled_start, status, quorum_data')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('body_id', SOCIEDAD.juntaBodyId)
    .gte('scheduled_start', `${MEETING.date}T00:00:00.000Z`)
    .lt('scheduled_start', '2026-06-17T00:00:00.000Z')
    .order('created_at', { ascending: false })
    .limit(5);
  expect(error).toBeNull();
  const universal = (data ?? []).find((m) => {
    const qd = asRecord(m.quorum_data);
    return qd.is_universal === true || qd.junta_universal === true;
  });
  return universal?.id ?? null;
}

async function findMinuteForMeeting(client: ServiceClient, meetingId: string) {
  const { data, error } = await client
    .from('minutes')
    .select('id, signed_at, body_id, entity_id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false })
    .limit(1);
  expect(error).toBeNull();
  return (data ?? [])[0] ?? null;
}

async function createUniversalMeetingViaUi(page: Page): Promise<string> {
  await page.goto(
    `/secretaria/reuniones/nueva?flow=junta-universal&scope=sociedad&entity=${SOCIEDAD.entityId}`,
  );
  await expect(page.getByRole('heading', { name: /Iniciar reunión sin convocatoria/i })).toBeVisible({
    timeout: 20_000,
  });

  // Selector de órgano: por opciones, ya que la etiqueta visible no está
  // asociada vía htmlFor con el <select>.
  await selectOptionInAnySelect(page, SOCIEDAD.juntaBodyId);

  await page.locator('input[type="date"]').first().fill(MEETING.date);
  await page.locator('input[type="time"]').first().fill(MEETING.time);
  // El lugar puede precargarse desde domicilio social; lo sobrescribimos
  // para garantizar contenido estable.
  const lugarInput = page.locator('input[type="text"]').filter({ hasNot: page.locator('[disabled]') }).first();
  await lugarInput.fill(MEETING.place);

  const submit = page.getByRole('button', { name: /Crear Junta Universal y continuar/i });
  await expect(submit).toBeEnabled({ timeout: 20_000 });
  await submit.click();

  await expect(page).toHaveURL(/\/secretaria\/reuniones\/[a-f0-9-]{36}/, { timeout: 30_000 });
  const match = page.url().match(/\/secretaria\/reuniones\/([a-f0-9-]{36})/);
  if (!match) throw new Error('No meeting id in URL after universal create');
  return match[1];
}

async function selectStep(page: Page, label: RegExp) {
  // En StepperShell el botón muestra `<span>{n}</span><span>{label}</span>`
  // cuando el paso está activo, y `<Check icon><span>{label}</span>` cuando
  // está hecho. Para que el matcher cubra ambos casos buscamos por accessible
  // name (que concatena ambos spans) permitiendo número/checkmark inicial.
  const btn = page.locator('nav[aria-label="Pasos"] button').filter({ hasText: label });
  await expect(btn.first()).toBeVisible({ timeout: 10_000 });
  await btn.first().click();
}

async function setUniversalAgendaPoint(
  page: Page,
  index: number,
  input: { title: string; materia: string; tipo: string; notas: string },
) {
  const titleInputs = page.getByPlaceholder(/Aprobación de cuentas anuales|Acuerdo de la sesión/i);
  await expect(titleInputs.nth(index)).toBeVisible({ timeout: 20_000 });
  await titleInputs.nth(index).fill(input.title);

  // Cada bloque de punto tiene 3 selects (Tipo de punto, Materia, Clase).
  // Indexamos por posición global (3 × index ... 3 × index + 2). El primero
  // debe ser DECISORIO para activar votación/Acuerdo 360.
  const mainSelects = page.locator('main select');
  await mainSelects.nth(index * 3).selectOption('DECISORIO');
  await mainSelects.nth(index * 3 + 1).selectOption(input.materia);
  await mainSelects.nth(index * 3 + 2).selectOption(input.tipo);

  const textareas = page.locator('main textarea');
  await textareas.nth(index).fill(input.notas);
}

async function ensureMeetingWorkflow(page: Page, meetingId: string): Promise<string> {
  await page.goto(`/secretaria/reuniones/${meetingId}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(page.getByRole('heading', { name: /Asistente de sesión societaria/i })).toBeVisible({
    timeout: 20_000,
  });

  const client = serviceClient();
  const existingMinute = await findMinuteForMeeting(client, meetingId);
  if (existingMinute?.id) return existingMinute.id as string;

  // Paso 1 — Constitución. El meeting nace en DRAFT para universales y el
  // estado solo pasa a CELEBRADA cuando se declara apertura. Si el click no
  // navega el estado, lo retentamos hasta que el motor refleje "CELEBRADA".
  await selectStep(page, /Constitución/i);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const openBtn = page.getByRole('button', { name: /Declarar apertura de la sesión/i });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!(await openBtn.isVisible().catch(() => false))) break;
    await expect(openBtn).toBeEnabled({ timeout: 10_000 });
    await openBtn.scrollIntoViewIfNeeded();
    await openBtn.click();
    await page.waitForTimeout(1200);
    const opened = await page.getByText(/Sesión declarada abierta/i).first().isVisible().catch(() => false);
    if (opened) break;
  }
  await expect(page.getByText(/Sesión declarada abierta/i)).toBeVisible({ timeout: 20_000 });

  // Paso 2 — Asistentes (4 socios PRESENCIAL, 25% c/u)
  await selectStep(page, /Asistentes/i);
  for (const name of ['Clara Rivas Arga Test', 'Nerea Vidal Arga Test', 'Mateo Soler Arga Test', 'ARGA Seguros S.A.']) {
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });
  }
  await expect(page.getByText(/100% del capital social presente o representado|Concurrencia universal 100%/i).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Guardar asistencia/i }).click();
  await expect(page.getByText(/Asistencia de \d+ miembros guardada/i).first()).toBeVisible({ timeout: 20_000 });

  // Paso 3 — Quórum
  await selectStep(page, /Quórum/i);
  await expect(page.getByText(/QUÓRUM ALCANZADO/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Confirmar quórum y continuar/i }).click();
  await expect(page.getByText(/Quórum (registrado|ya registrado)/i).first()).toBeVisible({ timeout: 20_000 });

  // Paso 4 — Agenda y debate
  await selectStep(page, /Agenda y debate/i);
  await expect(page.getByRole('heading', { name: /Paso 4\. Agenda y debate/i })).toBeVisible({
    timeout: 20_000,
  });
  await setUniversalAgendaPoint(page, 0, AGENDA.modificacion);
  // Si ya solo hay un punto, añadimos el segundo.
  const addBtn = page.getByRole('button', { name: /Añadir punto del orden del día|Anadir punto del orden del día/i });
  await expect(addBtn).toBeVisible({ timeout: 10_000 });
  await addBtn.click();
  // Esperamos a que aparezca el segundo bloque (segundo title input).
  await expect(
    page.getByPlaceholder(/Aprobación de cuentas anuales|Acuerdo de la sesión/i).nth(1),
  ).toBeVisible({ timeout: 10_000 });
  await setUniversalAgendaPoint(page, 1, AGENDA.nombramiento);
  // Checkbox de aceptación unánime (universal)
  const acceptanceCheckbox = page
    .locator('label')
    .filter({ hasText: /Todos los asistentes aceptan por unanimidad/i })
    .locator('input[type="checkbox"]');
  await expect(acceptanceCheckbox).toBeVisible({ timeout: 10_000 });
  if (!(await acceptanceCheckbox.isChecked())) {
    await acceptanceCheckbox.check();
  }
  await expect(acceptanceCheckbox).toBeChecked();
  const saveDebates = page.getByRole('button', { name: /Guardar debates/i });
  await expect(saveDebates).toBeEnabled({ timeout: 15_000 });
  await saveDebates.click();
  await expect(page.getByText(/Agenda, debate y constancias guardados/i).first()).toBeVisible({
    timeout: 30_000,
  });

  // Paso 5 — Votaciones (unanimidad). Recargamos la página para forzar que
  // `useAgendaItemsKind` refetch los kinds DECISORIO recién materializados;
  // sin reload, kindIndex está vacío y `resolvePointKind` cae al default
  // DELIBERATIVO durante el primer render.
  await page.reload();
  await expect(page.getByRole('heading', { name: /Asistente de sesión societaria/i })).toBeVisible({
    timeout: 20_000,
  });
  await selectStep(page, /Votaciones/i);
  await expect(page.getByText(/Evaluación de adopción por punto/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Aprobar todo por unanimidad/i }).click();
  const saveResolution = page.getByRole('button', {
    name: /Registrar resolución y crear expediente Acuerdo 360|Recalcular resolución y crear expediente Acuerdo 360/,
  });
  await expect(saveResolution).toBeEnabled({ timeout: 30_000 });
  await saveResolution.click();
  await expect(
    page.getByText(/resolución\(es\) registrada\(s\)|resoluciones ya están registradas/i).first(),
  ).toBeVisible({ timeout: 45_000 });

  // Paso 6 — Cierre. Para junta universal hay que rellenar hora_cierre.
  await selectStep(page, /Cierre/i);
  const horaCierreInput = page.locator('input[type="time"]').first();
  if (await horaCierreInput.isVisible().catch(() => false)) {
    await horaCierreInput.fill('11:30');
  }
  const generate = page.getByRole('button', { name: /Confirmar cierre y generar acta/i });
  const existingMinuteBtn = page.getByRole('button', { name: /Ver acta existente/i });
  if (await existingMinuteBtn.isVisible().catch(() => false)) {
    await existingMinuteBtn.click();
  } else {
    await expect(generate).toBeEnabled({ timeout: 30_000 });
    await generate.click();
    await expect(page.getByText(/Acta generada en borrador/i).first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: /^Ver acta$/i }).click();
  }
  await expect(page).toHaveURL(/\/secretaria\/actas\/[a-f0-9-]{36}/, { timeout: 30_000 });
  const minuteIdMatch = page.url().match(/\/secretaria\/actas\/([a-f0-9-]{36})/);
  expect(minuteIdMatch).not.toBeNull();
  return minuteIdMatch![1];
}

async function verifyCloudOutput(client: ServiceClient, meetingId: string, minuteId: string) {
  const { data: meeting, error: meErr } = await client
    .from('meetings')
    .select('id, status, body_id, scheduled_start, quorum_data')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('id', meetingId)
    .maybeSingle();
  expect(meErr).toBeNull();
  expect(meeting).toBeTruthy();
  expect(meeting!.body_id).toBe(SOCIEDAD.juntaBodyId);
  expect(meeting!.status).toBe('CELEBRADA');
  expect(String(meeting!.scheduled_start)).toContain(MEETING.date);
  const qd = asRecord(meeting!.quorum_data);
  expect(qd.is_universal).toBe(true);
  expect(qd.junta_universal).toBe(true);
  const quorum = asRecord(qd.quorum);
  expect(quorum.reached).toBe(true);
  expect(Number(quorum.pct)).toBeGreaterThanOrEqual(99.999);

  const { data: attendees, error: aErr } = await client
    .from('meeting_attendees')
    .select('id, person_id, attendance_type, capital_representado')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('meeting_id', meetingId);
  expect(aErr).toBeNull();
  expect(attendees ?? []).toHaveLength(4);
  const presenciales = (attendees ?? []).filter((a) => a.attendance_type === 'PRESENCIAL');
  expect(presenciales).toHaveLength(4);
  const totalCapital = presenciales.reduce((sum, a) => sum + Number(a.capital_representado ?? 0), 0);
  expect(Math.round(totalCapital)).toBe(100);

  const { data: resolutions, error: rErr } = await client
    .from('meeting_resolutions')
    .select('id, agenda_item_index, status, agreement_id, resolution_text, required_majority_code')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('meeting_id', meetingId)
    .order('agenda_item_index', { ascending: true });
  expect(rErr).toBeNull();
  expect(resolutions ?? []).toHaveLength(2);
  const modificacion = (resolutions ?? []).find((r) =>
    String(r.resolution_text ?? '').toLowerCase().includes('estatutos'),
  );
  const nombramiento = (resolutions ?? []).find((r) =>
    String(r.resolution_text ?? '').toLowerCase().includes('clara rivas'),
  );
  expect(modificacion?.status).toBe('ADOPTED');
  expect(modificacion?.agreement_id).toBeTruthy();
  expect(modificacion?.required_majority_code).toBe('MODIFICACION_ESTATUTOS:ESTATUTARIA');
  expect(nombramiento?.status).toBe('ADOPTED');
  expect(nombramiento?.agreement_id).toBeTruthy();
  expect(nombramiento?.required_majority_code).toBe('NOMBRAMIENTO_CONSEJERO:ORDINARIA');

  const { data: agreements, error: agErr } = await client
    .from('agreements')
    .select('id, agreement_kind, adoption_mode, status, matter_class, parent_meeting_id, entity_id, body_id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('parent_meeting_id', meetingId);
  expect(agErr).toBeNull();
  expect(agreements ?? []).toHaveLength(2);
  for (const agreement of agreements ?? []) {
    expect(agreement.entity_id).toBe(SOCIEDAD.entityId);
    expect(agreement.body_id).toBe(SOCIEDAD.juntaBodyId);
    // Para Junta universal, agreements.adoption_mode = 'UNIVERSAL'; en reuniones
    // ordinarias sería 'MEETING'. Aceptamos ambos por compatibilidad con reuses.
    expect(['UNIVERSAL', 'MEETING']).toContain(String(agreement.adoption_mode));
    expect(['ADOPTED', 'PROPOSED']).toContain(String(agreement.status));
  }
  const kinds = (agreements ?? []).map((a) => a.agreement_kind);
  expect(kinds).toContain('MODIFICACION_ESTATUTOS');
  expect(kinds).toContain('NOMBRAMIENTO_CONSEJERO');

  const { data: minute, error: mnErr } = await client
    .from('minutes')
    .select('id, meeting_id, body_id, entity_id, signed_at, content')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('id', minuteId)
    .maybeSingle();
  expect(mnErr).toBeNull();
  expect(minute).toBeTruthy();
  expect(minute!.body_id).toBe(SOCIEDAD.juntaBodyId);
  expect(minute!.entity_id).toBe(SOCIEDAD.entityId);
  expect(minute!.signed_at).toBeNull();
  const content = String(minute!.content ?? '');
  expect(content).toContain('Modificación de estatutos');
  expect(content).toContain('Clara Rivas Arga Test');
}

test.describe.configure({ timeout: 300_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_JUNTA_UNIVERSAL !== '1',
  'Opt-in: Junta universal SL Arga test A (cambio a Admin Único)',
);

test('Secretaría tramita Junta universal con cambio a Administrador Único', async ({ page }) => {
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
  let meetingId = await findExistingUniversalMeeting(client);
  if (!meetingId) {
    meetingId = await createUniversalMeetingViaUi(page);
  }
  expect(meetingId).toBeTruthy();

  const minuteId = await ensureMeetingWorkflow(page, meetingId!);
  await verifyCloudOutput(client, meetingId!, minuteId);

  // Bloqueo de certificación con acta en borrador.
  await page.goto(`/secretaria/actas/${minuteId}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  const emitir = page.getByRole('button', { name: /Emitir certificación/i });
  await expect(emitir).toBeVisible({ timeout: 20_000 });
  await expect(emitir).toBeDisabled();
  await expect(
    page.getByText(/acta debe estar aprobada o firmada.*RRM arts\. 108-109/i).first(),
  ).toBeVisible({ timeout: 20_000 });

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during junta universal flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during junta universal flow',
  ).toEqual([]);
});
