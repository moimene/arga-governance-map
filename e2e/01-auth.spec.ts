import { test, expect } from '@playwright/test';

// Este test NO usa storageState — necesita navegador limpio
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth', () => {
  test('redirige a /login cuando no hay sesión', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page.getByText('Bienvenido')).toBeVisible();
  });

  test('login con credenciales demo', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('usuario@argaseguros.com').fill('demo@arga-seguros.com');
    await page.getByPlaceholder('••••••••').fill('TGMSdemo2026!');
    await page.getByRole('button', { name: 'Acceder', exact: true }).click();
    await page.waitForURL('/', { timeout: 20_000 });
    await expect(page.getByText('ARGA').first()).toBeVisible();
  });

  test('botón Acceder como demo autentica directamente', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Acceder como demo' }).click();
    await page.waitForURL('/', { timeout: 20_000 });
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.getByText('ARGA').first()).toBeVisible();
  });
});
