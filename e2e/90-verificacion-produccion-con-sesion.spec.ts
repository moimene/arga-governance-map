import { expect, test } from '@playwright/test';

/**
 * VERIFICACIÓN VIVA EN PRODUCCIÓN, CON SESIÓN INICIADA.
 *
 * Los barridos de bundle comprueban el código servido, pero no lo que ve un
 * usuario autenticado: las superficies de GRC, AIMS, SII y Secretaría están
 * TODAS detrás del login, así que un grep sobre los chunks no distingue entre
 * «la frase se retiró» y «la frase está pero no se renderiza en ese estado».
 * Esto lo cierra: entra de verdad y lee la pantalla real.
 *
 * ⚠️ SOLO LECTURA, Y NO ES UNA PREFERENCIA DE ESTILO. Producción NO se compila
 * con `VITE_E2E`, así que `isRealQTSPForbidden()` devuelve false y el
 * cortafuegos que impide tocar el QTSP real está APAGADO. Este proyecto ya
 * creó una vez firmas REALES en EAD Trust por correr e2e contra Cloud. Aquí no
 * se pulsa ningún botón de acción: solo se navega y se asierta. Cualquier
 * añadido futuro a este fichero debe respetarlo.
 *
 * No corre en la suite normal: exige `PLAYWRIGHT_BASE_URL` remota. El skip va
 * declarado con motivo, no en silencio.
 */
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? '';
const esRemota = /^https:\/\//.test(BASE) && !/localhost|127\.0\.0\.1/.test(BASE);

test.describe('Producción — verificación con sesión iniciada', () => {
  test.skip(
    !esRemota,
    'Requiere PLAYWRIGHT_BASE_URL apuntando a la URL pública. Sin ella no hay nada que verificar en vivo.',
  );

  test('la sesión es real y el shell del tenant carga', async ({ page }) => {
    await page.goto('/');
    // Control: si la sesión no valiera, la app redirige a /login.
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('ARGA').first()).toBeVisible({ timeout: 30_000 });
  });

  // Cada entrada: [ruta, frases que DEBEN estar, frases que NO deben estar].
  // Las prohibidas son afirmaciones retiradas por no tener respaldo; las
  // exigidas son la postura honesta que las sustituye.
  const PANTALLAS: Array<[string, RegExp[], RegExp[]]> = [
    ['/grc', [], [/QSeal Custodia/i, /PLAN DE SALIDA SELLADO EN LEDGER WORM/i, /QSeal no personal/i]],
    ['/ai-governance', [], [/Guía AESIA/i, /QSEAL/i, /Sellado cualificado/i]],
    ['/sii', [/simulad|demo|sin eficacia jurídica/i], [/log de auditoría independiente/i, /buzón cifrado/i]],
  ];

  for (const [ruta, exigidas, prohibidas] of PANTALLAS) {
    test(`${ruta} — postura honesta presente y afirmaciones retiradas ausentes`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page).not.toHaveURL(/\/login/);
      // Anti-vacuidad: una pantalla en blanco satisfaría cualquier «no aparece».
      // Se lee el BODY y no `main` porque el módulo SII no cuelga de él: con
      // `main` la primera corrida dio 0 caracteres y el control saltó, que es
      // justo lo que tenía que hacer. El body es un superconjunto, así que
      // endurece las aserciones de ausencia en vez de relajarlas.
      await expect(page.locator('body')).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      const texto = (await page.locator('body').innerText()).trim();
      expect(texto.length, `${ruta} renderizó vacío: las aserciones de ausencia no valdrían`).toBeGreaterThan(200);

      for (const re of exigidas) expect(texto, `${ruta}: falta la postura honesta ${re}`).toMatch(re);
      for (const re of prohibidas) expect(texto, `${ruta}: reaparece la afirmación retirada ${re}`).not.toMatch(re);
    });
  }

  test('la frontera de la certificación se sostiene EN PRODUCCIÓN, no solo en local', async ({ page }) => {
    await page.goto('/secretaria/actas');
    await expect(page).not.toHaveURL(/\/login/);

    // El enlace lleva el nombre del ÓRGANO (`a.body_name`), no la palabra
    // «Acta», así que se localiza por destino. Y el destino NO es
    // `/secretaria/actas/` a secas: `actaDetailPath` lo pasa por
    // `scope.createScopedTo`, que reescribe el prefijo. Medido en producción:
    // con `/secretaria/actas/` salían 0 coincidencias y con `/actas/`, 13.
    await page.waitForLoadState('networkidle').catch(() => {});
    const fila = page.locator('a[href*="/actas/"]').first();
    const filaVisible = await fila.isVisible().catch(() => false);
    if (!filaVisible) {
      // Sin actas no hay nada que juzgar, y decirlo es mejor que pasar en falso.
      test.skip(true, 'El tenant no tiene actas listadas en producción: no hay espécimen que verificar.');
    }
    await fila.click();
    await expect(page).toHaveURL(/\/actas\/[0-9a-f-]{36}/, { timeout: 30_000 });

    // Control positivo: es la ficha del acta, no una pantalla de error.
    await expect(page.getByRole('heading', { name: 'Revisión legal para certificación' })).toBeVisible({
      timeout: 30_000,
    });

    // La invariante: la custodia final NO existe y el producto lo declara.
    const custodia = page.getByLabel(/^Custodia EAD de /).first();
    await expect(custodia).toBeVisible({ timeout: 20_000 });
    await expect(custodia.getByRole('button', { name: 'Custodia final no disponible' })).toBeDisabled();
    await expect(custodia).toContainText(/Pendiente de renderer autoritativo/i);

    // Y en consecuencia no se afirma ninguna certificación emitida.
    await expect(page.getByText(/Certificación emitida/i)).toHaveCount(0);
  });
});
