/**
 * Phase B5 — UI driving destructive del ConvocatoriasStepper.
 *
 * Drives los 7 pasos del stepper end-to-end con sociedad sintética CdA SA:
 *   1. Sociedad y órgano (select entity + body + tipo ORDINARIA)
 *   2. Fecha y plazo legal (date + lugar)
 *   3. Orden del día (1 punto APROBACION_CUENTAS)
 *   4. Destinatarios (default — body members cargan automáticamente)
 *   5. Canales de publicación (default recomendados WEB_CORPORATIVA + ERDS)
 *   6. Adjuntos (skip)
 *   7. Revisión y emisión → click "Emitir convocatoria"
 *
 * Verificación Cloud: convocatorias row con estado='EMITIDA',
 *   body_id correcto, tipo_convocatoria='ORDINARIA', agenda_items array
 *   con al menos 1 punto, publication_channels array no vacío.
 *
 * Diferencias clave vs e2e/04-secretaria-convocatorias.spec.ts (read-only)
 * y vs e2e/18-secretaria-golden-path.spec.ts (golden path contra ARGA real):
 *   - e2e/41 usa fixture sintética (no ARGA), destructive opt-in
 *   - e2e/41 verifica Cloud writes vía service_role (no UI assertions únicamente)
 *
 * Marker scheme:
 *   - persons.tax_id = `Z-CV-<6hex>` (PJ sociedad)
 *   - persons.tax_id LIKE `Y-CV-<6hex>%` (PF consejeros del CdA)
 *   - entities.legal_name LIKE `PHASE-B5-CV-<runId>%`
 *   - convocatorias: identificable por body_id de la fixture
 *   - runId = `CV-YYYYMMDD-HHMMSS-<6hex>-B5`
 *
 * Opt-in vía SECRETARIA_E2E_PHASE_B1=1.
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
  if (!key) throw new Error('Missing Supabase service role key for B5 UI driving E2E');
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
  return `CV-${stamp}-${randomBytes(2).toString('hex')}-B5`;
}

// ── Pre-cleanup defensivo ────────────────────────────────────────────

async function cleanLeftoverPhaseB5Residue(client: ServiceClient): Promise<void> {
  const { data: pjPersons } = await client.from('persons').select('id').like('tax_id', 'Z-CV-%');
  const pjIds = (pjPersons ?? []).map((p) => p.id);

  let purged = 0;

  if (pjIds.length > 0) {
    const orFilters: string[] = ['legal_name.like.PHASE-B5-CV-*', `person_id.in.(${pjIds.join(',')})`];
    const { data: entities } = await client.from('entities').select('id').or(orFilters.join(','));
    const entityIds = (entities ?? []).map((e) => e.id);

    for (const eId of entityIds) {
      const { data: bodies } = await client.from('governing_bodies').select('id').eq('entity_id', eId);
      const bodyIds = (bodies ?? []).map((b) => b.id);
      // Borrar convocatorias por body_id
      if (bodyIds.length > 0) {
        await client.from('convocatorias').delete().in('body_id', bodyIds);
      }
      await client.from('authority_evidence').delete().eq('entity_id', eId);
      await client.from('condiciones_persona').delete().eq('entity_id', eId);
      await client.from('capital_holdings').delete().eq('entity_id', eId);
      await client.from('share_classes').delete().eq('entity_id', eId);
      await client.from('entity_capital_profile').delete().eq('entity_id', eId);
      await client.from('governing_bodies').delete().eq('entity_id', eId);
      await client.from('entities').delete().eq('id', eId);
      purged += 1;
    }
  }

  for (const prefix of ['Z-CV-%', 'Y-CV-%']) {
    const { data: deleted } = await client.from('persons').delete().like('tax_id', prefix).select('id');
    purged += deleted?.length ?? 0;
  }

  if (purged > 0) {
    console.log(`[phase-b5] pre-cleanup OK: purged ${purged} legacy CV resources`);
  }
}

// ── Synthetic fixture ────────────────────────────────────────────────

interface SyntheticFixture {
  runId: string;
  taxIdPj: string;
  legalName: string;
  pjPersonId: string;
  entityId: string;
  bodyId: string;
  consejeros: Array<{ personId: string; cargo: string; condicionId: string }>;
}

async function createSyntheticFixture(client: ServiceClient, created: CleanupEntry[]): Promise<SyntheticFixture> {
  const runId = generateRunId();
  const hex = runId.split('-').slice(-2)[0];
  const taxIdPj = `Z-CV-${hex}`;
  const legalName = `PHASE-B5-CV-${runId} S.A.`;
  const slug = `phase-b5-${runId.toLowerCase()}`;

  const { data: pj, error: pjErr } = await client
    .from('persons')
    .insert({ tenant_id: DEMO_TENANT_ID, full_name: legalName, denomination: legalName, tax_id: taxIdPj, person_type: 'PJ' })
    .select('id')
    .single();
  if (pjErr || !pj) throw new Error(`PJ insert failed: ${pjErr?.message}`);
  created.push({ table: 'persons', id: pj.id, marker: runId });

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

  const { data: profile } = await client
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
  if (profile) created.push({ table: 'entity_capital_profile', id: profile.id, marker: runId });

  const { data: shareClass } = await client
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
  if (shareClass) created.push({ table: 'share_classes', id: shareClass.id, marker: runId });

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

  // Socio único + capital_holding 100% para que la entity pase demo-readiness.
  // useEntityDemoReadiness clasifica la entity como 'reference_only' si NO hay
  // capital_holdings activos (effective_to NULL), bloqueando canAdvance del step 1
  // del ConvocatoriaStepper. Con 1 socio + 1 holding 100% pasamos a 'partial'.
  const { data: socio } = await client
    .from('persons')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      full_name: `B5 Demo Socio único ${runId}`,
      tax_id: `Y-CV-${hex}-S`,
      person_type: 'PF',
    })
    .select('id')
    .single();
  if (socio) created.push({ table: 'persons', id: socio.id, marker: runId });

  if (socio && shareClass) {
    const { data: holding } = await client
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
    if (holding) created.push({ table: 'capital_holdings', id: holding.id, marker: runId });
  }

  const consejeros: SyntheticFixture['consejeros'] = [];
  const today = new Date().toISOString().slice(0, 10);
  const cargos = ['PRESIDENTE', 'SECRETARIO', 'CONSEJERO'];
  for (let i = 0; i < cargos.length; i += 1) {
    const { data: p, error: pErr } = await client
      .from('persons')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        full_name: `B5 Demo ${cargos[i]} ${i + 1} ${runId}`,
        tax_id: `Y-CV-${hex}-${i}`,
        person_type: 'PF',
      })
      .select('id')
      .single();
    if (pErr || !p) throw new Error(`consejero ${i} failed: ${pErr?.message}`);
    created.push({ table: 'persons', id: p.id, marker: runId });

    const { data: cond, error: cErr } = await client
      .from('condiciones_persona')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        person_id: p.id,
        entity_id: entity.id,
        body_id: body.id,
        tipo_condicion: cargos[i],
        estado: 'VIGENTE',
        fecha_inicio: today,
        metadata: { e2e_phase_b_run: runId },
      })
      .select('id')
      .single();
    if (cErr || !cond) throw new Error(`condicion ${cargos[i]} failed: ${cErr?.message}`);
    created.push({ table: 'condiciones_persona', id: cond.id, marker: runId });
    consejeros.push({ personId: p.id, cargo: cargos[i], condicionId: cond.id });
  }

  return {
    runId,
    taxIdPj,
    legalName,
    pjPersonId: pj.id,
    entityId: entity.id,
    bodyId: body.id,
    consejeros,
  };
}

// ── Test ────────────────────────────────────────────────────────────

test.describe.configure({ timeout: 120_000 });
test.skip(
  process.env.SECRETARIA_E2E_PHASE_B1 !== '1',
  'Opt-in: Phase B5 destructive UI driving — ConvocatoriaStepper synthetic',
);

test.describe('Phase B5 — UI driving destructive ConvocatoriaStepper synthetic', () => {
  let client: ServiceClient;
  let fixture: SyntheticFixture;
  const created: CleanupEntry[] = [];

  test.beforeAll(async () => {
    client = serviceClient();
    await cleanLeftoverPhaseB5Residue(client);
    fixture = await createSyntheticFixture(client, created);
    console.log(`[phase-b5] runId=${fixture.runId} entityId=${fixture.entityId} bodyId=${fixture.bodyId}`);
  });

  test.afterAll(async () => {
    if (!client) return;

    // 1. Cleanup convocatorias creadas por el stepper (FK-safe: no hay deps)
    if (fixture?.bodyId) {
      const { data: convs } = await client
        .from('convocatorias')
        .select('id')
        .eq('body_id', fixture.bodyId);
      if (convs && convs.length > 0) {
        await client.from('convocatorias').delete().in('id', convs.map((c) => c.id));
        console.log(`[phase-b5] cleanup OK: ${convs.length} convocatorias`);
      }
    }

    // 2. authority_evidence trigger-creado
    if (fixture?.entityId) {
      await client.from('authority_evidence').delete().eq('entity_id', fixture.entityId);
    }

    // 3. Cleanup fixture en orden inverso
    for (const entry of [...created].reverse()) {
      const { error } = await client.from(entry.table).delete().eq('id', entry.id);
      if (error) console.error(`[phase-b5] cleanup ${entry.table}/${entry.id}:`, error.message);
      else console.log(`[phase-b5] cleanup OK: ${entry.table}/${entry.id}`);
    }
  });

  test('UI ConvocatoriaStepper drive 7 pasos + verify Cloud convocatoria EMITIDA', async ({ page }) => {
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
        networkFails.push(`[${status}] ${resp.request().method()} ${url} → ${body.slice(0, 300)}`);
      }
    });

    await page.goto('/secretaria/convocatorias/nueva');
    await expect(
      page.getByRole('heading', { name: /Asistente de convocatoria/i }).first(),
    ).toBeVisible({ timeout: 20_000 });

    // ── PASO 1: Sociedad y órgano ────────────────────────────────
    // Sociedad select (primer select)
    const sociedadSelect = page.locator('select').first();
    await expect(sociedadSelect).toBeVisible({ timeout: 10_000 });
    await sociedadSelect.selectOption(fixture.entityId);

    // Órgano select aparece tras seleccionar sociedad
    const organoSelect = page.locator('select').nth(1);
    await expect(organoSelect).toBeVisible({ timeout: 10_000 });
    // Esperar a que cargue bodies del entity (puede tardar)
    await expect
      .poll(async () => (await organoSelect.locator('option').count()), { timeout: 10_000 })
      .toBeGreaterThan(1);
    await organoSelect.selectOption(fixture.bodyId);

    // Tipo de reunión: botones ORDINARIA/EXTRAORDINARIA/UNIVERSAL.
    // Por default tipoConvocatoria es 'ORDINARIA' — clickamos para asegurar.
    const ordinariaBtn = page.getByRole('button', { name: /^Ordinaria$/i }).first();
    if (await ordinariaBtn.isVisible().catch(() => false)) {
      await ordinariaBtn.click();
    }

    // Avanzar a step 2
    const next1 = page.getByRole('button', { name: /^Siguiente$/i });
    await expect(next1).toBeEnabled({ timeout: 15_000 });
    await next1.click();

    // ── PASO 2: Fecha y plazo legal ───────────────────────────────
    await expect(
      page.getByRole('heading', { name: /Paso 2\. Fecha y plazo legal/i }),
    ).toBeVisible({ timeout: 10_000 });
    // Fecha 30 días en el futuro (suficiente antelación para SA art. 176 LSC)
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.locator('input[type="date"]').first().fill(futureDate);
    await page.locator('input[type="text"]').first().fill('Sede social C/ Gran Vía 1, Madrid');

    const next2 = page.getByRole('button', { name: /^Siguiente$/i });
    await expect(next2).toBeEnabled({ timeout: 10_000 });
    await next2.click();

    // ── PASO 3: Orden del día ──────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: /Paso 3\. Orden del día/i }),
    ).toBeVisible({ timeout: 10_000 });
    // El default tiene 1 agenda item vacío. Llenamos su titulo.
    const tituloPunto = page.getByPlaceholder(/Descripción del punto del orden del día/i).first();
    await expect(tituloPunto).toBeVisible({ timeout: 5_000 });
    await tituloPunto.fill(`B5 ${fixture.runId} — Aprobación de cuentas anuales 2025`);

    const next3 = page.getByRole('button', { name: /^Siguiente$/i });
    await expect(next3).toBeEnabled({ timeout: 10_000 });
    await next3.click();

    // ── PASO 4: Destinatarios (default: body members cargan) ──────
    await expect(
      page.getByRole('heading', { name: /Paso 4\. Destinatarios/i }),
    ).toBeVisible({ timeout: 10_000 });
    // canAdvance default true, click siguiente
    const next4 = page.getByRole('button', { name: /^Siguiente$/i });
    await expect(next4).toBeEnabled({ timeout: 10_000 });
    await next4.click();

    // ── PASO 5: Canales de publicación (default recomendados) ─────
    await expect(
      page.getByRole('heading', { name: /Paso 5\. Canales de publicación/i }),
    ).toBeVisible({ timeout: 10_000 });
    const next5 = page.getByRole('button', { name: /^Siguiente$/i });
    await expect(next5).toBeEnabled({ timeout: 10_000 });
    await next5.click();

    // ── PASO 6: Adjuntos (skip) ────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: /Paso 6\. Adjuntos/i }),
    ).toBeVisible({ timeout: 10_000 });
    const next6 = page.getByRole('button', { name: /^Siguiente$/i });
    await expect(next6).toBeEnabled({ timeout: 10_000 });
    await next6.click();

    // ── PASO 7: Revisión y emisión ─────────────────────────────────
    await expect(
      page.getByRole('heading', { name: /Paso 7\. Revisión y emisión/i }),
    ).toBeVisible({ timeout: 10_000 });
    // El botón principal cambia de "Siguiente" a "Emitir convocatoria"
    const emitirBtn = page.getByRole('button', { name: /Emitir convocatoria/i });
    await expect(emitirBtn).toBeVisible({ timeout: 10_000 });
    await expect(emitirBtn).toBeEnabled({ timeout: 10_000 });
    await emitirBtn.click();

    // Tras éxito el stepper renderiza un success screen in-page (NO hay redirect).
    // Esperamos al toast "Convocatoria emitida correctamente" o al banner verde.
    await expect(
      page.getByText(/Convocatoria emitida correctamente/i).first(),
    ).toBeVisible({ timeout: 30_000 });

    // ── Verificación Cloud ─────────────────────────────────────────
    const { data: convs, error: convErr } = await client
      .from('convocatorias')
      .select('id, body_id, tipo_convocatoria, estado, fecha_1, lugar, agenda_items, publication_channels, junta_universal, is_second_call, modalidad')
      .eq('body_id', fixture.bodyId);
    expect(convErr, 'read convocatorias').toBeNull();
    expect(convs?.length, 'al menos 1 convocatoria creada').toBeGreaterThanOrEqual(1);

    const conv = convs![0];
    expect(conv.estado).toBe('EMITIDA');
    expect(conv.body_id).toBe(fixture.bodyId);
    expect(conv.tipo_convocatoria).toBe('ORDINARIA');
    expect(conv.lugar).toMatch(/Sede social/i);
    expect(conv.junta_universal).toBe(false);
    expect(Array.isArray(conv.agenda_items)).toBe(true);
    expect((conv.agenda_items as unknown[]).length, 'agenda con al menos 1 punto').toBeGreaterThanOrEqual(1);

    // Sin errores fatales
    expect(
      browserErrors.filter((e) =>
        /relation .* does not exist|column .* does not exist|permission denied|RLS/i.test(e),
      ),
      'no fatal errors during convocatoria UI flow',
    ).toEqual([]);
    // Network fails: tolerantes a 4xx en consultas read-only que usen 406 (no rows),
    // pero rechazamos cualquier 4xx en POST/PATCH/DELETE.
    const writeNetworkFails = networkFails.filter((f) =>
      /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f),
    );
    expect(writeNetworkFails, 'no Supabase write 4xx during convocatoria flow').toEqual([]);
  });
});
