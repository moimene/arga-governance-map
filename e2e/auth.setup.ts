import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(process.cwd(), '.auth/session.json');

setup('authenticate as demo user', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Acceder como demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Acceder como demo' }).click();
  await page.waitForURL('/', { timeout: 20_000 });
  await expect(page.getByText('ARGA')).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
