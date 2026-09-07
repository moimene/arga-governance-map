import { defineConfig, devices } from '@playwright/test';
import './playwright.config'; // Carga las credenciales locales sin copiarlas al spec.

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (baseURL !== 'https://arga-governance-map.vercel.app') {
  throw new Error('La comprobación requiere PLAYWRIGHT_BASE_URL=https://arga-governance-map.vercel.app');
}

export default defineConfig({
  testDir: './e2e/production',
  testMatch: /\.check\.ts$/,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: 'list',
  outputDir: 'test-results/production-tenants',
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL,
    storageState: { cookies: [], origins: [] },
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'only-on-failure',
    navigationTimeout: 30_000,
  },
});
