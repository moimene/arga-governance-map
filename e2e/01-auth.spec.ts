import { test, expect } from '@playwright/test';
import { DEMO_EMAIL, DEMO_PASSWORD, fillLogin, loginAsDemo } from './fixtures/demo-credentials';

// Este test NO usa storageState — necesita navegador limpio
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth', () => {
  test('redirige a /login cuando no hay sesión y ofrece los dos entornos', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page.getByRole('radio', { name: /ARGA/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Garrigues/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Acceso a ARGA' })).toBeVisible();
  });

  test('?tenant=garrigues preselecciona el entorno Garrigues', async ({ page }) => {
    await page.goto('/login?tenant=garrigues');
    await expect(page.getByRole('radio', { name: /Garrigues/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('heading', { name: 'Acceso a Garrigues' })).toBeVisible();
  });

  test('login con credenciales demo desde el formulario', async ({ page }) => {
    await loginAsDemo(page, 'arga');
    await expect(page.getByText('ARGA').first()).toBeVisible();
  });

  test('login Garrigues aterriza en el shell Garrigues', async ({ page }) => {
    await loginAsDemo(page, 'garrigues');
    await expect(page.getByText(/GARRIGUES/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/^ARGA$/).first()).toHaveCount(0);
  });

  test('no existe ningún acceso directo: ni botón demo, ni autoalta, ni contraseña en pantalla', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /demo/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /crear cuenta|sso/i })).toHaveCount(0);
    await expect(page.getByText(DEMO_PASSWORD)).toHaveCount(0);
    await expect(page.getByText(DEMO_EMAIL)).toHaveCount(0);
  });

  test('una cuenta ARGA no entra por el entorno Garrigues', async ({ page }) => {
    await fillLogin(page, 'garrigues', DEMO_EMAIL, DEMO_PASSWORD);
    await expect(page.getByText(/pertenece al entorno ARGA/)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
