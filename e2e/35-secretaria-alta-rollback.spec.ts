/**
 * Test de rollback compensatorio en alta de sociedad.
 *
 * Carril FU#2 sobre commit 4036f1a (fix(secretaria): alta de sociedad operable
 * + tenant scoping). Verifica que cuando uno de los inserts intermedios falla,
 * `SociedadNuevaStepper.guardar()` ejecuta los compensating deletes en orden
 * inverso al de creación.
 *
 * Trade-off: este test es mock-based (intercepta llamadas Supabase REST con
 * `page.route`). NO valida la limpieza real en Cloud; valida la secuencia de
 * deletes que el cliente emite. Para validar Cloud-side se requeriría un
 * test destructivo opt-in tipo `e2e/32-...`.
 */
import { test, expect } from './fixtures/base';

const FAKE_PERSON_ID = '00000000-0000-4000-8000-aaaaaaaaaaa1';
const FAKE_ENTITY_ID = '00000000-0000-4000-8000-aaaaaaaaaaa2';

test.describe('Secretaría — alta sociedad rollback compensatorio', () => {
  test('limpia datos parciales en orden inverso si falla un insert intermedio', async ({ page }) => {
    const orderedRequests: Array<{ table: string; method: string }> = [];

    // Para `.select().single()` el cliente supabase-js envía
    // `Accept: application/vnd.pgrst.object+json` y espera el objeto
    // directamente, NO un array de un elemento.
    const fulfillJsonObject = (route: import('@playwright/test').Route, body: unknown) =>
      route.fulfill({
        status: 201,
        headers: { 'content-type': 'application/vnd.pgrst.object+json' },
        body: JSON.stringify(body),
      });

    const fulfillNoContent = (route: import('@playwright/test').Route) =>
      route.fulfill({ status: 204, headers: { 'content-type': 'application/json' }, body: '' });

    // 1) persons: POST devuelve PJ falsa, DELETE registra orden
    await page.route('**/rest/v1/persons*', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        orderedRequests.push({ table: 'persons', method });
        return fulfillJsonObject(route, {
          id: FAKE_PERSON_ID,
          full_name: 'TEST SA',
          tax_id: 'A-99999990',
          person_type: 'PJ',
        });
      }
      if (method === 'DELETE') {
        orderedRequests.push({ table: 'persons', method });
        return fulfillNoContent(route);
      }
      return route.fallback();
    });

    // 2) entities: POST devuelve entity falsa, DELETE registra orden
    await page.route('**/rest/v1/entities*', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        orderedRequests.push({ table: 'entities', method });
        return fulfillJsonObject(route, {
          id: FAKE_ENTITY_ID,
          person_id: FAKE_PERSON_ID,
          legal_name: 'TEST SA',
          common_name: 'TEST SA',
          slug: 'test-sa-12345',
          jurisdiction: 'ES',
          legal_form: 'S.L.',
          tipo_social: 'SL',
          entity_status: 'Active',
          materiality: 'Medium',
        });
      }
      if (method === 'DELETE') {
        orderedRequests.push({ table: 'entities', method });
        return fulfillNoContent(route);
      }
      return route.fallback();
    });

    // 3) entity_capital_profile: POST OK, DELETE registra orden
    await page.route('**/rest/v1/entity_capital_profile*', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        orderedRequests.push({ table: 'entity_capital_profile', method });
        return fulfillNoContent(route);
      }
      if (method === 'DELETE') {
        orderedRequests.push({ table: 'entity_capital_profile', method });
        return fulfillNoContent(route);
      }
      return route.fallback();
    });

    // 4) share_classes: POST FALLA con 500 (failure injection)
    await page.route('**/rest/v1/share_classes*', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        orderedRequests.push({ table: 'share_classes', method });
        return route.fulfill({
          status: 500,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            code: 'PGRST500',
            message: 'simulated failure for rollback test',
            details: null,
            hint: null,
          }),
        });
      }
      if (method === 'DELETE') {
        orderedRequests.push({ table: 'share_classes', method });
        return fulfillNoContent(route);
      }
      return route.fallback();
    });

    // 5) governing_bodies: solo DELETE (POST nunca se alcanza por fallo previo)
    await page.route('**/rest/v1/governing_bodies*', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        orderedRequests.push({ table: 'governing_bodies', method });
        return route.fulfill({ status: 500, body: '{"message":"should not be called"}' });
      }
      if (method === 'DELETE') {
        orderedRequests.push({ table: 'governing_bodies', method });
        return fulfillNoContent(route);
      }
      return route.fallback();
    });

    // Navegar al alta y completar el stepper de 4 pasos.
    await page.goto('/secretaria/sociedades/nueva');
    await expect(page.getByRole('heading', { name: 'Alta de sociedad' })).toBeVisible({ timeout: 10_000 });

    // Paso 1: identidad
    await page.getByLabel('Denominación legal *').fill('TEST SA');
    await page.getByLabel('NIF/CIF *').fill('A-99999990');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Paso 2: administración (defaults sirven)
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Paso 3: capital (defaults sirven)
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Paso 4: confirmar y enviar
    await page.getByRole('button', { name: 'Crear sociedad' }).click();

    // Espera al toast de error
    await expect(page.getByText(/No se pudo crear la sociedad/i)).toBeVisible({ timeout: 10_000 });

    // Verifica la secuencia de requests emitida por el cliente
    const sequence = orderedRequests.map((r) => `${r.method} ${r.table}`);

    // Inserts: persons → entities → entity_capital_profile → share_classes (falla)
    expect(sequence.slice(0, 4)).toEqual([
      'POST persons',
      'POST entities',
      'POST entity_capital_profile',
      'POST share_classes',
    ]);

    // Tras el fallo: governing_bodies NUNCA se llamó como POST
    expect(sequence).not.toContain('POST governing_bodies');

    // Rollback compensatorio en orden inverso de creación:
    // governing_bodies (no-op pero se intenta) → share_classes → entity_capital_profile
    // → entities → persons
    const deleteSequence = sequence.filter((s) => s.startsWith('DELETE'));
    expect(deleteSequence).toEqual([
      'DELETE governing_bodies',
      'DELETE share_classes',
      'DELETE entity_capital_profile',
      'DELETE entities',
      'DELETE persons',
    ]);
  });
});
