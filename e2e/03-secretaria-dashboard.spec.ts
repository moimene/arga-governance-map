import { test, expect } from './fixtures/base';

test.describe('Secretaría Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/secretaria');
  });

  test('carga el módulo Secretaría Societaria', async ({ page }) => {
    await expect(
      page.getByText('Secretaría').or(page.getByText('secretaría')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('muestra KPIs: Reuniones, Convocatorias, Tramitaciones', async ({ page }) => {
    await expect(
      page.getByText('Reuniones')
        .or(page.getByText('Convocatoria'))
        .or(page.getByText('Tramitación'))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('sidebar muestra los módulos de Secretaría', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Convocatorias' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Reuniones' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Tramitador' })).toBeVisible({ timeout: 10_000 });
  });

  test('pactos vigentes aparece en cross-module metrics', async ({ page }) => {
    await expect(
      page.getByText('Pacto').or(page.getByText('pacto')).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
