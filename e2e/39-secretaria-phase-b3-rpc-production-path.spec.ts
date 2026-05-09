/**
 * Phase B3 — RPC production path destructive opt-in.
 *
 * Cubre el path real que el ReunionStepper UI ejecuta al cerrar reunión:
 * `fn_save_meeting_resolutions` (migración 000056). Las pruebas
 * anteriores (B1 v2/v3) hacían direct INSERT en `agreements` para
 * validar persistencia. El production path va vía este RPC con role
 * check + payload validation.
 *
 * Bypass del role check: `fn_secretaria_assert_role_allowed` y
 * `fn_secretaria_assert_tenant_access` tienen cortocircuito para
 * service_role (`fn_secretaria_is_service_role()` → RETURN). Verificado
 * vía Cloud query 2026-05-09.
 *
 * Validamos:
 *   - El RPC acepta agreement_action='UPSERT' + agreement_payload bien formado.
 *   - Inserta agreement con compliance_snapshot completo (engine_version=2.1,
 *     organo_tipo=CONSEJO).
 *   - Inserta meeting_resolutions linked al meeting.
 *   - Devuelve jsonb con agenda_item_index, resolution_id, agreement_id.
 *   - El snapshot persistido NO se marca como legacy
 *     (`isLegacyMeetingAdoptionSnapshot`).
 *
 * NO toca ARGA. Marker scheme reutilizado de B1 v3.
 *
 * Opt-in vía SECRETARIA_E2E_PHASE_B1=1 (mismo flag que B1 v1/v2/v3).
 */
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  buildMeetingAdoptionSnapshot,
  isLegacyMeetingAdoptionSnapshot,
  MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION,
  type RulePack,
} from '../src/lib/rules-engine';
import { buildMeetingAgreementPayload } from '../src/lib/secretaria/agreement-360';

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
  if (!key) throw new Error('Missing Supabase service role key for B3 RPC destructive E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing destructive E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

function generateRunId(suffix: string): string {
  const now = new Date();
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `PB-${stamp}-${randomBytes(2).toString('hex')}-${suffix}`;
}

// ── Skip gate ───────────────────────────────────────────────────────

test.skip(
  process.env.SECRETARIA_E2E_PHASE_B1 !== '1',
  'Opt-in: Phase B3 destructive — RPC fn_save_meeting_resolutions production path',
);

// ── Fixture mínimo: entity + body + meeting ─────────────────────────

interface MinimalFixture {
  runId: string;
  taxIdPj: string;
  legalName: string;
  entityId: string;
  bodyId: string;
  meetingId: string;
}

async function createMinimalFixture(client: ServiceClient, created: CleanupEntry[]): Promise<MinimalFixture> {
  const runId = generateRunId('B3');
  const hex = runId.split('-').slice(-2)[0];
  const taxIdPj = `Z-PB-${hex}`;
  const legalName = `PHASE-B-DEMO-${runId} S.A.`;
  const slug = `phase-b3-${runId.toLowerCase()}`;

  // PJ
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

  // Entity
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

  // CdA body con organo_tipo CONSEJO_ADMIN.
  const { data: body, error: bErr } = await client
    .from('governing_bodies')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      slug: `${slug}-cda`,
      name: 'Consejo de Administración',
      body_type: 'CDA',
      config: { organo_tipo: 'CONSEJO_ADMIN', e2e_phase_b_run: runId },
      quorum_rule: { quorum_asistencia: 0.5 },
    })
    .select('id')
    .single();
  if (bErr || !body) throw new Error(`body insert failed: ${bErr?.message}`);
  created.push({ table: 'governing_bodies', id: body.id, marker: runId });

  // Meeting
  const { data: meeting, error: mErr } = await client
    .from('meetings')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      body_id: body.id,
      slug: `${slug}-meeting`,
      meeting_type: 'CDA_ORDINARIA',
      scheduled_start: new Date().toISOString(),
      status: 'CELEBRADA',
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
    entityId: entity.id,
    bodyId: body.id,
    meetingId: meeting.id,
  };
}

// ── RulePack para construir snapshot ────────────────────────────────

const consejoOrdinariaPack: RulePack = {
  id: 'pack-test-b3-aprob-cuentas',
  materia: 'APROBACION_CUENTAS',
  clase: 'ORDINARIA',
  organoTipo: 'CONSEJO',
  modosAdopcionPermitidos: ['MEETING'],
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
};

// ── Test ────────────────────────────────────────────────────────────

test.describe('Phase B3 — fn_save_meeting_resolutions production path', () => {
  let client: ServiceClient;
  const created: CleanupEntry[] = [];

  test.beforeAll(() => {
    client = serviceClient();
  });

  test.afterAll(async () => {
    if (!client) return;
    // Cleanup en orden inverso. Los meeting_resolutions y agreements
    // creados por el RPC NO están en created[] — los limpiamos por
    // parent_meeting_id antes que el meeting.
    for (const entry of [...created].reverse()) {
      // Si la entry es un meeting, primero limpiamos sus children
      // creados por el RPC.
      if (entry.table === 'meetings') {
        // meeting_votes
        await client.from('meeting_votes').delete().eq('meeting_id', entry.id);
        // meeting_resolutions
        await client.from('meeting_resolutions').delete().eq('meeting_id', entry.id);
        // agreements creados por el RPC con parent_meeting_id
        await client.from('agreements').delete().eq('parent_meeting_id', entry.id);
        // rule_evaluation_results referenciando el meeting (si los hay)
      }
      try {
        const { error } = await client.from(entry.table).delete().eq('id', entry.id);
        if (error) {
          console.error(`[phase-b3] cleanup FAIL: ${entry.table}/${entry.id}:`, error.message);
        } else {
          console.log(`[phase-b3] cleanup OK: ${entry.table}/${entry.id}`);
        }
      } catch (e) {
        console.error(`[phase-b3] cleanup THREW: ${entry.table}/${entry.id}:`, e);
      }
    }
  });

  test('fn_save_meeting_resolutions con UPSERT crea agreement + meeting_resolutions con snapshot 2.1', async () => {
    const fixture = await createMinimalFixture(client, created);

    // Build snapshot via builder real (post-fix CDA→CONSEJO + A2 engine_version).
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: `B3 RPC test ${fixture.runId}`,
      materia: 'APROBACION_CUENTAS',
      materiaClase: 'ORDINARIA',
      tipoSocial: 'SA',
      organoTipo: 'CONSEJO',
      adoptionMode: 'MEETING',
      quorumReached: true,
      voters: [
        { id: 'c1', vote: 'FAVOR', voting_weight: 1 },
        { id: 'c2', vote: 'FAVOR', voting_weight: 1 },
        { id: 'c3', vote: 'FAVOR', voting_weight: 1 },
      ],
      totalMiembros: 3,
      capitalTotal: 3,
      packs: [consejoOrdinariaPack],
    });

    // Sanity check del snapshot client-side.
    expect(snapshot.engine_version).toBe(MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION);
    expect(snapshot.voting_context.organo_tipo).toBe('CONSEJO');
    expect(snapshot.status_resolucion).toBe('ADOPTED');
    expect(snapshot.societary_validity.ok).toBe(true);
    expect(snapshot.societary_validity.agreement_proclaimable).toBe(true);

    // Build agreement payload via función de producción.
    const agreementPayload = buildMeetingAgreementPayload({
      tenantId: DEMO_TENANT_ID,
      entityId: fixture.entityId,
      bodyId: fixture.bodyId,
      meetingId: fixture.meetingId,
      scheduledStart: new Date().toISOString(),
      snapshot,
    });
    expect(agreementPayload, 'buildMeetingAgreementPayload returned non-null').not.toBeNull();

    // Construir p_rows para el RPC. Una fila con UPSERT.
    const rpcRows = [
      {
        agenda_item_index: 0,
        resolution_text: snapshot.resolution_text,
        resolution_type: 'AGREEMENT',
        required_majority_code: 'MAYORIA_SIMPLE',
        status: 'ADOPTED',
        agreement_action: 'UPSERT',
        agreement_payload: agreementPayload,
        adoption_snapshot: snapshot,
        votes: [],
      },
    ];

    // Invoke RPC.
    const { data: result, error: rpcErr } = await client.rpc('fn_save_meeting_resolutions', {
      p_tenant_id: DEMO_TENANT_ID,
      p_meeting_id: fixture.meetingId,
      p_rows: rpcRows,
    });

    expect(rpcErr, 'fn_save_meeting_resolutions RPC error').toBeNull();
    expect(result, 'RPC returned data').not.toBeNull();
    expect(Array.isArray(result), 'RPC returns array').toBe(true);
    expect((result as unknown[]).length).toBe(1);

    // Shape del return: cada elemento tiene agenda_item_index, resolution_id, agreement_id.
    const row = (result as Array<Record<string, unknown>>)[0];
    expect(row.agenda_item_index).toBe(0);
    expect(typeof row.resolution_id).toBe('string');
    expect(typeof row.agreement_id).toBe('string');

    // Verificar que el agreement está persistido con compliance_snapshot
    // que el RPC actualizó (línea 280-297 de migración 000056).
    const { data: agreementRow, error: agErr } = await client
      .from('agreements')
      .select('id, adoption_mode, status, compliance_snapshot, parent_meeting_id, body_id')
      .eq('id', row.agreement_id)
      .single();
    expect(agErr, 'read back agreement').toBeNull();
    expect(agreementRow!.adoption_mode).toBe('MEETING');
    expect(agreementRow!.parent_meeting_id).toBe(fixture.meetingId);
    expect(agreementRow!.body_id).toBe(fixture.bodyId);

    const persistedSnap = agreementRow!.compliance_snapshot as Record<string, unknown> | null;
    expect(persistedSnap).not.toBeNull();
    expect((persistedSnap as Record<string, unknown>).schema_version).toBe('meeting-adoption-snapshot.v2');
    expect((persistedSnap as Record<string, unknown>).engine_version).toBe('2.1');
    const votingContext = (persistedSnap as Record<string, unknown>).voting_context as Record<string, unknown>;
    expect(votingContext.organo_tipo, 'D1 cloud-real vía RPC: CdA persistido como CONSEJO').toBe('CONSEJO');

    // Helper legacy NO debe flaggearlo.
    expect(isLegacyMeetingAdoptionSnapshot(persistedSnap)).toBe(false);

    // Verificar meeting_resolutions tiene 1 fila.
    const { data: resolutions, error: resErr } = await client
      .from('meeting_resolutions')
      .select('id, agenda_item_index, status, agreement_id')
      .eq('meeting_id', fixture.meetingId);
    expect(resErr, 'read meeting_resolutions').toBeNull();
    expect(resolutions?.length).toBe(1);
    expect(resolutions![0].agenda_item_index).toBe(0);
    expect(resolutions![0].agreement_id).toBe(row.agreement_id);
  });

  test('fn_save_meeting_resolutions con agreement_action=NONE solo crea meeting_resolutions sin agreement', async () => {
    const fixture = await createMinimalFixture(client, created);

    // Path simplificado: action=NONE, sin payload de agreement.
    const rpcRows = [
      {
        agenda_item_index: 0,
        resolution_text: `B3 NONE ${fixture.runId}`,
        resolution_type: 'INFORMATION',
        status: 'PENDING',
        agreement_action: 'NONE',
        votes: [],
      },
    ];

    const { data: result, error: rpcErr } = await client.rpc('fn_save_meeting_resolutions', {
      p_tenant_id: DEMO_TENANT_ID,
      p_meeting_id: fixture.meetingId,
      p_rows: rpcRows,
    });

    expect(rpcErr, 'RPC error').toBeNull();
    const row = (result as Array<Record<string, unknown>>)[0];
    expect(row.agenda_item_index).toBe(0);
    expect(typeof row.resolution_id).toBe('string');
    expect(row.agreement_id, 'NONE → no agreement creado').toBeNull();

    // meeting_resolutions tiene la fila pero sin agreement_id.
    const { data: resolutions } = await client
      .from('meeting_resolutions')
      .select('id, agreement_id')
      .eq('meeting_id', fixture.meetingId);
    expect(resolutions?.length).toBe(1);
    expect(resolutions![0].agreement_id).toBeNull();
  });

  test('fn_save_meeting_resolutions valida agenda_item_index requerido', async () => {
    const fixture = await createMinimalFixture(client, created);

    // Row sin agenda_item_index.
    const rpcRows = [
      {
        // agenda_item_index omitido — el RPC RAISE EXCEPTION
        resolution_text: 'fail',
        agreement_action: 'NONE',
      },
    ];

    const { error: rpcErr } = await client.rpc('fn_save_meeting_resolutions', {
      p_tenant_id: DEMO_TENANT_ID,
      p_meeting_id: fixture.meetingId,
      p_rows: rpcRows,
    });

    expect(rpcErr, 'RPC debe fallar sin agenda_item_index').not.toBeNull();
    expect(rpcErr!.message).toContain('agenda_item_index');
  });
});
