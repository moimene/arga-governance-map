import { test, expect } from './fixtures/base';

test.describe('Secretaría Societaria — responsive 390px', () => {
  test('dashboard usa drawer móvil y no comprime el contenido', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/secretaria');

    await expect(page.getByText('Mesa de trabajo del secretario')).toBeVisible();

    const noHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(noHorizontalOverflow).toBe(true);

    await expect(page.locator('aside[aria-label="Navegación de Secretaría Societaria"]')).toBeHidden();

    const menuButton = page.getByRole('button', { name: /Abrir navegación de Secretaría/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const drawer = page.getByRole('dialog', { name: /Navegación de Secretaría Societaria/i });
    await expect(drawer).toBeVisible();
    await expect(page.getByRole('link', { name: /Sociedades/i })).toBeVisible();

    await page.getByRole('link', { name: /Sociedades/i }).click();
    await expect(page).toHaveURL(/\/secretaria\/sociedades/);
    await expect(drawer).not.toBeVisible();
  });
});
