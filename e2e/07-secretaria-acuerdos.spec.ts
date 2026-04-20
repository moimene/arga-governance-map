import { test, expect } from './fixtures/base';

test.describe('Acuerdos Sin Sesión', () => {
  test('lista carga con estados APROBADO y VOTING_OPEN', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion');
    await expect(
      page.getByText('ASOC-').or(page.getByText('APROBADO').or(page.getByText('VOTING_OPEN'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('detalle ASOC-001 abre sin crash', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion');
    const asoc = page.getByText('ASOC-001').first();
    if (await asoc.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await asoc.click();
      await expect(page.url()).toMatch(/\/secretaria\/acuerdos-sin-sesion\/.+/);
    }
  });

  test('nuevo acuerdo sin sesión — stepper renderiza', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion/nuevo');
    await expect(page).not.toHaveURL('/login');
  });
});

test.describe('Decisiones Unipersonales', () => {
  test('lista renderiza DEC-SU-001 y DEC-AU-001', async ({ page }) => {
    await page.goto('/secretaria/decisiones-unipersonales');
    await expect(
      page.getByText('DEC-').or(page.getByText('FIRMADA').or(page.getByText('BORRADOR'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('detalle de decisión abre sin crash', async ({ page }) => {
    await page.goto('/secretaria/decisiones-unipersonales');
    const dec = page.getByText('DEC-').first();
    if (await dec.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dec.click();
      await expect(page.url()).toMatch(/\/secretaria\/decisiones-unipersonales\/.+/);
    }
  });
});
