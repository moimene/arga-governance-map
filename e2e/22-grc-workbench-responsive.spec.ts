import { test, expect } from './fixtures/base';
import type { Page } from '@playwright/test';

const viewports = [
  { label: 'mobile', width: 390, height: 844 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1440, height: 900 },
] as const;

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

test.describe('GRC Compass — responsive workbench', () => {
  for (const viewport of viewports) {
    test(`/grc mantiene el workbench visible y sin overflow horizontal en ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/grc');

      await expect(page).not.toHaveURL('/login');
      await expect(page.getByRole('heading', { name: 'Mesa de trabajo GRC' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText('Riesgos, incidentes y plazos que requieren decisión')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Monitor de cumplimiento GRC' })).toBeVisible();
      await expect(page.getByText('TPRM / Outsourcing')).toBeVisible();
      await expect(page.getByText('Contexto técnico y contratos')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test(`/grc/incidentes usa mesa operativa responsive sin overflow en ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/grc/incidentes');

      await expect(page).not.toHaveURL('/login');
      await expect(page.getByRole('heading', { name: 'Incidentes' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole('heading', { name: 'Filtros' })).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const mobileList = page.getByTestId('grc-incidents-mobile-list');
      const desktopTable = page.getByTestId('grc-incidents-desktop-table');

      if (viewport.width < 1024) {
        await expect(mobileList).toBeVisible();
        await expect(page.getByText('Lista operativa').first()).toBeVisible();
        await expect(desktopTable).toBeHidden();
      } else {
        await expect(desktopTable).toBeVisible();
        await expect(mobileList).toBeHidden();
      }
    });
  }
});
