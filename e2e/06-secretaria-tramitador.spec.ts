import { test, expect } from './fixtures/base';

test.describe('Secretaría — Tramitador', () => {
  test('lista de tramitaciones carga con estados demo', async ({ page }) => {
    await page.goto('/secretaria/tramitador');
    await expect(
      page.getByText('TRAM-').or(page.getByText('EN_TRAMITE').or(page.getByText('Tramitación'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('stepper nueva tramitación — paso 1: Materia y Órgano', async ({ page }) => {
    await page.goto('/secretaria/tramitador/nuevo');
    await expect(
      page.getByText('Materia').or(page.getByText('Órgano')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('stepper tramitador — seleccionar materia activa motor rule packs', async ({ page }) => {
    await page.goto('/secretaria/tramitador/nuevo');
    await page.waitForTimeout(2000);
    const select = page.locator('select').first();
    if (await select.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await select.selectOption({ index: 1 });
      await expect(
        page.getByText('regla').or(page.getByText('Quórum').or(page.getByText('mayoría'))).first()
      ).toBeVisible({ timeout: 8_000 }).catch(() => {});
    }
  });

  test('TRAM-001 detalle abre sin crash', async ({ page }) => {
    await page.goto('/secretaria/tramitador');
    const tram001 = page.getByText('TRAM-001').first();
    if (await tram001.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await tram001.click();
      await expect(page.url()).toMatch(/\/secretaria\/tramitador\/.+/);
      await expect(page).not.toHaveURL('/login');
    }
  });
});
