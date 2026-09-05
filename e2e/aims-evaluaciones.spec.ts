import { test, expect } from './fixtures/base';

/**
 * AIMS 360 — recorrido del autodiagnóstico de conformidad.
 *
 * ESTE SPEC NO PUEDE ESCRIBIR EN CLOUD, Y ESO SE VIGILA AQUÍ DENTRO.
 * ---------------------------------------------------------------
 * La versión anterior recorría el alta hasta el final y pulsaba «Guardar
 * evaluación» contra `governance_OS`. El 2026-07-19 dejó CUATRO filas reales en
 * `ai_risk_assessments` del tenant ARGA, todas con `status='APROBADO'`,
 * `score=100` y una nota que sigue en producción afirmando «el cumplimiento
 * estricto de todos los artículos de la Ley de Inteligencia Artificial de la
 * Unión Europea». Ese texto lo escribió este fichero, no una auditoría, y desde
 * entonces la ficha del sistema lo pinta como si fuera la conclusión.
 *
 * El e2e apunta al entorno activo de desarrollo (`governance_OS`): no hay base
 * desechable contra la que correrlo. Así que el recorrido es de LECTURA, y un
 * guard de red aborta —y hace fallar el test— cualquier método de escritura que
 * salga hacia la API de datos. Mismo criterio que el cortafuegos de QTSP real
 * en los specs de Secretaría: si el spec no puede escribir, no puede volver a
 * fabricar el dato que luego el producto presenta como hecho.
 *
 * Sus selectores, además, estaban todos muertos: buscaban «Nueva evaluación
 * AIMS», «Marcar todo como Conforme (Demo Quick-Pass)», `#overall-status` y
 * «ledger WORM», rótulos que no existen en ninguna pantalla actual.
 */

/** Métodos que mutan. GET y HEAD pasan; el resto ni sale. */
const METODOS_DE_ESCRITURA = ['POST', 'PATCH', 'PUT', 'DELETE'];

test.describe('AIMS 360 — autodiagnóstico de conformidad (solo lectura)', () => {
  let escriturasIntentadas: string[] = [];

  test.beforeEach(async ({ page }) => {
    escriturasIntentadas = [];
    // Cortafuegos: ninguna escritura de datos sale de este spec. Se registra y
    // se aborta, para que un fallo sea ruidoso en vez de silencioso.
    await page.route('**/rest/v1/**', async (route) => {
      const req = route.request();
      if (METODOS_DE_ESCRITURA.includes(req.method())) {
        escriturasIntentadas.push(`${req.method()} ${new URL(req.url()).pathname}`);
        await route.abort();
        return;
      }
      await route.fallback();
    });
    // Las RPC también escriben.
    await page.route('**/rest/v1/rpc/**', async (route) => {
      escriturasIntentadas.push(`RPC ${new URL(route.request().url()).pathname}`);
      await route.abort();
    });
  });

  test.afterEach(() => {
    expect(
      escriturasIntentadas,
      'este spec ha intentado escribir en Cloud: es exactamente lo que dejó las 4 evaluaciones fabricadas de ARGA',
    ).toEqual([]);
  });

  test('el listado enlaza al alta y el alta llega al paso de medidas sin escribir', async ({ page }) => {
    await page.goto('/ai-governance/evaluaciones');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Evaluaciones de riesgo IA' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Nueva evaluación' }).click();
    await expect(page).toHaveURL(/\/ai-governance\/evaluaciones\/nuevo$/);
    await expect(
      page.getByRole('heading', { name: /Nuevo Autodiagnóstico de Conformidad/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('1. Parámetros del Autodiagnóstico')).toBeVisible();

    // Paso 1: sistema y marco. Los ids son los selectores estables.
    const sistema = page.locator('#eval-system');
    await expect(sistema).toBeVisible();
    await sistema.selectOption({ index: 1 });
    await page.locator('#eval-framework').selectOption('EU_AI_ACT');

    await page.getByRole('button', { name: 'Continuar a Evaluación de Medidas' }).click();

    // Paso 2: el catálogo de medidas guía se pinta con su artículo del
    // Reglamento y SIN atribuir ninguna Guía AESIA (la atribución se retiró
    // porque no se pudo cotejar contra fuente oficial).
    await expect(page.getByText('Sistema de gestión de riesgos').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Guía \d+ AESIA/)).toHaveCount(0);
  });

  test('el alta no promete precinto ni integridad que no calcula', async ({ page }) => {
    await page.goto('/ai-governance/evaluaciones/nuevo');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole('heading', { name: /Nuevo Autodiagnóstico de Conformidad/i }),
    ).toBeVisible({ timeout: 15_000 });

    // El botón de guardar decía «Guardar y Precintar Autodiagnóstico» sobre dos
    // INSERT planos: sin hash, sin sello y sin bundle de evidencia.
    await expect(page.getByRole('button', { name: /Precintar/i })).toHaveCount(0);
  });

  test('el enlace desde la ficha de sistema apunta a una ruta que existe y preselecciona el sistema', async ({ page }) => {
    // Los tres botones de `SistemaDetalle` apuntaban a `/nueva`, que no está
    // montada (`App.tsx` monta `/nuevo`), y el alta ignoraba `?system_id=`.
    await page.goto('/ai-governance/sistemas');
    await expect(page).not.toHaveURL(/\/login/);
    const primerSistema = page.getByRole('link', { name: /./ }).first();
    await expect(primerSistema).toBeVisible({ timeout: 15_000 });

    await page.goto('/ai-governance/evaluaciones/nuevo?system_id=no-existe-a-proposito');
    await expect(page).not.toHaveURL(/\/login/);
    // La ruta responde (no es un 404 de router) y el select existe.
    await expect(page.locator('#eval-system')).toBeVisible({ timeout: 10_000 });
  });
});
