/**
 * Verificación por pantalla — MOI-142, grupo nuevo (tenant …0003).
 *
 * Ola de verificación C (2026-09-27). Solo lectura vía SELECT y navegación
 * real por pantalla; ninguna escritura fuera de la que produzca la propia
 * UI con la cuenta demo@grupo-nuevo-demo.dev. Nunca clave de servicio.
 *
 * Objetivo: convocar por pantalla una Junta General de Corporación Nueva,
 * S.A. (matriz del grupo nuevo) en fecha futura, emitirla hasta el final
 * por el stepper de /secretaria/convocatorias/nueva, y comprobar que queda
 * EMITIDA, con destinatarios = socios con voto y documento/manifiesto
 * generado en servidor. Si la pantalla no ofrece el camino o falla, este
 * spec documenta el error literal (no lo esconde ni lo reintenta con otra
 * vía) — es el comportamiento esperado a verificar, no un bug del spec.
 *
 * Run:
 *   PLAYWRIGHT_PORT=5303 bunx playwright test e2e/70-verif-moi142-junta-convocatoria-nuevo.spec.ts --project=chromium
 */
import { test, expect } from './fixtures/base';
import { loginAsDemo } from './fixtures/demo-credentials';

const CORPORACION_NUEVA_ENTITY_ID = '45c8df67-64c9-42a3-abff-8047dd23748b';
const JUNTA_BODY_ID = 'ceee9767-0bbf-4bf7-a2a9-6a812414e4bb';
const FORBIDDEN_TENANTS = [
  '00000000-0000-0000-0000-000000000001', // ARGA
  '00000000-0000-0000-0000-000000000002', // Garrigues
];

test.describe.configure({ timeout: 180_000 });

test.use({ storageState: { cookies: [], origins: [] } });

// Este spec ESCRIBE en el grupo nuevo (emite una convocatoria real, para
// siempre en producción). No debe correr en una pasada general de e2e:
// solo se activa a propósito con E2E_ESCRIBE_GRUPO_NUEVO=1.
test.skip(
  process.env.E2E_ESCRIBE_GRUPO_NUEVO !== '1',
  'Escribe en el grupo nuevo (…0003); activar explícitamente con E2E_ESCRIBE_GRUPO_NUEVO=1',
);

test('MOI-142 · Junta grupo nuevo: convocar y emitir hasta el final por pantalla', async ({ page }) => {
  const crossTenantWrites: string[] = [];
  const domainWrites4xx: string[] = [];

  // Guard de red: cualquier escritura de dominio (POST/PATCH/PUT/DELETE) que
  // mencione el tenant_id de ARGA o Garrigues en URL o cuerpo hace fallar el
  // test de inmediato. Esta sesión solo debería escribir en …0003.
  page.on('request', (req) => {
    const method = req.method();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return;
    const url = req.url();
    if (!/supabase\.co\/(rest|rpc)\//.test(url)) return;
    const postData = req.postData() ?? '';
    for (const forbidden of FORBIDDEN_TENANTS) {
      if (url.includes(forbidden) || postData.includes(forbidden)) {
        crossTenantWrites.push(`[${method}] ${url} :: ${postData.slice(0, 300)}`);
      }
    }
  });
  page.on('response', async (resp) => {
    const status = resp.status();
    const req = resp.request();
    if (status >= 400 && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method()) && /supabase\.co\/(rest|rpc)\//.test(resp.url())) {
      let body = '';
      try { body = await resp.text(); } catch { /* noop */ }
      domainWrites4xx.push(`[${status}] ${req.method()} ${resp.url()} → ${body.slice(0, 500)}`);
    }
  });

  await loginAsDemo(page, 'nuevo');

  await page.goto('/secretaria/convocatorias/nueva');
  await expect(page.getByRole('heading', { name: /Asistente de convocatoria/i }).first()).toBeVisible({ timeout: 20_000 });

  // ── PASO 1: Sociedad y órgano ──────────────────────────────────
  const sociedadSelect = page.locator('select').first();
  await expect(sociedadSelect).toBeVisible({ timeout: 10_000 });
  await sociedadSelect.selectOption(CORPORACION_NUEVA_ENTITY_ID);

  const organoSelect = page.locator('select').nth(1);
  await expect(organoSelect).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(async () => (await organoSelect.locator('option').count()), { timeout: 10_000 })
    .toBeGreaterThan(1);
  await organoSelect.selectOption(JUNTA_BODY_ID);
  await expect(organoSelect).toHaveValue(JUNTA_BODY_ID);

  await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi142-paso1-junta-seleccionada.png' });

  const ordinariaBtn = page.getByRole('button', { name: /^Ordinaria$/i }).first();
  if (await ordinariaBtn.isVisible().catch(() => false)) await ordinariaBtn.click();

  await expect(page.getByRole('button', { name: /^Siguiente$/i })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // ── PASO 2: Fecha y plazo legal (fecha futura, +45 días: SA exige 30) ──
  await expect(page.getByRole('heading', { name: /Paso 2\. Fecha y plazo legal/i })).toBeVisible({ timeout: 10_000 });
  // +45..54 días (jitter por minuto actual): SA exige 30, deja margen de
  // sobra y evita colisionar con una convocatoria emitida en una corrida
  // anterior el mismo día natural (mismo body_id + fecha_1 => duplicado).
  const dayOffset = 45 + (new Date().getMinutes() % 10);
  const futureDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.locator('input[type="date"]').first().fill(futureDate);
  await page.locator('input[type="time"]').first().fill('10:00');
  const lugarInput = page.locator('input[type="text"]').first();
  if (await lugarInput.isVisible().catch(() => false)) {
    await lugarInput.fill('Sede social, Calle Serrano 45, Madrid');
  }
  await expect(page.getByRole('button', { name: /^Siguiente$/i })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // ── PASO 3: Orden del día ────────────────────────────────────────
  await expect(page.getByRole('heading', { name: /Paso 3\. Orden del día/i })).toBeVisible({ timeout: 10_000 });
  const acuerdoKind = page.getByRole('radio', { name: /Acuerdo:/i }).first();
  await expect(acuerdoKind).toBeVisible({ timeout: 5_000 });
  await acuerdoKind.click();

  const materiaSelect = page.getByLabel('Materia del acuerdo').first();
  await expect(materiaSelect).toBeVisible({ timeout: 5_000 });
  const firstMateriaValue = await materiaSelect.locator('option').evaluateAll((opts) =>
    (opts as HTMLOptionElement[]).find((o) => o.value)?.value ?? '',
  );
  if (firstMateriaValue) await materiaSelect.selectOption(firstMateriaValue);

  const tituloPunto = page.getByPlaceholder(/Descripción del punto del orden del día/i).first();
  await expect(tituloPunto).toBeVisible({ timeout: 5_000 });
  await tituloPunto.fill('MOI-142 verif-c — Aprobación del presupuesto operativo 2026');

  const propuestaTextarea = page.locator('main textarea').first();
  if (await propuestaTextarea.isVisible().catch(() => false)) {
    await propuestaTextarea.fill('MOI-142 verif-c: propuesta de acuerdo de ejemplo para verificación por pantalla del camino de Junta.');
  }

  await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi142-paso3-orden-del-dia.png' });

  await expect(page.getByRole('button', { name: /^Siguiente$/i })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // ── PASO 4: Destinatarios (socios con voto vía capital_holdings) ─
  await expect(page.getByRole('heading', { name: /Paso 4\. Destinatarios/i })).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi142-paso4-destinatarios.png' });
  await expect(page.getByRole('button', { name: /^Siguiente$/i })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // ── PASO 5: Canales de publicación ────────────────────────────────
  // El servidor (fn_convocation_manifest_enrich_recipients) exige un canal
  // de notificación DIRECTA a destinatarios (EAD_INTERPOSITION o
  // EMAIL_SIMPLE); en una Junta el primer checkbox del listado sin filtrar
  // es "Web corporativa" (art. 173 LSC), que no basta por sí solo.
  await expect(page.getByRole('heading', { name: /Paso 5\./i })).toBeVisible({ timeout: 10_000 });
  const emailChannel = page.locator('main label', { hasText: /Email simple/i }).first();
  await expect(emailChannel).toBeVisible({ timeout: 10_000 });
  const emailChannelCheckbox = emailChannel.locator('input[type="checkbox"]');
  if (!(await emailChannelCheckbox.isChecked())) {
    await emailChannel.click();
  }
  await expect(page.getByRole('button', { name: /^Siguiente$/i })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // ── PASO 6: Adjuntos (skip) ───────────────────────────────────────
  await expect(page.getByRole('heading', { name: /Paso 6\. Adjuntos/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Siguiente$/i })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // ── PASO 7: Borrador documento (plantilla CONVOCATORIA_JUNTA activa) ──
  await expect(page.getByRole('heading', { name: /Paso 7\. Borrador documento/i })).toBeVisible({ timeout: 10_000 });
  // Rellenar cualquier campo capa 3 marcado como requerido/invalid, si el
  // motor de plantillas no lo resolvió automáticamente.
  const requiredInvalidTextareas = page.locator('main textarea[aria-required="true"][aria-invalid="true"]');
  const invalidTextAreaCount = await requiredInvalidTextareas.count();
  for (let i = 0; i < invalidTextAreaCount; i++) {
    await requiredInvalidTextareas.nth(i).fill('MOI-142 verif-c valor capa 3');
  }
  const requiredInvalidSelects = page.locator('main select[aria-required="true"][aria-invalid="true"]');
  const invalidSelectCount = await requiredInvalidSelects.count();
  for (let i = 0; i < invalidSelectCount; i++) {
    const sel = requiredInvalidSelects.nth(i);
    const val = await sel.locator('option').evaluateAll((opts) => (opts as HTMLOptionElement[]).find((o) => o.value)?.value ?? '');
    if (val) await sel.selectOption(val);
  }
  await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi142-paso7-borrador.png' });

  await expect(page.getByRole('button', { name: /^Siguiente$/i })).toBeEnabled({ timeout: 60_000 });
  await page.getByRole('button', { name: /^Siguiente$/i }).click();

  // ── PASO 8: Revisión y registro → Emitir ──────────────────────────
  await expect(page.getByRole('heading', { name: /Paso 8\./i })).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi142-paso8-revision.png' });

  const rpcCalls: string[] = [];
  page.on('request', (req) => {
    if (/supabase\.co\/rest\/v1\/rpc\/fn_emit_convocatoria/.test(req.url())) {
      rpcCalls.push(`${req.method()} ${req.url()} :: ${(req.postData() ?? '').slice(0, 2000)}`);
    }
  });
  page.on('response', async (resp) => {
    if (/supabase\.co\/rest\/v1\/rpc\/fn_emit_convocatoria/.test(resp.url())) {
      let body = '';
      try { body = await resp.text(); } catch { /* noop */ }
      rpcCalls.push(`RESPONSE [${resp.status()}] ${resp.url()} :: ${body.slice(0, 2000)}`);
    }
  });

  const allButtons = await page.locator('main button').allTextContents();
  console.log('[MOI-142 verif-c] botones visibles en Paso 8:', JSON.stringify(allButtons));

  const emitirBtn = page.getByRole('button', { name: /Registrar simulación DEMO/i });
  await expect(emitirBtn).toBeVisible({ timeout: 10_000 });
  await expect(emitirBtn).toBeEnabled({ timeout: 20_000 });
  await emitirBtn.click();

  // Puede terminar en éxito ("Simulación DEMO registrada...") o en error
  // ("No se pudo registrar la simulación DEMO"). Documentamos cuál ocurrió,
  // sin forzar ninguno de los dos.
  const successToast = page.getByText(/Simulación DEMO registrada|Convocatoria emitida/i).first();
  const errorToast = page.getByText(/No se pudo (registrar|completar)|Este registro gobernado solo está habilitado/i).first();
  await Promise.race([
    successToast.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
    errorToast.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
  ]);

  await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi142-paso8-resultado.png' });
  if (await errorToast.isVisible().catch(() => false)) {
    await errorToast.locator('xpath=ancestor-or-self::*[3]').screenshot({
      path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi142-toast-error-detalle.png',
    }).catch(() => null);
  }

  const errorVisible = await errorToast.isVisible().catch(() => false);
  const successVisible = await successToast.isVisible().catch(() => false);

  if (errorVisible) {
    const errorText = await page.locator('[data-sonner-toast], [role="status"], [role="alert"]').allTextContents();
    console.log('[MOI-142 verif-c] HALLAZGO — la pantalla ofrece el camino de Junta pero la emisión falla.');
    console.log('[MOI-142 verif-c] Texto de error visible:', JSON.stringify(errorText));
  } else if (successVisible) {
    console.log('[MOI-142 verif-c] La emisión de la convocatoria de Junta se completó por pantalla.');
  } else {
    console.log('[MOI-142 verif-c] Ni éxito ni error detectados tras 30s — estado indeterminado, ver captura.');
  }
  console.log('[MOI-142 verif-c] Llamadas RPC fn_emit_convocatoria observadas:', rpcCalls.length);
  for (const c of rpcCalls) console.log('  ' + c);

  // ── PASO 9 (post-emisión): el documento final se genera en servidor
  // (convocation-artifact-register), vía el botón "Borrador DEMO revisado
  // DOCX" de la ficha — genérico por organoTipo, sin rama específica de
  // Consejo. Desde el cierre de MOI-142 la emisión de Junta DEBE completarse
  // y el documento final DEBE generarse: el spec se pone rojo si no.
  expect(successVisible, 'la emisión de la convocatoria de Junta debe completarse').toBe(true);
  {
    await page.getByRole('button', { name: /^Abrir convocatoria$/i }).click();
    await page.waitForURL(/\/secretaria\/convocatorias\/[0-9a-f-]{36}/, { timeout: 15_000 });
    const docxBtn = page.getByRole('button', { name: /Borrador DEMO/i }).first();
    await expect(docxBtn).toBeVisible({ timeout: 15_000 });
    await docxBtn.click();
    const docxSuccess = page.getByText(/Documento Word generado/i).first();
    const docxError = page.getByText(/No se pudo generar el documento|Faltan variables obligatorias/i).first();
    await Promise.race([
      docxSuccess.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
      docxError.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => null),
    ]);
    await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi142-paso9-docx-resultado.png' });
    if (await docxError.isVisible().catch(() => false)) {
      const docxErrorText = await page.locator('[data-sonner-toast], [role="status"], [role="alert"]').allTextContents();
      console.log('[MOI-142 verif-c] HALLAZGO — la generación del documento final falla para Junta:', JSON.stringify(docxErrorText));
    }
    await expect(docxSuccess, 'el documento final de la Junta debe generarse en servidor').toBeVisible();
    console.log('[MOI-142 verif-c] Documento final (DOCX) generado y archivado en servidor para la Junta:', page.url());
  }

  // Guard: nunca escrituras cross-tenant hacia ARGA/Garrigues desde esta sesión.
  expect(crossTenantWrites, 'no cross-tenant domain writes to ARGA/Garrigues').toEqual([]);

  // No fallamos el test por el 4xx del propio RPC de emisión (es lo que
  // estamos verificando); lo dejamos en log para el informe.
  if (domainWrites4xx.length > 0) {
    console.log('[MOI-142 verif-c] Escrituras 4xx observadas (puede incluir el propio intento de emisión):');
    for (const w of domainWrites4xx) console.log('  ' + w);
  }
});
