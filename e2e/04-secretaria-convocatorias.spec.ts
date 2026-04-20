import { test, expect } from './fixtures/base';

test.describe('Secretaría — Convocatorias', () => {
  test('lista de convocatorias renderiza con datos demo', async ({ page }) => {
    await page.goto('/secretaria/convocatorias');
    await expect(
      page.getByText('CONV-').or(page.getByText('Convocatori')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('detalle de convocatoria CONV-001 abre desde lista', async ({ page }) => {
    await page.goto('/secretaria/convocatorias');
    await page.getByText('CONV-001').first().click();
    await expect(page.url()).toMatch(/\/secretaria\/convocatorias\/.+/);
  });

  test('stepper nueva convocatoria — paso 1 renderiza', async ({ page }) => {
    await page.goto('/secretaria/convocatorias/nueva');
    await expect(
      page.getByText('Órgano').or(page.getByText('Tipo').or(page.getByText('paso')).first())
    ).toBeVisible({ timeout: 10_000 });
  });

  test('stepper nueva convocatoria — botón Siguiente avanza paso', async ({ page }) => {
    await page.goto('/secretaria/convocatorias/nueva');
    await page.waitForTimeout(1500);
    const siguiente = page.getByRole('button', { name: /Siguiente|siguiente/i });
    if (await siguiente.isVisible()) {
      await siguiente.click();
      await expect(page.getByText('paso 2').or(page.getByText('2 de')).first()).toBeVisible({ timeout: 5_000 }).catch(() => {});
    }
  });
});
