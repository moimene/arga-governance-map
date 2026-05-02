import { test, expect } from './fixtures/base';

test.describe('Secretaría — Reuniones', () => {
  test('lista de reuniones carga datos demo', async ({ page }) => {
    await page.goto('/secretaria/reuniones');
    await expect(
      page.getByText('CdA').or(page.getByText('Consejo').or(page.getByText('Reunión'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('nueva reunión — intake enruta a convocatoria owner', async ({ page }) => {
    await page.goto('/secretaria/reuniones/nueva');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Preparar una sesión societaria')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /Crear convocatoria/i })).toBeVisible();
  });
});

test.describe('Secretaría — Actas', () => {
  test('lista de actas carga datos demo', async ({ page }) => {
    await page.goto('/secretaria/actas');
    await expect(
      page.getByText('ACTA-').or(page.getByText('Acta')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('detalle de acta abre desde lista', async ({ page }) => {
    await page.goto('/secretaria/actas');
    const acta = page.getByText('ACTA-').first();
    if (await acta.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await acta.click();
      await expect(page.url()).toMatch(/\/secretaria\/actas\/.+/);
      await expect(page.getByRole('button', { name: 'Acta DOCX' })).toBeVisible();
    }
  });
});
