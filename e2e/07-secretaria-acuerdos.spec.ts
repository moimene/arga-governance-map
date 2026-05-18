import { test, expect } from './fixtures/base';

test.describe('Acuerdos Sin Sesión', () => {
  test('lista carga con tabla de acuerdos', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL('/login');
  });

  test('detalle de acuerdo sin sesión abre desde lista', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion');
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow, 'la lista debe exponer al menos un acuerdo sin sesión').toBeVisible({ timeout: 10_000 });
    const detailLink = firstRow.getByRole('link').first();
    await expect(detailLink, 'cada acuerdo sin sesión debe tener enlace accesible a detalle').toBeVisible();
    await detailLink.click();
    await expect(page).toHaveURL(/\/secretaria\/acuerdos-sin-sesion\/[^/?]+/);
  });

  test('nuevo acuerdo sin sesión — stepper renderiza', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion/nuevo');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByRole('heading', { name: /Asistente de acuerdo escrito sin sesión/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Paso 1\. Tipo y órgano/i })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Decisiones Unipersonales', () => {
  test('lista renderiza tabla de decisiones', async ({ page }) => {
    await page.goto('/secretaria/decisiones-unipersonales');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL('/login');
  });

  test('detalle de decisión abre sin crash', async ({ page }) => {
    await page.goto('/secretaria/decisiones-unipersonales');
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow, 'la lista debe exponer al menos una decisión unipersonal').toBeVisible({ timeout: 10_000 });
    const detailLink = firstRow.getByRole('link').first();
    await expect(detailLink, 'cada decisión debe tener enlace accesible a detalle').toBeVisible();
    await detailLink.click();
    await expect(page).toHaveURL(/\/secretaria\/decisiones-unipersonales\/[^/?]+/);
  });
});
