/**
 * Phase B7 — UI driving destructive de SociedadNuevaStepper.
 *
 * Cubre el alta de una sociedad SA desde cero vía UI. Drives los 4 pasos
 * (Identidad / Administración / Capital / Confirmar) y verifica Cloud
 * que se crearon correctamente:
 *   - persons (PJ) — denominación legal
 *   - entities — con FK person_id + jurisdicción + tipo_social + tipo_organo_admin
 *   - entity_capital_profile — VIGENTE con capital escriturado/desembolsado
 *   - share_classes — clase ORD ordinaria
 *   - governing_bodies (2) — Junta General + CdA seed
 *
 * Diferencias clave vs e2e/35-secretaria-alta-rollback.spec.ts:
 *   - e2e/35 valida ROLLBACK ante fallo intermedio (test pesimista)
 *   - e2e/43 valida HAPPY PATH end-to-end (test optimista) con verificación
 *     Cloud completa de las 5 tablas escritas + cleanup destructive
 *
 * Marker scheme:
 *   - persons.tax_id = `Z-NS-<6hex>`  (PJ sociedad sintética)
 *   - entities.legal_name LIKE `PHASE-B7-NS-<runId>%`
 *   - runId = `NS-YYYYMMDD-HHMMSS-<6hex>-B7`
 *
 * Opt-in vía SECRETARIA_E2E_PHASE_B1=1 (mismo flag que B1/B3/B4).
 */
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const EXPECTED_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';

type ServiceClient = SupabaseClient;

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
  if (!key) throw new Error('Missing Supabase service role key for B7 UI driving E2E');
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
  return `NS-${stamp}-${randomBytes(2).toString('hex')}-B7`;
}

// ── Pre-cleanup defensivo idempotente ────────────────────────────────
//
// Si runs anteriores de B7 fallaron antes de que SociedadNuevaStepper.guardar()
// completara los 5 inserts, dejan residuos en Cloud. Este helper purga
// cualquier residuo NS-marker antes de empezar el run actual.

async function cleanLeftoverPhaseB7Residue(client: ServiceClient): Promise<void> {
  // 1. Find PJ persons (Z-NS-) - owners of synthetic societies
  const { data: pjPersons } = await client.from('persons').select('id').like('tax_id', 'Z-NS-%');
  const pjIds = (pjPersons ?? []).map((p) => p.id);

  let purged = 0;

  if (pjIds.length > 0) {
    // 2. Find entities owned by these PJs OR with PHASE-B7- legal_name
    const orFilters: string[] = ['legal_name.like.PHASE-B7-NS-*', `person_id.in.(${pjIds.join(',')})`];
    const { data: entities } = await client.from('entities').select('id').or(orFilters.join(','));
    const entityIds = (entities ?? []).map((e) => e.id);

    for (const eId of entityIds) {
      // condiciones / capital / shares / bodies first
      await client.from('condiciones_persona').delete().eq('entity_id', eId);
      await client.from('capital_holdings').delete().eq('entity_id', eId);
      await client.from('share_classes').delete().eq('entity_id', eId);
      await client.from('entity_capital_profile').delete().eq('entity_id', eId);
      await client.from('governing_bodies').delete().eq('entity_id', eId);
      await client.from('entities').delete().eq('id', eId);
      purged += 1;
    }
  }

  const { data: deletedPjs } = await client
    .from('persons')
    .delete()
    .like('tax_id', 'Z-NS-%')
    .select('id');
  purged += deletedPjs?.length ?? 0;

  if (purged > 0) {
    console.log(`[phase-b7] pre-cleanup OK: purged ${purged} legacy NS resources`);
  }
}

// ── Test ────────────────────────────────────────────────────────────

test.describe.configure({ timeout: 120_000 });
test.skip(
  process.env.SECRETARIA_E2E_PHASE_B1 !== '1',
  'Opt-in: Phase B7 destructive UI driving — synthetic sociedad alta SociedadNuevaStepper',
);

interface CreatedEntity {
  runId: string;
  taxId: string;
  legalName: string;
  // populated post-stepper run via Cloud query
  pjPersonId: string | null;
  entityId: string | null;
}

test.describe('Phase B7 — UI driving destructive SociedadNuevaStepper', () => {
  let client: ServiceClient;
  let trace: CreatedEntity;

  test.beforeAll(async () => {
    client = serviceClient();
    await cleanLeftoverPhaseB7Residue(client);

    const runId = generateRunId();
    const hex = runId.split('-').slice(-2)[0];
    trace = {
      runId,
      taxId: `Z-NS-${hex}`,
      legalName: `PHASE-B7-NS-${runId} S.A.`,
      pjPersonId: null,
      entityId: null,
    };
    console.log(`[phase-b7] runId=${trace.runId} taxId=${trace.taxId} legalName="${trace.legalName}"`);
  });

  test.afterAll(async () => {
    if (!client || !trace.entityId) {
      // Si no llegó a crearse la entity, sólo borramos PJ residual
      if (trace?.pjPersonId) {
        await client.from('persons').delete().eq('id', trace.pjPersonId);
      }
      return;
    }
    // Cascade cleanup: bodies → share_classes → capital_profile → entity → PJ
    const eId = trace.entityId;
    await client.from('condiciones_persona').delete().eq('entity_id', eId);
    await client.from('capital_holdings').delete().eq('entity_id', eId);
    await client.from('share_classes').delete().eq('entity_id', eId);
    await client.from('entity_capital_profile').delete().eq('entity_id', eId);
    await client.from('governing_bodies').delete().eq('entity_id', eId);
    const { error: eErr } = await client.from('entities').delete().eq('id', eId);
    if (eErr) console.error('[phase-b7] cleanup entity FAIL:', eErr.message);
    else console.log(`[phase-b7] cleanup OK: entity/${eId}`);

    if (trace.pjPersonId) {
      const { error: pErr } = await client.from('persons').delete().eq('id', trace.pjPersonId);
      if (pErr) console.error('[phase-b7] cleanup PJ FAIL:', pErr.message);
      else console.log(`[phase-b7] cleanup OK: persons/${trace.pjPersonId}`);
    }
  });

  test('UI SociedadNuevaStepper drive 4 pasos + verify Cloud writes', async ({ page }) => {
    // Capturar errores de browser para debug
    const browserErrors: string[] = [];
    page.on('pageerror', (err) => browserErrors.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/favicon|ResizeObserver/i.test(msg.text())) {
        browserErrors.push(`[console.error] ${msg.text()}`);
      }
    });

    await page.goto('/secretaria/sociedades/nueva');
    await expect(page.getByRole('heading', { name: 'Alta de sociedad' })).toBeVisible({
      timeout: 20_000,
    });

    // ── PASO 1: Identidad ────────────────────────────────────────
    // Campos por <label> con span: usamos getByLabel (Playwright matchea aunque
    // el span vaya antes del input, gracias al asociado HTML).
    await page.getByLabel(/Denominación legal/i).fill(trace.legalName);
    await page.getByLabel(/Nombre común/i).fill(`PHASE B7 NS ${trace.runId}`);
    await page.getByLabel(/NIF\/CIF/i).fill(trace.taxId);
    await page.getByLabel(/Tipo social/i).selectOption('SA');
    // Jurisdicción ya viene 'ES' por default en EMPTY draft, pero forzamos
    await page.getByLabel(/Jurisdicción/i).fill('ES');

    // canNext en step 0: legal_name + tax_id + jurisdiction → "Siguiente" enabled
    const next1 = page.getByRole('button', { name: 'Siguiente' });
    await expect(next1).toBeEnabled({ timeout: 10_000 });
    await next1.click();

    // ── PASO 2: Administración ───────────────────────────────────
    await expect(page.getByLabel(/Órgano de administración/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/Órgano de administración/i).selectOption('CDA');
    // unipersonal y cotizada quedan en false default
    const next2 = page.getByRole('button', { name: 'Siguiente' });
    await expect(next2).toBeEnabled({ timeout: 10_000 });
    await next2.click();

    // ── PASO 3: Capital ───────────────────────────────────────────
    await expect(page.getByLabel(/Capital escriturado/i)).toBeVisible({ timeout: 10_000 });
    await page.getByLabel(/Capital escriturado/i).fill('60000');
    await page.getByLabel(/Número de títulos/i).fill('60000');
    // valor_nominal es auto, no editable

    const next3 = page.getByRole('button', { name: 'Siguiente' });
    await expect(next3).toBeEnabled({ timeout: 10_000 });
    await next3.click();

    // ── PASO 4: Confirmar + crear ────────────────────────────────
    await expect(page.getByText(/Revisa los datos/i).first()).toBeVisible({ timeout: 10_000 });
    // El botón principal cambia a "Crear sociedad"
    const crear = page.getByRole('button', { name: 'Crear sociedad' });
    await expect(crear).toBeEnabled({ timeout: 10_000 });
    await crear.click();

    // Esperar toast success o redirect a /secretaria/sociedades/:id
    await page.waitForURL(/\/secretaria\/sociedades\/[a-f0-9-]{36}/, { timeout: 30_000 });
    const url = page.url();
    const idMatch = url.match(/\/secretaria\/sociedades\/([a-f0-9-]{36})/);
    expect(idMatch, 'redirect a detalle de sociedad creada').not.toBeNull();
    const createdEntityId = idMatch![1];

    // ── Verificación Cloud ──────────────────────────────────────
    // 1. PJ con tax_id marker
    const { data: pj, error: pjErr } = await client
      .from('persons')
      .select('id, full_name, tax_id, person_type, denomination')
      .eq('tax_id', trace.taxId)
      .maybeSingle();
    expect(pjErr, 'read PJ').toBeNull();
    expect(pj, 'PJ creada con marker').not.toBeNull();
    expect(pj!.person_type).toBe('PJ');
    expect(pj!.denomination).toBe(trace.legalName);
    trace.pjPersonId = pj!.id;

    // 2. Entity con FK person_id, tipo_social SA, tipo_organo_admin CDA
    const { data: entity, error: eErr } = await client
      .from('entities')
      .select('id, person_id, legal_name, tipo_social, tipo_organo_admin, jurisdiction, entity_status, materiality, forma_administracion')
      .eq('id', createdEntityId)
      .maybeSingle();
    expect(eErr, 'read entity').toBeNull();
    expect(entity, 'entity creada').not.toBeNull();
    expect(entity!.person_id, 'entity.person_id FK al PJ').toBe(pj!.id);
    expect(entity!.legal_name).toBe(trace.legalName);
    expect(entity!.tipo_social).toBe('SA');
    expect(entity!.tipo_organo_admin).toBe('CDA');
    expect(entity!.jurisdiction).toBe('ES');
    expect(entity!.entity_status).toBe('Active');
    expect(entity!.forma_administracion).toBe('CONSEJO');
    trace.entityId = entity!.id;

    // 3. entity_capital_profile VIGENTE
    const { data: profile, error: pfErr } = await client
      .from('entity_capital_profile')
      .select('entity_id, capital_escriturado, capital_desembolsado, numero_titulos, valor_nominal, estado, currency')
      .eq('entity_id', createdEntityId)
      .eq('estado', 'VIGENTE')
      .maybeSingle();
    expect(pfErr, 'read capital_profile').toBeNull();
    expect(profile, 'capital_profile VIGENTE').not.toBeNull();
    expect(profile!.capital_escriturado).toBe(60000);
    expect(profile!.capital_desembolsado).toBe(60000);
    expect(profile!.numero_titulos).toBe(60000);
    expect(profile!.currency).toBe('EUR');

    // 4. share_classes — al menos 1 clase ORD
    const { data: shares, error: shErr } = await client
      .from('share_classes')
      .select('class_code, name, votes_per_title, voting_rights')
      .eq('entity_id', createdEntityId);
    expect(shErr, 'read share_classes').toBeNull();
    expect(shares?.length ?? 0, 'al menos 1 share_class').toBeGreaterThanOrEqual(1);
    const ord = shares!.find((s) => s.class_code === 'ORD');
    expect(ord, 'clase ORD ordinaria creada').toBeDefined();
    expect(ord!.voting_rights).toBe(true);

    // 5. governing_bodies — 2 órganos seed (Junta + CdA)
    const { data: bodies, error: bErr } = await client
      .from('governing_bodies')
      .select('name, body_type, slug')
      .eq('entity_id', createdEntityId);
    expect(bErr, 'read bodies').toBeNull();
    expect(bodies?.length ?? 0, '2 órganos seed creados').toBeGreaterThanOrEqual(2);
    const junta = bodies!.find((b) => b.body_type === 'JUNTA');
    const cda = bodies!.find((b) => b.body_type === 'CDA');
    expect(junta, 'Junta General creada').toBeDefined();
    expect(cda, 'CdA creado').toBeDefined();
    expect(junta!.name).toMatch(/Junta General/i);

    // Sin errores fatales en browser
    expect(
      browserErrors.filter((e) =>
        /relation .* does not exist|column .* does not exist|permission denied|RLS/i.test(e),
      ),
      'no fatal errors during sociedad alta UI flow',
    ).toEqual([]);
  });
});
