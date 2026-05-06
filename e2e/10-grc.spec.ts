import { test, expect } from './fixtures/base';

test.describe('GRC Compass', () => {
  test('dashboard GRC carga métricas', async ({ page }) => {
    await page.goto('/grc');
    await expect(
      page.getByText('GRC').or(page.getByText('Riesgo').or(page.getByText('Incidente'))).first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Contexto técnico y contratos')).toBeVisible();
    await expect(page.getByText(/No conectado ahora:/).first()).toBeVisible();
  });

  test('cambio Grupo/Sociedad en GRC conserva el scope al navegar', async ({ page }) => {
    await page.goto('/grc?scope=grupo');
    await expect(page.getByRole('button', { name: /^Sociedad$/ })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /^Sociedad$/ }).click();
    const sociedadSelect = page.getByLabel('Sociedad seleccionada');
    await expect(sociedadSelect).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => sociedadSelect.locator('option').count(), { timeout: 10_000 })
      .toBeGreaterThan(1);

    const firstEntityValue = await sociedadSelect.evaluate((select) => {
      const element = select as HTMLSelectElement;
      return Array.from(element.options).find((option) => option.value)?.value ?? '';
    });
    expect(firstEntityValue).toBeTruthy();
    await sociedadSelect.selectOption(firstEntityValue);

    await expect(page).toHaveURL(/\/grc\?scope=sociedad&entity=/);
    await page.getByRole('link', { name: /Risk 360/i }).first().click();
    await expect(page).toHaveURL(/\/grc\/risk-360\?scope=sociedad&entity=/);
    await expect(page.getByText(/Modo Sociedad/i).first()).toBeVisible();

    await page.getByRole('button', { name: /^Grupo$/ }).click();
    await expect(page).toHaveURL(/\/grc\/risk-360$/);
    await expect(page.getByText(/Modo Grupo/i).first()).toBeVisible();
  });

  test('Risk 360 renderiza sin crash', async ({ page }) => {
    await page.goto('/grc/risk-360');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('Risk').or(page.getByText('Riesgo')).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('nuevo riesgo GRC renderiza formulario owner-write', async ({ page }) => {
    await page.goto('/grc/risk-360/nuevo');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Nuevo riesgo').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('legacy_write · risks')).toBeVisible();
  });

  test('Penal / Anticorrupción renderiza como vista conectada', async ({ page }) => {
    await page.goto('/grc/penal-anticorrupcion');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Penal / Anticorrupción').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Source: risks/i)).toBeVisible();
  });

  test('handoff AIMS a Risk 360 se muestra como intake read-only', async ({ page }) => {
    await page.goto('/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Entrada desde AIMS' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/abrir riesgo, control o plan de acción en GRC/i)).toBeVisible();
  });

  test('lista de incidentes carga datos demo', async ({ page }) => {
    await page.goto('/grc/incidentes');
    await expect(page).not.toHaveURL('/login');
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL('/login');
  });

  test('handoff AIMS a incidentes GRC se muestra sin write cross-module', async ({ page }) => {
    await page.goto('/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Entrada desde AIMS' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/conserva la trazabilidad de la decisión/i)).toBeVisible();
  });

  test('stepper nuevo incidente renderiza paso 1', async ({ page }) => {
    await page.goto('/grc/incidentes/nuevo');
    await expect(page).not.toHaveURL('/login');
    await expect(
      page.getByText('Incidente')
        .or(page.getByText('Tipo'))
        .or(page.getByText('Descripción'))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('packs país muestra ES, BR, MX', async ({ page }) => {
    await page.goto('/grc/packs');
    await expect(
      page.getByText('ES').or(page.getByText('España').or(page.getByText('Pack'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('MyWork renderiza sin crash', async ({ page }) => {
    await page.goto('/grc/mywork');
    await expect(page).not.toHaveURL('/login');
  });

  test('Alertas renderiza sin crash', async ({ page }) => {
    await page.goto('/grc/alertas');
    await expect(page).not.toHaveURL('/login');
  });

  test('Excepciones renderiza sin crash', async ({ page }) => {
    await page.goto('/grc/excepciones');
    await expect(page).not.toHaveURL('/login');
  });
});
