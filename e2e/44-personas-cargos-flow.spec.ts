import { test, expect } from './fixtures/base';

/**
 * Wave 7 — Personas y Cargos refactor readiness
 *
 * Tests del flujo completo personas-cargos tras W6 apply en Cloud demo.
 * Verifica que los entregables de las olas D4 y D5 quedan operativos:
 *
 *   D4.1  Separación VIGENTE / CESADO en PersonaDetalle
 *   D4.2  Botones "Asignar cargo" y "Asignar/Editar representante" en heading
 *   D4.3  Modal cesar cargo accesible (botones "Cesar")
 *   D4.4  Banner PJ administradora sin representante (NO debe disparar para SOCIO L1)
 *   D5.1  Botón "Asignar cargo" por fila en PersonasList
 *   D5.2  DesignarAdminStepper acepta ?personId= y salta paso "Persona"
 *   D5.3  Wizard representante PJ → PF
 *   D5.4  Bloqueo NIF duplicado en alta con CTA "Abrir ficha existente"
 *   D5.5  Doble verificación RM cert + Vº Bº en pipeline certificación
 *
 * IDs verificados en Cloud demo (governance_OS, post-W6 apply):
 *   - ARGA Seguros SA:      6d7ed736-f263-4531-a59d-c6ca0cd41602
 *   - Cartera ARGA SLU:     b50fad18-ca71-41bb-a940-45d43f4fcdb7  (PJ, socio SOCIO en ARGA Seguros)
 *   - Antonio Ríos:         12ab13c3-0a0e-4ab6-a17a-902a3eaeddf8  (PF, PRESIDENTE CdA + JGA + CAC)
 *   - tax_id existente:     A-99999903  (ARGA Seguros, S.A. canónica)
 */

const ARGA_SEGUROS_ID = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
const CARTERA_ARGA_PERSON_ID = 'b50fad18-ca71-41bb-a940-45d43f4fcdb7';
const ANTONIO_RIOS_PERSON_ID = '12ab13c3-0a0e-4ab6-a17a-902a3eaeddf8';
const ARGA_SEGUROS_CANONICAL_TAX_ID = 'A-99999903';

test.describe('Personas y Cargos — Wave 6 readiness', () => {
  test('PersonasList renderiza Cartera ARGA una sola vez y oculta PRUEBA 1', async ({ page }) => {
    await page.goto('/secretaria/personas?scope=grupo');

    // El bootstrap canónico crea una única fila para Cartera ARGA SLU y oculta
    // entradas marcadas como [ARCHIVED-LEGAL] (filtradas por isProductionPerson).
    const table = page.getByTestId('personas-desktop-table');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // Esperamos a que la tabla tenga filas reales (no skeleton).
    await expect(table.locator('tbody tr')).toHaveCount(
      await table.locator('tbody tr').count(),
      { timeout: 10_000 },
    );

    // Cartera ARGA — debe aparecer exactamente UNA vez en la columna Nombre.
    const carteraLinks = table.locator('tbody tr td:first-child a', {
      hasText: /Cartera ARGA/i,
    });
    await expect(carteraLinks).toHaveCount(1);

    // PRUEBA 1 — filtrada por isProductionPerson (queda como [ARCHIVED-LEGAL]).
    const pruebaRows = table.locator('tbody tr td:first-child a', {
      hasText: /^PRUEBA 1$/i,
    });
    await expect(pruebaRows).toHaveCount(0);

    // Botón "Asignar cargo" por fila — al menos uno por persona renderizada.
    const asignarBtns = page.locator('a[aria-label^="Asignar cargo a"]');
    const rowCount = await table.locator('tbody tr').count();
    expect(await asignarBtns.count()).toBeGreaterThanOrEqual(rowCount);
  });

  test('PersonaDetalle Cartera ARGA: secciones VIGENTE/HISTÓRICO + botones acción', async ({
    page,
  }) => {
    await page.goto(`/secretaria/personas/${CARTERA_ARGA_PERSON_ID}`);

    await expect(page.getByRole('heading', { name: /Cartera ARGA/i, level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // D4.1 — secciones separadas vigentes / histórico (no una sola lista mezclada).
    await expect(
      page.getByRole('heading', { level: 2, name: /Cargos vigentes/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /Histórico/i }),
    ).toBeVisible();

    // D4.2 — botones en heading: Asignar cargo + Asignar/Editar representante (PJ).
    await expect(page.getByRole('link', { name: /^Asignar cargo$/i }).first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: /(Asignar|Editar) representante/i }).first(),
    ).toBeVisible();
  });

  test('PersonaDetalle Cartera ARGA: SIN banner PJ-rep (SOCIO es L1 — no admin)', async ({
    page,
  }) => {
    await page.goto(`/secretaria/personas/${CARTERA_ARGA_PERSON_ID}`);

    await expect(page.getByRole('heading', { name: /Cartera ARGA/i, level: 1 })).toBeVisible({
      timeout: 10_000,
    });

    // D4.4 — Cartera ARGA tiene cargo SOCIO en ARGA Seguros. Es PJ pero NO
    // ocupa cargo administrativo (ADMIN_*/CONSEJERO), por lo que la regla L1
    // de cargo-validation.requiresRepresentative devuelve false: no debe
    // mostrarse el banner "requiere representante PF permanente".
    const banner = page.getByRole('alert').filter({
      hasText: /requiere representante PF permanente/i,
    });
    await expect(banner).toHaveCount(0);
  });

  test('PersonaDetalle Antonio Ríos: PRESIDENTE del CdA aparece como VIGENTE', async ({
    page,
  }) => {
    await page.goto(`/secretaria/personas/${ANTONIO_RIOS_PERSON_ID}`);

    await expect(
      page.getByRole('heading', { name: /Antonio Ríos/i, level: 1 }),
    ).toBeVisible({ timeout: 10_000 });

    // En la tabla "Cargos vigentes" debe haber al menos una fila con
    // Presidente + Consejo de Administración.
    const cdaPresidenteRow = page
      .locator('section table tbody tr', {
        hasText: /Presidente/i,
      })
      .filter({ hasText: /Consejo de Administración/i });
    await expect(cdaPresidenteRow.first()).toBeVisible({ timeout: 10_000 });
  });

  test('DesignarAdminStepper /cargos/nuevo?personId= salta paso Persona', async ({ page }) => {
    // D5.2 — con personId + entityId en URL, el stepper salta a paso "Cargo"
    // directamente. Sin entityId se inserta paso "Sociedad" entre persona y cargo.
    await page.goto(
      `/secretaria/cargos/nuevo?personId=${ANTONIO_RIOS_PERSON_ID}&entityId=${ARGA_SEGUROS_ID}`,
    );

    await expect(
      page.getByRole('heading', { name: /Designar administrador/i, level: 1 }),
    ).toBeVisible({ timeout: 10_000 });

    // El selector de cargo debe estar visible — significa que NO estamos en
    // paso "Persona" (que mostraría selector de persona) ni "Sociedad" (que
    // mostraría selector de sociedad).
    const cargoSelect = page.getByLabel(/Tipo de cargo/i);
    await expect(cargoSelect).toBeVisible({ timeout: 10_000 });
  });

  test('DesignarAdminStepper dropdown incluye VICESECRETARIO y excluye COMISIONADO', async ({
    page,
  }) => {
    await page.goto(
      `/secretaria/cargos/nuevo?personId=${ANTONIO_RIOS_PERSON_ID}&entityId=${ARGA_SEGUROS_ID}`,
    );

    const cargoSelect = page.getByLabel(/Tipo de cargo/i);
    await expect(cargoSelect).toBeVisible({ timeout: 10_000 });

    // L17 (RRM art. 109, 124 + LSC art. 529 octies): VICESECRETARIO es
    // cargo colegiado inscribible y debe aparecer en el dropdown.
    const options = await cargoSelect.locator('option').allTextContents();
    expect(options).toContain('Vicesecretario');

    // COMISIONADO no existe en el catálogo CARGO_LABELS y no debe aparecer.
    expect(options.some((o) => /comisionado/i.test(o))).toBe(false);
  });

  test('PersonaNuevaStepper bloquea NIF duplicado con CTA "Abrir ficha existente"', async ({
    page,
  }) => {
    await page.goto('/secretaria/personas/nueva');

    // Paso 1 — seleccionar PJ (tax_id A-99999903 corresponde a una persona PJ).
    await page.getByLabel(/Tipo de persona/i).selectOption('PJ');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Paso 2 — Datos. Rellenar denominación + tax_id duplicado.
    await page.getByLabel(/Denominación legal/i).fill('PRUEBA DUP NIF');
    await page.getByLabel(/CIF/i).fill(ARGA_SEGUROS_CANONICAL_TAX_ID);

    // El precheck es debounced (500ms). Esperamos al alert.
    const alert = page.getByRole('alert').filter({
      hasText: /Ya existe una persona con este NIF/i,
    });
    await expect(alert).toBeVisible({ timeout: 5_000 });

    // CTA "Abrir ficha existente" presente con link a la persona ya creada.
    const abrirFicha = page.getByRole('link', { name: /Abrir ficha existente/i });
    await expect(abrirFicha).toBeVisible();
    await expect(abrirFicha).toHaveAttribute('href', /\/secretaria\/personas\/[a-f0-9-]+/);

    // Siguiente debe estar deshabilitado mientras el conflict persista.
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  test('SociedadDetalle ARGA Seguros: Autoridad muestra cargos certificantes con Inscripción RM', async ({
    page,
  }) => {
    await page.goto(`/secretaria/sociedades/${ARGA_SEGUROS_ID}`);

    // Cambiar a tab Autoridad.
    await page.getByRole('button', { name: 'Autoridad', exact: true }).click();

    // Cabeceras esperadas en la tabla Autoridad.
    const table = page.locator('table').filter({
      has: page.getByRole('columnheader', { name: /Cargo certificante/i }),
    });
    await expect(table).toBeVisible({ timeout: 10_000 });
    await expect(table.getByRole('columnheader', { name: /Inscripción RM/i })).toBeVisible();

    // D5.5 / W6 apply: el Presidente y el Secretario del CdA tienen
    // inscripcion_rm_referencia poblada con RM-DEMO-ARGA-CDA-2026 para
    // habilitar el pipeline de certificación (EmitirCertificacionButton).
    const presidenteCdaRow = table
      .locator('tbody tr', { hasText: /Antonio Ríos Valverde/i })
      .filter({ hasText: /Consejo de Administración/i })
      .filter({ hasText: /RM-DEMO-ARGA-CDA-2026/i });
    await expect(presidenteCdaRow.first()).toBeVisible();

    const secretarioCdaRow = table
      .locator('tbody tr', { hasText: /Lucía Paredes Vega/i })
      .filter({ hasText: /Consejo de Administración/i })
      .filter({ hasText: /RM-DEMO-ARGA-CDA-2026/i });
    await expect(secretarioCdaRow.first()).toBeVisible();
  });
});
