import { test, expect } from './fixtures/base';

async function getDemoSociedadId(page): Promise<string> {
  await page.goto('/secretaria?scope=sociedad');
  const selector = page.locator('aside select[aria-label="Sociedad seleccionada"]');
  await expect(selector).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => selector.inputValue(), { timeout: 10_000 }).not.toBe('');
  return selector.inputValue();
}

test.describe('Secretaría — Lote 2 QA', () => {
  test('War Room de campañas renderiza en modo Grupo sin lanzar procesos', async ({ page }) => {
    await page.goto('/secretaria/procesos-grupo?scope=grupo');

    await expect(page.locator('main').getByRole('heading', { name: 'Campañas de grupo', exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Secretaría · War Room de grupo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lanzar campaña' })).toBeVisible();

    await expect(page.getByText('Cadena de acuerdos')).toBeVisible();
    await expect(page.getByText('Expedientes derivados')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Sociedad' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Fase' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Modo' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Rule pack' })).toBeVisible();
    await expect(page.getByText('Ha ocurrido un error', { exact: false })).toHaveCount(0);
  });

  test('War Room exige modo Grupo cuando se abre desde scope de sociedad', async ({ page }) => {
    const entityId = await getDemoSociedadId(page);
    await page.goto(`/secretaria/procesos-grupo?scope=sociedad&entity=${entityId}`);

    await expect(page.locator('main').getByRole('heading', { name: 'Campañas de grupo', exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText('Las campañas operan sobre un perímetro multi-sociedad')
    ).toBeVisible();

    await page.getByRole('button', { name: 'Cambiar a modo Grupo' }).click();

    await expect(page).toHaveURL('/secretaria/procesos-grupo?scope=grupo');
    await expect(page.getByText('Secretaría · War Room de grupo')).toBeVisible();
    await expect(page.getByText('Expedientes derivados')).toBeVisible();
    await expect(page.getByText('Ha ocurrido un error', { exact: false })).toHaveCount(0);
  });

  test('los asistentes de creación mantienen bloqueado el contexto de sociedad', async ({ page }) => {
    const entityId = await getDemoSociedadId(page);

    await page.goto(`/secretaria/convocatorias/nueva?scope=sociedad&entity=${entityId}`);
    await expect(page.getByText('Modo Sociedad activo: la convocatoria se emitirá dentro de esta sociedad.')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('main select').first()).toBeDisabled();
    await expect(page.locator('main select').first()).toHaveValue(entityId);
    const organoSelect = page.locator('main select').nth(1);
    await expect(organoSelect).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => organoSelect.locator('option').count(), { timeout: 10_000 }).toBeGreaterThan(1);
    await expect(page.getByText('No hay órganos registrados para esta sociedad.')).toHaveCount(0);
    await expect(page.getByText('Ha ocurrido un error', { exact: false })).toHaveCount(0);

    await page.goto(`/secretaria/acuerdos-sin-sesion/nuevo?scope=sociedad&entity=${entityId}`);
    await expect(page.getByText('Modo Sociedad activo: el acuerdo sin sesión se abrirá para esta sociedad.')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('main select').first()).toBeDisabled();
    await expect(page.locator('main select').first()).toHaveValue(entityId);
    await expect(page.getByText('Ha ocurrido un error', { exact: false })).toHaveCount(0);

    await page.goto(`/secretaria/tramitador/nuevo?scope=sociedad&entity=${entityId}`);
    await expect(page.getByText('Modo Sociedad activo: el tramitador solo muestra acuerdos de')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: /^Siguiente$/ })).toBeDisabled();
    await expect(
      page.locator('nav[aria-label="Pasos"]').getByRole('button', { name: /Vía de presentación/ })
    ).toBeDisabled();
    await expect(page.getByText('Ha ocurrido un error', { exact: false })).toHaveCount(0);
  });
});
