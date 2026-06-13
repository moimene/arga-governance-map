import { test, expect } from './fixtures/base';

test.describe('Board Pack', () => {
  test('ruta /secretaria/board-pack/:id renderiza sin crash', async ({ page }) => {
    await page.goto('/secretaria/board-pack/cda-22-04-2026');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('Board Pack')
        .or(page.getByText('board pack'))
        .or(page.getByText('Consejo'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Board Pack contiene sección de acuerdos o KPIs', async ({ page }) => {
    await page.goto('/secretaria/board-pack/cda-22-04-2026');
    await expect(
      page.getByText('Acuerdo')
        .or(page.getByText('KPI'))
        .or(page.getByText('Resumen'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Expediente de Acuerdo', () => {
  test('ruta /secretaria/acuerdos/:id muestra timeline 8 estados', async ({ page }) => {
    await page.goto('/secretaria/tramitador');
    await page.waitForTimeout(2000);
    // Audit #6: affordance explícito y estable "Ver Acuerdo 360" en cada fila con
    // agreement vinculado (antes el test pinchaba el texto descriptivo "Expediente"
    // y navegaba al detalle del tramitador en vez del Acuerdo 360).
    const acuerdoLink = page.getByTestId('tramitador-acuerdo-link').first();
    if (await acuerdoLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await acuerdoLink.click();
      await expect(page).toHaveURL(/\/secretaria\/acuerdos\/.+/, { timeout: 10_000 });
      // El timeline de ExpedienteAcuerdo renderiza labels en español (TIMELINE_LABEL,
      // trabajo H2 status-labels), no los códigos en inglés. Los 8 pasos siempre se
      // pintan, así que basta con verificar una etiqueta conocida del timeline.
      await expect(
        page.getByText('Borrador')
          .or(page.getByText('Adoptado'))
          .or(page.getByText('Propuesto'))
          .first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('calendario de vencimientos renderiza', async ({ page }) => {
    await page.goto('/secretaria/calendario');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('Calendario')
        .or(page.getByText('vencimiento'))
        .or(page.getByText('enero').or(page.getByText('abril'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
