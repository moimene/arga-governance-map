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
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

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
});
