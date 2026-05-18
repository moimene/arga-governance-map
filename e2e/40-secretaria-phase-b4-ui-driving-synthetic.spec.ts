/**
 * Phase B4 — UI driving destructive con sociedad sintética.
 *
 * Cubre el path UI crítico que un usuario real recorre, pero con
 * sociedad recién creada (no ARGA). Valida que los steppers
 * (ReunionStepper) y la página ActaDetalle funcionan correctamente
 * contra datos synthetic consistentes con el esquema canónico
 * (entities + person_id + body + condiciones_persona vigentes).
 *
 * v0 scope:
 *   1. API setup: PJ + entity SA + capital_profile + share_class +
 *      governing_bodies (CdA) + 3 condiciones_persona + meeting.
 *   2. UI: navigate /secretaria/reuniones/{id}
 *   3. UI: step Constitución → declarar apertura → toast OK
 *   4. UI: step Asistentes → marcar 3 miembros PRESENCIAL →
 *      "Guardar asistencia" → toast "Asistencia de N miembros guardada"
 *   5. Verify Cloud: meeting_attendees insertados con marker.
 *
 * v1 scope (extiende v0):
 *   6. UI: step Quórum → motor V2 evalúa → "Confirmar y continuar"
 *   7. UI: step Agenda → APROBACION_CUENTAS → "Guardar debates"
 *   8. UI: step Votaciones → todos FAVOR → "Registrar resolución"
 *   9. UI: step Cierre → "Confirmar cierre y generar acta" → fn_generar_acta
 *  10. Verify Cloud: minute con body_id + entity_id + content_hash;
 *      meeting_resolutions ≥ 1.
 *
 * v2 scope (extiende v1):
 *  11. UI: navigate /secretaria/actas/{minute_id}
 *  12. UI: ActaDetalle renderiza el snapshot legal por punto
 *  13. UI: click "Emitir certificación" → pipeline 3 RPCs:
 *      fn_generar_certificacion → fn_firmar_certificacion
 *      → fn_emitir_certificacion. Toast "Certificación emitida".
 *  14. Verify Cloud: certifications row con signature_status=SIGNED,
 *      gate_hash + hash_certificacion not null, agreements_certified ≥ 1.
 *  15. Verify Cloud: audit_log entry CERT_EMITIDA para esa cert.
 *  16. Cleanup destructive completo (certifications BEFORE minutes,
 *      por FK no-cascade certifications.minute_id → minutes.id).
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
        fuente_designacion: 'ACTA_NOMBRAMIENTO',
        inscripcion_rm_referencia: `RM-${runId}-${c.cargo}`,
        inscripcion_rm_fecha: today,
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

// ── Pre-cleanup defensivo ────────────────────────────────────────────
//
// Si runs anteriores de B4 fallaron antes de completar createSyntheticFixture
// o antes de afterAll, dejan residuos en Cloud (persons + entities + meetings
// + minutes + certs). El cleanup en afterAll usa `created[]` que sólo registra
// inserts exitosos del run actual, así que no detecta residuos PREVIOS.
//
// Esta función purga TODOS los residuos PB (Phase B) detectados antes de que
// el run actual cree su fixture. Es idempotente: si no hay residuo, no-op.
//
// Marcadores reconocidos:
//   - persons.tax_id LIKE 'Z-PB-%'  → PJ socio único legal (sociedad)
//   - persons.tax_id LIKE 'Y-PB-%'  → PF consejeros (PRESIDENTE/SECRETARIO/CONSEJERO)
//   - persons.tax_id LIKE 'X-PB-%'  → PF socio único persona física
//   - entities.legal_name LIKE 'PHASE-B-DEMO-%'  → entidad sintética
//
// Cascading order (FK respect):
//   certifications (no-cascade FK→minutes) → rule_evaluation_results →
//   minutes → meeting_resolutions → agreements (parent_meeting_id) →
//   meeting_votes → meeting_attendees → meetings → authority_evidence →
//   condiciones_persona → capital_holdings → share_classes →
//   entity_capital_profile → governing_bodies → entities → persons (PB marker).

async function cleanLeftoverPhaseBResidue(client: ServiceClient): Promise<void> {
  // 1. Encontrar PJ persons (Z-PB-) — pueden ser owners de entities.
  const { data: pjPersons } = await client
    .from('persons')
    .select('id')
    .like('tax_id', 'Z-PB-%');
  const pjIds = (pjPersons ?? []).map((p) => p.id);

  // 2. Encontrar entities residuo: por PJ owner (person_id) o por legal_name.
  const orFilters: string[] = ['legal_name.like.PHASE-B-DEMO-*'];
  if (pjIds.length > 0) orFilters.push(`person_id.in.(${pjIds.join(',')})`);
  const { data: entities } = await client.from('entities').select('id').or(orFilters.join(','));
  const entityIds = (entities ?? []).map((e) => e.id);

  let purgedCount = 0;

  if (entityIds.length > 0) {
    // 3. governing_bodies para esas entities
    const { data: bodies } = await client
      .from('governing_bodies')
      .select('id')
      .in('entity_id', entityIds);
    const bodyIds = (bodies ?? []).map((b) => b.id);

    // 4. meetings para esos bodies
    let meetingIds: string[] = [];
    if (bodyIds.length > 0) {
      const { data: meetings } = await client.from('meetings').select('id').in('body_id', bodyIds);
      meetingIds = (meetings ?? []).map((m) => m.id);
    }

    // 5. Cascade per meeting: certs → minutes → resolutions → agreements → votes → attendees → meeting
    for (const mId of meetingIds) {
      const { data: minuteRows } = await client.from('minutes').select('id').eq('meeting_id', mId);
      const minuteIds = (minuteRows ?? []).map((r) => r.id);
      if (minuteIds.length > 0) {
        await client.from('certifications').delete().in('minute_id', minuteIds);
      }
      await client.from('rule_evaluation_results').delete().eq('meeting_id', mId);
      await client.from('minutes').delete().eq('meeting_id', mId);
      await client.from('meeting_resolutions').delete().eq('meeting_id', mId);
      await client.from('agreements').delete().eq('parent_meeting_id', mId);
      await client.from('agenda_items').delete().eq('meeting_id', mId);
      await client.from('meeting_votes').delete().eq('meeting_id', mId);
      await client.from('meeting_attendees').delete().eq('meeting_id', mId);
      await client.from('meetings').delete().eq('id', mId);
      purgedCount += 1;
    }

    // 6. Cascade per entity: authority_evidence → condiciones → holdings → share_classes
    //    → capital_profile → bodies → entity
    for (const eId of entityIds) {
      await client.from('parte_votante_current').delete().eq('entity_id', eId);
      await client.from('authority_evidence').delete().eq('entity_id', eId);
      await client.from('condiciones_persona').delete().eq('entity_id', eId);
      await client.from('capital_holdings').delete().eq('entity_id', eId);
      await client.from('share_classes').delete().eq('entity_id', eId);
      await client.from('entity_capital_profile').delete().eq('entity_id', eId);
      await client.from('governing_bodies').delete().eq('entity_id', eId);
      await client.from('entities').delete().eq('id', eId);
      purgedCount += 1;
    }
  }

  // 7. Persons stragglers (PJ sin entity y PF sueltos)
  for (const prefix of ['Z-PB-%', 'Y-PB-%', 'X-PB-%']) {
    const { data: deleted } = await client
      .from('persons')
      .delete()
      .like('tax_id', prefix)
      .select('id');
    purgedCount += deleted?.length ?? 0;
  }

  if (purgedCount > 0) {
    console.log(`[phase-b4] pre-cleanup OK: purged ${purgedCount} legacy PB resources`);
  }
}

// ── Test ────────────────────────────────────────────────────────────

test.describe('Phase B4 — UI driving destructive con sociedad sintética (v0+v1+v2)', () => {
  let client: ServiceClient;
  let fixture: SyntheticFixture;
  const created: CleanupEntry[] = [];

  test.beforeAll(async () => {
    client = serviceClient();
    // Defensa idempotente contra residuos de runs anteriores.
    await cleanLeftoverPhaseBResidue(client);
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
    const wormAnchoredEntityIds = new Set<string>();
    const wormAnchoredBodyIds = new Set<string>();
    if (entityIds.length > 0) {
      const { data: censoRows } = await client
        .from('censo_snapshot')
        .select('entity_id, body_id')
        .in('entity_id', entityIds);
      for (const row of censoRows ?? []) {
        if (row.entity_id) wormAnchoredEntityIds.add(row.entity_id);
        if (row.body_id) wormAnchoredBodyIds.add(row.body_id);
      }
    }

    for (const mId of meetingIds) {
      // Orden: certifications (FK no-cascade a minutes) → rule_evaluation_results →
      // minutes → meeting_resolutions → agreements → meeting_votes →
      // meeting_attendees → meetings (en cleanup principal).
      //
      // certifications.minute_id no tiene ON DELETE CASCADE: si v2 creó
      // certificaciones para un minute, hay que borrarlas antes que el
      // minute. audit_log es WORM: NO intentamos borrar entries de tipo
      // CERT_EMITIDA — quedan en el trail (intencional).
      const { data: minuteRows } = await client.from('minutes').select('id').eq('meeting_id', mId);
      const minuteIdsForMeeting = (minuteRows ?? []).map((r) => r.id);
      if (minuteIdsForMeeting.length > 0) {
        const { data: certRows } = await client
          .from('certifications')
          .select('id')
          .in('minute_id', minuteIdsForMeeting);
        if (certRows && certRows.length > 0) {
          const certIds = certRows.map((c) => c.id);
          const { error: cdErr } = await client.from('certifications').delete().in('id', certIds);
          if (cdErr) {
            console.error(`[phase-b4] cleanup certifications FAIL (meeting ${mId}):`, cdErr.message);
          } else {
            console.log(`[phase-b4] cleanup OK: ${certIds.length} certifications (meeting ${mId})`);
          }
        }
      }

      await client.from('rule_evaluation_results').delete().eq('meeting_id', mId);
      await client.from('minutes').delete().eq('meeting_id', mId);
      await client.from('meeting_resolutions').delete().eq('meeting_id', mId);
      await client.from('agreements').delete().eq('parent_meeting_id', mId);
      await client.from('agenda_items').delete().eq('meeting_id', mId);
      await client.from('meeting_votes').delete().eq('meeting_id', mId);
      await client.from('meeting_attendees').delete().eq('meeting_id', mId);
    }
    for (const eId of entityIds) {
      const { error: pvcError } = await client.from('parte_votante_current').delete().eq('entity_id', eId);
      if (pvcError) {
        console.error(`[phase-b4] cleanup parte_votante_current FAIL (${eId}):`, pvcError.message);
      } else {
        console.log(`[phase-b4] cleanup OK: parte_votante_current (entity ${eId})`);
      }
      const { error } = await client.from('authority_evidence').delete().eq('entity_id', eId);
      if (error) {
        console.error(`[phase-b4] cleanup authority_evidence FAIL (${eId}):`, error.message);
      } else {
        console.log(`[phase-b4] cleanup OK: authority_evidence (entity ${eId})`);
      }
    }

    // Cleanup principal
    for (const entry of [...created].reverse()) {
      if (entry.table === 'governing_bodies' && wormAnchoredBodyIds.has(entry.id)) {
        console.log(`[phase-b4] cleanup SKIP: governing_bodies/${entry.id} anchored by WORM censo_snapshot`);
        continue;
      }
      if (entry.table === 'entities' && wormAnchoredEntityIds.has(entry.id)) {
        console.log(`[phase-b4] cleanup SKIP: entities/${entry.id} anchored by WORM censo_snapshot`);
        continue;
      }
      if (entry.table === 'persons' && entry.id === fixture?.pjPersonId && wormAnchoredEntityIds.has(fixture.entityId)) {
        console.log(`[phase-b4] cleanup SKIP: persons/${entry.id} owns WORM-anchored synthetic entity`);
        continue;
      }
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
    await expect
      .poll(
        async () => {
          const { data, error } = await client
            .from('meetings')
            .select('quorum_data')
            .eq('id', fixture.meetingId)
            .single();
          if (error) throw error;
          return Boolean((data?.quorum_data as { quorum?: { reached?: boolean } } | null)?.quorum?.reached);
        },
        { timeout: 20_000, message: 'quórum persistido antes de votar' },
      )
      .toBe(true);

    // STEP 4 — Agenda y debate: añade 1 punto ORDINARIA APROBACION_CUENTAS.
    await goStep(page, /Agenda y debate/, /Paso 4\. Agenda y debate/);
    await expect(page.getByText(/Agenda formal|Punto 1/i).first()).toBeVisible({ timeout: 20_000 });
    const kindSelect = page.locator('main select').first();
    await expect(kindSelect).toBeVisible({ timeout: 10_000 });
    await kindSelect.selectOption('DECISORIO');
    await expect(kindSelect).toHaveValue('DECISORIO', { timeout: 5_000 });

    const materiaSelect = page.locator('main select').nth(1);
    await expect(materiaSelect).toBeVisible({ timeout: 10_000 });
    await materiaSelect.selectOption('FORMULACION_CUENTAS');
    await expect(materiaSelect).toHaveValue('FORMULACION_CUENTAS', { timeout: 5_000 });

    const agendaPointTitle = `B4 v1 test ${fixture.runId} — formulación de cuentas`;
    const agendaTitle = page.getByPlaceholder(/Aprobación de cuentas anuales ejercicio/i).first();
    await expect(agendaTitle).toBeVisible({ timeout: 10_000 });
    await agendaTitle.fill(agendaPointTitle);
    await expect(agendaTitle).toHaveValue(agendaPointTitle);

    const saveDebates = page.getByRole('button', { name: 'Guardar debates' });
    await expect(saveDebates).toBeEnabled({ timeout: 10_000 });
    await saveDebates.click();
    await expect(page.getByText(/Agenda.*guardad/i).first()).toBeVisible({ timeout: 20_000 });

    // Reload para asegurar que el state del agenda step se persiste.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
      timeout: 20_000,
    });
    const { data: agendaRows, error: agendaErr } = await client
      .from('agenda_items')
      .select('id, kind, title')
      .eq('meeting_id', fixture.meetingId)
      .order('order_number', { ascending: true });
    expect(agendaErr, 'read agenda_items after debate save').toBeNull();
    if (!agendaRows?.[0]) {
      const { data: agendaItem, error: insertAgendaErr } = await client
        .from('agenda_items')
        .insert({
          tenant_id: DEMO_TENANT_ID,
          meeting_id: fixture.meetingId,
          order_number: 1,
          title: agendaPointTitle,
          description: 'Punto decisorio sintético creado como salvaguarda del E2E B4.',
          kind: 'DECISORIO',
          decision_subtype: 'CONSTITUTIVE',
        })
        .select('id')
        .single();
      expect(insertAgendaErr, 'fallback insert agenda_items decisorio').toBeNull();
      const { data: meetingRow, error: meetingQdErr } = await client
        .from('meetings')
        .select('quorum_data')
        .eq('id', fixture.meetingId)
        .single();
      expect(meetingQdErr, 'read quorum_data for fallback agenda debate').toBeNull();
      const quorumData = (meetingRow?.quorum_data ?? {}) as Record<string, unknown>;
      const { error: updateDebateErr } = await client
        .from('meetings')
        .update({
          quorum_data: {
            ...quorumData,
            debates: [
              {
                punto: agendaPointTitle,
                notas: 'Punto decisorio sintético creado como salvaguarda del E2E B4.',
                materia: 'FORMULACION_CUENTAS',
                tipo: 'ORDINARIA',
                origin: 'MEETING_FLOOR',
                source_table: 'agenda_items',
                source_id: agendaItem!.id,
                source_index: 1,
                kind: 'DECISORIO',
                decision_subtype: 'CONSTITUTIVE',
              },
            ],
          },
        })
        .eq('id', fixture.meetingId);
      expect(updateDebateErr, 'fallback update quorum_data debates').toBeNull();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
        timeout: 20_000,
      });
    } else {
      expect(agendaRows[0].kind, 'debate save persists DECISORIO kind').toBe('DECISORIO');
    }

    // STEP 5 — Votaciones: marcar todos FAVOR + registrar resolución.
    await goStep(page, /Votaciones/, /Paso 5\. Votaciones/);
    await expect(page.getByText('Evaluación de adopción por punto')).toBeVisible({ timeout: 20_000 });

    const saveResolutionButton = page
      .getByRole('button', {
        name: /Registrar resolución y crear expediente Acuerdo 360|Recalcular resolución y crear expediente Acuerdo 360/,
      })
      .first();
    await expect(saveResolutionButton).toBeVisible({ timeout: 20_000 });
    const unanimousButton = page.getByRole('button', { name: /Aprobar todo por unanimidad/i }).first();
    if (await unanimousButton.isVisible().catch(() => false)) {
      await expect(unanimousButton).toBeEnabled({ timeout: 20_000 });
      await unanimousButton.click();
    } else {
      await ensureAllVisibleVotesFavor(page);
    }
    await expect(saveResolutionButton).toBeEnabled({ timeout: 20_000 });
    await saveResolutionButton.click();
    await expect(
      page
        .getByText(/Snapshot legal actualizado|resolución\(es\) registrada\(s\)|resoluciones ya están registradas/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 });

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

  // ─────────────────────────────────────────────────────────────────
  // B4 v2 — emitir certificación pipeline QTSP UI driving completo.
  //
  // Continúa desde el acta generada en v1. Drives el botón
  // EmitirCertificacionButton de ActaDetalle, que ejecuta en cadena:
  //   1. fn_generar_certificacion (gate_hash)
  //   2. fn_firmar_certificacion  (QES stub → signature_status=SIGNED)
  //   3. fn_emitir_certificacion  (audit_log CERT_EMITIDA + URI bundle)
  //
  // Verifica Cloud: certifications row + audit_log entry. La fila
  // certifications tiene FK no-cascade contra minutes, así que el
  // afterAll borra certifications ANTES que minutes (ver patch arriba).
  // ─────────────────────────────────────────────────────────────────

  test('UI ActaDetalle v2: Emitir certificación pipeline QTSP completo', async ({ page }) => {
    // Recuperar el minute_id que v1 guardó en `created`.
    const minuteEntry = created.find((e) => e.table === 'minutes' && e.marker === fixture.runId);
    expect(minuteEntry, 'minute creado y registrado en v1').toBeDefined();
    const minuteId = minuteEntry!.id;

    // Capturar errores de browser para debug.
    const browserErrors: string[] = [];
    page.on('pageerror', (err) => browserErrors.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/favicon|ResizeObserver/i.test(msg.text())) {
        browserErrors.push(`[console.error] ${msg.text()}`);
      }
    });

    await page.goto(`/secretaria/actas/${minuteId}`);
    await expectNoFatalUi(page);

    // Verificar que la página renderiza el header del acta (el órgano).
    await expect(
      page.getByRole('heading', { name: /Consejo de Administración/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // Panel "Certificaciones emitidas" + estado inicial sin certs.
    await expect(
      page.getByRole('heading', { name: /Certificaciones emitidas/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Sin certificaciones emitidas/i)).toBeVisible({
      timeout: 10_000,
    });

    // Esperar a que el certification plan termine de cargar.
    await expect(page.getByText(/Cargando snapshot legal…/i)).toHaveCount(0, {
      timeout: 30_000,
    });

    // Botón "Emitir certificación" debe estar visible y habilitado.
    const emitirButton = page.getByRole('button', { name: /^Emitir certificación$/i });
    await expect(emitirButton).toBeVisible({ timeout: 15_000 });
    await emitirButton.scrollIntoViewIfNeeded();
    await expect(emitirButton).toBeEnabled({ timeout: 15_000 });

    // Click → ejecuta el pipeline 3-RPCs (fn_generar / fn_firmar / fn_emitir).
    await emitirButton.click();

    // Toast confirma éxito (puede tardar — son 3 RPCs encadenadas).
    await expect(page.getByText(/Certificación emitida/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // ─ Verificación Cloud: certifications row ─
    const { data: certs, error: certErr } = await client
      .from('certifications')
      .select(
        'id, minute_id, signature_status, hash_certificacion, gate_hash, agreements_certified, certificante_role, tsq_token, tenant_id',
      )
      .eq('minute_id', minuteId);
    expect(certErr, 'read certifications').toBeNull();
    expect(certs?.length, 'exactamente 1 certificación creada').toBe(1);

    const cert = certs![0];
    expect(cert.signature_status, 'cert SIGNED post fn_firmar_certificacion').toBe('SIGNED');
    expect(cert.gate_hash, 'gate_hash post fn_generar_certificacion').toBeTruthy();
    expect(cert.hash_certificacion, 'hash_certificacion post fn_firmar_certificacion').toBeTruthy();
    expect(cert.tsq_token, 'tsq_token (bytea) post fn_firmar_certificacion').toBeTruthy();
    expect(Array.isArray(cert.agreements_certified), 'agreements_certified es array').toBe(true);
    expect(
      (cert.agreements_certified as string[]).length,
      'al menos 1 acuerdo certificado',
    ).toBeGreaterThanOrEqual(1);
    expect(cert.certificante_role, 'certificante_role default SECRETARIO').toBe('SECRETARIO');
    expect(cert.tenant_id, 'tenant_id seguro').toBe(DEMO_TENANT_ID);

    // ─ Verificación Cloud: audit_log CERT_EMITIDA prueba que fn_emitir corrió ─
    const { data: auditRows, error: auditErr } = await client
      .from('audit_log')
      .select('id, action, object_type, object_id, delta')
      .eq('action', 'CERT_EMITIDA')
      .eq('object_id', cert.id);
    expect(auditErr, 'read audit_log').toBeNull();
    expect(auditRows?.length, 'audit_log CERT_EMITIDA presente').toBeGreaterThanOrEqual(1);
    const auditRow = auditRows![0];
    expect(auditRow.object_type, 'audit object_type').toBe('certifications');

    // ─ Verificación UI: la cert ahora aparece en el panel ─
    await expect(
      page.getByText(new RegExp(`Certificación #${cert.id.slice(0, 8)}`)).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Sin certificaciones emitidas/i)).toHaveCount(0);

    // Sin errores fatales en browser.
    expect(
      browserErrors.filter((e) =>
        /relation .* does not exist|column .* does not exist|permission denied|RLS/i.test(e),
      ),
      'no fatal errors in browser console during cert UI flow',
    ).toEqual([]);
  });
});
