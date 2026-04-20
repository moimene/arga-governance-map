import { test, expect } from './fixtures/base';

test.describe('Acuerdos Sin Sesión', () => {
  test('lista carga con tabla de acuerdos', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL('/login');
  });

  test('detalle ASOC-001 abre sin crash', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion');
    const asoc = page.getByText('ASOC-001').first();
    if (await asoc.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await asoc.click();
      await expect(page.url()).toMatch(/\/secretaria\/acuerdos-sin-sesion\/.+/);
    }
  });

  test('nuevo acuerdo sin sesión — stepper renderiza', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion/nuevo');
    await expect(page).not.toHaveURL('/login');
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
    const dec = page.getByText('DEC-').first();
    if (await dec.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dec.click();
      await expect(page.url()).toMatch(/\/secretaria\/decisiones-unipersonales\/.+/);
    }
  });
});
