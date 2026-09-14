import { test, expect } from './fixtures/base';
import { loginAsDemo, type Entorno } from './fixtures/demo-credentials';

/**
 * AIMS 360 — recorrido del autodiagnóstico de conformidad, en los DOS entornos.
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
 * Desde 2026-09-14 corre con sesión PROPIA por entorno (ARGA y Garrigues), sin
 * el storageState compartido, y exige en el cable que cada lectura de
 * `ai_systems` lleve el filtro `tenant_id=eq.<tenant del entorno>`.
 */

/** Métodos que mutan. GET y HEAD pasan; el resto ni sale. */
const METODOS_DE_ESCRITURA = ['POST', 'PATCH', 'PUT', 'DELETE'];

const TENANT: Record<Entorno, string> = {
  arga: '00000000-0000-0000-0000-000000000001',
  garrigues: '00000000-0000-0000-0000-000000000002',
};

for (const entorno of ['arga', 'garrigues'] as const) {
  test.describe(`AIMS 360 — autodiagnóstico de conformidad (solo lectura) · ${entorno}`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    let escriturasIntentadas: string[] = [];
    let filtrosSistemas: Array<string | null> = [];

    test.beforeEach(async ({ page }) => {
      escriturasIntentadas = [];
      filtrosSistemas = [];
      // Cortafuegos ANTES de cualquier navegación (el login va a /auth/v1, no a
      // /rest/v1): ninguna escritura de datos sale de este spec, tampoco en el
      // aterrizaje post-login. Se registra y se aborta, para que un fallo sea
      // ruidoso en vez de silencioso.
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
      // El filtro de tenant se exige EN EL CABLE, no en el rótulo.
      page.on('request', (req) => {
        const url = new URL(req.url());
        if (url.pathname === '/rest/v1/ai_systems') filtrosSistemas.push(url.searchParams.get('tenant_id'));
      });
      await loginAsDemo(page, entorno);
    });

    test.afterEach(async () => {
      expect(
        escriturasIntentadas,
        'este spec ha intentado escribir en Cloud: es exactamente lo que dejó las 4 evaluaciones fabricadas de ARGA',
      ).toEqual([]);
      // Se sondea, no se lee una foto: la query de ai_systems arranca cuando
      // TenantProvider resuelve el tenant y puede llegar DESPUÉS de que el
      // cuerpo del test termine.
      await expect
        .poll(() => filtrosSistemas.length, { message: 'ninguna pantalla leyó ai_systems: la aserción de tenant sería vacua', timeout: 10_000 })
        .toBeGreaterThan(0);
      for (const filtro of filtrosSistemas) expect(filtro).toBe(`eq.${TENANT[entorno]}`);
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

      // Paso 1: sistema y marco. Los ids son los selectores estables. El
      // sistema se elige por NOMBRE (el primero real del inventario del
      // tenant), no por índice.
      const sistema = page.locator('#eval-system');
      await expect(sistema).toBeVisible();
      const opciones = sistema.locator('option:not([value=""])');
      await expect(opciones.first(), 'el inventario del tenant no ofrece ningún sistema').toBeAttached({ timeout: 10_000 });
      const nombre = (await opciones.first().textContent())?.trim() ?? '';
      expect(nombre).not.toBe('');
      await sistema.selectOption({ label: nombre });
      await page.locator('#eval-framework').selectOption('EU_AI_ACT');

      await page.getByRole('button', { name: 'Continuar a Evaluación de Medidas' }).click();

      // Paso 2: invariantes válidas para CUALQUIER perfil de aplicabilidad (el
      // catálogo cambia por rol y nivel, así que no se fija ninguna medida por
      // su nombre): el banner de perfil, N ≥ 1 requisitos y al menos una medida
      // con su artículo del Reglamento. Y SIN atribuir ninguna Guía AESIA (la
      // atribución se retiró porque no se pudo cotejar contra fuente oficial).
      await expect(page.getByText(/^Perfil de aplicabilidad:/)).toBeVisible({ timeout: 10_000 });
      const requisitos = page.getByText(/Requisitos RIA \(\d+\)/);
      await expect(requisitos).toBeVisible();
      const n = Number(/\((\d+)\)/.exec((await requisitos.textContent()) ?? '')?.[1]);
      expect(n, 'el paso de medidas no ofrece ningún requisito').toBeGreaterThanOrEqual(1);
      await expect(page.getByText(/^Art\. \d+/).first()).toBeVisible();
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
      // Se espera al inventario: sin esto el afterEach puede correr antes de que
      // salga la lectura de ai_systems y la aserción de tenant queda racy.
      await expect(page.locator('#eval-system option:not([value=""])').first()).toBeAttached({ timeout: 10_000 });
    });

    test('el enlace desde la ficha de sistema apunta a una ruta que existe y preselecciona el sistema', async ({ page }) => {
      // Los tres botones de `SistemaDetalle` apuntaban a `/nueva`, que no está
      // montada (`App.tsx` monta `/nuevo`), y el alta ignoraba `?system_id=`.
      await page.goto('/ai-governance/sistemas');
      await expect(page).not.toHaveURL(/\/login/);
      const primeraFila = page.locator('tbody tr').first();
      await expect(primeraFila).toBeVisible({ timeout: 15_000 });
      await primeraFila.click();
      await expect(page).toHaveURL(/\/ai-governance\/sistemas\/[0-9a-f-]{36}$/, { timeout: 10_000 });
      const systemId = page.url().split('/').pop()!;

      await page.getByRole('button', { name: 'Nuevo Autodiagnóstico' }).click();
      // La ruta existe (no es un 404 de router) y trae el sistema de la ficha.
      await expect(page).toHaveURL(new RegExp(`/ai-governance/evaluaciones/nuevo\\?system_id=${systemId}$`));
      await expect(page.locator('#eval-system')).toHaveValue(systemId, { timeout: 10_000 });
    });
  });
}
