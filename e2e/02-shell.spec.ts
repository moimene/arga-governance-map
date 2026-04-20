import { test, expect } from './fixtures/base';

test.describe('TGMS Shell', () => {
  test('dashboard principal carga con KPIs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Governance').or(page.getByText('Dashboard')).first()).toBeVisible();
  });

  test('ruta /governance-map renderiza el mapa', async ({ page }) => {
    await page.goto('/governance-map');
    await expect(
      page.getByText('Governance Map').or(page.getByText('gobernanza')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('ruta /entidades muestra lista de entidades', async ({ page }) => {
    await page.goto('/entidades');
    await expect(page.getByText('ARGA')).toBeVisible({ timeout: 10_000 });
  });

  test('ruta /entidades/:id muestra detalle', async ({ page }) => {
    await page.goto('/entidades');
    await page.locator('a[href*="/entidades/"]').first().click();
    await expect(page.url()).toMatch(/\/entidades\/.+/);
  });

  test('ruta /organos muestra lista de órganos', async ({ page }) => {
    await page.goto('/organos');
    await expect(
      page.getByText('CdA').or(page.getByText('Consejo').or(page.getByText('Órganos'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('ruta /politicas muestra lista de políticas', async ({ page }) => {
    await page.goto('/politicas');
    await expect(
      page.getByText('Política').or(page.getByText('PR-')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('ruta /obligaciones muestra lista de obligaciones', async ({ page }) => {
    await page.goto('/obligaciones');
    await expect(
      page.getByText('Obligacion').or(page.getByText('Control')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('ruta /delegaciones renderiza sin crash', async ({ page }) => {
    await page.goto('/delegaciones');
    await expect(page).not.toHaveURL('/login');
  });

  test('ruta /hallazgos renderiza sin crash', async ({ page }) => {
    await page.goto('/hallazgos');
    await expect(page).not.toHaveURL('/login');
  });

  test('ruta /conflictos renderiza sin crash', async ({ page }) => {
    await page.goto('/conflictos');
    await expect(page).not.toHaveURL('/login');
  });
});
