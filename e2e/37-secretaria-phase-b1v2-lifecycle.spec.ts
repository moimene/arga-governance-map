/**
 * Phase B1 v2 — Lifecycle societario completo destructive opt-in.
 *
 * Extiende la cobertura de e2e/36 (B1 v1, solo D1 verification) hacia el
 * flujo end-to-end:
 *
 *   sociedad → órganos → cap table → cargos → meeting agreement
 *                                          → no-session agreement
 *
 * No driver UI (Playwright en este test no abre browser). Setup vía API
 * con service role; verificación leyendo snapshots persistidos en Cloud.
 * El UI walkthrough completo (steppers de convocatoria/reunión) queda
 * para una iteración madura — el path crítico que validamos aquí es la
 * persistencia correcta de `compliance_snapshot` con organo_tipo=CONSEJO
 * y engine_version=2.1.
 *
 * NO toca ARGA. Cada fila lleva marker = runId + config.e2e_phase_b_run.
 *
 * Opt-in vía SECRETARIA_E2E_PHASE_B1=1 (mismo flag que e2e/36).
 *
 * Tests:
 *   1. meeting agreement: snapshot persistido tiene organo_tipo='CONSEJO'
 *      y engine_version='2.1' para CdA SA.
 *   2. no-session agreement: persistencia coherente sin tocar el path
 *      meeting.
 *   3. cap table: capital_holdings + share_classes operacional, suma
 *      100% sin huecos.
 */
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  buildMeetingAdoptionSnapshot,
  isLegacyMeetingAdoptionSnapshot,
  MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION,
} from '../src/lib/rules-engine';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const EXPECTED_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';

type ServiceClient = SupabaseClient;
interface CleanupEntry { table: string; id: string; marker: string }

// ── Env / client helpers (mismo patrón que e2e/32 y e2e/36) ──────────

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
  if (!key) throw new Error('Missing Supabase service role key for Phase B1 v2 destructive E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing destructive E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

// ── Marker generation (mismo scheme que e2e/36) ──────────────────────

function generateRunId(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `PB-${stamp}-${randomBytes(3).toString('hex')}`;
}

const taxIdFromHex = (hex: string) => `Z-PB-${hex}`;

// ── Skip gate ───────────────────────────────────────────────────────

test.skip(
  process.env.SECRETARIA_E2E_PHASE_B1 !== '1',
  'Opt-in: Phase B1 v2 destructive lifecycle — meeting + no-session + cap table',
);

// ── Test ────────────────────────────────────────────────────────────

interface SocietyFixture {
  runId: string;
  taxIdPj: string;
  legalName: string;
  pjPersonId: string;
  entityId: string;
  capitalProfileId: string;
  shareClassId: string;
  jgaId: string;
  cdaId: string;
  /** Personas físicas: 5 consejeros + 1 socio único */
  consejeros: Array<{ id: string; cargo: string }>;
  socioId: string;
  capitalHoldingId: string;
  condicionesPersonaIds: string[];
}

test.describe('Phase B1 v2 — lifecycle societario completo destructive', () => {
  let client: ServiceClient;
  let fixture: SocietyFixture;
  const created: CleanupEntry[] = [];

  test.beforeAll(async () => {
    client = serviceClient();
    fixture = await createSocietyFixture(client, created);
    console.log(`[phase-b1v2] runId=${fixture.runId} entityId=${fixture.entityId}`);
  });

  test.afterAll(async () => {
    if (!client) return;

    // Cleanup tabular previo a las filas individuales: hay triggers que
    // crean filas en authority_evidence al insertar condiciones_persona
    // tipo PRESIDENTE/SECRETARIO. Esas filas deben borrarse antes que
    // condiciones_persona/persons o el FK falla.
    if (fixture?.entityId) {
      const { error: aeErr } = await client
        .from('authority_evidence')
        .delete()
        .eq('entity_id', fixture.entityId);
      if (aeErr) {
        console.error(`[phase-b1v2] cleanup authority_evidence FAIL:`, aeErr.message);
      } else {
        console.log(`[phase-b1v2] cleanup OK: authority_evidence (by entity_id ${fixture.entityId})`);
      }
    }

    const reverse = [...created].reverse();
    for (const entry of reverse) {
      try {
        const { error } = await client.from(entry.table).delete().eq('id', entry.id);
        if (error) {
          console.error(`[phase-b1v2] cleanup FAIL: ${entry.table}/${entry.id} (${entry.marker}):`, error.message);
        } else {
          console.log(`[phase-b1v2] cleanup OK: ${entry.table}/${entry.id}`);
        }
      } catch (e) {
        console.error(`[phase-b1v2] cleanup THREW: ${entry.table}/${entry.id}:`, e);
      }
    }
    // Verificación post: 0 filas con runId actual.
    const personsLeft = await client.from('persons').select('id', { count: 'exact', head: true }).eq('tax_id', fixture.taxIdPj);
    const entitiesLeft = await client.from('entities').select('id', { count: 'exact', head: true }).eq('legal_name', fixture.legalName);
    const bodiesLeft = await client.from('governing_bodies').select('id', { count: 'exact', head: true }).eq('config->>e2e_phase_b_run', fixture.runId);
    expect(personsLeft.count, 'persons leftovers').toBe(0);
    expect(entitiesLeft.count, 'entities leftovers').toBe(0);
    expect(bodiesLeft.count, 'governing_bodies leftovers').toBe(0);
  });

  // ── Test 1: meeting agreement con CdA persiste organoTipo=CONSEJO ─

  test('meeting agreement con CdA: snapshot persistido tiene organo_tipo=CONSEJO + engine_version=2.1', async () => {
    // Crear meeting linked al CdA. `slug` es NOT NULL.
    const { data: meeting, error: mErr } = await client
      .from('meetings')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        body_id: fixture.cdaId,
        slug: `phase-b1v2-meeting-${fixture.runId.toLowerCase()}`,
        meeting_type: 'CDA_ORDINARIA',
        scheduled_start: new Date().toISOString(),
        status: 'CELEBRADA',
        quorum_data: { e2e_phase_b_run: fixture.runId },
      })
      .select('id')
      .single();
    expect(mErr, 'insert meeting').toBeNull();
    expect(meeting?.id).toBeDefined();
    created.push({ table: 'meetings', id: meeting!.id, marker: fixture.runId });

    const { data: agendaItem, error: aiErr } = await client
      .from('agenda_items')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        meeting_id: meeting!.id,
        order_number: 0,
        title: `B1v2 meeting agenda ${fixture.runId}`,
        description: 'Punto decisorio sintético para anclar Acuerdo 360.',
        kind: 'DECISORIO',
        decision_subtype: 'CONSTITUTIVE',
      })
      .select('id')
      .single();
    expect(aiErr, 'insert agenda item').toBeNull();
    created.push({ table: 'agenda_items', id: agendaItem!.id, marker: fixture.runId });

    // Build snapshot via builder real (post-fix CDA→CONSEJO).
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: `Test B1 v2 meeting ${fixture.runId}`,
      materia: 'APROBACION_CUENTAS',
      materiaClase: 'ORDINARIA',
      tipoSocial: 'SA',
      organoTipo: 'CONSEJO',
      adoptionMode: 'MEETING',
      quorumReached: true,
      voters: fixture.consejeros.slice(0, 5).map((c, i) => ({
        id: c.id,
        vote: i < 4 ? 'FAVOR' : 'CONTRA',
        voting_weight: 1,
      })),
      totalMiembros: 5,
      capitalTotal: 5,
      packs: [
        {
          id: 'pack-test-aprob-cuentas',
          materia: 'APROBACION_CUENTAS',
          clase: 'ORDINARIA',
          organoTipo: 'CONSEJO',
          modosAdopcionPermitidos: ['MEETING'],
          // Stubs mínimos para pasar el shape del builder.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          convocatoria: {} as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          constitucion: {} as any,
          votacion: {
            mayoria: {
              SA: { formula: 'favor > contra', fuente: 'LEY', referencia: 'LSC' },
              SL: { formula: 'favor > contra', fuente: 'LEY', referencia: 'LSC' },
              CONSEJO: { formula: 'favor > contra', fuente: 'LEY', referencia: 'LSC' },
            },
            abstenciones: 'no_cuentan',
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          documentacion: {} as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          acta: {} as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          plazosMateriales: {} as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          postAcuerdo: {} as any,
        },
      ],
    });

    // Anti-bug aserciones del snapshot client-side antes de persist.
    expect(snapshot.engine_version).toBe(MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION);
    expect(snapshot.voting_context.organo_tipo).toBe('CONSEJO');
    expect(snapshot.status_resolucion).toBe('ADOPTED');

    // Insert agreement con adoption_mode=MEETING, body_id=CDA, parent_meeting_id.
    const { data: agreement, error: agErr } = await client
      .from('agreements')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: fixture.entityId,
        body_id: fixture.cdaId,
        agreement_kind: 'APROBACION_CUENTAS',
        matter_class: 'ORDINARIA',
        adoption_mode: 'MEETING',
        inscribable: false,
        status: 'ADOPTED',
        proposal_text: `B1v2 test ${fixture.runId}`,
        decision_text: `Aprobado vía meeting CdA ${fixture.runId}`,
        decision_date: new Date().toISOString().slice(0, 10),
        parent_meeting_id: meeting!.id,
        agenda_item_id: agendaItem!.id,
        execution_mode: { mode: 'MEETING', agenda_item_index: 0 },
        compliance_snapshot: snapshot,
      })
      .select('id')
      .single();
    expect(agErr, 'insert agreement').toBeNull();
    created.push({ table: 'agreements', id: agreement!.id, marker: fixture.runId });

    // Re-leer agreement desde Cloud y verificar snapshot persistido.
    const { data: persisted, error: rErr } = await client
      .from('agreements')
      .select('id, body_id, adoption_mode, status, compliance_snapshot')
      .eq('id', agreement!.id)
      .single();
    expect(rErr, 'read back agreement').toBeNull();

    const persistedSnapshot = persisted!.compliance_snapshot as Record<string, unknown> | null;
    expect(persistedSnapshot, 'compliance_snapshot persisted').not.toBeNull();
    expect((persistedSnapshot as Record<string, unknown>).schema_version).toBe('meeting-adoption-snapshot.v2');
    expect((persistedSnapshot as Record<string, unknown>).engine_version).toBe('2.1');
    const votingContext = (persistedSnapshot as Record<string, unknown>).voting_context as Record<string, unknown>;
    expect(votingContext.organo_tipo, 'D1 cloud-real: CdA persistido como CONSEJO').toBe('CONSEJO');
    expect(votingContext.tipo_social).toBe('SA');

    // Y el helper legacy NO debe flaggearlo.
    expect(isLegacyMeetingAdoptionSnapshot(persistedSnapshot)).toBe(false);
  });

  // ── Test 2: no-session agreement persiste sin pasar por path meeting ─

  test('no-session agreement: persiste con adoption_mode=NO_SESSION sin disparar legacy badge', async () => {
    // No-session resolution. Schema real: matter_class + agreement_kind
    // separados (no `materia`); votos como columnas; requires_unanimity NOT NULL.
    // Sin columna metadata — el marker se persiste vía proposal_text.
    const { data: nsr, error: nsrErr } = await client
      .from('no_session_resolutions')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        body_id: fixture.cdaId,
        title: `B1v2 no-session ${fixture.runId}`,
        status: 'APROBADO',
        proposal_text: `e2e_phase_b_run=${fixture.runId} — B1v2 no-session test`,
        agreement_kind: 'APROBACION_CUENTAS',
        matter_class: 'ORDINARIA',
        votes_for: 5,
        votes_against: 0,
        abstentions: 0,
        requires_unanimity: false,
      })
      .select('id')
      .single();
    expect(nsrErr, 'insert no_session_resolutions').toBeNull();
    created.push({ table: 'no_session_resolutions', id: nsr!.id, marker: fixture.runId });

    // Snapshot estilo no-session (shape distinto al meeting, sin
    // schema_version meeting-adoption-snapshot — el helper NO debe
    // marcarlo legacy aunque no tenga engine_version).
    const noSessionSnapshot = {
      adoption_mode: 'NO_SESSION',
      schema_version: 'no-session-snapshot.v1',
      result: { acuerdoProclamable: true },
      e2e_phase_b_run: fixture.runId,
    };

    const { data: agreement, error: agErr } = await client
      .from('agreements')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: fixture.entityId,
        body_id: fixture.cdaId,
        agreement_kind: 'APROBACION_CUENTAS',
        matter_class: 'ORDINARIA',
        adoption_mode: 'NO_SESSION',
        inscribable: false,
        status: 'ADOPTED',
        proposal_text: `B1v2 no-session ${fixture.runId}`,
        decision_text: `Aprobado vía acuerdo sin sesión ${fixture.runId}`,
        decision_date: new Date().toISOString().slice(0, 10),
        no_session_resolution_id: nsr!.id,
        compliance_snapshot: noSessionSnapshot,
      })
      .select('id')
      .single();
    expect(agErr, 'insert no-session agreement').toBeNull();
    created.push({ table: 'agreements', id: agreement!.id, marker: fixture.runId });

    // Re-leer y verificar shape coherente.
    const { data: persisted } = await client
      .from('agreements')
      .select('id, adoption_mode, compliance_snapshot')
      .eq('id', agreement!.id)
      .single();
    expect(persisted!.adoption_mode).toBe('NO_SESSION');
    const snap = persisted!.compliance_snapshot as Record<string, unknown> | null;
    expect(snap, 'compliance_snapshot persisted').not.toBeNull();
    expect((snap as Record<string, unknown>).adoption_mode).toBe('NO_SESSION');

    // El helper legacy NO debe marcarlo (shape distinto, no es meeting).
    expect(
      isLegacyMeetingAdoptionSnapshot(snap),
      'no-session NO se considera legacy del meeting flow',
    ).toBe(false);
  });

  // ── Test 3: cap table operacional ────────────────────────────────────

  test('cap table: capital_holdings con 1 socio único 100% + condiciones SOCIO + share_class ORD', async () => {
    // Verifica el setup de cap table que createSocietyFixture ya creó.
    const { data: holdings, error: hErr } = await client
      .from('capital_holdings')
      .select('id, holder_person_id, share_class_id, numero_titulos, porcentaje_capital, voting_rights, is_treasury, effective_to')
      .eq('entity_id', fixture.entityId)
      .is('effective_to', null);
    expect(hErr, 'select capital_holdings vigentes').toBeNull();
    expect(holdings?.length, 'exactamente 1 holding vigente (socio único 100%)').toBe(1);

    const sole = holdings![0];
    expect(sole.holder_person_id).toBe(fixture.socioId);
    expect(sole.share_class_id).toBe(fixture.shareClassId);
    expect(Number(sole.porcentaje_capital)).toBe(100);
    expect(Number(sole.numero_titulos)).toBeGreaterThan(0);
    expect(sole.voting_rights).toBe(true);
    expect(sole.is_treasury).toBe(false);

    // Suma agregada de % capital = 100 (sin huecos de cap table).
    const total = holdings!.reduce((acc, row) => acc + Number(row.porcentaje_capital ?? 0), 0);
    expect(total, 'cap table cierra al 100%').toBe(100);

    // Verifica condicion SOCIO presente.
    const { data: condSocio } = await client
      .from('condiciones_persona')
      .select('id, person_id, tipo_condicion, estado')
      .eq('entity_id', fixture.entityId)
      .eq('tipo_condicion', 'SOCIO')
      .eq('estado', 'VIGENTE');
    expect(condSocio?.length).toBe(1);
    expect(condSocio![0].person_id).toBe(fixture.socioId);

    // Verifica share_class ORD.
    const { data: classes } = await client
      .from('share_classes')
      .select('id, class_code, voting_rights')
      .eq('entity_id', fixture.entityId);
    expect(classes?.length).toBe(1);
    expect(classes![0].class_code).toBe('ORD');
    expect(classes![0].voting_rights).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Helper: createSocietyFixture
//
// Crea sociedad SA + CdA colegiado + 5 consejeros + 1 socio único 100%
// + condiciones_persona alineadas. Cada fila va a `created[]` para
// cleanup posterior.
// ─────────────────────────────────────────────────────────────────────

async function createSocietyFixture(
  client: ServiceClient,
  created: CleanupEntry[],
): Promise<SocietyFixture> {
  const runId = generateRunId();
  const hex = runId.split('-').slice(-1)[0];
  const taxIdPj = taxIdFromHex(hex);
  const legalName = `PHASE-B-DEMO-${runId} S.A.`;
  const slug = `phase-b1v2-${runId.toLowerCase()}`;

  // 1) PJ persona jurídica.
  const { data: pjPerson, error: pjErr } = await client
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
  if (pjErr || !pjPerson) throw pjErr ?? new Error('PJ insert failed');
  created.push({ table: 'persons', id: pjPerson.id, marker: runId });

  // 2) Entity SA.
  const { data: entity, error: eErr } = await client
    .from('entities')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      person_id: pjPerson.id,
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
  if (eErr || !entity) throw eErr ?? new Error('entity insert failed');
  created.push({ table: 'entities', id: entity.id, marker: runId });

  // 3) entity_capital_profile VIGENTE.
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
  if (pfErr || !profile) throw pfErr ?? new Error('capital_profile insert failed');
  created.push({ table: 'entity_capital_profile', id: profile.id, marker: runId });

  // 4) share_class ORD.
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
  if (scErr || !shareClass) throw scErr ?? new Error('share_class insert failed');
  created.push({ table: 'share_classes', id: shareClass.id, marker: runId });

  // 5) governing_bodies × 2 (JGA + CdA, ambos con marker).
  const { data: jga, error: jErr } = await client
    .from('governing_bodies')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      slug: `${slug}-jga`,
      name: 'Junta General de Accionistas',
      body_type: 'JUNTA',
      config: { organo_tipo: 'JUNTA_GENERAL', tipo_social: 'SA', e2e_phase_b_run: runId },
      quorum_rule: { primera_convocatoria_pct: 25, segunda_convocatoria_pct: 0 },
    })
    .select('id')
    .single();
  if (jErr || !jga) throw jErr ?? new Error('JGA insert failed');
  created.push({ table: 'governing_bodies', id: jga.id, marker: runId });

  const { data: cda, error: cErr } = await client
    .from('governing_bodies')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      slug: `${slug}-cda`,
      name: 'Consejo de Administración',
      body_type: 'CDA',
      config: {
        organo_tipo: 'CONSEJO_ADMIN',
        voto_calidad_presidente: true,
        e2e_phase_b_run: runId,
      },
      quorum_rule: { quorum_asistencia: 0.5, mayoria_simple: 0.5, voto_calidad_presidente: true },
    })
    .select('id')
    .single();
  if (cErr || !cda) throw cErr ?? new Error('CdA insert failed');
  created.push({ table: 'governing_bodies', id: cda.id, marker: runId });

  // 6) 5 personas físicas (consejeros) + 1 socio.
  const consejeroCargos = ['PRESIDENTE', 'SECRETARIO', 'CONSEJERO', 'CONSEJERO', 'CONSEJERO'];
  const consejeros: Array<{ id: string; cargo: string }> = [];
  for (let i = 0; i < consejeroCargos.length; i += 1) {
    const cargo = consejeroCargos[i];
    const { data: p, error: cnErr } = await client
      .from('persons')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        full_name: `PHASE-B-DEMO-${runId} Consejero ${i + 1} ${cargo}`,
        tax_id: `Y-PB-${hex}-${i}`,
        person_type: 'PF',
      })
      .select('id')
      .single();
    if (cnErr || !p) throw cnErr ?? new Error(`consejero ${i} insert failed`);
    created.push({ table: 'persons', id: p.id, marker: runId });
    consejeros.push({ id: p.id, cargo });
  }

  // 7) Socio único persona física.
  const { data: socio, error: sErr } = await client
    .from('persons')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      full_name: `PHASE-B-DEMO-${runId} Socio único`,
      tax_id: `X-PB-${hex}`,
      person_type: 'PF',
    })
    .select('id')
    .single();
  if (sErr || !socio) throw sErr ?? new Error('socio insert failed');
  created.push({ table: 'persons', id: socio.id, marker: runId });

  // 8) capital_holdings: socio único 100%.
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
  if (hErr || !holding) throw hErr ?? new Error('capital_holding insert failed');
  created.push({ table: 'capital_holdings', id: holding.id, marker: runId });

  // 9) condiciones_persona: 5 cargos CdA + 1 SOCIO.
  const condicionesPersonaIds: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const c of consejeros) {
    const { data: cond, error: cdErr } = await client
      .from('condiciones_persona')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        person_id: c.id,
        entity_id: entity.id,
        body_id: cda.id, // body_id obligatorio para tipos colegiados
        tipo_condicion: c.cargo,
        estado: 'VIGENTE',
        fecha_inicio: today,
        metadata: { e2e_phase_b_run: runId },
      })
      .select('id')
      .single();
    if (cdErr || !cond) throw cdErr ?? new Error(`condicion ${c.cargo} insert failed`);
    created.push({ table: 'condiciones_persona', id: cond.id, marker: runId });
    condicionesPersonaIds.push(cond.id);
  }

  const { data: condSocio, error: csErr } = await client
    .from('condiciones_persona')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      person_id: socio.id,
      entity_id: entity.id,
      body_id: null, // SOCIO no puede tener body_id (CHECK constraint)
      tipo_condicion: 'SOCIO',
      estado: 'VIGENTE',
      fecha_inicio: today,
      metadata: { e2e_phase_b_run: runId },
    })
    .select('id')
    .single();
  if (csErr || !condSocio) throw csErr ?? new Error('condicion SOCIO insert failed');
  created.push({ table: 'condiciones_persona', id: condSocio.id, marker: runId });
  condicionesPersonaIds.push(condSocio.id);

  return {
    runId,
    taxIdPj,
    legalName,
    pjPersonId: pjPerson.id,
    entityId: entity.id,
    capitalProfileId: profile.id,
    shareClassId: shareClass.id,
    jgaId: jga.id,
    cdaId: cda.id,
    consejeros,
    socioId: socio.id,
    capitalHoldingId: holding.id,
    condicionesPersonaIds,
  };
}
