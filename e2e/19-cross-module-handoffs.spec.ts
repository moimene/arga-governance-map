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
    await expect(page.getByText('Entrada desde AIMS')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/brecha en expediente técnico/i)).toBeVisible();
  });

  test('AIMS material incident opens GRC intake without shared writes', async ({ page }) => {
    await page.goto('/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=e2e-ai-incident');

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Entrada desde AIMS')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/contexto de preparación/i)).toBeVisible();
  });

  test('AIMS material incident opens Secretaria agenda intake without creating acts', async ({ page }) => {
    await page.goto('/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=e2e-ai-incident');

    await expect(page).not.toHaveURL('/login');
    // MOI-157: se llama «derivación», no «handoff», y el evento se lee con nombre
    // legible, no con el código crudo del contrato. La garantía real (nada se
    // materializa desde aquí) ya la vigila el intercept de arriba; el texto solo
    // debe declararla sin nombrar tablas.
    await expect(page.getByText('Derivación desde AIMS 360')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/incidente de IA material/i)).toBeVisible();
    await expect(page.getByText(/No se crean.*reuniones.*acuerdos.*actas/i)).toBeVisible();
    await expect(page.getByText('Handoff read-only')).toHaveCount(0);
    await expect(page.getByText('AIMS_INCIDENT_MATERIAL')).toHaveCount(0);
    await expect(page.getByText('governance_module_events')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Crear convocatoria/i })).toBeVisible();
  });

  test('GRC material event opens Secretaria agenda intake without creating acts', async ({ page }) => {
    await page.goto('/secretaria/reuniones/nueva?source=grc&event=GRC_INCIDENT_MATERIAL&source_id=e2e-grc-incident');

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Derivación desde GRC Compass')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/incidente material/i)).toBeVisible();
    await expect(page.getByText(/Secretaría decide si lo incorpora/i)).toBeVisible();
    await expect(page.getByText(/No se crean.*reuniones.*acuerdos.*actas/i)).toBeVisible();
    await expect(page.getByText('Handoff read-only')).toHaveCount(0);
    await expect(page.getByText('GRC_INCIDENT_MATERIAL')).toHaveCount(0);
  });
});
