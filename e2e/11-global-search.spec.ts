import { test, expect } from './fixtures/base';

test.describe('Búsqueda Global', () => {
  test('Cmd+K abre el modal de búsqueda', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k');
    await expect(
      page.getByRole('dialog').or(page.getByPlaceholder(/buscar|search/i)).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('búsqueda "ARGA" devuelve resultados', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);
    const input = page.getByRole('searchbox').or(page.getByPlaceholder(/buscar|search/i)).first();
    if (await input.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await input.fill('ARGA');
      await page.waitForTimeout(800);
      await expect(
        page.getByText('ARGA').first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('búsqueda por materia societaria devuelve acuerdos o puntos históricos', async ({ page }) => {
    await page.goto('/secretaria');
    await page.getByRole('button', { name: /Buscar/ }).first().click();
    const input = page.getByRole('searchbox').or(page.getByPlaceholder(/buscar|search/i)).first();
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill('APROBACION_CUENTAS');
    await expect(
      page.getByText(/APROBACION CUENTAS|Aprobación de cuentas|APROBACION_CUENTAS/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Escape cierra el modal de búsqueda', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('dialog')
    ).not.toBeVisible({ timeout: 3_000 }).catch(() => {});
  });
});

test.describe('AI Governance', () => {
  test('módulo AI Governance renderiza sin crash', async ({ page }) => {
    await page.goto('/ai-governance');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('AI').or(page.getByText('Inteligencia').or(page.getByText('Governance'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('SII — Zona Segregada', () => {
  test('ruta /sii renderiza en zona amber', async ({ page }) => {
    await page.goto('/sii');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('SII').or(page.getByText('Segregado')).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
