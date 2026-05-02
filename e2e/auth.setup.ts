import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_FILE = path.join(process.cwd(), '.auth/session.json');

setup('authenticate as demo user', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Acceder como demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Acceder como demo' }).click();
  await page.waitForURL('/', { timeout: 20_000 });
  await expect(page.getByText('ARGA').first()).toBeVisible();
  const authDir = path.join(process.cwd(), '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  const storageState = await page.context().storageState();
  const activeBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
  const pageOrigin = new URL(page.url()).origin;
  const activeOrigin = activeBaseUrl ? new URL(activeBaseUrl).origin : pageOrigin;
  const pageOriginState = storageState.origins.find((origin) => origin.origin === pageOrigin);

  if (pageOriginState && activeOrigin !== pageOrigin) {
    storageState.origins = [
      ...storageState.origins.filter((origin) => origin.origin !== activeOrigin),
      { origin: activeOrigin, localStorage: pageOriginState.localStorage },
    ];
  }

  fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));
});
