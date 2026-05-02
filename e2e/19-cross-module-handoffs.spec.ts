import { test, expect } from './fixtures/base';

test.describe('Cross-module handoffs read-only', () => {
  let forbiddenWrites: string[];

  test.beforeEach(async ({ page }) => {
    forbiddenWrites = [];

    await page.route(/\/rest\/v1\/governance_module_(events|links)(\?|$)/, async (route) => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) {
        forbiddenWrites.push(`${request.method()} ${request.url()}`);
      }
      await route.continue();
    });
  });

  test.afterEach(() => {
    expect(forbiddenWrites).toEqual([]);
  });

  test('AIMS technical file gap opens GRC intake without shared writes', async ({ page }) => {
    await page.goto('/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP&assessment=e2e-assessment');

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Intake read-only desde AIMS')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/no escribe eventos ni links/i)).toBeVisible();
  });

  test('AIMS material incident opens GRC intake without shared writes', async ({ page }) => {
    await page.goto('/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=e2e-ai-incident');

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Intake read-only desde AIMS')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/no escribe en contratos cross-module/i)).toBeVisible();
  });

  test('AIMS material incident opens Secretaria agenda intake without creating acts', async ({ page }) => {
    await page.goto('/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=e2e-ai-incident');

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Handoff read-only desde AIMS 360')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/No se escriben.*governance_module_events.*governance_module_links/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Crear convocatoria/i })).toBeVisible();
  });

  test('GRC material event opens Secretaria agenda intake without creating acts', async ({ page }) => {
    await page.goto('/secretaria/reuniones/nueva?source=grc&event=GRC_INCIDENT_MATERIAL&source_id=e2e-grc-incident');

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Handoff read-only desde GRC Compass')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Secretaría decide si lo incorpora/i)).toBeVisible();
    await expect(page.getByText(/No se escriben.*reuniones.*acuerdos.*actas/i)).toBeVisible();
  });
});
