/**
 * Phase B1 — Golden path societario destructive opt-in.
 *
 * Crea una sociedad sintética nueva con CdA colegiado en governance_OS,
 * verifica que el adapter `resolveAgreementOrganoTipo` resuelve a
 * 'CONSEJO' contra datos Cloud-real (no fixture sintético), y limpia
 * todo lo creado por IDs en memoria + verificación post-cleanup por
 * runId exacto.
 *
 * NO toca ARGA Seguros ni ningún demo existente. Cada fila creada lleva
 * marker = runId del run actual.
 *
 * Opt-in vía SECRETARIA_E2E_PHASE_B1=1. Requiere SUPABASE_SERVICE_ROLE_KEY.
 *
 * Carril v1 (este archivo): API-driven setup + verificación D1. UI flow
 * completo (convocatoria/reunión/acuerdo/acta/cert) queda como B1 v2 si
 * éste pasa limpio.
 *
 * Marker scheme:
 *   runId        = `PB-YYYYMMDD-HHMMSS-<6hex>`
 *   tax_id       = `Z-PB-<6hex>`              (Z evita colisión letras CIF)
 *   legal_name   = `PHASE-B-DEMO-<runId> S.A.`
 *   config.e2e_phase_b_run = runId            (en governing_bodies)
 *
 * Cleanup:
 *   - explícito por IDs in memory en orden inverso de creación (no cascades)
 *   - log auditable por entry { table, id, marker }
 *   - verificación post por runId exacto en persons/entities/governing_bodies
 *   - check informativo separado para residuos antiguos LIKE 'Z-PB-%'
 *     (NO blocker)
 */
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolveAgreementOrganoTipo } from '../src/hooks/useAgreementCompliance';

// ── Constantes ──────────────────────────────────────────────────────

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const EXPECTED_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';

type ServiceClient = SupabaseClient;

interface CleanupEntry {
  table: string;
  id: string;
  marker: string;
}

// ── Env loading helpers (mismo patrón que e2e/32) ───────────────────

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readLocalSecretEnv(): Record<string, string> {
  try {
    const text = readFileSync(
      process.env.SECRETARIA_P0_ENV_FILE ?? DEFAULT_SECRET_ENV_FILE,
      'utf8',
    );
    const parsed: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      parsed[match[1]] = cleanEnvValue(match[2]) ?? '';
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

  if (!key) throw new Error('Missing Supabase service role key for Phase B1 destructive E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing destructive E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as ServiceClient;
}

// ── Marker generation ───────────────────────────────────────────────

function generateRunId(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const hex = randomBytes(3).toString('hex');
  return `PB-${stamp}-${hex}`;
}

function taxIdFromRunId(runId: string): string {
  // runId = PB-YYYYMMDD-HHMMSS-<6hex>; extract last 6 hex
  const parts = runId.split('-');
  const hex = parts[parts.length - 1];
  return `Z-PB-${hex}`;
}

function legalNameFromRunId(runId: string): string {
  return `PHASE-B-DEMO-${runId} S.A.`;
}

// ── Skip gate ───────────────────────────────────────────────────────

test.skip(
  process.env.SECRETARIA_E2E_PHASE_B1 !== '1',
  'Opt-in: Phase B1 destructive — creates synthetic SA + CdA in Cloud governance_OS',
);

// ── Test ────────────────────────────────────────────────────────────

test.describe('Phase B1 — golden path societario destructive', () => {
  let client: ServiceClient;
  let runId: string;
  let taxId: string;
  let legalName: string;
  const created: CleanupEntry[] = [];

  test.beforeAll(() => {
    client = serviceClient();
    runId = generateRunId();
    taxId = taxIdFromRunId(runId);
    legalName = legalNameFromRunId(runId);
    console.log(`[phase-b1] runId=${runId} taxId=${taxId} legalName=${legalName}`);
  });

  test.afterAll(async () => {
    if (!client) return;

    // Cleanup en orden inverso por IDs en memoria. Best-effort: si una
    // limpieza falla, log y continúa.
    const reverseOrder = [...created].reverse();
    for (const entry of reverseOrder) {
      try {
        const { error } = await client.from(entry.table).delete().eq('id', entry.id);
        if (error) {
          console.error(
            `[phase-b1] cleanup FAIL: ${entry.table}/${entry.id} (${entry.marker}):`,
            error.message,
          );
        } else {
          console.log(`[phase-b1] cleanup OK: ${entry.table}/${entry.id}`);
        }
      } catch (e) {
        console.error(
          `[phase-b1] cleanup THREW: ${entry.table}/${entry.id} (${entry.marker}):`,
          e,
        );
      }
    }

    // Verificación post-cleanup: 0 filas con runId actual.
    const personsLeft = await client
      .from('persons')
      .select('id', { count: 'exact', head: true })
      .eq('tax_id', taxId);
    const entitiesLeft = await client
      .from('entities')
      .select('id', { count: 'exact', head: true })
      .eq('legal_name', legalName);
    const bodiesLeft = await client
      .from('governing_bodies')
      .select('id', { count: 'exact', head: true })
      .eq('config->>e2e_phase_b_run', runId);

    expect(personsLeft.count, `persons leftovers for ${runId}`).toBe(0);
    expect(entitiesLeft.count, `entities leftovers for ${runId}`).toBe(0);
    expect(bodiesLeft.count, `governing_bodies leftovers for ${runId}`).toBe(0);

    // Check informativo separado: residuos históricos de runs anteriores.
    // NO blocker, solo log.
    const historicalLeftovers = await client
      .from('persons')
      .select('id, tax_id', { count: 'exact' })
      .like('tax_id', 'Z-PB-%')
      .neq('tax_id', taxId);
    if ((historicalLeftovers.count ?? 0) > 0) {
      console.warn(
        `[phase-b1] historical residue: ${historicalLeftovers.count} persons with Z-PB-* prefix from previous runs. ` +
          `Considera carril aparte para barrido histórico explícito.`,
      );
    }
  });

  test('crea sociedad SA + CdA y D1 resuelve organoTipo=CONSEJO contra Cloud real', async () => {
    // ── 1) Persona jurídica ───────────────────────────────────────
    const { data: person, error: pErr } = await client
      .from('persons')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        full_name: legalName,
        denomination: legalName,
        tax_id: taxId,
        person_type: 'PJ',
      })
      .select('id')
      .single();
    expect(pErr, 'insert persons').toBeNull();
    expect(person?.id).toBeDefined();
    created.push({ table: 'persons', id: person!.id, marker: runId });

    // ── 2) Entity SA ──────────────────────────────────────────────
    const slug = `phase-b1-${runId.toLowerCase()}`;
    const { data: entity, error: eErr } = await client
      .from('entities')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        person_id: person!.id,
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
    expect(eErr, 'insert entities').toBeNull();
    expect(entity?.id).toBeDefined();
    created.push({ table: 'entities', id: entity!.id, marker: runId });

    // ── 3) entity_capital_profile VIGENTE ─────────────────────────
    const { data: profile, error: cErr } = await client
      .from('entity_capital_profile')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: entity!.id,
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
    expect(cErr, 'insert entity_capital_profile').toBeNull();
    created.push({ table: 'entity_capital_profile', id: profile!.id, marker: runId });

    // ── 4) share_classes ORD ──────────────────────────────────────
    const { data: shareClass, error: scErr } = await client
      .from('share_classes')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: entity!.id,
        class_code: 'ORD',
        name: 'Ordinaria',
        votes_per_title: 1,
        economic_rights_coeff: 1,
        voting_rights: true,
        veto_rights: false,
      })
      .select('id')
      .single();
    expect(scErr, 'insert share_classes').toBeNull();
    created.push({ table: 'share_classes', id: shareClass!.id, marker: runId });

    // ── 5) governing_bodies × 2: JGA + CdA ────────────────────────
    const { data: jga, error: jgaErr } = await client
      .from('governing_bodies')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: entity!.id,
        slug: `${slug}-jga`,
        name: 'Junta General de Accionistas',
        body_type: 'JUNTA',
        config: {
          organo_tipo: 'JUNTA_GENERAL',
          tipo_social: 'SA',
          e2e_phase_b_run: runId,
        },
        quorum_rule: { primera_convocatoria_pct: 25, segunda_convocatoria_pct: 0 },
      })
      .select('id')
      .single();
    expect(jgaErr, 'insert governing_bodies JGA').toBeNull();
    created.push({ table: 'governing_bodies', id: jga!.id, marker: runId });

    const { data: cda, error: cdaErr } = await client
      .from('governing_bodies')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        entity_id: entity!.id,
        slug: `${slug}-cda`,
        name: 'Consejo de Administración',
        body_type: 'CDA',
        config: {
          organo_tipo: 'CONSEJO_ADMIN',
          voto_calidad_presidente: true,
          e2e_phase_b_run: runId,
        },
        quorum_rule: {
          quorum_asistencia: 0.5,
          mayoria_simple: 0.5,
          voto_calidad_presidente: true,
        },
      })
      .select('id')
      .single();
    expect(cdaErr, 'insert governing_bodies CdA').toBeNull();
    created.push({ table: 'governing_bodies', id: cda!.id, marker: runId });

    // ── 6) D1 verification: leer agreement-shape desde Cloud y
    //     verificar que el adapter resuelve organoTipo=CONSEJO ─────
    //
    // Construimos el shape `{governing_bodies: {body_type, config}}`
    // con los datos REALES recién insertados y los pasamos al wrapper
    // exportado del adapter. Esto valida que:
    //   a) El insert preservó body_type='CDA'.
    //   b) El config con organo_tipo='CONSEJO_ADMIN' está accesible.
    //   c) `resolveAgreementOrganoTipo` (el wrapper de useAgreementCompliance)
    //      lo resuelve a 'CONSEJO', no a 'JUNTA_GENERAL'.
    const { data: cdaFromCloud, error: cdaReadErr } = await client
      .from('governing_bodies')
      .select('body_type, config')
      .eq('id', cda!.id)
      .single();
    expect(cdaReadErr, 'read CdA back from Cloud').toBeNull();
    expect(cdaFromCloud?.body_type).toBe('CDA');

    const agreementShape = { governing_bodies: cdaFromCloud };
    const organoTipo = resolveAgreementOrganoTipo(agreementShape);
    expect(
      organoTipo,
      `D1: body_type='CDA' from Cloud must resolve to CONSEJO (not JUNTA_GENERAL)`,
    ).toBe('CONSEJO');

    // Sanity check inverso: el JGA debe resolver a JUNTA_GENERAL.
    const { data: jgaFromCloud } = await client
      .from('governing_bodies')
      .select('body_type, config')
      .eq('id', jga!.id)
      .single();
    expect(resolveAgreementOrganoTipo({ governing_bodies: jgaFromCloud })).toBe('JUNTA_GENERAL');
  });
});
