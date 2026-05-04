import { test, expect } from './fixtures/base';
import type { Page } from '@playwright/test';

const denseSecretariaPages = [
  {
    path: '/secretaria/sociedades?scope=grupo',
    heading: /Sociedades/i,
    mobile: 'sociedades-mobile-list',
    desktop: 'sociedades-desktop-table',
  },
  {
    path: '/secretaria/personas?scope=grupo',
    heading: /^Personas$/i,
    mobile: 'personas-mobile-list',
    desktop: 'personas-desktop-table',
  },
  {
    path: '/secretaria/libros?scope=grupo',
    heading: /Libros obligatorios/i,
    mobile: 'libros-mobile-list',
    desktop: 'libros-desktop-table',
  },
  {
    path: '/secretaria/plantillas?scope=grupo',
    heading: /Plantillas documentales protegidas|Plantillas aplicables/i,
    mobile: 'plantillas-mobile-list',
    desktop: 'plantillas-desktop-table',
  },
];

async function expectNoHorizontalOverflow(page: Page) {
  const noHorizontalOverflow = await page.evaluate(() => {
    const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return width <= window.innerWidth + 1;
  });
  expect(noHorizontalOverflow).toBe(true);
}

test.describe('Secretaría Societaria — responsive 390px', () => {
  test('dashboard usa drawer móvil y no comprime el contenido', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/secretaria');

    await expect(page.getByText('Mesa de trabajo del secretario')).toBeVisible();

    await expectNoHorizontalOverflow(page);

    await expect(page.locator('aside[aria-label="Navegación de Secretaría Societaria"]')).toBeHidden();

    const menuButton = page.getByRole('button', { name: /Abrir navegación de Secretaría/i });
    await expect(menuButton).toBeVisible();
    await menuButton.click();

    const drawer = page.getByRole('dialog', { name: /Navegación de Secretaría Societaria/i });
    await expect(drawer).toBeVisible();
    await expect(page.getByRole('link', { name: /Sociedades/i })).toBeVisible();

    await page.getByRole('link', { name: /Sociedades/i }).click();
    await expect(page).toHaveURL(/\/secretaria\/sociedades/);
    await expect(drawer).not.toBeVisible();
  });
});

test.describe('Secretaría Societaria — listas densas responsive', () => {
  for (const viewport of [
    { width: 390, height: 844, mode: 'mobile' },
    { width: 768, height: 1024, mode: 'mobile' },
    { width: 1440, height: 1000, mode: 'desktop' },
  ] as const) {
    test(`listas clave no desbordan a ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const modulePage of denseSecretariaPages) {
        await page.goto(modulePage.path);

        await expect(page.getByRole('heading', { name: modulePage.heading })).toBeVisible();
        await expectNoHorizontalOverflow(page);

        if (viewport.mode === 'desktop') {
          await expect(page.getByTestId(modulePage.desktop)).toBeVisible();
          await expect(page.getByTestId(modulePage.mobile)).toBeHidden();
        } else {
          await expect(page.getByTestId(modulePage.mobile)).toBeVisible();
          await expect(page.getByTestId(modulePage.desktop)).toBeHidden();
        }
      }
    });
  }
});
