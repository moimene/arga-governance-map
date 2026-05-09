/**
 * Phase B1 v3 — Adoption modes destructive opt-in.
 *
 * Cubre los modes de adopción que NO estaban en B1 v1/v2:
 *   - UNIPERSONAL_ADMIN  (admin único, SLU)
 *   - SOLIDARIO          (admin solidarios, SL)
 *   - CO_APROBACION      (admin mancomunados, SL)
 *   - UNIPERSONAL_SOCIO  (socio único, SLU)
 *   - UNIVERSAL          (junta universal sin convocatoria, SA)
 *
 * No driver UI. Setup vía API + service role; cada test crea su propia
 * sociedad coherente con el mode (SLU/SL/SA según corresponda) y
 * verifica que un agreement con ese adoption_mode persiste correctamente
 * con shape de snapshot razonable y cleanup completo.
 *
 * NO toca ARGA. Cada fila lleva marker config.e2e_phase_b_run y/o
 * tax_id/legal_name con runId del test.
 *
 * Opt-in vía SECRETARIA_E2E_PHASE_B1=1 (mismo flag que B1 v1/v2).
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

// ── Env / client / marker helpers (mismo patrón que e2e/36, e2e/37) ─

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
  if (!key) throw new Error('Missing Supabase service role key for Phase B1 v3 destructive E2E');
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

const taxIdFromHex = (hex: string, prefix: string = 'Z') => `${prefix}-PB-${hex}`;

// ── Skip gate ───────────────────────────────────────────────────────

test.skip(
  process.env.SECRETARIA_E2E_PHASE_B1 !== '1',
  'Opt-in: Phase B1 v3 destructive — adoption modes no-meeting/no-no-session',
);

// ── Tipos del fixture ────────────────────────────────────────────────

type TipoSocial = 'SA' | 'SL' | 'SLU' | 'SAU';
type TipoOrganoAdmin = 'CDA' | 'ADMIN_UNICO' | 'ADMIN_SOLIDARIOS' | 'ADMIN_MANCOMUNADOS';

interface SocietyVariantOptions {
  runId: string;
  tipoSocial: TipoSocial;
  tipoOrganoAdmin: TipoOrganoAdmin;
  numAdmins?: number;             // para SOLIDARIOS/MANCOMUNADOS (default 2)
  esUnipersonal?: boolean;         // SLU/SAU
}

interface SocietyVariantFixture {
  runId: string;
  legalName: string;
  taxIdPj: string;
  pjPersonId: string;
  entityId: string;
  capitalProfileId: string;
  shareClassId: string;
  jgaId: string;
  adminBodyId: string;
  adminPersonIds: string[];        // 1 para UNICO, N para solidarios/mancomunados
  socioPersonId: string;
  capitalHoldingId: string;
}

// ── Fixture builder parametrizado ───────────────────────────────────

const ADMIN_BODY_CONFIG: Record<
  TipoOrganoAdmin,
  { organoTipo: string; adoptionMode?: string; adminTipoCondicion: string; quorumRule: Record<string, unknown> }
> = {
  CDA: {
    organoTipo: 'CONSEJO_ADMIN',
    adminTipoCondicion: 'CONSEJERO',
    quorumRule: { quorum_asistencia: 0.5, mayoria_simple: 0.5 },
  },
  ADMIN_UNICO: {
    organoTipo: 'ADMIN_UNICO',
    adoptionMode: 'UNIPERSONAL_ADMIN',
    adminTipoCondicion: 'ADMIN_UNICO',
    quorumRule: { unipersonal_admin: true },
  },
  ADMIN_SOLIDARIOS: {
    organoTipo: 'ADMIN_SOLIDARIOS',
    adoptionMode: 'SOLIDARIO',
    adminTipoCondicion: 'ADMIN_SOLIDARIO',
    quorumRule: { accion_individual: true },
  },
  ADMIN_MANCOMUNADOS: {
    organoTipo: 'ADMIN_CONJUNTA',
    adoptionMode: 'CO_APROBACION',
    adminTipoCondicion: 'ADMIN_MANCOMUNADO',
    quorumRule: { firmas_requeridas: 2, total_administradores: 2 },
  },
};

async function createSocietyVariant(
  client: ServiceClient,
  created: CleanupEntry[],
  options: SocietyVariantOptions,
): Promise<SocietyVariantFixture> {
  const { runId, tipoSocial, tipoOrganoAdmin } = options;
  const numAdmins = options.numAdmins ?? (tipoOrganoAdmin === 'ADMIN_UNICO' ? 1 : 2);
  const esUnipersonal = options.esUnipersonal ?? (tipoSocial === 'SAU' || tipoSocial === 'SLU');
  const hex = runId.split('-').slice(-2)[0]; // segundo-a-último segmento del runId tiene el random hex

  const legalName = `PHASE-B-DEMO-${runId} ${tipoSocial}`;
  const taxIdPj = taxIdFromHex(hex);
  const slug = `phase-b1v3-${runId.toLowerCase()}`;

  const legalForm = (
    {
      SA: 'S.A.',
      SL: 'S.L.',
      SAU: 'S.A.U.',
      SLU: 'S.L.U.',
    } as Record<TipoSocial, string>
  )[tipoSocial];

  const formaAdministracion = (
    {
      CDA: 'CONSEJO',
      ADMIN_UNICO: 'ADMINISTRADOR_UNICO',
      ADMIN_SOLIDARIOS: 'ADMINISTRADORES_SOLIDARIOS',
      ADMIN_MANCOMUNADOS: 'ADMINISTRADORES_MANCOMUNADOS',
    } as Record<TipoOrganoAdmin, string>
  )[tipoOrganoAdmin];

  // 1) PJ
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

  // 2) Entity
  const { data: entity, error: eErr } = await client
    .from('entities')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      person_id: pj.id,
      slug,
      legal_name: legalName,
      common_name: legalName,
      jurisdiction: 'ES',
      legal_form: legalForm,
      tipo_social: tipoSocial,
      forma_administracion: formaAdministracion,
      tipo_organo_admin: tipoOrganoAdmin,
      es_unipersonal: esUnipersonal,
      es_cotizada: false,
      entity_status: 'Active',
      materiality: 'Medium',
    })
    .select('id')
    .single();
  if (eErr || !entity) throw new Error(`entity insert failed: ${eErr?.message}`);
  created.push({ table: 'entities', id: entity.id, marker: runId });

  // 3) capital_profile
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

  // 4) share_class
  const { data: sc, error: scErr } = await client
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
  if (scErr || !sc) throw new Error(`share_class insert failed: ${scErr?.message}`);
  created.push({ table: 'share_classes', id: sc.id, marker: runId });

  // 5) governing_bodies — JGA + admin body
  const juntaName = esUnipersonal ? 'Socio único' : (tipoSocial === 'SA' || tipoSocial === 'SAU' ? 'Junta General de Accionistas' : 'Junta General de Socios');
  const juntaConfig: Record<string, unknown> = {
    organo_tipo: esUnipersonal ? 'SOCIO_UNICO' : 'JUNTA_GENERAL',
    tipo_social: tipoSocial,
    e2e_phase_b_run: runId,
  };
  if (esUnipersonal) juntaConfig.adoption_mode = 'UNIPERSONAL_SOCIO';
  const { data: jga, error: jErr } = await client
    .from('governing_bodies')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      slug: `${slug}-junta`,
      name: juntaName,
      body_type: 'JUNTA',
      config: juntaConfig,
      quorum_rule: esUnipersonal ? { unipersonal: true } : { primera_convocatoria_pct: 25 },
    })
    .select('id')
    .single();
  if (jErr || !jga) throw new Error(`JGA insert failed: ${jErr?.message}`);
  created.push({ table: 'governing_bodies', id: jga.id, marker: runId });

  const adminCfg = ADMIN_BODY_CONFIG[tipoOrganoAdmin];
  const adminBodyConfig: Record<string, unknown> = {
    organo_tipo: adminCfg.organoTipo,
    e2e_phase_b_run: runId,
  };
  if (adminCfg.adoptionMode) adminBodyConfig.adoption_mode = adminCfg.adoptionMode;
  const adminBodyName = (
    {
      CDA: 'Consejo de Administración',
      ADMIN_UNICO: 'Administrador único',
      ADMIN_SOLIDARIOS: 'Administradores solidarios',
      ADMIN_MANCOMUNADOS: 'Administradores mancomunados',
    } as Record<TipoOrganoAdmin, string>
  )[tipoOrganoAdmin];
  const { data: adminBody, error: abErr } = await client
    .from('governing_bodies')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      slug: `${slug}-admin`,
      name: adminBodyName,
      body_type: 'CDA', // Convención BD: 'CDA' es umbrella para todo órgano admin.
      config: adminBodyConfig,
      quorum_rule: adminCfg.quorumRule,
    })
    .select('id')
    .single();
  if (abErr || !adminBody) throw new Error(`admin body insert failed: ${abErr?.message}`);
  created.push({ table: 'governing_bodies', id: adminBody.id, marker: runId });

  // 6) Personas físicas: N admins + 1 socio
  const adminPersonIds: string[] = [];
  for (let i = 0; i < numAdmins; i += 1) {
    const { data: p, error: apErr } = await client
      .from('persons')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        full_name: `PHASE-B-DEMO-${runId} ${adminCfg.adminTipoCondicion} ${i + 1}`,
        tax_id: `Y-PB-${hex}-${i}`,
        person_type: 'PF',
      })
      .select('id')
      .single();
    if (apErr || !p) throw new Error(`admin person ${i} insert failed: ${apErr?.message}`);
    created.push({ table: 'persons', id: p.id, marker: runId });
    adminPersonIds.push(p.id);
  }

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
  if (sErr || !socio) throw new Error(`socio insert failed: ${sErr?.message}`);
  created.push({ table: 'persons', id: socio.id, marker: runId });

  // 7) capital_holding socio único 100%
  const { data: holding, error: hErr } = await client
    .from('capital_holdings')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      holder_person_id: socio.id,
      share_class_id: sc.id,
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

  // 8) condiciones_persona — admins + 1 SOCIO
  // Para tipos colegiados (CONSEJERO/PRESIDENTE/etc): body_id obligatorio.
  // Para tipos no-colegiados (ADMIN_UNICO/SOLIDARIO/MANCOMUNADO/SOCIO): body_id NULL.
  const isColegiado = adminCfg.adminTipoCondicion === 'CONSEJERO';
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < adminPersonIds.length; i += 1) {
    const { data: cond, error: cdErr } = await client
      .from('condiciones_persona')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        person_id: adminPersonIds[i],
        entity_id: entity.id,
        body_id: isColegiado ? adminBody.id : null,
        tipo_condicion: adminCfg.adminTipoCondicion,
        estado: 'VIGENTE',
        fecha_inicio: today,
        metadata: { e2e_phase_b_run: runId },
      })
      .select('id')
      .single();
    if (cdErr || !cond) throw new Error(`condicion admin ${i} insert failed: ${cdErr?.message}`);
    created.push({ table: 'condiciones_persona', id: cond.id, marker: runId });
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

  return {
    runId,
    legalName,
    taxIdPj,
    pjPersonId: pj.id,
    entityId: entity.id,
    capitalProfileId: profile.id,
    shareClassId: sc.id,
    jgaId: jga.id,
    adminBodyId: adminBody.id,
    adminPersonIds,
    socioPersonId: socio.id,
    capitalHoldingId: holding.id,
  };
}

// ── Test ────────────────────────────────────────────────────────────

test.describe('Phase B1 v3 — adoption modes no-meeting/no-no-session', () => {
  let client: ServiceClient;
  const created: CleanupEntry[] = [];
  const fixtureEntities: string[] = []; // entity_ids para cleanup authority_evidence

  test.beforeAll(() => {
    client = serviceClient();
  });

  test.afterAll(async () => {
    if (!client) return;

    // Pre-cleanup: authority_evidence (trigger-creado) por entity_id.
    for (const entityId of fixtureEntities) {
      const { error } = await client.from('authority_evidence').delete().eq('entity_id', entityId);
      if (error) {
        console.error(`[phase-b1v3] cleanup authority_evidence FAIL (${entityId}):`, error.message);
      } else {
        console.log(`[phase-b1v3] cleanup OK: authority_evidence (entity ${entityId})`);
      }
    }

    // Cleanup principal: orden inverso por IDs.
    for (const entry of [...created].reverse()) {
      try {
        const { error } = await client.from(entry.table).delete().eq('id', entry.id);
        if (error) {
          console.error(`[phase-b1v3] cleanup FAIL: ${entry.table}/${entry.id} (${entry.marker}):`, error.message);
        } else {
          console.log(`[phase-b1v3] cleanup OK: ${entry.table}/${entry.id}`);
        }
      } catch (e) {
        console.error(`[phase-b1v3] cleanup THREW: ${entry.table}/${entry.id}:`, e);
      }
    }

    // Verificación post: 0 personas con tax_id derivado de runIds del archivo.
    // Como cada test tiene su runId distinto, miramos por prefijo del marker.
    const personsLeft = await client
      .from('persons')
      .select('id', { count: 'exact', head: true })
      .like('tax_id', 'Z-PB-%')
      .like('full_name', `%PHASE-B-DEMO-PB-%`);
    // Con cleanup por id no debería quedar nada del propio run; las que
    // quedan son residuos históricos (NO blocker, info).
    if ((personsLeft.count ?? 0) > 0) {
      console.warn(`[phase-b1v3] residuos históricos PHASE-B-DEMO en persons: ${personsLeft.count}`);
    }
  });

  test('UNIPERSONAL_ADMIN: SLU + admin único + decisión unipersonal', async () => {
    const runId = generateRunId('AU');
    const fixture = await createSocietyVariant(client, created, {
      runId,
      tipoSocial: 'SLU',
      tipoOrganoAdmin: 'ADMIN_UNICO',
    });
    fixtureEntities.push(fixture.entityId);

    // unipersonal_decisions row
    const { data: decision, error: dErr } = await client
      .from('unipersonal_decisions')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: fixture.entityId,
        decision_type: 'ADMIN_UNICO',
        title: `B1v3 unipersonal admin ${runId}`,
        content: `Decisión del administrador único — ${runId}`,
        decision_date: new Date().toISOString().slice(0, 10),
        decided_by_id: fixture.adminPersonIds[0],
        status: 'FIRMADA',
        requires_registry: false,
      })
      .select('id')
      .single();
    expect(dErr, 'insert unipersonal_decision').toBeNull();
    created.push({ table: 'unipersonal_decisions', id: decision!.id, marker: runId });

    // agreement adoption_mode=UNIPERSONAL_ADMIN
    const snapshot = {
      adoption_mode: 'UNIPERSONAL_ADMIN',
      schema_version: 'unipersonal-admin-snapshot.v1',
      decided_by: fixture.adminPersonIds[0],
      e2e_phase_b_run: runId,
    };
    const { data: agreement, error: agErr } = await client
      .from('agreements')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: fixture.entityId,
        body_id: fixture.adminBodyId,
        agreement_kind: 'GESTION_ORDINARIA',
        matter_class: 'ORDINARIA',
        adoption_mode: 'UNIPERSONAL_ADMIN',
        inscribable: false,
        status: 'ADOPTED',
        proposal_text: `B1v3 unipersonal admin ${runId}`,
        decision_text: `Aprobado por administrador único ${runId}`,
        decision_date: new Date().toISOString().slice(0, 10),
        unipersonal_decision_id: decision!.id,
        compliance_snapshot: snapshot,
      })
      .select('id')
      .single();
    expect(agErr, 'insert agreement UNIPERSONAL_ADMIN').toBeNull();
    created.push({ table: 'agreements', id: agreement!.id, marker: runId });

    // Verifica persistencia
    const { data: persisted } = await client
      .from('agreements')
      .select('adoption_mode, body_id, unipersonal_decision_id, compliance_snapshot')
      .eq('id', agreement!.id)
      .single();
    expect(persisted!.adoption_mode).toBe('UNIPERSONAL_ADMIN');
    expect(persisted!.body_id).toBe(fixture.adminBodyId);
    expect(persisted!.unipersonal_decision_id).toBe(decision!.id);
    const snap = persisted!.compliance_snapshot as Record<string, unknown> | null;
    expect((snap as Record<string, unknown>).adoption_mode).toBe('UNIPERSONAL_ADMIN');
  });

  // ─────────────────────────────────────────────────────────────────
  // P0 schema gap RESUELTO en migración
  // `extend_agreements_adoption_mode_solidario_co_aprobacion`
  // (2026-05-09). Antes el CHECK constraint solo aceptaba 5 modes y
  // los steppers Solidario/CoAprobacion rompían contra BD pese a que
  // el motor TS los soportaba. La migración alinea la enumeración
  // con AdoptionMode del Sprint G.
  // ─────────────────────────────────────────────────────────────────

  test('SOLIDARIO: SL + 2 administradores solidarios + acuerdo solidario', async () => {
    const runId = generateRunId('SO');
    const fixture = await createSocietyVariant(client, created, {
      runId,
      tipoSocial: 'SL',
      tipoOrganoAdmin: 'ADMIN_SOLIDARIOS',
      numAdmins: 2,
    });
    fixtureEntities.push(fixture.entityId);

    const snapshot = {
      adoption_mode: 'SOLIDARIO',
      schema_version: 'solidario-snapshot.v1',
      adminVigentes: fixture.adminPersonIds,
      decidedBy: fixture.adminPersonIds[0],
      result: { acuerdoProclamable: true, severity: 'OK' },
      e2e_phase_b_run: runId,
    };

    const { data: agreement, error: agErr } = await client
      .from('agreements')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: fixture.entityId,
        body_id: fixture.adminBodyId,
        agreement_kind: 'GESTION_ORDINARIA',
        matter_class: 'ORDINARIA',
        adoption_mode: 'SOLIDARIO',
        inscribable: false,
        status: 'ADOPTED',
        proposal_text: `B1v3 solidario ${runId}`,
        decision_text: `Aprobado por administrador solidario ${runId}`,
        decision_date: new Date().toISOString().slice(0, 10),
        compliance_snapshot: snapshot,
      })
      .select('id')
      .single();
    expect(agErr, 'insert agreement SOLIDARIO').toBeNull();
    created.push({ table: 'agreements', id: agreement!.id, marker: runId });

    // Verifica persistencia + organo body coherente
    const { data: persisted } = await client
      .from('agreements')
      .select('adoption_mode, body_id, compliance_snapshot, governing_bodies(body_type, config)')
      .eq('id', agreement!.id)
      .single();
    expect(persisted!.adoption_mode).toBe('SOLIDARIO');
    const body = persisted!.governing_bodies as { body_type?: string; config?: Record<string, unknown> } | null;
    expect(body?.body_type).toBe('CDA');
    expect((body?.config ?? {}).organo_tipo).toBe('ADMIN_SOLIDARIOS');
    expect((body?.config ?? {}).adoption_mode).toBe('SOLIDARIO');
  });

  test('CO_APROBACION: SL + 2 administradores mancomunados + acuerdo co-aprobación', async () => {
    const runId = generateRunId('MA');
    const fixture = await createSocietyVariant(client, created, {
      runId,
      tipoSocial: 'SL',
      tipoOrganoAdmin: 'ADMIN_MANCOMUNADOS',
      numAdmins: 2,
    });
    fixtureEntities.push(fixture.entityId);

    const snapshot = {
      adoption_mode: 'CO_APROBACION',
      schema_version: 'co-aprobacion-snapshot.v1',
      k_required: 2,
      n_total: 2,
      firmasPresentes: fixture.adminPersonIds,
      result: { acuerdoProclamable: true, severity: 'OK' },
      e2e_phase_b_run: runId,
    };

    const { data: agreement, error: agErr } = await client
      .from('agreements')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: fixture.entityId,
        body_id: fixture.adminBodyId,
        agreement_kind: 'GESTION_ORDINARIA',
        matter_class: 'ORDINARIA',
        adoption_mode: 'CO_APROBACION',
        inscribable: false,
        status: 'ADOPTED',
        proposal_text: `B1v3 co-aprobacion ${runId}`,
        decision_text: `Aprobado por administradores mancomunados ${runId}`,
        decision_date: new Date().toISOString().slice(0, 10),
        compliance_snapshot: snapshot,
      })
      .select('id')
      .single();
    expect(agErr, 'insert agreement CO_APROBACION').toBeNull();
    created.push({ table: 'agreements', id: agreement!.id, marker: runId });

    const { data: persisted } = await client
      .from('agreements')
      .select('adoption_mode, compliance_snapshot, governing_bodies(body_type, config)')
      .eq('id', agreement!.id)
      .single();
    expect(persisted!.adoption_mode).toBe('CO_APROBACION');
    const body = persisted!.governing_bodies as { body_type?: string; config?: Record<string, unknown> } | null;
    expect(body?.body_type).toBe('CDA');
    expect((body?.config ?? {}).organo_tipo).toBe('ADMIN_CONJUNTA');
    expect((body?.config ?? {}).adoption_mode).toBe('CO_APROBACION');
  });

  test('UNIPERSONAL_SOCIO: SLU socio único + decisión socio unipersonal', async () => {
    const runId = generateRunId('US');
    // Para socio único usamos admin único también (forma común en SLU).
    const fixture = await createSocietyVariant(client, created, {
      runId,
      tipoSocial: 'SLU',
      tipoOrganoAdmin: 'ADMIN_UNICO',
      esUnipersonal: true,
    });
    fixtureEntities.push(fixture.entityId);

    // Decisión del socio único — usa el body_id de la JGA degenerada (socio único).
    const { data: decision, error: dErr } = await client
      .from('unipersonal_decisions')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: fixture.entityId,
        decision_type: 'SOCIO_UNICO',
        title: `B1v3 unipersonal socio ${runId}`,
        content: `Decisión del socio único — ${runId}`,
        decision_date: new Date().toISOString().slice(0, 10),
        decided_by_id: fixture.socioPersonId,
        status: 'FIRMADA',
        requires_registry: false,
      })
      .select('id')
      .single();
    expect(dErr, 'insert unipersonal_decision SOCIO_UNICO').toBeNull();
    created.push({ table: 'unipersonal_decisions', id: decision!.id, marker: runId });

    const snapshot = {
      adoption_mode: 'UNIPERSONAL_SOCIO',
      schema_version: 'unipersonal-socio-snapshot.v1',
      decided_by: fixture.socioPersonId,
      capital_pct: 100,
      e2e_phase_b_run: runId,
    };
    const { data: agreement, error: agErr } = await client
      .from('agreements')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: fixture.entityId,
        body_id: fixture.jgaId, // JGA degenerada (socio único)
        agreement_kind: 'APROBACION_CUENTAS',
        matter_class: 'ORDINARIA',
        adoption_mode: 'UNIPERSONAL_SOCIO',
        inscribable: false,
        status: 'ADOPTED',
        proposal_text: `B1v3 unipersonal socio ${runId}`,
        decision_text: `Aprobado por socio único ${runId}`,
        decision_date: new Date().toISOString().slice(0, 10),
        unipersonal_decision_id: decision!.id,
        compliance_snapshot: snapshot,
      })
      .select('id')
      .single();
    expect(agErr, 'insert agreement UNIPERSONAL_SOCIO').toBeNull();
    created.push({ table: 'agreements', id: agreement!.id, marker: runId });

    const { data: persisted } = await client
      .from('agreements')
      .select('adoption_mode, body_id, governing_bodies(body_type, config)')
      .eq('id', agreement!.id)
      .single();
    expect(persisted!.adoption_mode).toBe('UNIPERSONAL_SOCIO');
    const body = persisted!.governing_bodies as { body_type?: string; config?: Record<string, unknown> } | null;
    expect(body?.body_type).toBe('JUNTA');
    expect((body?.config ?? {}).organo_tipo).toBe('SOCIO_UNICO');
  });

  test('UNIVERSAL: SA + JGA universal sin convocatoria + meeting agreement', async () => {
    const runId = generateRunId('UN');
    // Universal exige todos los socios presentes — usamos socio único 100%.
    const fixture = await createSocietyVariant(client, created, {
      runId,
      tipoSocial: 'SA',
      tipoOrganoAdmin: 'CDA',
    });
    fixtureEntities.push(fixture.entityId);

    // Meeting universal: convocatoria=NULL, junta_universal=true.
    const { data: meeting, error: mErr } = await client
      .from('meetings')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        body_id: fixture.jgaId,
        slug: `${runId.toLowerCase()}-junta-universal`,
        meeting_type: 'JUNTA_UNIVERSAL',
        scheduled_start: new Date().toISOString(),
        status: 'CELEBRADA',
        quorum_data: { junta_universal: true, e2e_phase_b_run: runId },
      })
      .select('id')
      .single();
    expect(mErr, 'insert meeting universal').toBeNull();
    created.push({ table: 'meetings', id: meeting!.id, marker: runId });

    // Snapshot de junta universal: adoption_mode=UNIVERSAL.
    const snapshot = {
      adoption_mode: 'UNIVERSAL',
      schema_version: 'meeting-adoption-snapshot.v2',
      engine_version: '2.1',
      voting_context: {
        tipo_social: 'SA',
        organo_tipo: 'JUNTA_GENERAL',
        adoption_mode: 'UNIVERSAL',
        primera_convocatoria: false, // universal == sin convocatoria formal
        total_miembros: 1,
        capital_total: 100,
        quorum_reached: true,
        voto_calidad_habilitado: false,
      },
      universal: { todos_socios_presentes: true, sin_convocatoria_formal: true },
      e2e_phase_b_run: runId,
    };

    const { data: agreement, error: agErr } = await client
      .from('agreements')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: fixture.entityId,
        body_id: fixture.jgaId,
        agreement_kind: 'APROBACION_CUENTAS',
        matter_class: 'ORDINARIA',
        adoption_mode: 'UNIVERSAL',
        inscribable: false,
        status: 'ADOPTED',
        proposal_text: `B1v3 universal ${runId}`,
        decision_text: `Aprobado en junta universal ${runId}`,
        decision_date: new Date().toISOString().slice(0, 10),
        parent_meeting_id: meeting!.id,
        compliance_snapshot: snapshot,
      })
      .select('id')
      .single();
    expect(agErr, 'insert agreement UNIVERSAL').toBeNull();
    created.push({ table: 'agreements', id: agreement!.id, marker: runId });

    const { data: persisted } = await client
      .from('agreements')
      .select('adoption_mode, parent_meeting_id, compliance_snapshot')
      .eq('id', agreement!.id)
      .single();
    expect(persisted!.adoption_mode).toBe('UNIVERSAL');
    expect(persisted!.parent_meeting_id).toBe(meeting!.id);
    const snap = persisted!.compliance_snapshot as Record<string, unknown> | null;
    expect((snap as Record<string, unknown>).adoption_mode).toBe('UNIVERSAL');
    const universal = (snap as Record<string, unknown>).universal as Record<string, unknown> | undefined;
    expect(universal?.todos_socios_presentes).toBe(true);
  });
});
