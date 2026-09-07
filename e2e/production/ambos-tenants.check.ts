import { expect, test, type Response } from '@playwright/test';
import { loginAsDemo } from '../fixtures/demo-credentials';

const PROJECT_HOST = 'hzqwefkwsxopwrmtksbg.supabase.co';
const tenants = [
  { entorno: 'arga', id: '00000000-0000-0000-0000-000000000001', email: 'demo@arga-seguros.com' },
  { entorno: 'garrigues', id: '00000000-0000-0000-0000-000000000002', email: 'demo@garrigues-demo.dev' },
] as const;

// Se ejecuta con el config dedicado: no modifica .auth/session.json ni depende
// de la sesión compartida con los otros carriles. No forma parte del testMatch
// de la suite ordinaria, y no convierte la falta de producción en un skip.
for (const tenant of tenants) {
  test(`${tenant.entorno}: sesión propia, consola medida y superficies visibles`, async ({ page, context }, info) => {
    const blocked: string[] = [];
    const errors: string[] = [];
    const evidence: Record<string, unknown> = { tenant: tenant.entorno };
    page.on('pageerror', (error) => errors.push(error.message));

    // Única escritura remota permitida: obtener/renovar la sesión solicitada.
    // Una acción accidental de dominio o proveedor se bloquea antes de enviarse.
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method());
      const login = request.method() === 'POST' && url.hostname === PROJECT_HOST
        && url.pathname === '/auth/v1/token'
        && ['password', 'refresh_token'].includes(url.searchParams.get('grant_type') ?? '');
      if (read || login) return route.continue();
      blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort('blockedbyclient');
    });

    const ownProfile = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.hostname === PROJECT_HOST && url.pathname === '/rest/v1/user_profiles'
        && (url.searchParams.get('select') ?? '').includes('tenant_id') && response.ok();
    });
    const countResponse = (table: string, marker: string) => page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.hostname === PROJECT_HOST && url.pathname === `/rest/v1/${table}`
        && response.request().method() === 'HEAD' && url.searchParams.has(marker);
    });
    const agreements = countResponse('agreements', 'inscribable');
    const incidents = countResponse('incidents', 'is_major_incident');
    // Adjuntar handlers inmediatamente evita rechazos sin observar si falla el login.
    const responses = Promise.all([ownProfile, agreements, incidents]);
    void responses.catch(() => {});

    try {
      await loginAsDemo(page, tenant.entorno);
      const [profileResponse, agreementsResponse, incidentsResponse] = await responses;
      const profile = await profileResponse.json();
      const row = Array.isArray(profile) ? profile[0] : profile;
      expect(row?.tenant_id, 'el perfil autenticado pertenece al tenant esperado').toBe(tenant.id);
      await expect(page).not.toHaveURL(/\/login/);

      const measuredCount = async (response: Response) => {
        const url = new URL(response.url());
        expect(url.searchParams.get('tenant_id')).toBe(`eq.${tenant.id}`);
        expect(response.ok(), `${url.pathname}: HTTP ${response.status()}`).toBe(true);
        const range = await response.headerValue('content-range');
        expect(range, 'el servidor debe aportar el recuento solicitado').toMatch(/\/\d+$/);
        return Number(range!.split('/').at(-1));
      };
      const registryCount = await measuredCount(agreementsResponse);
      const incidentCount = await measuredCount(incidentsResponse);
      evidence.console = { registryCount, incidentCount };
      await expect(page.getByRole('link', { name: /Acuerdos inscribibles/ }).locator('.tabular-nums')).toHaveText(String(registryCount));
      await expect(page.getByRole('link', { name: /Incidentes mayores abiertos/ }).locator('.tabular-nums')).toHaveText(String(incidentCount));
      if (tenant.entorno === 'garrigues') {
        await expect.soft(page.getByRole('heading', { name: /Consola General ARGA/ })).toHaveCount(0);
      }

      for (const [route, heading] of [
        ['/grc', 'Mesa de trabajo GRC'],
        ['/ai-governance', 'Mesa de trabajo AI Governance'],
      ]) {
        await page.goto(route);
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        const body = await page.locator('body').innerText();
        expect.soft(body).not.toMatch(/QSeal Custodia|PLAN DE SALIDA SELLADO EN LEDGER WORM|QSEAL-EADTRUST/i);
        evidence[route] = { headingVisible: true };
      }

      await page.goto('/sii');
      const gate = page.getByRole('dialog');
      await expect(gate.getByText(tenant.email, { exact: true })).toBeVisible();
      await expect(gate).toContainText(/demo|simulad|local/i);
      // Esta confirmación solo afecta al sessionStorage del contexto efímero.
      await gate.getByRole('button', { name: 'Entrar a zona SII', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Sistema Interno de Información (SII) — Canal de Denuncias', exact: true })).toBeVisible();
      const sii = await page.locator('body').innerText();
      expect(sii).toMatch(/solo en este navegador|simulad/i);
      expect(sii).not.toMatch(/log de auditoría independiente|buzón cifrado|sellado EAD/i);
      if (tenant.entorno === 'garrigues') {
        expect.soft(sii).not.toMatch(/Elena Navarro|ARGA Seguros/i);
      }
      evidence.sii = { gateIdentityMatched: true, dashboardVisible: true };
      await page.screenshot({ path: info.outputPath(`${tenant.entorno}-sii.png`), fullPage: true });
      expect(blocked, 'ninguna navegación debe intentar una escritura de dominio').toEqual([]);
      expect(errors, 'errores JavaScript de las páginas visitadas').toEqual([]);
    } finally {
      await info.attach('evidencia-sin-credenciales', {
        body: JSON.stringify({ ...evidence, blocked, errors }, null, 2),
        contentType: 'application/json',
      });
    }
  });
}

/**
 * LA FRONTERA DE LA CERTIFICACIÓN, verificada EN PRODUCCIÓN.
 *
 * Venía de e2e/90-verificacion-produccion-con-sesion.spec.ts, que se retira: ese
 * spec y este fichero comprobaban lo mismo por dos caminos, y este es el fuerte
 * —contrasta el `tenant_id` del perfil, exige el filtro de tenant EN EL CABLE,
 * cuadra los KPI contra el `content-range` del servidor y prueba que no se
 * intenta ninguna escritura—. Se conserva de aquél lo único que no cubría:
 * que el tramo de certificación sigue declarándose no disponible en vivo.
 *
 * Solo ARGA: es el único tenant con actas.
 */
test('arga: la certificación sigue bloqueada por la custodia que no existe', async ({ page }) => {
  await loginAsDemo(page, 'arga');
  await page.goto('/secretaria/actas');
  await expect(page).not.toHaveURL(/\/login/);

  // La ruta la reescribe `scope.createScopedTo`, así que se localiza por sufijo.
  const fila = page.locator('a[href*="/actas/"]').first();
  await expect(fila, 'sin actas no habría nada que juzgar').toBeVisible({ timeout: 30_000 });
  await fila.click();
  await expect(page).toHaveURL(/\/actas\/[0-9a-f-]{36}/, { timeout: 30_000 });

  // Control positivo: es la ficha del acta, no una pantalla de error.
  await expect(page.getByRole('heading', { name: 'Revisión legal para certificación' })).toBeVisible({
    timeout: 30_000,
  });

  // La invariante: la custodia final NO existe y el producto lo declara.
  const custodia = page.getByLabel(/^Custodia EAD de /).first();
  await expect(custodia).toBeVisible({ timeout: 20_000 });
  await expect(custodia.getByRole('button', { name: 'Custodia final no disponible' })).toBeDisabled();
  await expect(custodia).toContainText(/Pendiente de renderer autoritativo/i);

  // Y en consecuencia no se afirma ninguna certificación emitida.
  await expect(page.getByText(/Certificación emitida/i)).toHaveCount(0);
});
