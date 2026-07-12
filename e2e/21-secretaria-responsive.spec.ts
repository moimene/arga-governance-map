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

    await expect(page.getByText('Mesa de Secretaría')).toBeVisible();

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

  test('Materias y reglas mantiene el orden de foco y lleva la selección al detalle', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      '/secretaria/catalogo-materias?scope=grupo&materia=DIVIDENDO_A_CUENTA&presentacion=tabla',
    );

    await expect(page.getByRole('heading', { name: 'Materias y reglas' })).toBeVisible({ timeout: 10_000 });
    await expectNoHorizontalOverflow(page);

    const controls = page.getByTestId('materias-catalog-controls');
    const exportButton = controls.getByRole('button', { name: 'Exportar matriz CSV' });
    await expect(exportButton).toBeEnabled({ timeout: 10_000 });
    const catalogTouchTargets = [
      page.getByRole('combobox', { name: 'Sociedad', exact: true }),
      controls.getByLabel('Buscar por materia, artículo o documento'),
      controls.getByLabel('Mayoría mínima (catálogo)'),
      controls.getByLabel('Formalización'),
      controls.getByLabel('Estado'),
      exportButton,
    ];
    for (const target of catalogTouchTargets) {
      const targetBox = await target.boundingBox();
      expect(targetBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await controls.getByLabel('Buscar por materia, artículo o documento').fill('dividendo');
    const clearFilters = controls.getByRole('button', { name: 'Limpiar filtros' });
    const clearFiltersBox = await clearFilters.boundingBox();
    expect(clearFiltersBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await clearFilters.click();

    const detail = page.getByRole('complementary', { name: 'Detalle de la materia seleccionada' });
    await expect(
      detail.getByRole('heading', { name: 'Distribución de dividendo a cuenta' }),
    ).toBeVisible();

    const tableScroller = page.getByRole('region', { name: 'Comparación de materias y reglas' });
    await expect(tableScroller).toBeVisible();
    const detailBox = await detail.boundingBox();
    const tableBox = await tableScroller.boundingBox();
    expect(detailBox).not.toBeNull();
    expect(tableBox).not.toBeNull();
    expect(tableBox!.y).toBeLessThan(detailBox!.y);

    await tableScroller.focus();
    await expect(tableScroller).toBeFocused();
    const dimensions = await tableScroller.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
    expect(dimensions.overflowX).toBe('auto');

    const dividendRow = tableScroller.getByRole('row', {
      name: /Distribución de dividendo a cuenta/i,
    });
    await dividendRow
      .getByRole('button', { name: 'Ver detalle de Distribución de dividendo a cuenta' })
      .click();
    await expect(detail).toBeFocused();
    await expect(
      detail.getByRole('heading', { name: 'Distribución de dividendo a cuenta' }),
    ).toBeVisible();
  });

  test('Plantillas lleva la selección móvil al detalle y mantiene targets de ciclo de 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/secretaria/plantillas?scope=grupo');

    await expect(page.getByRole('heading', { name: /Plantillas documentales protegidas|Plantillas aplicables/i })).toBeVisible({
      timeout: 10_000,
    });
    await expectNoHorizontalOverflow(page);

    const cycleGroup = page.getByRole('group', { name: 'Filtrar plantillas por ciclo de vida' });
    await expect(cycleGroup).toBeVisible();
    const cycleButtons = cycleGroup.getByRole('button');
    const cycleButtonCount = await cycleButtons.count();
    expect(cycleButtonCount).toBeGreaterThan(0);
    for (let index = 0; index < cycleButtonCount; index += 1) {
      const box = await cycleButtons.nth(index).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const qualityFilter = page.getByRole('combobox', { name: 'Filtrar por calidad documental' });
    const qualityBox = await qualityFilter.boundingBox();
    expect(qualityBox).not.toBeNull();
    expect(qualityBox!.height).toBeGreaterThanOrEqual(44);

    const mobileList = page.getByTestId('plantillas-mobile-list');
    await expect(mobileList).toBeVisible();
    await mobileList
      .getByRole('button', { name: /Acta de acuerdo escrito sin sesión/i })
      .click();

    const detail = page.getByRole('complementary', {
      name: 'Detalle de la plantilla seleccionada',
    });
    await expect(detail).toBeFocused();
    await expect(detail.getByText('Todos los tipos sociales', { exact: true }).first()).toBeVisible();
    const governanceBox = await detail
      .getByRole('button', { name: 'Administrar esta plantilla' })
      .boundingBox();
    expect(governanceBox).not.toBeNull();
    expect(governanceBox!.height).toBeGreaterThanOrEqual(44);
    await expect
      .poll(() =>
        detail.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < window.innerHeight;
        }),
      )
      .toBe(true);
    const detailViewport = await detail.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        active: document.activeElement === element,
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: window.innerHeight,
      };
    });
    expect(detailViewport.active).toBe(true);
    expect(detailViewport.bottom).toBeGreaterThan(0);
    expect(detailViewport.top).toBeLessThan(detailViewport.viewportHeight);
    await expectNoHorizontalOverflow(page);
  });

  test('tabla comparativa ocupa el ancho disponible sin forzar scroll a 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/secretaria/catalogo-materias?scope=grupo&presentacion=tabla');

    await expect(page.getByRole('heading', { name: 'Materias y reglas' })).toBeVisible({ timeout: 10_000 });
    await expectNoHorizontalOverflow(page);

    const tableScroller = page.getByRole('region', { name: 'Comparación de materias y reglas' });
    await expect(tableScroller).toBeVisible();
    const dimensions = await tableScroller.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
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
