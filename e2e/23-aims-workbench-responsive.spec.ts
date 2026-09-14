import { test, expect } from './fixtures/base';
import type { Page } from '@playwright/test';
import { loginAsDemo, type Entorno } from './fixtures/demo-credentials';

const viewports = [
  { label: 'mobile', width: 390, height: 844 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1440, height: 900 },
] as const;

const TENANT: Record<Entorno, string> = {
  arga: '00000000-0000-0000-0000-000000000001',
  garrigues: '00000000-0000-0000-0000-000000000002',
};

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    );

    return {
      documentWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(
    metrics.documentWidth,
    `Horizontal overflow: document ${metrics.documentWidth}px > viewport ${metrics.viewportWidth}px`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

// Sesión PROPIA por entorno (sin el storageState compartido): el workbench se
// mide en ARGA y en Garrigues, sólo lectura, y con el filtro de tenant exigido
// EN EL CABLE en cada lectura de `ai_systems`.
for (const entorno of ['arga', 'garrigues'] as const) {
  test.describe(`AIMS / AI Governance — responsive workbench · ${entorno}`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    let filtrosSistemas: Array<string | null> = [];

    test.beforeEach(async ({ page }) => {
      filtrosSistemas = [];
      await loginAsDemo(page, entorno);
      page.on('request', (req) => {
        const url = new URL(req.url());
        if (url.pathname === '/rest/v1/ai_systems') filtrosSistemas.push(url.searchParams.get('tenant_id'));
      });
    });

    test.afterEach(async () => {
      // Se sondea, no se lee una foto: la query de ai_systems arranca cuando
      // TenantProvider resuelve el tenant y puede llegar DESPUÉS de que el
      // cuerpo del test termine.
      await expect
        .poll(() => filtrosSistemas.length, { message: 'ninguna pantalla leyó ai_systems: la aserción de tenant sería vacua', timeout: 10_000 })
        .toBeGreaterThan(0);
      for (const filtro of filtrosSistemas) expect(filtro).toBe(`eq.${TENANT[entorno]}`);
    });

    for (const viewport of viewports) {
      test(`/ai-governance mantiene el workbench visible y sin overflow horizontal en ${viewport.label}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/ai-governance');

        await expect(page).not.toHaveURL('/login');
        await expect(page.getByRole('heading', { name: 'Mesa de trabajo AI Governance' })).toBeVisible({
          timeout: 10_000,
        });
        await expect(page.getByText('Sistemas, evaluaciones e incidentes que requieren criterio')).toBeVisible();
        await expect(page.getByText('Monitor de cumplimiento')).toBeVisible({ timeout: 10_000 });
        // Por concepto (aria-label), no por rótulo: el texto del panel cambia.
        await expect(page.getByLabel('Readiness AIMS')).toBeVisible({ timeout: 10_000 });
        await expectNoHorizontalOverflow(page);
      });

      test(`/ai-governance/sistemas mantiene lista crítica responsive en ${viewport.label}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/ai-governance/sistemas');

        await expect(page).not.toHaveURL('/login');
        await expect(page.getByRole('heading', { name: 'Inventario de sistemas IA' })).toBeVisible({
          timeout: 10_000,
        });
        await expect(page.getByLabel('Estado del inventario AIMS')).toBeVisible();
        await expect(page.getByLabel('Filtros del inventario de sistemas')).toBeVisible();

        if (viewport.width < 1024) {
          await expect(page.getByRole('list', { name: 'Lista móvil de sistemas IA' })).toBeVisible({
            timeout: 10_000,
          });
          await expect(page.locator('table').first()).toBeHidden();
        } else {
          await expect(page.locator('table').first()).toBeVisible({ timeout: 10_000 });
          await expect(page.getByRole('columnheader', { name: 'Proveedor' })).toBeVisible();
        }

        await expectNoHorizontalOverflow(page);
      });
    }
  });
}
