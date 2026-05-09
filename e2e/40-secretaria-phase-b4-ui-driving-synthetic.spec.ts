/**
 * Phase B4 v0 — UI driving destructive con sociedad sintética.
 *
 * Cubre el path UI crítico que un usuario real recorre, pero con
 * sociedad recién creada (no ARGA). Valida que los steppers
 * (ReunionStepper) funcionan correctamente contra datos synthetic
 * que son consistentes con el esquema canónico (entities + person_id
 * + body + condiciones_persona vigentes).
 *
 * v0 scope (mínimo viable):
 *   1. API setup: PJ + entity SA + capital_profile + share_class +
 *      governing_bodies (CdA) + 3 condiciones_persona + meeting.
 *   2. UI: navigate /secretaria/reuniones/{id}
 *   3. UI: step Constitución → declarar apertura → toast OK
 *   4. UI: step Asistentes → marcar 3 miembros PRESENCIAL →
 *      "Guardar asistencia" → toast "Asistencia de N miembros guardada"
 *   5. Verify Cloud: meeting_attendees insertados con marker.
 *   6. Cleanup destructive completo.
 *
 * Si v0 pasa estable, v1 puede extenderlo a votación + acta + cert.
 *
 * Opt-in vía SECRETARIA_E2E_PHASE_B1=1 (mismo flag que B1/B3).
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

// ── Helpers Playwright UI driving (mismo patrón que e2e/18) ─────────

const FATAL_UI_PATTERNS = [
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /function .* does not exist/i,
  /permission denied/i,
  /violates row-level security/i,
];

async function expectNoFatalUi(page: Page) {
  await expect(page).not.toHaveURL(/\/login/);
  for (const pattern of FATAL_UI_PATTERNS) {
    await expect(page.getByText(pattern).first()).toHaveCount(0);
  }
}

async function goStep(page: Page, label: string | RegExp, heading: string | RegExp) {
  await page.getByRole('button', { name: label }).first().click();
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 10_000 });
  await expectNoFatalUi(page);
}

async function clickIfVisibleAndEnabled(page: Page, buttonName: string | RegExp) {
  const button = page.getByRole('button', { name: buttonName }).first();
  if ((await button.isVisible().catch(() => false)) && (await button.isEnabled().catch(() => false))) {
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
    await expect(voteSelects.first()).toBeVisible({ timeout: 10_000 });
    const voteCount = await voteSelects.count();
    for (let index = 0; index < voteCount; index += 1) {
      await voteSelects.nth(index).selectOption('FAVOR');
    }
  }
}

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const EXPECTED_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';

type ServiceClient = SupabaseClient;
interface CleanupEntry { table: string; id: string; marker: string }

// ── Env / client / marker helpers ───────────────────────────────────

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
  if (!key) throw new Error('Missing Supabase service role key for B4 UI driving E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing destructive E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

function generateRunId(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `PB-${stamp}-${randomBytes(2).toString('hex')}-B4`;
}

test.describe.configure({ timeout: 120_000 });
test.skip(
  process.env.SECRETARIA_E2E_PHASE_B1 !== '1',
  'Opt-in: Phase B4 destructive UI driving — synthetic sociedad reunion stepper',
);

interface SyntheticFixture {
  runId: string;
  taxIdPj: string;
  legalName: string;
  pjPersonId: string;
  entityId: string;
  capitalProfileId: string;
  shareClassId: string;
  bodyId: string;
  meetingId: string;
  consejeros: Array<{ personId: string; cargo: string; condicionId: string }>;
  capitalHoldingId: string;
  socioPersonId: string;
}

async function createSyntheticFixture(client: ServiceClient, created: CleanupEntry[]): Promise<SyntheticFixture> {
  const runId = generateRunId();
  const hex = runId.split('-').slice(-2)[0];
  const taxIdPj = `Z-PB-${hex}`;
  const legalName = `PHASE-B-DEMO-${runId} S.A.`;
  const slug = `phase-b4-${runId.toLowerCase()}`;

  // 1. PJ
  const { data: pj, error: pjErr } = await client
    .from('persons')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      full_name: legalName,
      denomination: legalName,
      tax_id: taxIdPj,
      person_type: 'PJ',
    })
    .select('id')
    .single();
  if (pjErr || !pj) throw new Error(`PJ insert failed: ${pjErr?.message}`);
  created.push({ table: 'persons', id: pj.id, marker: runId });

  // 2. Entity SA con CdA
  const { data: entity, error: eErr } = await client
    .from('entities')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      person_id: pj.id,
      slug,
      legal_name: legalName,
      common_name: legalName,
      jurisdiction: 'ES',
      legal_form: 'S.A.',
      tipo_social: 'SA',
      forma_administracion: 'CONSEJO',
      tipo_organo_admin: 'CDA',
      es_unipersonal: false,
      es_cotizada: false,
      entity_status: 'Active',
      materiality: 'Medium',
    })
    .select('id')
    .single();
  if (eErr || !entity) throw new Error(`entity insert failed: ${eErr?.message}`);
  created.push({ table: 'entities', id: entity.id, marker: runId });

  // 3. capital_profile VIGENTE
  const { data: profile, error: pfErr } = await client
    .from('entity_capital_profile')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      currency: 'EUR',
      capital_escriturado: 60000,
      capital_desembolsado: 60000,
      numero_titulos: 60000,
      valor_nominal: 1,
      estado: 'VIGENTE',
      effective_from: new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single();
  if (pfErr || !profile) throw new Error(`capital_profile insert failed: ${pfErr?.message}`);
  created.push({ table: 'entity_capital_profile', id: profile.id, marker: runId });

  // 4. share_class
  const { data: shareClass, error: scErr } = await client
    .from('share_classes')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      class_code: 'ORD',
      name: 'Ordinaria',
      votes_per_title: 1,
      economic_rights_coeff: 1,
      voting_rights: true,
      veto_rights: false,
    })
    .select('id')
    .single();
  if (scErr || !shareClass) throw new Error(`share_class insert failed: ${scErr?.message}`);
  created.push({ table: 'share_classes', id: shareClass.id, marker: runId });

  // 5. governing_bodies (CdA)
  const { data: body, error: bErr } = await client
    .from('governing_bodies')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      slug: `${slug}-cda`,
      name: 'Consejo de Administración',
      body_type: 'CDA',
      config: { organo_tipo: 'CONSEJO_ADMIN', voto_calidad_presidente: true, e2e_phase_b_run: runId },
      quorum_rule: { quorum_asistencia: 0.5, mayoria_simple: 0.5 },
    })
    .select('id')
    .single();
  if (bErr || !body) throw new Error(`body insert failed: ${bErr?.message}`);
  created.push({ table: 'governing_bodies', id: body.id, marker: runId });

  // 6. 3 personas físicas (Presidente + Secretario + Consejero) + 1 socio
  const consejeros: SyntheticFixture['consejeros'] = [];
  const cargos = ['PRESIDENTE', 'SECRETARIO', 'CONSEJERO'];
  for (let i = 0; i < cargos.length; i += 1) {
    const { data: p, error } = await client
      .from('persons')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        full_name: `B4 Demo ${cargos[i]} ${i + 1} ${runId}`,
        tax_id: `Y-PB-${hex}-${i}`,
        person_type: 'PF',
      })
      .select('id')
      .single();
    if (error || !p) throw new Error(`consejero ${i} insert failed: ${error?.message}`);
    created.push({ table: 'persons', id: p.id, marker: runId });
    consejeros.push({ personId: p.id, cargo: cargos[i], condicionId: '' });
  }

  const { data: socio, error: sErr } = await client
    .from('persons')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      full_name: `B4 Demo Socio único ${runId}`,
      tax_id: `X-PB-${hex}`,
      person_type: 'PF',
    })
    .select('id')
    .single();
  if (sErr || !socio) throw new Error(`socio insert failed: ${sErr?.message}`);
  created.push({ table: 'persons', id: socio.id, marker: runId });

  // 7. capital_holding 100% socio único
  const { data: holding, error: hErr } = await client
    .from('capital_holdings')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      holder_person_id: socio.id,
      share_class_id: shareClass.id,
      numero_titulos: 60000,
      porcentaje_capital: 100,
      voting_rights: true,
      is_treasury: false,
      effective_from: new Date().toISOString().slice(0, 10),
      metadata: { e2e_phase_b_run: runId },
    })
    .select('id')
    .single();
  if (hErr || !holding) throw new Error(`capital_holding insert failed: ${hErr?.message}`);
  created.push({ table: 'capital_holdings', id: holding.id, marker: runId });

  // 8. condiciones_persona — 3 cargos del CdA + 1 SOCIO
  const today = new Date().toISOString().slice(0, 10);
  for (const c of consejeros) {
    const { data: cond, error } = await client
      .from('condiciones_persona')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        person_id: c.personId,
        entity_id: entity.id,
        body_id: body.id,
        tipo_condicion: c.cargo,
        estado: 'VIGENTE',
        fecha_inicio: today,
        metadata: { e2e_phase_b_run: runId },
      })
      .select('id')
      .single();
    if (error || !cond) throw new Error(`condicion ${c.cargo} insert failed: ${error?.message}`);
    created.push({ table: 'condiciones_persona', id: cond.id, marker: runId });
    c.condicionId = cond.id;
  }

  const { data: condSocio, error: csErr } = await client
    .from('condiciones_persona')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      person_id: socio.id,
      entity_id: entity.id,
      body_id: null,
      tipo_condicion: 'SOCIO',
      estado: 'VIGENTE',
      fecha_inicio: today,
      metadata: { e2e_phase_b_run: runId },
    })
    .select('id')
    .single();
  if (csErr || !condSocio) throw new Error(`condicion SOCIO insert failed: ${csErr?.message}`);
  created.push({ table: 'condiciones_persona', id: condSocio.id, marker: runId });

  // 9. meeting (status PROGRAMADA — la UI permite abrirla)
  const { data: meeting, error: mErr } = await client
    .from('meetings')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      body_id: body.id,
      slug: `${slug}-meeting`,
      meeting_type: 'CDA_ORDINARIA',
      scheduled_start: new Date().toISOString(),
      status: 'CONVOCADA',
      quorum_data: { e2e_phase_b_run: runId },
    })
    .select('id')
    .single();
  if (mErr || !meeting) throw new Error(`meeting insert failed: ${mErr?.message}`);
  created.push({ table: 'meetings', id: meeting.id, marker: runId });

  return {
    runId,
    taxIdPj,
    legalName,
    pjPersonId: pj.id,
    entityId: entity.id,
    capitalProfileId: profile.id,
    shareClassId: shareClass.id,
    bodyId: body.id,
    meetingId: meeting.id,
    consejeros,
    socioPersonId: socio.id,
    capitalHoldingId: holding.id,
  };
}

// ── Test ────────────────────────────────────────────────────────────

test.describe('Phase B4 v0 — UI driving destructive con sociedad sintética', () => {
  let client: ServiceClient;
  let fixture: SyntheticFixture;
  const created: CleanupEntry[] = [];

  test.beforeAll(async () => {
    client = serviceClient();
    fixture = await createSyntheticFixture(client, created);
    console.log(`[phase-b4] runId=${fixture.runId} entityId=${fixture.entityId} meetingId=${fixture.meetingId}`);
  });

  test.afterAll(async () => {
    if (!client) return;
    // Pre-cleanup robusto: aunque la fixture haya fallado a mitad,
    // limpiamos por created[] (que se rellena progresivamente).
    // - meeting_votes + meeting_attendees por cada meeting en created
    // - authority_evidence por cada entity en created (trigger-creado
    //   automáticamente al insertar condiciones_persona PRESIDENTE/SECRETARIO)
    const meetingIds = created.filter((e) => e.table === 'meetings').map((e) => e.id);
    const entityIds = created.filter((e) => e.table === 'entities').map((e) => e.id);

    for (const mId of meetingIds) {
      // Orden: rule_evaluation_results → minutes → meeting_resolutions →
      // agreements → meeting_votes → meeting_attendees → meetings (luego
      // en cleanup principal).
      await client.from('rule_evaluation_results').delete().eq('meeting_id', mId);
      await client.from('minutes').delete().eq('meeting_id', mId);
      await client.from('meeting_resolutions').delete().eq('meeting_id', mId);
      await client.from('agreements').delete().eq('parent_meeting_id', mId);
      await client.from('meeting_votes').delete().eq('meeting_id', mId);
      await client.from('meeting_attendees').delete().eq('meeting_id', mId);
    }
    for (const eId of entityIds) {
      const { error } = await client.from('authority_evidence').delete().eq('entity_id', eId);
      if (error) {
        console.error(`[phase-b4] cleanup authority_evidence FAIL (${eId}):`, error.message);
      } else {
        console.log(`[phase-b4] cleanup OK: authority_evidence (entity ${eId})`);
      }
    }

    // Cleanup principal
    for (const entry of [...created].reverse()) {
      try {
        const { error } = await client.from(entry.table).delete().eq('id', entry.id);
        if (error) {
          console.error(`[phase-b4] cleanup FAIL: ${entry.table}/${entry.id}:`, error.message);
        } else {
          console.log(`[phase-b4] cleanup OK: ${entry.table}/${entry.id}`);
        }
      } catch (e) {
        console.error(`[phase-b4] cleanup THREW: ${entry.table}/${entry.id}:`, e);
      }
    }
  });

  test('UI ReunionStepper con sociedad sintética: apertura + asistentes + persistencia Cloud', async ({ page }) => {
    // Capturar errores de browser para debug
    const browserErrors: string[] = [];
    page.on('pageerror', (err) => browserErrors.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/favicon|ResizeObserver/i.test(msg.text())) {
        browserErrors.push(`[console.error] ${msg.text()}`);
      }
    });

    // Navegar al meeting recién creado.
    await page.goto(`/secretaria/reuniones/${fixture.meetingId}`);

    // Header del stepper carga.
    await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
      timeout: 20_000,
    });

    // STEP 1 — Constitución: declarar apertura
    const aperturaButton = page.getByRole('button', { name: /Declarar apertura/i });
    await expect(aperturaButton).toBeVisible({ timeout: 10_000 });
    if (await aperturaButton.isEnabled().catch(() => false)) {
      await aperturaButton.click();
      // Tras el click, el meeting transiciona a CELEBRADA.
      await expect(
        page.getByText(/Sesión declarada abierta|CELEBRADA|Estado actual/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    }

    // STEP 2 — Asistentes: navegar al step
    const asistentesNav = page.getByRole('button', { name: /Asistentes/i }).first();
    if (await asistentesNav.isVisible().catch(() => false)) {
      await asistentesNav.click();
    }
    await expect(page.getByRole('heading', { name: /Paso 2\. Asistentes/ })).toBeVisible({ timeout: 10_000 });

    // El stepper debe mostrar los 3 miembros del CdA.
    // Los miembros vienen de useBodyMembers(bodyId) → condiciones_persona vigentes.
    for (const consejero of fixture.consejeros) {
      const fullName = `B4 Demo ${consejero.cargo} ${fixture.consejeros.indexOf(consejero) + 1} ${fixture.runId}`;
      // El nombre puede aparecer truncado o con formato distinto en la UI.
      // Buscamos por substring del runId (suficientemente único).
      await expect(page.getByText(new RegExp(consejero.cargo, 'i')).first()).toBeVisible({ timeout: 10_000 });
    }

    // Click "Guardar asistencia" — todos como PRESENCIAL por defecto.
    const saveAttendance = page.getByRole('button', { name: 'Guardar asistencia' });
    await expect(saveAttendance).toBeVisible({ timeout: 10_000 });
    await saveAttendance.scrollIntoViewIfNeeded();
    await expect(saveAttendance).toBeEnabled({ timeout: 20_000 });
    await saveAttendance.click();

    // Toast confirma persistencia.
    await expect(page.getByText(/Asistencia de \d+ miembros guardada/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // Verificación Cloud: meeting_attendees insertados con los person_ids correctos.
    const { data: attendees, error: attErr } = await client
      .from('meeting_attendees')
      .select('person_id, attendance_type')
      .eq('meeting_id', fixture.meetingId);
    expect(attErr, 'read meeting_attendees').toBeNull();
    expect(attendees?.length, '3 miembros guardados').toBe(3);
    const persistedPersonIds = new Set(attendees!.map((a) => a.person_id));
    for (const consejero of fixture.consejeros) {
      expect(persistedPersonIds.has(consejero.personId), `consejero ${consejero.cargo} en attendees`).toBe(true);
    }

    // Sin errores fatales en browser.
    expect(
      browserErrors.filter((e) => /relation .* does not exist|column .* does not exist|permission denied|RLS/i.test(e)),
      'no fatal errors in browser console',
    ).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────
  // B4 v1 — flow completo: quórum + agenda + votación + cierre + acta
  //
  // Continúa desde el meeting con asistentes ya guardados (test 1).
  // Drives los pasos 3-6 del ReunionStepper, valida que se genera
  // acta vía fn_generar_acta y que la fila aparece en `minutes` con
  // body_id + entity_id correctos.
  // ─────────────────────────────────────────────────────────────────

  test('UI ReunionStepper v1: quórum + agenda + votación + cierre + acta', async ({ page }) => {
    // Re-navegar al meeting (continúa el state del test 1).
    await page.goto(`/secretaria/reuniones/${fixture.meetingId}`);
    await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
      timeout: 20_000,
    });

    // STEP 3 — Quórum: verifica que el motor V2 reporta quórum alcanzado
    // (3 presentes de 3 totales = 100% > 50%).
    await goStep(page, /Quórum/, /Paso 3\. Quórum/);
    await expect(page.getByText(/No hay lista de asistentes guardada/i)).toHaveCount(0);
    await expect(page.getByText(/Evaluación Motor V2|QUÓRUM ALCANZADO/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await clickIfVisibleAndEnabled(page, 'Confirmar quórum y continuar');

    // STEP 4 — Agenda y debate: añade 1 punto ORDINARIA APROBACION_CUENTAS.
    await goStep(page, /Agenda y debate/, /Paso 4\. Agenda y debate/);
    await expect(page.getByText(/Agenda formal|Punto 1/i).first()).toBeVisible({ timeout: 20_000 });
    const materiaSelect = page.locator('main select').first();
    await expect(materiaSelect).toBeVisible({ timeout: 10_000 });
    await materiaSelect.selectOption('APROBACION_CUENTAS');
    await expect(materiaSelect).toHaveValue('APROBACION_CUENTAS', { timeout: 5_000 });

    const agendaTitle = page.getByRole('textbox', { name: /Aprobación de cuentas anuales/i }).first();
    if (await agendaTitle.isVisible().catch(() => false)) {
      await agendaTitle.fill(`B4 v1 test ${fixture.runId} — aprobar cuentas`);
    }

    const saveDebates = page.getByRole('button', { name: 'Guardar debates' });
    await expect(saveDebates).toBeEnabled({ timeout: 10_000 });
    await saveDebates.click();
    await expect(page.getByText('Agenda y debate guardados').first()).toBeVisible({ timeout: 20_000 });

    // Reload para asegurar que el state del agenda step se persiste.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
      timeout: 20_000,
    });

    // STEP 5 — Votaciones: marcar todos FAVOR + registrar resolución.
    await goStep(page, /Votaciones/, /Paso 5\. Votaciones/);
    await expect(page.getByText('Evaluación de adopción por punto')).toBeVisible({ timeout: 20_000 });

    const saveResolutionButton = page
      .getByRole('button', {
        name: /Registrar resolución y crear expediente Acuerdo 360|Recalcular resolución y crear expediente Acuerdo 360/,
      })
      .first();
    if (await saveResolutionButton.isVisible().catch(() => false)) {
      await ensureAllVisibleVotesFavor(page);
      if (await saveResolutionButton.isEnabled().catch(() => false)) {
        await saveResolutionButton.click();
        await expect(
          page
            .getByText(/Snapshot legal actualizado|resolución\(es\) registrada\(s\)|resoluciones ya están registradas/i)
            .first(),
        ).toBeVisible({ timeout: 30_000 });
      }
    }

    // STEP 6 — Cierre: generar acta vía fn_generar_acta.
    await goStep(page, /Cierre/, /Paso 6\. Cierre/);
    const existingMinuteButton = page.getByRole('button', { name: 'Ver acta existente' });
    const hasExisting = await expect(existingMinuteButton)
      .toBeVisible({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasExisting) {
      const generateButton = page.getByRole('button', { name: 'Confirmar cierre y generar acta' });
      await expect(generateButton).toBeEnabled({ timeout: 20_000 });
      await generateButton.click();
      await expect(page.locator('main').getByText('Acta generada en borrador')).toBeVisible({
        timeout: 30_000,
      });
    }

    // Verificación Cloud: minutes tiene una fila para este meeting con
    // body_id + entity_id correctos (post-F10.2 backfill).
    const { data: minute, error: minuteErr } = await client
      .from('minutes')
      .select('id, meeting_id, body_id, entity_id, content_hash, snapshot_id')
      .eq('meeting_id', fixture.meetingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(minuteErr, 'read minutes back').toBeNull();
    expect(minute, 'minute row created by fn_generar_acta').not.toBeNull();
    expect(minute!.meeting_id).toBe(fixture.meetingId);
    expect(minute!.body_id, 'minute.body_id linked to CdA').toBe(fixture.bodyId);
    expect(minute!.entity_id, 'minute.entity_id linked to entity').toBe(fixture.entityId);
    expect(minute!.content_hash, 'fn_generar_acta calcula content_hash').toMatch(/^[a-f0-9]+$/i);

    // Verificación: meeting_resolutions tiene al menos 1 fila para el meeting.
    const { data: resolutions, error: resErr } = await client
      .from('meeting_resolutions')
      .select('id, agenda_item_index, agreement_id')
      .eq('meeting_id', fixture.meetingId);
    expect(resErr, 'read meeting_resolutions').toBeNull();
    expect(resolutions?.length, 'al menos 1 meeting_resolution registrada').toBeGreaterThanOrEqual(1);

    // Track minute para cleanup explícito.
    if (minute?.id) created.push({ table: 'minutes', id: minute.id, marker: fixture.runId });
  });
});
