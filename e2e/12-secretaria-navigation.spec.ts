import { test, expect } from './fixtures/base';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/secretaria', heading: 'Dashboard' },
  { label: 'Sociedades', path: '/secretaria/sociedades', heading: 'Sociedades' },
  { label: 'Personas', path: '/secretaria/personas', heading: 'Personas' },
  { label: 'Board Pack', path: '/secretaria/board-pack', heading: 'Board Pack' },
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
