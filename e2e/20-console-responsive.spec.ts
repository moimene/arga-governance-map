import { test, expect } from './fixtures/base';

test.describe('TGMS Console — responsive 390px', () => {
  test('home renderiza sin overflow horizontal en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Sin scroll horizontal
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(overflow).toBe(true);

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
