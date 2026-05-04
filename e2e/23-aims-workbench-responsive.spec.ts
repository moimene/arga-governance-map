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

test.describe('AIMS / AI Governance — responsive workbench', () => {
  for (const viewport of viewports) {
    test(`/ai-governance mantiene el workbench visible y sin overflow horizontal en ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/ai-governance');

      await expect(page).not.toHaveURL('/login');
      await expect(page.getByRole('heading', { name: 'Mesa de trabajo AI Governance' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText('Sistemas, evaluaciones e incidentes que requieren criterio')).toBeVisible();
      await expect(page.getByText('Readiness de demo AIMS')).toBeVisible({ timeout: 10_000 });
      await expectNoHorizontalOverflow(page);
    });

    test(`/ai-governance/sistemas mantiene lista crítica responsive en ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/ai-governance/sistemas');

      await expect(page).not.toHaveURL('/login');
      await expect(page.getByRole('heading', { name: 'Inventario de sistemas IA' })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText('Demo AIMS conectada')).toBeVisible();
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
