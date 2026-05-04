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

test.describe('TGMS Console — responsive workbench', () => {
  for (const viewport of viewports) {
    test(`home mantiene el workbench visible y sin overflow horizontal en ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      await expect(page.getByRole('heading', { name: /Qué requiere atención ahora/i })).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText('TGMS compone, cada módulo responsable escribe')).toBeVisible();
      await expect(page.getByText('TGMS Console no muta owners').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test('home renderiza sin overflow horizontal en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Sin scroll horizontal
    await expectNoHorizontalOverflow(page);

    // Hamburguesa visible
    const menuButton = page.getByRole('button', { name: /Abrir menú de navegación/i });
    await expect(menuButton).toBeVisible();

    // Aside desktop oculto
    await expect(
      page.locator('aside[data-testid="desktop-sidebar"]'),
    ).toBeHidden();

    // Literales ejecutivos
    await expect(page.getByText('TGMS Console no muta owners').first()).toBeVisible();
    await expect(page.getByText('000049 en HOLD').first()).toBeVisible();

    // Drawer mobile operativo y auto-cierre al navegar
    await menuButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('link', { name: /Governance Map/i })).toBeVisible();
    await page.getByRole('link', { name: /Governance Map/i }).click();
    await expect(page).toHaveURL(/\/governance-map/);
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
