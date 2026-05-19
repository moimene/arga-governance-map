/**
 * E2E opt-in — firma del acta del Consejo + emisión de certificación QES.
 *
 * Continúa T2 (e2e/49). El acta del Consejo quedó en BORRADOR
 * (`signed_at=null`), lo que bloqueaba la certificación con la razón
 * RRM 108-109. Este test:
 *
 *   1. Garantiza que PRESIDENTE y SECRETARIO del Consejo tienen
 *      `inscripcion_rm_referencia` poblada (dual check L23 + RRM 109).
 *   2. Firma el acta via service-role (`signed_at`, `signed_by_*`).
 *   3. Verifica por UI que el gate de acta-no-firmada desaparece y
 *      que `EmitirCertificacionButton` queda habilitado.
 *   4. Pulsa "Emitir certificación" y comprueba que el pipeline
 *      `fn_generar_certificacion → fn_firmar_certificacion →
 *      fn_emitir_certificacion` materializa la fila en `certifications`
 *      con `signature_status='FIRMADA'` y token QES base64.
 *
 * Run:
 *   SECRETARIA_E2E_ARGA_TEST_A_ACTA_FIRMADA=1 bun run e2e -- e2e/55-secretaria-arga-test-a-acta-firmada-certificacion.spec.ts --project=chromium
 */
import { test, expect } from './fixtures/base';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_PROJECT_REF = 'hzqwefkwsxopwrmtksbg';
const EXPECTED_PROJECT_REF = cleanEnvValue(process.env.EXPECTED_PROJECT_REF) ?? DEFAULT_PROJECT_REF;
const DEFAULT_SECRET_ENV_FILE = 'docs/superpowers/plans/.env';

const SOCIEDAD = {
  entityId: '16b28a35-663d-426b-bbf8-9f0d6e8a5d25',
  legalName: 'Arga test A, SL',
  consejoBodyId: '075a5339-4d58-43e7-8a36-4b11257a760e',
  presidente: '089df45d-2d08-42ad-88aa-343b89449711',
  secretario: 'afdbd2e2-8bae-4fbc-986b-b11d78ae751e',
};

const RM_REFERENCE_PRESIDENTE = 'RM Madrid · Tomo 1234 · Folio 56 · Inscripción 7ª (PRESIDENTE Arga test A)';
const RM_REFERENCE_SECRETARIO = 'RM Madrid · Tomo 1234 · Folio 56 · Inscripción 7ª (SECRETARIO Arga test A)';

type ServiceClient = SupabaseClient;

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
  if (!key) throw new Error('Missing Supabase service role key for acta firmada E2E');
  if (
    projectRefFromUrl(url) !== EXPECTED_PROJECT_REF &&
    process.env.SECRETARIA_E2E_ALLOW_NON_CANONICAL_PROJECT !== '1'
  ) {
    throw new Error(`Refusing E2E against ${url}; expected ${EXPECTED_PROJECT_REF}`);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as ServiceClient;
}

async function ensureRmReferences(client: ServiceClient) {
  // Verifica si las AE PRESIDENTE/SECRETARIO ya tienen inscripcion_rm_referencia;
  // si no, las pobla con strings demo.
  const { data, error } = await client
    .from('authority_evidence')
    .select('id, cargo, inscripcion_rm_referencia')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('entity_id', SOCIEDAD.entityId)
    .eq('body_id', SOCIEDAD.consejoBodyId)
    .eq('estado', 'VIGENTE')
    .in('cargo', ['PRESIDENTE', 'SECRETARIO']);
  expect(error).toBeNull();
  for (const row of data ?? []) {
    if (row.inscripcion_rm_referencia) continue;
    const reference = row.cargo === 'PRESIDENTE' ? RM_REFERENCE_PRESIDENTE : RM_REFERENCE_SECRETARIO;
    const { error: updErr } = await client
      .from('authority_evidence')
      .update({ inscripcion_rm_referencia: reference })
      .eq('id', row.id);
    expect(updErr).toBeNull();
  }
}

async function findConsejoActa(client: ServiceClient): Promise<{ id: string; signed_at: string | null }> {
  const { data, error } = await client
    .from('minutes')
    .select('id, signed_at, signed_by_secretary_id, signed_by_president_id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('entity_id', SOCIEDAD.entityId)
    .eq('body_id', SOCIEDAD.consejoBodyId)
    .order('created_at', { ascending: false })
    .limit(1);
  expect(error).toBeNull();
  const acta = (data ?? [])[0];
  expect(acta?.id, 'Sin acta del Consejo — ejecuta e2e/49 antes').toBeTruthy();
  return acta as { id: string; signed_at: string | null };
}

async function signActa(client: ServiceClient, minuteId: string) {
  const { error } = await client
    .from('minutes')
    .update({
      signed_at: new Date().toISOString(),
      signed_by_secretary_id: SOCIEDAD.secretario,
      signed_by_president_id: SOCIEDAD.presidente,
    })
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('id', minuteId);
  expect(error).toBeNull();
}

test.describe.configure({ timeout: 180_000 });
test.skip(
  process.env.SECRETARIA_E2E_ARGA_TEST_A_ACTA_FIRMADA !== '1',
  'Opt-in: firma acta + certificación QES Arga test A',
);

test('Secretaría firma el acta del Consejo y emite la certificación QES end-to-end', async ({ page }) => {
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
      networkFails.push(`[${status}] ${resp.request().method()} ${url} -> ${body.slice(0, 500)}`);
    }
  });

  const client = serviceClient();

  // Setup 1: RM references vigentes para SECRETARIO + PRESIDENTE.
  await ensureRmReferences(client);

  // Setup 2: acta del Consejo firmada (idempotente — si ya está firmada, no toca).
  const acta = await findConsejoActa(client);
  if (!acta.signed_at) {
    await signActa(client, acta.id);
  }

  // Verifica en Cloud que la firma quedó.
  const { data: signedRow, error: signedErr } = await client
    .from('minutes')
    .select('id, signed_at, signed_by_secretary_id, signed_by_president_id, body_id, entity_id')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('id', acta.id)
    .maybeSingle();
  expect(signedErr).toBeNull();
  expect(signedRow?.signed_at).toBeTruthy();
  expect(signedRow?.signed_by_secretary_id).toBe(SOCIEDAD.secretario);
  expect(signedRow?.signed_by_president_id).toBe(SOCIEDAD.presidente);

  // UI: la página del acta ya no debe mostrar el gate RRM 108-109.
  await page.goto(`/secretaria/actas/${acta.id}?scope=sociedad&entity=${SOCIEDAD.entityId}`);
  await expect(page.getByRole('heading', { name: /Certificaciones emitidas/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/acta debe estar aprobada o firmada.*RRM arts\. 108-109/i),
  ).toHaveCount(0);

  // Si ya hay una certificación previa, el test es idempotente: verifica
  // su existencia. Si no, emite una nueva via el botón.
  const { data: certsPrevia } = await client
    .from('certifications')
    .select('id, signature_status, agreements_certified')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('minute_id', acta.id);
  const hadCert = (certsPrevia ?? []).length > 0;

  if (!hadCert) {
    const emitir = page.getByRole('button', { name: /Emitir certificación/i }).first();
    await expect(emitir).toBeVisible({ timeout: 20_000 });
    await expect(emitir).toBeEnabled({ timeout: 20_000 });
    await emitir.click();
    await expect(
      page.getByText(/Certificación emitida|Referencia operativa demo/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  }

  // Verificación en Cloud: hay al menos una certificación FIRMADA o EMITIDA
  // para el minute. La RPC fn_firmar_certificacion deja `signature_status`
  // en estado consistente con QES stub.
  const { data: certsFinal, error: certsFinalErr } = await client
    .from('certifications')
    .select('id, minute_id, signature_status, tipo_certificacion, agreements_certified, certificante_role, visto_bueno_persona_id, tsq_token, gate_hash, hash_certificacion')
    .eq('tenant_id', DEMO_TENANT_ID)
    .eq('minute_id', acta.id);
  expect(certsFinalErr).toBeNull();
  expect((certsFinal ?? []).length).toBeGreaterThanOrEqual(1);
  const cert = (certsFinal ?? [])[0];
  expect(cert.tipo_certificacion).toBe('ACUERDO');
  expect(cert.certificante_role).toBe('SECRETARIO');
  expect(cert.visto_bueno_persona_id).toBe(SOCIEDAD.presidente);
  expect(cert.tsq_token).toBeTruthy();
  expect(cert.gate_hash).toBeTruthy();
  // `signature_status` lo expone la RPC en inglés ('SIGNED'); aceptamos
  // variantes equivalentes por si se cambia la canonicalización.
  expect(['SIGNED', 'FIRMADA', 'EMITIDA', 'ISSUED']).toContain(
    String(cert.signature_status ?? '').toUpperCase(),
  );

  // UI: el listado de Certificaciones emitidas muestra la nueva certificación.
  await page.reload();
  await expect(page.getByRole('heading', { name: /Certificaciones emitidas/i }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`#${cert.id.slice(0, 8)}`, { exact: false }).first()).toBeVisible({ timeout: 20_000 });

  expect(
    browserErrors.filter((e) =>
      /relation .* does not exist|column .* does not exist|permission denied|RLS|TypeError|ReferenceError/i.test(e),
    ),
    'no fatal browser errors during acta firmada flow',
  ).toEqual([]);
  expect(
    networkFails.filter((f) => /^\[4\d\d\] (POST|PATCH|DELETE)/.test(f)),
    'no Supabase write 4xx during acta firmada flow',
  ).toEqual([]);
});
