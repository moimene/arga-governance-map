import { test, expect } from './fixtures/base';
import { loginAsDemo, type Entorno } from './fixtures/demo-credentials';

/**
 * Certificaciones autónomas — selectores con datos reales, sin UUID a mano
 * (MOI-195).
 *
 * Antes, siete campos (órgano, persona, cargo, libro, movimiento, acuerdo y
 * decisión) eran `<input>` de texto libre con `placeholder="UUID opcional"`:
 * un secretario no puede escribir un identificador interno de la base de
 * datos. Ahora son selectores alimentados por los hooks del propio grupo.
 *
 * ESTE SPEC ES DE SOLO LECTURA. Un cortafuegos de red aborta y hace fallar el
 * test ante cualquier escritura de dominio (POST/PATCH/PUT/DELETE a
 * `/rest/v1/**`), salvo la única RPC que este flujo necesita invocar de
 * verdad para llegar a "Preparar fuente":
 * `fn_prepare_standalone_certification_source`, que el propio issue verificó
 * sin INSERT/UPDATE/DELETE en su cuerpo (no crea ni emite ninguna
 * certificación).
 *
 * Sociedad con acuerdos reales por entorno (medido en Cloud, 2026-09-26): la
 * matriz de cada tenant es la que concentra los acuerdos (ARGA Seguros: 36;
 * Garrigues (matriz): 10 de 10).
 */

const METODOS_DE_ESCRITURA = ['POST', 'PATCH', 'PUT', 'DELETE'];
const PREPARE_RPC_PATH = '/rest/v1/rpc/fn_prepare_standalone_certification_source';

const SOCIEDAD_CON_ACUERDOS: Record<'arga' | 'garrigues', string> = {
  arga: 'ARGA Seguros',
  garrigues: 'Garrigues (matriz)',
};

function firewallDeEscrituras(escrituras: string[]) {
  return async (route: import('@playwright/test').Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const esRpcPreparar = url.pathname === PREPARE_RPC_PATH;
    if (METODOS_DE_ESCRITURA.includes(req.method()) && !esRpcPreparar) {
      escrituras.push(`${req.method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    await route.fallback();
  };
}

for (const entorno of ['arga', 'garrigues'] as const) {
  test.describe(`Certificaciones autónomas — selectores sin UUID a mano (solo lectura) · ${entorno}`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    let escrituras: string[] = [];

    test.beforeEach(async ({ page }) => {
      escrituras = [];
      await page.route('**/rest/v1/**', firewallDeEscrituras(escrituras));
      await loginAsDemo(page, entorno as Entorno);
    });

    test.afterEach(() => {
      expect(
        escrituras,
        'este spec es de solo lectura: no puede crear ni emitir ninguna certificación',
      ).toEqual([]);
    });

    test('el selector de acuerdo ofrece datos reales del grupo, ninguna caja pide un UUID', async ({ page }) => {
      await page.goto('/secretaria/certificaciones');
      await expect(page.getByRole('heading', { name: 'Certificaciones autónomas' })).toBeVisible({
        timeout: 15_000,
      });

      // Arnés de mutación en el test de contrato estático
      // (src/test/schema/secretaria-informes-certificaciones.test.ts) cubre el
      // marcador "UUID" en el código fuente; aquí se comprueba en la pantalla
      // ya renderizada, contra el DOM real.
      await expect(page.locator('input[placeholder*="UUID" i]')).toHaveCount(0);

      await page.getByLabel('Sociedad').selectOption({ label: SOCIEDAD_CON_ACUERDOS[entorno] });

      const acuerdoSelect = page.getByLabel('Acuerdo');
      await expect
        .poll(async () => acuerdoSelect.locator('option').count(), { timeout: 10_000 })
        .toBeGreaterThan(1);

      const opciones = await acuerdoSelect.locator('option').all();
      const valorReal = await opciones[1].getAttribute('value');
      // Un identificador real de `agreements`, no un valor tecleado.
      expect(valorReal).toMatch(/^[0-9a-f-]{36}$/i);

      await acuerdoSelect.selectOption(valorReal!);
      await expect(acuerdoSelect).toHaveValue(valorReal!);
    });
  });
}

test.describe('Certificaciones autónomas — prepara la fuente sin escribir en el dominio (ARGA)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let escrituras: string[] = [];

  test.beforeEach(async ({ page }) => {
    escrituras = [];
    await page.route('**/rest/v1/**', firewallDeEscrituras(escrituras));
    await loginAsDemo(page, 'arga');
  });

  test.afterEach(() => {
    expect(
      escrituras,
      'preparar la fuente no debe crear ni emitir ninguna certificación',
    ).toEqual([]);
  });

  test('selecciona un acuerdo en el selector y prepara la fuente', async ({ page }) => {
    await page.goto('/secretaria/certificaciones');
    await expect(page.getByRole('heading', { name: 'Certificaciones autónomas' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel('Sociedad').selectOption({ label: SOCIEDAD_CON_ACUERDOS.arga });
    await page.getByLabel('Tipo').selectOption({ label: 'Certificación de acuerdo 360' });

    const acuerdoSelect = page.getByLabel('Acuerdo');
    await expect
      .poll(async () => acuerdoSelect.locator('option').count(), { timeout: 10_000 })
      .toBeGreaterThan(1);
    const opciones = await acuerdoSelect.locator('option').all();
    const valorReal = await opciones[1].getAttribute('value');
    await acuerdoSelect.selectOption(valorReal!);

    await page.getByRole('button', { name: 'Preparar fuente' }).click();
    await expect(page.getByText('Fuente canónica preparada')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Certificaciones autónomas — Garrigues: catálogo de tipos aún sin sembrar (deuda declarada, ajena a MOI-195)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let escrituras: string[] = [];

  test.beforeEach(async ({ page }) => {
    escrituras = [];
    await page.route('**/rest/v1/**', firewallDeEscrituras(escrituras));
    await loginAsDemo(page, 'garrigues');
  });

  test.afterEach(() => {
    expect(escrituras, 'este spec no escribe nada').toEqual([]);
  });

  /**
   * `standalone_certification_kinds` para el tenant Garrigues tiene 0 filas en
   * Cloud (medido 2026-09-26; ARGA tiene 41). El bootstrap de tipos ya soporta
   * sembrarlos (MOI-233), pero no se ha ejecutado para este tenant todavía —
   * es deuda de otro issue, no de este cambio. Mientras tanto "Preparar
   * fuente" queda deshabilitado porque no hay ningún tipo que elegir, NUNCA
   * porque el selector de acuerdo pida un UUID: eso ya lo cubre el test de
   * arriba con datos reales de Garrigues.
   */
  test('Preparar fuente queda deshabilitado por falta de catálogo de tipos, no por UUID', async ({ page }) => {
    await page.goto('/secretaria/certificaciones');
    await expect(page.getByRole('heading', { name: 'Certificaciones autónomas' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel('Sociedad').selectOption({ label: SOCIEDAD_CON_ACUERDOS.garrigues });
    await expect(page.getByRole('button', { name: 'Preparar fuente' })).toBeDisabled();
  });
});
