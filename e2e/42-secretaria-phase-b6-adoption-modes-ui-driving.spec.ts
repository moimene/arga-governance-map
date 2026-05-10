/**
 * Phase B6 — UI driving destructive de los adoption modes alternativos.
 *
 * Cobertura de los 3 gaps reales de UI driving (no cubiertos por e2e/30
 * watchdog que solo valida cableado, ni por e2e/32 destructive que cubre
 * NO_SESSION genérico):
 *
 *   B6.1 — CoAprobacionStepper (CO_APROBACION, k de n admins): 5 pasos
 *   B6.2 — SolidarioStepper    (SOLIDARIO, un admin actuante): 4 pasos
 *   B6.3 — DecisionUnipersonalStepper (UNIPERSONAL_*, single decision): 3 pasos
 *
 * Las 3 modalidades son adopción SIN SESIÓN distintas a NO_SESSION:
 *   - CO_APROBACION: k administradores firman (mancomunados parciales)
 *   - SOLIDARIO:     1 administrador solidario actúa unilateralmente
 *   - UNIPERSONAL:   socio único o administrador único decide
 *
 * Patrón: 1 fixture sintética compartida (SA con 4 admins solidarios y 1
 * socio único, + Junta) — 3 tests serial drive cada stepper hasta crear
 * el agreement / unipersonal_decision correspondiente. Verifican Cloud
 * que el agreement aparece con el adoption_mode esperado.
 *
 * Marker scheme:
 *   - persons.tax_id = `Z-AS-<6hex>`  (PJ sociedad sintética)
 *   - persons.tax_id LIKE `Y-AS-<6hex>%`  (PF admins solidarios + socio)
 *   - entities.legal_name LIKE `PHASE-B6-AS-<runId>%`
 *   - runId = `AS-YYYYMMDD-HHMMSS-<6hex>-B6`
 *
 * Opt-in vía SECRETARIA_E2E_PHASE_B1=1.
 */
import type { Page } from '@playwright/test';
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
  if (!key) throw new Error('Missing Supabase service role key for B6 UI driving E2E');
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
  return `AS-${stamp}-${randomBytes(2).toString('hex')}-B6`;
}

async function expectNoFatalUi(page: Page) {
  await expect(page).not.toHaveURL(/\/login/);
  for (const pattern of [
    /relation .* does not exist/i,
    /column .* does not exist/i,
    /function .* does not exist/i,
    /permission denied/i,
    /violates row-level security/i,
  ]) {
    await expect(page.getByText(pattern).first()).toHaveCount(0);
  }
}

// ── Pre-cleanup defensivo idempotente ────────────────────────────────

async function cleanLeftoverPhaseB6Residue(client: ServiceClient): Promise<void> {
  // 1. PJ persons (Z-AS-)
  const { data: pjPersons } = await client.from('persons').select('id').like('tax_id', 'Z-AS-%');
  const pjIds = (pjPersons ?? []).map((p) => p.id);

  let purged = 0;

  if (pjIds.length > 0) {
    const orFilters: string[] = [
      'legal_name.like.PHASE-B6-AS-*',
      `person_id.in.(${pjIds.join(',')})`,
    ];
    const { data: entities } = await client.from('entities').select('id').or(orFilters.join(','));
    const entityIds = (entities ?? []).map((e) => e.id);

    for (const eId of entityIds) {
      // agreements (sin parent_meeting_id porque son sin sesión) por entity_id
      const { data: agrRows } = await client.from('agreements').select('id, unipersonal_decision_id').eq('entity_id', eId);
      const agrIds = (agrRows ?? []).map((a) => a.id);
      const decIds = (agrRows ?? []).map((a) => a.unipersonal_decision_id).filter((id): id is string => Boolean(id));
      if (agrIds.length > 0) await client.from('agreements').delete().in('id', agrIds);
      if (decIds.length > 0) await client.from('unipersonal_decisions').delete().in('id', decIds);
      // also unipersonal_decisions con entity_id directo
      await client.from('unipersonal_decisions').delete().eq('entity_id', eId);
      // bodies y todo lo que cuelga
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

  for (const prefix of ['Z-AS-%', 'Y-AS-%']) {
    const { data: deleted } = await client.from('persons').delete().like('tax_id', prefix).select('id');
    purged += deleted?.length ?? 0;
  }

  if (purged > 0) {
    console.log(`[phase-b6] pre-cleanup OK: purged ${purged} legacy AS resources`);
  }
}

// ── Synthetic fixture ───────────────────────────────────────────────
//
// Una entity SA con:
//   - forma_administracion = ADMINISTRADORES_SOLIDARIOS (para B6.2)
//   - tipo_organo_admin = ADMIN_SOLIDARIOS
//   - 4 condiciones_persona ADMIN_SOLIDARIO vigentes (para CO_APROBACION k de n)
//   - 1 condicion SOCIO_UNICO (para B6.3 SOCIO_UNICO unipersonal)
//   - es_unipersonal = true (para que la entity sea SAU si acepta SOCIO_UNICO)
//
// Nota: es_unipersonal=true sólo si tipo_social='SAU' (SAU = SA Unipersonal).
// Para que tanto SOLIDARIO como UNIPERSONAL_SOCIO funcionen sobre la misma
// fixture, usamos tipo_social='SA' (no unipersonal) pero la condicion SOCIO
// vigente actúa como referencia en el motor LSC sin requerir es_unipersonal.

interface SyntheticFixture {
  runId: string;
  taxIdPj: string;
  legalName: string;
  pjPersonId: string;
  entityId: string;
  bodyJuntaId: string;
  bodyAdminId: string;
  admins: Array<{ personId: string; condicionId: string; nombre: string }>;
  socioPersonId: string;
  socioCondicionId: string;
  capitalHoldingId: string;
}

async function createSyntheticFixture(
  client: ServiceClient,
  created: CleanupEntry[],
): Promise<SyntheticFixture> {
  const runId = generateRunId();
  const hex = runId.split('-').slice(-2)[0];
  const taxIdPj = `Z-AS-${hex}`;
  const legalName = `PHASE-B6-AS-${runId} S.L.`;
  const slug = `phase-b6-${runId.toLowerCase()}`;

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

  // 2. Entity SL con ADMINISTRADORES_SOLIDARIOS
  const { data: entity, error: eErr } = await client
    .from('entities')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      person_id: pj.id,
      slug,
      legal_name: legalName,
      common_name: legalName,
      jurisdiction: 'ES',
      legal_form: 'S.L.',
      tipo_social: 'SL',
      forma_administracion: 'ADMINISTRADORES_SOLIDARIOS',
      tipo_organo_admin: 'ADMIN_SOLIDARIOS',
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
      capital_escriturado: 3000,
      capital_desembolsado: 3000,
      numero_titulos: 3000,
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

  // 5. governing_bodies — JUNTA + ADMIN_SOLIDARIOS body
  const { data: junta, error: bjErr } = await client
    .from('governing_bodies')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      slug: `${slug}-junta`,
      name: 'Junta General de Socios',
      body_type: 'JUNTA',
      config: { organo_tipo: 'JUNTA_GENERAL', e2e_phase_b_run: runId },
      quorum_rule: { quorum_asistencia: 0.5 },
    })
    .select('id')
    .single();
  if (bjErr || !junta) throw new Error(`junta insert failed: ${bjErr?.message}`);
  created.push({ table: 'governing_bodies', id: junta.id, marker: runId });

  const { data: bodyAdmin, error: baErr } = await client
    .from('governing_bodies')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      slug: `${slug}-admin-solid`,
      name: 'Administradores solidarios',
      body_type: 'CDA',
      config: { organo_tipo: 'ADMIN_SOLIDARIOS', adoption_mode: 'SOLIDARIO', e2e_phase_b_run: runId },
      quorum_rule: { accion_individual: true },
    })
    .select('id')
    .single();
  if (baErr || !bodyAdmin) throw new Error(`body_admin insert failed: ${baErr?.message}`);
  created.push({ table: 'governing_bodies', id: bodyAdmin.id, marker: runId });

  // 6. 4 admins solidarios (PF) + 1 socio único (PF)
  const admins: SyntheticFixture['admins'] = [];
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 4; i += 1) {
    const nombre = `B6 Demo Admin Solidario ${i + 1} ${runId}`;
    const { data: p, error: pErr } = await client
      .from('persons')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        full_name: nombre,
        tax_id: `Y-AS-${hex}-A${i}`,
        person_type: 'PF',
      })
      .select('id')
      .single();
    if (pErr || !p) throw new Error(`admin ${i} insert failed: ${pErr?.message}`);
    created.push({ table: 'persons', id: p.id, marker: runId });

    // CHECK chk_condicion_body_coherente: ADMIN_SOLIDARIO debe tener body_id NULL
    // (los administradores solidarios actúan por la sociedad sin estar atados a
    // un órgano colegiado). El bodyAdmin existe sólo como representación UI del
    // órgano "Administradores solidarios" — no es un cuerpo colegiado real.
    const { data: cond, error: cErr } = await client
      .from('condiciones_persona')
      .insert({
        tenant_id: DEMO_TENANT_ID,
        person_id: p.id,
        entity_id: entity.id,
        body_id: null,
        tipo_condicion: 'ADMIN_SOLIDARIO',
        estado: 'VIGENTE',
        fecha_inicio: today,
        metadata: { e2e_phase_b_run: runId },
      })
      .select('id')
      .single();
    if (cErr || !cond) throw new Error(`admin condicion ${i} failed: ${cErr?.message}`);
    created.push({ table: 'condiciones_persona', id: cond.id, marker: runId });
    admins.push({ personId: p.id, condicionId: cond.id, nombre });
  }

  // Socio único (100% capital)
  const { data: socio, error: sErr } = await client
    .from('persons')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      full_name: `B6 Demo Socio único ${runId}`,
      tax_id: `Y-AS-${hex}-S`,
      person_type: 'PF',
    })
    .select('id')
    .single();
  if (sErr || !socio) throw new Error(`socio insert failed: ${sErr?.message}`);
  created.push({ table: 'persons', id: socio.id, marker: runId });

  const { data: holding, error: hErr } = await client
    .from('capital_holdings')
    .insert({
      tenant_id: DEMO_TENANT_ID,
      entity_id: entity.id,
      holder_person_id: socio.id,
      share_class_id: shareClass.id,
      numero_titulos: 3000,
      porcentaje_capital: 100,
      voting_rights: true,
      is_treasury: false,
      effective_from: today,
      metadata: { e2e_phase_b_run: runId },
    })
    .select('id')
    .single();
  if (hErr || !holding) throw new Error(`holding insert failed: ${hErr?.message}`);
  created.push({ table: 'capital_holdings', id: holding.id, marker: runId });

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
  if (csErr || !condSocio) throw new Error(`socio condicion failed: ${csErr?.message}`);
  created.push({ table: 'condiciones_persona', id: condSocio.id, marker: runId });

  return {
    runId,
    taxIdPj,
    legalName,
    pjPersonId: pj.id,
    entityId: entity.id,
    bodyJuntaId: junta.id,
    bodyAdminId: bodyAdmin.id,
    admins,
    socioPersonId: socio.id,
    socioCondicionId: condSocio.id,
    capitalHoldingId: holding.id,
  };
}

// ── Test ────────────────────────────────────────────────────────────

test.describe.configure({ timeout: 180_000, mode: 'serial' });
test.skip(
  process.env.SECRETARIA_E2E_PHASE_B1 !== '1',
  'Opt-in: Phase B6 destructive UI driving — multi-adoption-modes',
);

test.describe('Phase B6 — UI driving destructive multi-adoption-modes (CO_APROBACION + SOLIDARIO + UNIPERSONAL)', () => {
  let client: ServiceClient;
  let fixture: SyntheticFixture;
  const created: CleanupEntry[] = [];
  // IDs creados por los steppers (no por la fixture inicial)
  const stepperCreated: CleanupEntry[] = [];

  test.beforeAll(async () => {
    client = serviceClient();
    await cleanLeftoverPhaseB6Residue(client);
    fixture = await createSyntheticFixture(client, created);
    console.log(`[phase-b6] runId=${fixture.runId} entityId=${fixture.entityId} legalName="${fixture.legalName}"`);
  });

  test.afterAll(async () => {
    if (!client) return;

    // 1. Cleanup explícito de los agreements + unipersonal_decisions creados
    //    por los steppers. ORDEN CRÍTICO: agreements PRIMERO (porque tienen
    //    FK unipersonal_decision_id → unipersonal_decisions sin CASCADE), luego
    //    unipersonal_decisions. Si hacemos reverse() sin filtrar tablas, podemos
    //    intentar borrar unipersonal_decisions antes que su agreement → FK error.
    const stepperAgreements = stepperCreated.filter((e) => e.table === 'agreements');
    const stepperDecisions = stepperCreated.filter((e) => e.table === 'unipersonal_decisions');
    for (const entry of stepperAgreements) {
      const { error } = await client.from('agreements').delete().eq('id', entry.id);
      if (error) console.error(`[phase-b6] cleanup agreements/${entry.id}:`, error.message);
      else console.log(`[phase-b6] cleanup OK: agreements/${entry.id}`);
    }
    for (const entry of stepperDecisions) {
      const { error } = await client.from('unipersonal_decisions').delete().eq('id', entry.id);
      if (error) console.error(`[phase-b6] cleanup unipersonal_decisions/${entry.id}:`, error.message);
      else console.log(`[phase-b6] cleanup OK: unipersonal_decisions/${entry.id}`);
    }

    // 2. Cleanup masivo por entity_id de cualquier residuo no rastreado
    if (fixture?.entityId) {
      const eId = fixture.entityId;
      // Delete agreements creados durante steppers (no rastreados explícitamente)
      const { data: looseAgr } = await client
        .from('agreements')
        .select('id, unipersonal_decision_id')
        .eq('entity_id', eId);
      const looseIds = (looseAgr ?? []).map((a) => a.id);
      const looseDecIds = (looseAgr ?? [])
        .map((a) => a.unipersonal_decision_id)
        .filter((id): id is string => Boolean(id));
      if (looseIds.length > 0) {
        await client.from('agreements').delete().in('id', looseIds);
        console.log(`[phase-b6] cleanup OK: ${looseIds.length} agreements (loose)`);
      }
      if (looseDecIds.length > 0) {
        await client.from('unipersonal_decisions').delete().in('id', looseDecIds);
        console.log(`[phase-b6] cleanup OK: ${looseDecIds.length} unipersonal_decisions (loose)`);
      }
      // unipersonal_decisions huérfanas con entity_id directo
      await client.from('unipersonal_decisions').delete().eq('entity_id', eId);
      // authority_evidence (trigger-creado)
      await client.from('authority_evidence').delete().eq('entity_id', eId);
    }

    // 3. Cleanup de la fixture inicial (created[]) en orden inverso
    for (const entry of [...created].reverse()) {
      const { error } = await client.from(entry.table).delete().eq('id', entry.id);
      if (error) {
        console.error(`[phase-b6] cleanup ${entry.table}/${entry.id}:`, error.message);
      } else {
        console.log(`[phase-b6] cleanup OK: ${entry.table}/${entry.id}`);
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // B6.1 — CoAprobacionStepper (CO_APROBACION, k=2 de n=4 admins)
  // 5 pasos: Tipo acuerdo → Configuración k/n → Firmas → Evaluación motor → Registrar
  // ─────────────────────────────────────────────────────────────────

  test('B6.1 CoAprobacionStepper drive 5 pasos + verify Cloud agreement CO_APROBACION', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion/co-aprobacion');
    await expect(page.getByRole('heading', { name: /Co-aprobación/i }).first()).toBeVisible({ timeout: 20_000 });
    await expectNoFatalUi(page);

    // STEP 1 — Tipo de acuerdo: select sociedad + órgano + materia + texto
    // El stepper carga entities desde useEntities + bodies por entity_id
    // Hay que esperar a que el dropdown "Sociedad" liste nuestra entity sintética.
    const sociedadSelect = page.locator('select').first();
    await expect(sociedadSelect).toBeVisible({ timeout: 10_000 });
    // Buscar la option por value (entity.id)
    await sociedadSelect.selectOption(fixture.entityId);

    // Esperar a que cargue bodies + select órgano admin (el de tipo CDA con ADMIN_SOLIDARIOS)
    const organoSelect = page.locator('select').nth(1);
    await expect(organoSelect).toBeVisible({ timeout: 10_000 });
    await organoSelect.selectOption(fixture.bodyAdminId);

    // Materia (3er select) — APROBACION_CUENTAS para que sea ORDINARIA
    const materiaSelect = page.locator('select').nth(2);
    await expect(materiaSelect).toBeVisible({ timeout: 10_000 });
    await materiaSelect.selectOption('APROBACION_CUENTAS');

    // Texto propuesta
    const textoArea = page.locator('textarea').first();
    await expect(textoArea).toBeVisible({ timeout: 10_000 });
    await textoArea.fill(`B6.1 ${fixture.runId} — Aprobar cuentas anuales por co-aprobación 2 de 4 admins solidarios`);

    // Avanzar al paso 2
    const next1 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next1).toBeEnabled({ timeout: 10_000 });
    await next1.click();

    // STEP 2 — Configuración k/n (heading "Paso 2. Configuración k de n")
    await expect(
      page.getByRole('heading', { name: /Paso 2\. Configuración k de n/i }),
    ).toBeVisible({ timeout: 10_000 });
    // Hay 3 inputs (k, n, ventana) y 1 checkbox (estatutosPermitenSinSesion)
    // Los defaults pueden estar en 0 — los seteamos a k=2, n=4
    const inputs = page.locator('input[type="number"]');
    await expect(inputs.first()).toBeVisible({ timeout: 5_000 });
    await inputs.nth(0).fill('2'); // k
    await inputs.nth(1).fill('4'); // n
    // ventana es un select o un input — la dejamos por default si existe
    const ventanaSelect = page.locator('select').last();
    if (await ventanaSelect.isVisible().catch(() => false)) {
      await ventanaSelect.selectOption({ index: 1 }).catch(() => {});
    }
    const next2 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next2).toBeEnabled({ timeout: 10_000 });
    await next2.click();

    // STEP 3 — Firmas: añadir 2 firmas (k=2 mínimo)
    // Patrón del componente: input "Nombre del administrador firmante" + botón
    // "Añadir" deshabilitado hasta que el input tenga texto. Cada Añadir hace
    // push y limpia el input, así que llenamos + click + repetimos.
    await expect(
      page.getByRole('heading', { name: /Paso 3\. Firmas/i }),
    ).toBeVisible({ timeout: 10_000 });
    const nombreFirmaInput = page.getByLabel(/Nombre del administrador firmante/i);
    const addFirmaBtn = page.getByRole('button', { name: 'Añadir' });

    // Firma 1
    await nombreFirmaInput.fill(fixture.admins[0].nombre);
    await expect(addFirmaBtn).toBeEnabled({ timeout: 5_000 });
    await addFirmaBtn.click();
    // Firma 2
    await nombreFirmaInput.fill(fixture.admins[1].nombre);
    await expect(addFirmaBtn).toBeEnabled({ timeout: 5_000 });
    await addFirmaBtn.click();

    // Verificar que las 2 firmas aparecen en la lista
    await expect(page.getByText(fixture.admins[0].nombre).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(fixture.admins[1].nombre).first()).toBeVisible({ timeout: 5_000 });

    const next3 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next3).toBeEnabled({ timeout: 10_000 });
    await next3.click();

    // STEP 4 — Evaluación motor (auto-evalúa al entrar)
    await expect(
      page.getByRole('heading', { name: /Paso 4\. Evaluación motor/i }),
    ).toBeVisible({ timeout: 15_000 });
    const next4 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next4).toBeEnabled({ timeout: 15_000 });
    await next4.click();

    // STEP 5 — Registrar
    const registrar = page.getByRole('button', { name: /^Registrar acuerdo$/i });
    await expect(registrar).toBeVisible({ timeout: 10_000 });
    await expect(registrar).toBeEnabled({ timeout: 10_000 });
    await registrar.click();

    await expect(page.getByText(/Acuerdo registrado/i).first()).toBeVisible({ timeout: 30_000 });

    // Cloud verify: agreements row con adoption_mode=CO_APROBACION
    const { data: agrs, error: agrErr } = await client
      .from('agreements')
      .select('id, adoption_mode, status, agreement_kind, matter_class, entity_id, body_id, execution_mode')
      .eq('entity_id', fixture.entityId)
      .eq('adoption_mode', 'CO_APROBACION');
    expect(agrErr, 'read CO_APROBACION agreements').toBeNull();
    expect(agrs?.length, '1 agreement CO_APROBACION creado').toBeGreaterThanOrEqual(1);
    const agr = agrs![0];
    expect(agr.adoption_mode).toBe('CO_APROBACION');
    expect(agr.body_id).toBe(fixture.bodyAdminId);
    expect(agr.agreement_kind).toBe('APROBACION_CUENTAS');
    expect(agr.execution_mode, 'execution_mode con tipo CO_APROBACION').toBeTruthy();
    const exec = agr.execution_mode as Record<string, unknown>;
    expect(exec.tipo).toBe('CO_APROBACION');

    stepperCreated.push({ table: 'agreements', id: agr.id, marker: fixture.runId });
  });

  // ─────────────────────────────────────────────────────────────────
  // B6.2 — SolidarioStepper (SOLIDARIO, 1 admin actuante)
  // 4 pasos: Tipo acuerdo → Admin actuante → Evaluación motor → Registrar
  // ─────────────────────────────────────────────────────────────────

  test('B6.2 SolidarioStepper drive 4 pasos + verify Cloud agreement SOLIDARIO', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion/solidario');
    await expect(page.getByRole('heading', { name: /Administrador solidario/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expectNoFatalUi(page);

    // STEP 1 — Tipo de acuerdo: sociedad / órgano / materia / texto
    await page.locator('#solidario-entidad').selectOption(fixture.entityId);
    await page.locator('#solidario-organo').selectOption(fixture.bodyAdminId);
    await page.locator('#solidario-materia').selectOption('NOMBRAMIENTO_CESE');
    await page.locator('#solidario-texto').fill(
      `B6.2 ${fixture.runId} — Adopción solidaria nombramiento apoderado especial`,
    );

    const next1 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next1).toBeEnabled({ timeout: 10_000 });
    await next1.click();

    // STEP 2 — Admin actuante
    await expect(page.locator('#solidario-admin-id')).toBeVisible({ timeout: 10_000 });
    await page.locator('#solidario-admin-id').fill(fixture.admins[0].personId);
    await page.locator('#solidario-admin-nombre').fill(fixture.admins[0].nombre);
    // vigencia desde — fecha de hoy
    const today = new Date().toISOString().slice(0, 10);
    await page.locator('#solidario-vigencia-desde').fill(today);

    const next2 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next2).toBeEnabled({ timeout: 10_000 });
    await next2.click();

    // STEP 3 — Evaluación motor (heading "Paso 3. Evaluación motor")
    await expect(
      page.getByRole('heading', { name: /Paso 3\. Evaluación motor/i }),
    ).toBeVisible({ timeout: 15_000 });
    const next3 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next3).toBeEnabled({ timeout: 15_000 });
    await next3.click();

    // STEP 4 — Registrar
    const registrar = page.getByRole('button', { name: /^Registrar acuerdo$/i });
    await expect(registrar).toBeVisible({ timeout: 10_000 });
    await expect(registrar).toBeEnabled({ timeout: 10_000 });
    await registrar.click();

    await expect(page.getByText(/Acuerdo registrado/i).first()).toBeVisible({ timeout: 30_000 });

    // Cloud verify
    const { data: agrs, error: agrErr } = await client
      .from('agreements')
      .select('id, adoption_mode, status, agreement_kind, matter_class, entity_id, body_id, execution_mode')
      .eq('entity_id', fixture.entityId)
      .eq('adoption_mode', 'SOLIDARIO');
    expect(agrErr, 'read SOLIDARIO agreements').toBeNull();
    expect(agrs?.length, '1 agreement SOLIDARIO creado').toBeGreaterThanOrEqual(1);
    const agr = agrs![0];
    expect(agr.adoption_mode).toBe('SOLIDARIO');
    expect(agr.body_id).toBe(fixture.bodyAdminId);
    expect(agr.agreement_kind).toBe('NOMBRAMIENTO_CESE');
    expect(agr.execution_mode, 'execution_mode con tipo SOLIDARIO').toBeTruthy();
    const exec = agr.execution_mode as Record<string, unknown>;
    expect(exec.tipo).toBe('SOLIDARIO');

    stepperCreated.push({ table: 'agreements', id: agr.id, marker: fixture.runId });
  });

  // ─────────────────────────────────────────────────────────────────
  // B6.3 — DecisionUnipersonalStepper (UNIPERSONAL_SOCIO, socio único)
  // 3 pasos: Tipo y materia → Texto del acuerdo → Registro y documento
  // ─────────────────────────────────────────────────────────────────

  test('B6.3 DecisionUnipersonalStepper drive 3 pasos + verify Cloud unipersonal_decision + agreement UNIPERSONAL_SOCIO', async ({ page }) => {
    // Capturar errores de browser, toasts y network failures para debug
    const browserErrors: string[] = [];
    const networkFails: string[] = [];
    page.on('pageerror', (err) => browserErrors.push(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && !/favicon|ResizeObserver/i.test(text)) {
        browserErrors.push(`[console.error] ${text}`);
      }
    });
    page.on('response', async (resp) => {
      const url = resp.url();
      const status = resp.status();
      if (status >= 400 && /supabase\.co\/rest\/|supabase\.co\/rpc\//.test(url)) {
        let body = '';
        try {
          body = await resp.text();
        } catch {
          body = '<no body>';
        }
        networkFails.push(`[${status}] ${resp.request().method()} ${url} → ${body.slice(0, 500)}`);
      }
    });

    await page.goto('/secretaria/decisiones-unipersonales/nueva');
    await expect(page.getByRole('heading', { name: /decisión unipersonal/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expectNoFatalUi(page);

    // STEP 1 — Tipo y materia
    // Sociedad select (primer select de la página)
    const sociedadSelect = page.locator('select').first();
    await expect(sociedadSelect).toBeVisible({ timeout: 10_000 });
    await sociedadSelect.selectOption(fixture.entityId);

    // Tipo decision (botones SOCIO_UNICO / ADMINISTRADOR_UNICO)
    await page.getByRole('button', { name: /Socio único/i }).click();

    // Materia: el 2º select aparece DESPUÉS de cargar useMateriaCatalog.
    // Mientras carga muestra "Cargando catálogo…" en lugar del select.
    await expect(page.getByText(/Cargando catálogo/i)).toHaveCount(0, { timeout: 15_000 });
    const materiaSelect = page.locator('select').nth(1);
    await expect(materiaSelect).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => (await materiaSelect.locator('option').count()), { timeout: 10_000 })
      .toBeGreaterThan(1);

    // Post-fix matter_class='ESPECIAL' (commit posterior a B6 — ver
    // docs/superpowers/plans/2026-05-09-matter-class-especial-filter.md):
    // useMateriaCatalog filtra el dropdown a sólo matter_class compatibles
    // con agreements (ORDINARIA / ESTATUTARIA / ESTRUCTURAL). Por tanto la
    // primera opción no-vacía siempre es safe-to-pick — ya no hay workaround
    // forzando APROBACION_CUENTAS.
    const optionsCount = await materiaSelect.locator('option').count();
    let pickedValue: string | null = null;
    for (let i = 0; i < optionsCount; i += 1) {
      const v = await materiaSelect.locator('option').nth(i).getAttribute('value');
      if (v && v.trim().length > 0) { pickedValue = v; break; }
    }
    expect(pickedValue, 'al menos 1 materia agreement-compatible').not.toBeNull();
    await materiaSelect.selectOption(pickedValue!);

    const next1 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next1).toBeEnabled({ timeout: 10_000 });
    await next1.click();

    // STEP 2 — Texto del acuerdo
    await expect(
      page.getByRole('heading', { name: /Paso 2\. Texto del acuerdo/i }),
    ).toBeVisible({ timeout: 10_000 });
    const textoArea = page.locator('textarea').first();
    await textoArea.fill(
      `B6.3 ${fixture.runId} — El socio único acuerda nombrar como apoderado al Sr./Sra. apoderado especial.`,
    );
    // Fundamento jurídico opcional (input text que sigue al textarea)
    const fundamentoInput = page.locator('input[type="text"]').last();
    if (await fundamentoInput.isVisible().catch(() => false)) {
      await fundamentoInput.fill('art. 15 LSC');
    }

    const next2 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next2).toBeEnabled({ timeout: 10_000 });
    await next2.click();

    // STEP 3 — Registro y documento (FirmaArchivoStep)
    await expect(
      page.getByRole('heading', { name: /Paso 3\. Registro y documento/i }),
    ).toBeVisible({ timeout: 10_000 });
    // Botón crear con texto exacto "Registrar decisión y expediente"
    const crearBtn = page.getByRole('button', { name: /Registrar decisión y expediente/i });
    await expect(crearBtn).toBeVisible({ timeout: 10_000 });
    await expect(crearBtn).toBeEnabled({ timeout: 10_000 });
    await crearBtn.click();

    // Tras el éxito, aparece el banner "Decisión registrada y expediente creado"
    await expect(
      page.getByText(/Decisión registrada y expediente creado/i).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Sin errores fatales en browser ni network 4xx en endpoints Supabase
    expect(
      browserErrors.filter((e) =>
        /relation .* does not exist|column .* does not exist|permission denied|RLS/i.test(e),
      ),
      'no fatal errors during unipersonal UI flow',
    ).toEqual([]);
    expect(networkFails, 'no Supabase 4xx during unipersonal flow').toEqual([]);

    // Cloud verify: unipersonal_decisions row con adoption_mode SOCIO_UNICO
    const { data: decs, error: decErr } = await client
      .from('unipersonal_decisions')
      .select('id, decision_type, status, entity_id, content, decision_date')
      .eq('entity_id', fixture.entityId)
      .eq('decision_type', 'SOCIO_UNICO');
    expect(decErr, 'read unipersonal_decisions').toBeNull();
    expect(decs?.length, '1 unipersonal_decision SOCIO_UNICO creada').toBeGreaterThanOrEqual(1);
    const dec = decs![0];
    expect(dec.status).toBe('FIRMADA');
    expect(dec.entity_id).toBe(fixture.entityId);

    // Cloud verify: agreement con adoption_mode=UNIPERSONAL_SOCIO + unipersonal_decision_id
    const { data: agrs, error: agrErr } = await client
      .from('agreements')
      .select('id, adoption_mode, status, unipersonal_decision_id, entity_id')
      .eq('unipersonal_decision_id', dec.id);
    expect(agrErr, 'read UNIPERSONAL agreements').toBeNull();
    expect(agrs?.length, '1 agreement UNIPERSONAL_SOCIO creado').toBeGreaterThanOrEqual(1);
    const agr = agrs![0];
    expect(agr.adoption_mode).toBe('UNIPERSONAL_SOCIO');
    expect(agr.status).toBe('ADOPTED');

    stepperCreated.push({ table: 'agreements', id: agr.id, marker: fixture.runId });
    stepperCreated.push({ table: 'unipersonal_decisions', id: dec.id, marker: fixture.runId });
  });
});
