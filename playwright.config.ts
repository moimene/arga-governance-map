import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// Carga .env sin dependencia nueva: la contraseña demo ya no vive en el repo
// (rotación 2026-09-05) y los specs la leen de DEMO_PASSWORD_ARGA / _GARRIGUES.
if (fs.existsSync('.env')) {
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const reuseExistingServer = !process.env.CI && !process.env.PLAYWRIGHT_PORT;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/session.json',
      },
      dependencies: ['setup'],
    },
  ],
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          // VITE_E2E=1 -> shouldIncludeTestData() devuelve true para que los specs
          // vean el dato data_class='TEST' que crean (W3, 2026-06-14).
          command: `VITE_E2E=1 bunx --bun vite --host 127.0.0.1 --port ${port} --strictPort`,
          url: baseURL,
          reuseExistingServer,
          timeout: 60_000,
        },
      }),
});
