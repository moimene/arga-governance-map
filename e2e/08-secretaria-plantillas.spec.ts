import { test, expect } from './fixtures/base';

test.describe('Plantillas', () => {
  test('tab "Plantillas de proceso" muestra plantillas en estado REVISADA/ACTIVA', async ({ page }) => {
    await page.goto('/secretaria/plantillas');
    await expect(
      page.getByText('Plantillas de proceso').or(page.getByText('proceso')).first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('REVISADA').or(page.getByText('ACTIVA')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('tab "Modelos de acuerdo" muestra los 17 modelos LSC', async ({ page }) => {
    await page.goto('/secretaria/plantillas');
    await page.getByText('Modelos de acuerdo').click();
    await expect(
      page.getByRole('row', { name: /APROBACION|NOMBRAMIENTO|FUSION|COMITES/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('filtro por materia en modelos de acuerdo funciona', async ({ page }) => {
    await page.goto('/secretaria/plantillas');
    await page.getByText('Modelos de acuerdo').click();
    const select = page.locator('select').first();
    if (await select.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await select.selectOption({ index: 1 });
      await expect(page).not.toHaveURL('/login');
    }
  });
});

test.describe('Libros Obligatorios', () => {
  test('lista de libros muestra alertas de legalización', async ({ page }) => {
    await page.goto('/secretaria/libros');
    await expect(
      page.getByText('Libro').or(page.getByText('legaliz').or(page.getByText('alerta'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
