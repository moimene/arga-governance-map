import { test, expect } from './fixtures/base';

test.describe('Secretaría — Convocatorias', () => {
  test('lista de convocatorias renderiza con datos demo', async ({ page }) => {
    await page.goto('/secretaria/convocatorias');
    await expect(
      page.getByText('CONV-').or(page.getByText('Convocatori')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('detalle de convocatoria abre desde lista', async ({ page }) => {
    await page.goto('/secretaria/convocatorias?scope=grupo');
    await expect(page.locator('tbody')).toContainText('ARGA', { timeout: 10_000 });
    const dataRow = page.getByRole('row', { name: /ARGA/ }).first();
    await expect(dataRow).toBeVisible({ timeout: 10_000 });
    await dataRow.click();
    await expect(page).toHaveURL(/\/secretaria\/convocatorias\/[^/?]+/);
    await expect(page.getByRole('button', { name: 'Convocatoria DOCX' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Informe PRE' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reunión operativa' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Programar reunión|Abrir reunión/ }).first()).toBeVisible();
  });

  test('stepper nueva convocatoria — paso 1 renderiza', async ({ page }) => {
    await page.goto('/secretaria/convocatorias/nueva');
    await expect(
      page.getByText('Tipo y órgano').or(page.getByText('Paso 1')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('stepper nueva convocatoria — botón Siguiente avanza paso', async ({ page }) => {
    await page.goto('/secretaria/convocatorias/nueva');

    const sociedadSelect = page.locator('select').first();
    await expect(sociedadSelect).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => sociedadSelect.locator('option').count()).toBeGreaterThan(1);
    const sociedadValue = await sociedadSelect.evaluate((select) => {
      const options = Array.from((select as HTMLSelectElement).options);
      return options.find((option) => option.textContent?.includes('ARGA Seguros, S.A.'))?.value ?? options[1]?.value;
    });
    expect(sociedadValue).toBeTruthy();
    await sociedadSelect.selectOption(sociedadValue!);

    const organoSelect = page.locator('select').nth(1);
    await expect(organoSelect).toBeVisible({ timeout: 10_000 });
    await organoSelect.selectOption({ index: 1 });

    const siguiente = page.getByRole('button', { name: /Siguiente|siguiente/i });
    await expect(siguiente).toBeEnabled({ timeout: 10_000 });
    await siguiente.click();
    await expect(page.getByRole('heading', { name: /Paso 2/i })).toBeVisible({ timeout: 5_000 });
  });
});
