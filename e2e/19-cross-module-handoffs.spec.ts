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

  // MOI-158 — el destino lee el id del handoff y muestra referencia/título, en
  // solo lectura y acotado al tenant de la sesión (esta suite loguea como
  // ARGA, ver e2e/auth.setup.ts). Los ids son datos reales de Cloud
  // (governance_OS), leídos con SELECT antes de escribir este spec.
  const ARGA_AI_INCIDENT_ID = '03fe408a-f70b-4829-9a0b-de5fbe709df8';
  const OTHER_TENANT_AI_INCIDENT_ID = '447d97c2-a118-460f-91f5-509edc4499c7'; // Garrigues
  const ARGA_ASSESSMENT_ID = '132042ee-bd90-437e-b315-3baa747a421c';
  const OTHER_TENANT_ASSESSMENT_ID = 'fdcccf9e-fff0-4346-a2f2-17e610981be3'; // Garrigues

  test('GRC incidentes resuelve un ai_incident real del tenant a su referencia', async ({ page }) => {
    await page.goto(`/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${ARGA_AI_INCIDENT_ID}`);

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Entrada desde AIMS')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('EXP-INC-03FE408A')).toBeVisible();
    await expect(page.getByText(/Sesgo detectado en scoring/i)).toBeVisible();
  });

  test('GRC incidentes no muestra nada con un ai_incident de OTRO tenant', async ({ page }) => {
    await page.goto(`/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${OTHER_TENANT_AI_INCIDENT_ID}`);

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Entrada desde AIMS')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Incidente de origen/i)).not.toBeVisible();
  });

  test('Risk 360 resuelve un assessment real del tenant a sistema y fecha', async ({ page }) => {
    await page.goto(`/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP&assessment=${ARGA_ASSESSMENT_ID}`);

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Entrada desde AIMS')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Evaluación de origen/i)).toBeVisible();
    await expect(page.getByText(/Asistente de suscripci.n patrimonial/i)).toBeVisible();
  });

  test('Risk 360 no muestra nada con un assessment de OTRO tenant', async ({ page }) => {
    await page.goto(`/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP&assessment=${OTHER_TENANT_ASSESSMENT_ID}`);

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Entrada desde AIMS')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Evaluación de origen/i)).not.toBeVisible();
  });

  test('Secretaria intake resuelve un ai_incident real del tenant, sin pintar el id crudo', async ({ page }) => {
    await page.goto(`/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${ARGA_AI_INCIDENT_ID}`);

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Derivación desde AIMS 360')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('EXP-INC-03FE408A')).toBeVisible();
    await expect(page.getByText(/Sesgo detectado en scoring/i)).toBeVisible();
    await expect(page.getByText(ARGA_AI_INCIDENT_ID)).not.toBeVisible();
  });

  test('Secretaria intake no muestra nada con un ai_incident de OTRO tenant', async ({ page }) => {
    await page.goto(`/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=${OTHER_TENANT_AI_INCIDENT_ID}`);

    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Derivación desde AIMS 360')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Referencia:/i)).not.toBeVisible();
    await expect(page.getByText(OTHER_TENANT_AI_INCIDENT_ID)).not.toBeVisible();
  });
});
