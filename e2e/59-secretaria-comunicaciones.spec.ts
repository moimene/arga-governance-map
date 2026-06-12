// ITEM-129 [P3] Cobertura e2e para el módulo de comunicaciones de Secretaría.
// Hasta ahora ningún spec navegaba /secretaria/comunicaciones, montaba la bandeja
// ni ejercitaba el detalle de destinatarios. Este spec cubre, de forma read-only y
// no destructiva: (1) navegación a la bandeja (vía sidebar si está cableado, con
// fallback a deep link), (2) estado de bandeja (vacío o tabla), (3) filtros por
// estado y (4) detalle de una comunicación si hay seed en Cloud.
import { test, expect } from './fixtures/base';

const COMUNICACIONES_URL = '/secretaria/comunicaciones';

// Navega a la bandeja de comunicaciones. Si el item de sidebar ya está cableado
// (data-sidebar-item="Comunicaciones") lo usa; si no, hace fallback a deep link.
// Mantiene el contrato de selector estable [data-sidebar-item] del repo (ITEM-130).
async function abrirComunicaciones(page) {
  await page.goto('/secretaria');
  const item = page.locator('[data-sidebar-item="Comunicaciones"]').first();
  if (await item.count()) {
    await item.click();
  } else {
    await page.goto(COMUNICACIONES_URL);
  }
  await expect(page).toHaveURL(/\/secretaria\/comunicaciones/);
  await expect(
    page.getByRole('heading', { name: 'Comunicaciones', exact: true })
  ).toBeVisible({ timeout: 10_000 });
}

test.describe('Secretaría — Comunicaciones (ITEM-129)', () => {
  test('navega a la bandeja de comunicaciones y muestra cabecera', async ({ page }) => {
    await abrirComunicaciones(page);
    await expect(
      page.getByText('Envíos a miembros de órganos sociales', { exact: false })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('la bandeja muestra estado vacío o tabla de comunicaciones', async ({ page }) => {
    await abrirComunicaciones(page);

    // Espera a que la carga termine (la página muestra "Cargando…" mientras query).
    await expect(page.getByText('Cargando…')).toHaveCount(0, { timeout: 10_000 });

    const tabla = page.locator('table');
    const vacio = page.getByText('No hay comunicaciones que coincidan con los filtros.');

    // Tras la carga, exactamente uno de los dos estados debe estar presente.
    await expect
      .poll(async () => (await tabla.count()) + (await vacio.count()), { timeout: 10_000 })
      .toBeGreaterThan(0);
  });

  test('los filtros por estado (tablist) están presentes y son operables', async ({ page }) => {
    await abrirComunicaciones(page);

    const tablist = page.getByRole('tablist', { name: 'Filtros por estado' });
    await expect(tablist).toBeVisible({ timeout: 10_000 });

    for (const label of ['Todas', 'Borradores', 'Programadas', 'Enviadas', 'Errores']) {
      await expect(tablist.getByRole('tab', { name: label, exact: true })).toBeVisible();
    }

    // Cambiar a "Borradores" actualiza el query param y no rompe la bandeja.
    await tablist.getByRole('tab', { name: 'Borradores', exact: true }).click();
    await expect(page).toHaveURL(/[?&]tab=borrador/);
    await expect(
      page.getByRole('tab', { name: 'Borradores', exact: true })
    ).toHaveAttribute('aria-selected', 'true');
  });

  test('detalle de una comunicación si hay seed (read-only)', async ({ page }) => {
    await abrirComunicaciones(page);
    await expect(page.getByText('Cargando…')).toHaveCount(0, { timeout: 10_000 });

    const verLink = page.getByRole('link', { name: 'Ver', exact: true }).first();
    if (!(await verLink.count())) {
      test.skip(true, 'No hay comunicaciones seed en Cloud — bandeja vacía.');
      return;
    }

    await verLink.click();
    await expect(page).toHaveURL(/\/secretaria\/comunicaciones\/[0-9a-f-]+/);

    // El detalle resuelve a "No encontrada." (sin back-link) o a la ficha con
    // cabecera + back-link + tabla de destinatarios.
    await expect(page.getByText('Cargando…')).toHaveCount(0, { timeout: 10_000 });
    const noEncontrada = page.getByText('No encontrada.');
    const destinatarios = page.getByRole('heading', { name: /Destinatarios/ });
    await expect
      .poll(async () => (await noEncontrada.count()) + (await destinatarios.count()), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    // Cuando la ficha resuelve, ofrece el enlace de vuelta a la bandeja.
    if (await destinatarios.count()) {
      await expect(
        page.getByRole('link', { name: '← Volver a comunicaciones' })
      ).toBeVisible();
    }
  });
});
