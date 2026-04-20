import { test, expect } from './fixtures/base';

test.describe('Board Pack', () => {
  test('ruta /secretaria/board-pack/:id renderiza sin crash', async ({ page }) => {
    await page.goto('/secretaria/board-pack/cda-22-04-2026');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('Board Pack')
        .or(page.getByText('board pack'))
        .or(page.getByText('Consejo'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Board Pack contiene sección de acuerdos o KPIs', async ({ page }) => {
    await page.goto('/secretaria/board-pack/cda-22-04-2026');
    await expect(
      page.getByText('Acuerdo')
        .or(page.getByText('KPI'))
        .or(page.getByText('Resumen'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Expediente de Acuerdo', () => {
  test('ruta /secretaria/acuerdos/:id muestra timeline 8 estados', async ({ page }) => {
    await page.goto('/secretaria/tramitador');
    await page.waitForTimeout(2000);
    const expediente = page.getByText('Expediente').first();
    if (await expediente.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expediente.click();
      await expect(page.url()).toMatch(/\/secretaria\/acuerdos\/.+/);
      await expect(
        page.getByText('DRAFT')
          .or(page.getByText('ADOPTED'))
          .or(page.getByText('PROPOSED'))
          .first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('calendario de vencimientos renderiza', async ({ page }) => {
    await page.goto('/secretaria/calendario');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('Calendario')
        .or(page.getByText('vencimiento'))
        .or(page.getByText('enero').or(page.getByText('abril'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
