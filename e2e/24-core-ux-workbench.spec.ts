import { test, expect } from './fixtures/base';
import type { Page } from '@playwright/test';

const viewports = [
  { label: 'mobile', width: 390, height: 844 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1440, height: 900 },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    );

    return {
      documentWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(
    metrics.documentWidth,
    `Horizontal overflow: document ${metrics.documentWidth}px > viewport ${metrics.viewportWidth}px`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function allowSiiAccess(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('sii_access_confirmed', 'true');
  });
}

test.describe('Core UX workbench copy', () => {
  test('root console, GRC and AIMS expose workbench language', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Qué requiere atención ahora/i })).toBeVisible();
    await expect(page.getByText('TGMS compone, cada módulo responsable escribe')).toBeVisible();

    await page.goto('/grc');
    await expect(page.getByRole('heading', { name: 'Mesa de trabajo GRC' })).toBeVisible();
    await expect(page.getByText('Acciones operativas')).toBeVisible();

    await page.goto('/ai-governance');
    await expect(page.getByRole('heading', { name: 'Mesa de trabajo AI Governance' })).toBeVisible();
    await expect(page.getByText('Acciones del officer AIMS')).toBeVisible();
  });
});

test.describe('Core UX assigned routes — responsive', () => {
  for (const viewport of viewports) {
    test(`/sii expone intake seguro y sin overflow horizontal en ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await allowSiiAccess(page);
      await page.goto('/sii');

      await expect(page.getByRole('heading', { name: 'Intake SII' })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Entrada segura de comunicaciones')).toBeVisible();
      await expect(page.getByText('Bandeja de investigación')).toBeVisible();
      if (viewport.width < 1024) {
        await expect(page.getByTestId('sii-mobile-case-list')).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);
    });

    test(`/governance-map explica relaciones y no desborda en ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/governance-map');

      await expect(page.getByRole('heading', { name: 'Governance Map' })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Relaciones visibles:')).toBeVisible();
      await expect(page.getByText('Cómo leer el mapa')).toBeVisible();
      await expect(page.getByTestId('governance-map-canvas')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test(`/documentacion es navegable y sin overflow horizontal en ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/documentacion');

      await expect(page.getByRole('heading', { name: 'Centro de ayuda TGMS' })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Entender una relación')).toBeVisible();

      const nav = viewport.width < 1024 ? page.getByTestId('doc-mobile-nav') : page.getByTestId('doc-desktop-nav');
      await nav.getByRole('button', { name: 'Glosario' }).click();
      await expect(page.getByRole('heading', { name: 'Glosario' })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe('Governance Map filters', () => {
  test('aplica el filtro de jurisdicción y muestra el criterio activo', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/governance-map');

    await expect(page.getByRole('heading', { name: 'Governance Map' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('combobox', { name: 'Filtrar por jurisdicción' }).click();
    await page.getByRole('option', { name: 'España' }).click();
    await expect(page.getByText(/Filtro:.*España/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
