import { test, expect } from './fixtures/base';

/**
 * Guard de afirmaciones retiradas en GRC (TPRM, Penal/Anticorrupción, Solvencia II).
 *
 * POR QUÉ CAMBIÓ ESTE FICHERO. Su versión anterior no era un guard: era el
 * contrario. Asertaba como comportamiento esperado justo las afirmaciones que
 * el producto no sostiene — «Sellar Evidencia QSeal», «Certificación Forense
 * QSeal (EAD Trust)», «QSeal Custodia», «PLAN DE SALIDA SELLADO EN LEDGER
 * WORM», «Evidencias Forenses» —, de modo que retirarlas ponía el e2e en rojo
 * y quien lo viera tendría un motivo para volver a introducirlas. Un test que
 * pina una mentira es peor que no tener test.
 *
 * Además creaba un proveedor nuevo en Cloud EN CADA EJECUCIÓN
 * (`'Proveedor Test E2E - ' + Date.now()`), sembrando `grc_third_parties` con
 * basura de test — el mismo vicio que ya dejó cuatro evaluaciones fabricadas
 * en `ai_risk_assessments`. Este fichero es ahora de SOLO LECTURA.
 *
 * Lo que asierta: que las afirmaciones sin respaldo no han vuelto, y que la
 * postura honesta que las sustituye sí está en pantalla. La segunda mitad es
 * la que impide que el guard se satisfaga con una página en blanco.
 */

/** Afirmaciones sin respaldo que no pueden volver a ninguna pantalla de GRC. */
const AFIRMACIONES_RETIRADAS = [
  'QSeal Custodia',
  'Verificar QSeal',
  'EAD Trust Custody ID',
  'Prueba forense inmutable',
  'Sellar Evidencia QSeal',
  'Certificación Forense QSeal',
  'bundle WORM cualificado',
  'Evidencias Forenses',
  'PLAN DE SALIDA SELLADO EN LEDGER WORM',
  'PLAN DE SALIDA CUSTODIADO EN LEDGER WORM',
  'qualified timestamping',
  'EAD Trust Qualified TSP',
  'Cumple RGPD',
  'Remitido formalmente a DGSFP',
];

async function sinAfirmacionesRetiradas(page: import('@playwright/test').Page) {
  const cuerpo = await page.locator('body').innerText();
  for (const frase of AFIRMACIONES_RETIRADAS) {
    expect(cuerpo, `la pantalla ha recuperado una afirmación retirada: «${frase}»`)
      .not.toContain(frase);
  }
}

test.describe('GRC — afirmaciones retiradas y postura honesta', () => {
  test('TPRM no atribuye sello, custodia cualificada ni conformidad inventada', async ({ page }) => {
    await page.goto('/grc/tprm');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Registro DORA de Terceros TIC').first())
      .toBeVisible({ timeout: 10_000 });

    await sinAfirmacionesRetiradas(page);

    // Control positivo: la pantalla cargó de verdad. Sin esto, una página
    // vacía o un redirect satisfarían el guard de ausencia.
    await expect(page.getByPlaceholder('Buscar proveedor, LEI o servicio…')).toBeVisible();
  });

  test('Penal/Anticorrupción no afirma sello ni custodia forense', async ({ page }) => {
    await page.goto('/grc/penal-anticorrupcion');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Matriz de Compliance Penal e ISO 37001').first())
      .toBeVisible({ timeout: 10_000 });

    await sinAfirmacionesRetiradas(page);

    // Control positivo: las categorías penales se pintan.
    await expect(
      page.getByRole('heading', { name: '1. Cohecho y Corrupción en los Negocios' }),
    ).toBeVisible();

    // La custodia electrónica no está conectada, y la pantalla lo dice en vez
    // de ofrecer una acción que no puede cumplir.
    await expect(page.getByRole('button', { name: /Custodia \(no conectada\)/i }).first())
      .toBeVisible();
  });

  test('Solvencia II se presenta como demo y no afirma remisión al supervisor', async ({ page }) => {
    await page.goto('/grc/solvencia-ii');
    await expect(page).not.toHaveURL('/login');

    await sinAfirmacionesRetiradas(page);

    // Control positivo: es la pantalla de Solvencia II y declara su postura.
    const cuerpo = await page.locator('body').innerText();
    expect(cuerpo.toLowerCase()).toContain('solvencia');
    expect(
      /demo|no medido|sin dato|simulad/i.test(cuerpo),
      'la pantalla no declara su postura: sin etiqueta de demo/no medido, los KPI se leen como dato real',
    ).toBe(true);
  });
});
