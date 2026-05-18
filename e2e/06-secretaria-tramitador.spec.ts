import { test, expect } from './fixtures/base';

test.describe('Secretaría — Tramitador', () => {
  test('lista de tramitaciones carga con estados demo', async ({ page }) => {
    await page.goto('/secretaria/tramitador');
    await expect(
      page.getByText('TRAM-').or(page.getByText('EN_TRAMITE').or(page.getByText('Tramitación'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('stepper nueva tramitación — paso 1: Seleccionar acuerdo', async ({ page }) => {
    await page.goto('/secretaria/tramitador/nuevo');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('Seleccionar acuerdo').or(page.getByText('Cargando').or(page.getByText('CERTIFIED'))).first()
    ).toBeVisible({ timeout: 12_000 });
  });

  test('stepper tramitador — seleccionar materia activa motor rule packs', async ({ page }) => {
    await page.goto('/secretaria/tramitador/nuevo');
    const agreementButton = page.locator('main').getByRole('button', { name: /Tipo de materia:/ }).first();
    await expect(agreementButton, 'el tramitador debe listar acuerdos operativos seleccionables').toBeVisible({ timeout: 10_000 });
    await agreementButton.click();
    const siguiente = page.getByRole('button', { name: /Siguiente/i });
    await expect(siguiente, 'seleccionar un acuerdo debe desbloquear el análisis registral').toBeEnabled({ timeout: 10_000 });
    await siguiente.click();
    await expect(page.getByRole('heading', { name: /Paso 2\. Vía de presentación/i })).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/Análisis de inscribibilidad|Instrumento requerido|criterio conservador de prototipo/i).first(),
      'el análisis registral debe mostrar trazabilidad de reglas y salida operativa',
    ).toBeVisible({ timeout: 8_000 });
  });

  test('TRAM-001 detalle abre sin crash', async ({ page }) => {
    await page.goto('/secretaria/tramitador');
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow, 'la lista debe exponer al menos una tramitación operativa').toBeVisible({ timeout: 10_000 });
    const detailLink = firstRow.getByRole('link').first();
    await expect(detailLink, 'cada tramitación debe tener enlace accesible a detalle').toBeVisible();
    await detailLink.click();
    await expect(page).toHaveURL(/\/secretaria\/tramitador\/[^/?]+/);
    await expect(page).not.toHaveURL('/login');
  });
});
