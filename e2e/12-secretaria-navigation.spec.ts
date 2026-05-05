import { test, expect } from './fixtures/base';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/secretaria', heading: 'Mesa de trabajo del secretario' },
  { label: 'Sociedades', path: '/secretaria/sociedades', heading: 'Sociedades' },
  { label: 'Personas', path: '/secretaria/personas', heading: 'Personas' },
  { label: 'Board Pack', path: '/secretaria/board-pack', heading: 'Board Pack' },
  { label: 'Campañas de grupo', path: '/secretaria/procesos-grupo', heading: 'Campañas de grupo' },
  { label: 'Convocatorias', path: '/secretaria/convocatorias', heading: 'Convocatorias' },
  { label: 'Reuniones', path: '/secretaria/reuniones', heading: 'Reuniones' },
  { label: 'Actas', path: '/secretaria/actas', heading: 'Actas y certificaciones' },
  {
    label: 'Decisiones unipersonales',
    path: '/secretaria/decisiones-unipersonales',
    heading: 'Decisiones de socio único / administrador único',
  },
  {
    label: 'Acuerdos sin sesión',
    path: '/secretaria/acuerdos-sin-sesion',
    heading: 'Acuerdos escritos sin sesión',
  },
  { label: 'Tramitador registral', path: '/secretaria/tramitador', heading: 'Tramitaciones registrales' },
  {
    label: 'Libro de socios',
    path: '/secretaria/libro-socios',
    heading: 'Libro de socios — Movimientos de capital',
  },
  { label: 'Libros obligatorios', path: '/secretaria/libros', heading: 'Libros obligatorios' },
  { label: 'Plantillas', path: '/secretaria/plantillas', heading: 'Plantillas documentales protegidas' },
  { label: 'Gestor plantillas', path: '/secretaria/gestor-plantillas', heading: 'Plantillas con contenido jurídico' },
  { label: 'Calendario', path: '/secretaria/calendario', heading: 'Calendario de vencimientos' },
  {
    label: 'Multi-jurisdicción',
    path: '/secretaria/multi-jurisdiccion',
    heading: 'Secretaría Multi-jurisdicción',
  },
];

test.describe('Secretaría navigation smoke', () => {
  test('dashboard expone contratos sanitizados por flujo', async ({ page }) => {
    await page.goto('/secretaria');

    await expect(page.locator('main').getByRole('heading', { name: 'Mesa de trabajo del secretario', exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Prioridad ahora')).toBeVisible();
    await expect(page.getByText('Empezar un flujo')).toBeVisible();
    await expect(page.getByRole('button', { name: /Nueva convocatoria/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nueva reunión/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Generar documento/ })).toBeVisible();
  });

  test('cambia entre modo Sociedad y Grupo sin crash', async ({ page }) => {
    const failedSupabaseResponses: string[] = [];

    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && url.includes('supabase.co/rest/v1')) {
        failedSupabaseResponses.push(`${status} ${url}`);
      }
    });

    await page.goto('/secretaria');

    await page.getByRole('button', { name: 'Sociedad', exact: true }).click();
    const sociedadSelect = page.getByLabel('Sociedad seleccionada');
    await expect(sociedadSelect).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => sociedadSelect.locator('option').count()).toBeGreaterThan(1);

    const sociedadValue = await sociedadSelect.evaluate((select) => {
      const options = Array.from((select as HTMLSelectElement).options);
      return options.find((option) => option.textContent?.includes('ARGA Seguros, S.A.'))?.value ?? options[1]?.value;
    });
    expect(sociedadValue).toBeTruthy();
    await sociedadSelect.selectOption(sociedadValue!);

    await page.getByRole('link', { name: 'Convocatorias', exact: true }).click();
    await expect(page).toHaveURL(/\/secretaria\/convocatorias\?scope=sociedad&entity=/);
    await expect(page.locator('main').getByRole('heading', { name: 'Convocatorias', exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Ha ocurrido un error', { exact: false })).toHaveCount(0);

    await page.getByRole('button', { name: 'Grupo', exact: true }).click();
    await page.getByRole('link', { name: 'Campañas de grupo', exact: true }).click();
    await expect(page).toHaveURL('/secretaria/procesos-grupo');
    await expect(page.locator('main').getByRole('heading', { name: 'Campañas de grupo', exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Ha ocurrido un error', { exact: false })).toHaveCount(0);
    expect(failedSupabaseResponses, 'El cambio Sociedad/Grupo no debe disparar errores REST').toEqual([]);
  });

  test('recorre todo el menú lateral sin crashes ni errores Supabase', async ({ page }) => {
    const failedSupabaseResponses: string[] = [];

    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && url.includes('supabase.co/rest/v1')) {
        failedSupabaseResponses.push(`${status} ${url}`);
      }
    });

    await page.goto('/secretaria');

    for (const item of NAV_ITEMS) {
      const failuresBeforeRoute = failedSupabaseResponses.length;
      await page.getByRole('link', { name: item.label, exact: true }).click();

      await expect(page).toHaveURL(new RegExp(`${item.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
      await expect(
        page.locator('main').getByRole('heading', { name: item.heading, exact: true })
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Ha ocurrido un error', { exact: false })).toHaveCount(0);

      const routeFailures = failedSupabaseResponses.slice(failuresBeforeRoute);
      expect(routeFailures, `${item.label} ha disparado respuestas Supabase fallidas`).toEqual([]);
    }
  });
});
