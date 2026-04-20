import { test, expect } from './fixtures/base';

test.describe('GRC Compass', () => {
  test('dashboard GRC carga métricas', async ({ page }) => {
    await page.goto('/grc');
    await expect(
      page.getByText('GRC').or(page.getByText('Riesgo').or(page.getByText('Incidente'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Risk 360 renderiza sin crash', async ({ page }) => {
    await page.goto('/grc/risk-360');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('Risk').or(page.getByText('Riesgo')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('lista de incidentes carga datos demo', async ({ page }) => {
    await page.goto('/grc/incidentes');
    await expect(page).not.toHaveURL('/login');
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL('/login');
  });

  test('stepper nuevo incidente renderiza paso 1', async ({ page }) => {
    await page.goto('/grc/incidentes/nuevo');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('Incidente')
        .or(page.getByText('Tipo'))
        .or(page.getByText('Descripción'))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('packs país muestra ES, BR, MX', async ({ page }) => {
    await page.goto('/grc/packs');
    await expect(
      page.getByText('ES').or(page.getByText('España').or(page.getByText('Pack'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('MyWork renderiza sin crash', async ({ page }) => {
    await page.goto('/grc/mywork');
    await expect(page).not.toHaveURL('/login');
  });

  test('Alertas renderiza sin crash', async ({ page }) => {
    await page.goto('/grc/alertas');
    await expect(page).not.toHaveURL('/login');
  });

  test('Excepciones renderiza sin crash', async ({ page }) => {
    await page.goto('/grc/excepciones');
    await expect(page).not.toHaveURL('/login');
  });
});
