import { test, expect } from './fixtures/base';
import { loginAsDemo, type Entorno } from './fixtures/demo-credentials';

/**
 * MOI-197 — índice de expedientes de acuerdo (`/secretaria/acuerdos`), en los
 * DOS tenants con sesión propia.
 *
 * El criterio de hecho es "la lista cuadra con el recuento del servidor", NO
 * un número fijo (52 ARGA / 10 Garrigues es una foto del 24-09-2026: Garrigues
 * se siembra de forma progresiva y la cifra crece). Así que este spec lee el
 * total del propio `content-range` que devuelve PostgREST para la petición de
 * `agreements` (requiere `count: "exact"` en el select, ver
 * `useAgreementsList`) y lo contrasta contra el contador que la página pinta.
 *
 * Solo lectura: mismo cortafuegos que `aims-evaluaciones.spec.ts` — cualquier
 * método de escritura hacia `/rest/v1/**` aborta y hace fallar el test.
 */

const METODOS_DE_ESCRITURA = ['POST', 'PATCH', 'PUT', 'DELETE'];

const TENANT: Record<Entorno, string> = {
  arga: '00000000-0000-0000-0000-000000000001',
  garrigues: '00000000-0000-0000-0000-000000000002',
};

for (const entorno of ['arga', 'garrigues'] as const) {
  test.describe(`Expedientes de acuerdo — índice (solo lectura) · ${entorno}`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    let escriturasIntentadas: string[] = [];

    test.beforeEach(async ({ page }) => {
      escriturasIntentadas = [];
      await page.route('**/rest/v1/**', async (route) => {
        const req = route.request();
        if (METODOS_DE_ESCRITURA.includes(req.method())) {
          escriturasIntentadas.push(`${req.method()} ${new URL(req.url()).pathname}`);
          await route.abort();
          return;
        }
        await route.fallback();
      });
      await page.route('**/rest/v1/rpc/**', async (route) => {
        escriturasIntentadas.push(`RPC ${new URL(route.request().url()).pathname}`);
        await route.abort();
      });
      await loginAsDemo(page, entorno);
    });

    test.afterEach(() => {
      expect(escriturasIntentadas, 'un índice de solo lectura no debe intentar escribir en Cloud').toEqual([]);
    });

    test('la lista cuadra con el content-range del servidor, sin filtros aplicados', async ({ page }) => {
      const agreementsResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === '/rest/v1/agreements' &&
          response.request().method() === 'GET' &&
          url.searchParams.get('tenant_id') === `eq.${TENANT[entorno]}`
        );
      });

      await page.goto('/secretaria/acuerdos');
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: 'Expedientes de acuerdo' })).toBeVisible({ timeout: 15_000 });

      const response = await agreementsResponse;
      expect(response.ok(), `GET /rest/v1/agreements: HTTP ${response.status()}`).toBe(true);
      const range = await response.headerValue('content-range');
      expect(range, 'la petición debe pedir el recuento exacto (content-range)').toMatch(/\/\d+$/);
      const serverCount = Number(range!.split('/').at(-1));

      // El contador se pinta desde el primer render con `rows = data ?? []`,
      // así que aparece en "0 expedientes en total" mientras la consulta sigue
      // en vuelo (antes de que React procese la respuesta ya recibida por
      // Playwright). Sondear hasta que se estabilice, no leerlo una sola vez.
      const contador = page.getByText(/expedientes? en total/);
      await expect(contador).toBeVisible({ timeout: 15_000 });
      let pintado = NaN;
      await expect
        .poll(
          async () => {
            const texto = (await contador.textContent()) ?? '';
            pintado = Number(/(\d+)\s+expedientes?\s+en total/.exec(texto)?.[1]);
            return pintado;
          },
          { timeout: 15_000 },
        )
        .toBe(serverCount);
      expect(pintado, 'la página debe pintar exactamente lo que el servidor cuenta para este tenant').toBe(serverCount);

      // Control positivo: cada fila abre la ficha de expediente existente.
      if (serverCount > 0) {
        const primeraFila = page.locator('tbody tr').first();
        await expect(primeraFila).toBeVisible();
        await primeraFila.getByRole('link').click();
        await expect(page).toHaveURL(/\/secretaria\/acuerdos\/[0-9a-f-]{36}(\?.*)?$/, { timeout: 15_000 });
      }
    });
  });
}
