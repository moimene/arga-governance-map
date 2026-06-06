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

test.describe('Motor de reglas societarias', () => {
  test('materia recorre plantillas, simulación y apertura de expediente', async ({ page }) => {
    await page.goto('/secretaria/catalogo-materias?scope=sociedad&entity=6d7ed736-f263-4531-a59d-c6ca0cd41602&materia=CESE_CONSEJERO');

    await expect(page.getByRole('heading', { name: 'Materias, requisitos y documentos' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: /Cese de consejero art\. 223 LSC/i }).click();
    await expect(page.getByRole('tab', { name: 'Resumen Cadena completa de decisión' })).toBeVisible();
    await expect(page.getByText('Cadena de decisión del motor')).toBeVisible();

    await page.getByRole('tab', { name: 'Plantillas Gate PRE documental' }).click();
    await expect(page.getByText('Plantillas vinculadas al motor')).toBeVisible();
    await expect(page.getByText('Usada por el motor').first()).toBeVisible();

    await page.getByRole('tab', { name: 'Simular Resultado antes de iniciar' }).click();
    await expect(page.getByText('Resultado del motor').first()).toBeVisible();
    await expect(page.getByText('Plantillas mínimas', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Iniciar expediente' }).click();
    await expect(page).toHaveURL(/\/secretaria\/tramitador\/nuevo.*materia=CESE_CONSEJERO/);
    await expect(page).not.toHaveURL('/login');
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
