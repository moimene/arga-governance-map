import { test, expect } from './fixtures/base';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function expectSearchParams(page: Page, expected: Record<string, string>) {
  for (const [key, value] of Object.entries(expected)) {
    await expect.poll(() => new URL(page.url()).searchParams.get(key)).toBe(value);
  }
}

test.describe('Plantillas', () => {
  test('pestañas accesibles conservan Modelos en la URL, el teclado y la recarga', async ({ page }) => {
    await page.goto('/secretaria/plantillas?scope=grupo');
    await expect(page.getByRole('heading', { name: /Plantillas documentales protegidas|Plantillas aplicables/i })).toBeVisible({
      timeout: 10_000,
    });

    const tabs = page.getByRole('tablist');
    const proceso = tabs.getByRole('tab', { name: 'Plantillas de proceso' });
    const modelos = tabs.getByRole('tab', { name: 'Modelos de acuerdo' });
    await expect(proceso).toHaveAttribute('aria-controls', 'plantillas-panel');
    await expect(modelos).toHaveAttribute('aria-controls', 'plantillas-panel');
    await expect(page.locator('#plantillas-panel')).toHaveCount(1);
    await expect(proceso).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Plantillas de proceso' })).toBeVisible();
    await expect(
      page.getByTestId('plantillas-desktop-table').getByText('Activa', { exact: true }).first(),
    ).toBeVisible();

    await proceso.focus();
    await page.keyboard.press('ArrowRight');
    await expect(modelos).toBeFocused();
    await expect(modelos).toHaveAttribute('aria-selected', 'true');
    await expectSearchParams(page, { tipo: 'MODELO_ACUERDO' });
    await expect(page.getByRole('tabpanel', { name: 'Modelos de acuerdo' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('tab', { name: 'Modelos de acuerdo' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expectSearchParams(page, { tipo: 'MODELO_ACUERDO' });

    await page.getByRole('tab', { name: 'Modelos de acuerdo' }).focus();
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: 'Plantillas de proceso' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Plantillas de proceso' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect.poll(() => new URL(page.url()).searchParams.get('tipo')).toBeNull();

    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Modelos de acuerdo' })).toBeFocused();
    await expectSearchParams(page, { tipo: 'MODELO_ACUERDO' });
  });

  test('Modelos de acuerdo muestra el inventario Cloud sin fijar un recuento obsoleto', async ({ page }) => {
    await page.goto('/secretaria/plantillas?scope=grupo&tipo=MODELO_ACUERDO');
    await expect(page.getByRole('tab', { name: 'Modelos de acuerdo' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 10_000 },
    );
    await expect(
      page.getByTestId('plantillas-desktop-table').getByRole('row', { name: /Aprobación de cuentas/i }).first(),
    ).toBeVisible();
    await expect(page).not.toHaveURL('/login');
  });

  test('filtro por materia en modelos de acuerdo funciona', async ({ page }) => {
    await page.goto('/secretaria/plantillas?scope=grupo&tipo=MODELO_ACUERDO');
    const select = page.getByLabel('Filtrar modelos por materia');
    await expect(select).toBeVisible({ timeout: 10_000 });
    const firstMatter = await select.locator('option:not([value=""])').first().getAttribute('value');
    expect(firstMatter).toBeTruthy();
    await select.selectOption(firstMatter!);
    await expectSearchParams(page, { materia: firstMatter! });
    await expect(page).not.toHaveURL('/login');
  });

  test('una materia inferida conserva Modelos al limpiar el filtro y recargar', async ({ page }) => {
    await page.goto('/secretaria/plantillas?scope=grupo&materia=AUMENTO_CAPITAL');

    const modelos = page.getByRole('tab', { name: 'Modelos de acuerdo' });
    await expect(modelos).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
    await expectSearchParams(page, { tipo: 'MODELO_ACUERDO', materia: 'AUMENTO_CAPITAL' });

    await page.getByLabel('Filtrar modelos por materia').selectOption('');
    await expect.poll(() => new URL(page.url()).searchParams.get('materia')).toBeNull();
    await expectSearchParams(page, { tipo: 'MODELO_ACUERDO' });

    await page.reload();
    await expect(page.getByRole('tab', { name: 'Modelos de acuerdo' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('histórica con linaje exacto compara con la vigente y conserva el acceso a esa versión', async ({ page }) => {
    const historicalId = '1b1118a6-577d-45ed-96ee-77be89358aa0';
    const currentId = '2c15640c-de2f-41ea-aa8d-304147124a6e';
    await page.goto(
      `/secretaria/plantillas?scope=grupo&ciclo=historico&plantilla=${historicalId}`,
    );

    const detail = page.getByRole('complementary', {
      name: 'Detalle de la plantilla seleccionada',
    });
    await expect(detail).toBeVisible({ timeout: 10_000 });
    await expect(detail.getByText('Solo consulta histórica', { exact: true })).toBeVisible();
    await expect(detail.getByText('Todos los tipos sociales', { exact: true }).first()).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Comparar con vigente' })).toBeVisible();

    await detail.getByRole('button', { name: 'Comparar con vigente' }).click();
    const comparison = page.getByRole('region', { name: 'Comparación de versiones' });
    await expect(comparison).toBeVisible();
    await expect(comparison).toBeFocused();
    await expect(comparison.getByText(/Histórica v1\.2\.0/)).toBeVisible();
    await expect(comparison.getByText(/Vigente v1\.3\.0/)).toBeVisible();

    await comparison.getByRole('button', { name: 'Cerrar comparación de versiones' }).click();
    await expect(detail.getByRole('button', { name: 'Comparar con vigente' })).toBeFocused();

    await detail.getByRole('button', { name: 'Ver versión vigente' }).click();
    await expectSearchParams(page, { ciclo: 'vigentes', plantilla: currentId });
    await expect(
      page.getByRole('complementary', { name: 'Detalle de la plantilla seleccionada' }).getByText('v1.3.0'),
    ).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Detalle de la plantilla seleccionada' }),
    ).toBeFocused();
  });

  test('Oleada 3A conserva v1.1 vigente y v1.0 como histórico único de la familia', async ({ page }) => {
    const historicalId = '92ee684b-8a34-4e8c-b3ca-c1827f7fa05f';
    const currentId = '52e7f727-125b-4d26-a46f-bf9a912df56e';

    await page.goto(
      `/secretaria/plantillas?scope=grupo&ciclo=vigentes&plantilla=${currentId}`,
    );
    const currentDetail = page.getByRole('complementary', {
      name: 'Detalle de la plantilla seleccionada',
    });
    await expect(currentDetail).toBeVisible({ timeout: 10_000 });
    await expect(currentDetail.getByText('v1.1.0', { exact: true })).toBeVisible();
    await expect(currentDetail.getByText('Activa', { exact: true })).toBeVisible();

    await page.goto(
      `/secretaria/plantillas?scope=grupo&ciclo=historico&plantilla=${historicalId}`,
    );
    const historicalDetail = page.getByRole('complementary', {
      name: 'Detalle de la plantilla seleccionada',
    });
    await expect(historicalDetail).toBeVisible({ timeout: 10_000 });
    await expect(historicalDetail.getByText('v1.0.0', { exact: true })).toBeVisible();
    await expect(historicalDetail.getByText('Solo consulta histórica', { exact: true })).toBeVisible();

    await page.goto(
      `/secretaria/gestor-plantillas?tab=catalogo&plantilla=${currentId}&estado=ACTIVA&scope=grupo`,
    );
    await expect(page.getByRole('heading', { name: /Gobierno de plantillas/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Incidencia: 2 versiones vigentes equivalentes/i)).toHaveCount(0);
  });

  test('un modelo multi-materia conserva la regla canónica del handoff', async ({ page }) => {
    const multiMatterTemplateId = 'e3697ad9-e0c2-4baf-9144-c80a11808c07';
    await page.goto(
      `/secretaria/plantillas?scope=grupo&materia=FUSION&plantilla=${multiMatterTemplateId}`,
    );

    await expectSearchParams(page, {
      materia: 'FUSION',
      plantilla: multiMatterTemplateId,
      tipo: 'MODELO_ACUERDO',
    });
    const detail = page.getByRole('complementary', {
      name: 'Detalle de la plantilla seleccionada',
    });
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Ver materia y regla: Fusión' })).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Ver materia y regla: Escisión' })).toBeVisible();
    await expect(detail.getByRole('button', { name: /Cesión global activo/i })).toHaveCount(0);
  });

  test('histórica sin linaje exacto explica que no inferirá una sustituta', async ({ page }) => {
    const historicalWithoutReplacement = '4511327a-76b3-4888-afe4-84c871cd08e7';
    await page.goto(
      `/secretaria/plantillas?scope=grupo&tipo=MODELO_ACUERDO&ciclo=historico&plantilla=${historicalWithoutReplacement}`,
    );

    const detail = page.getByRole('complementary', {
      name: 'Detalle de la plantilla seleccionada',
    });
    await expect(detail).toBeVisible({ timeout: 10_000 });
    await expect(detail.getByText('Sin versión vigente comparable', { exact: true })).toBeVisible();
    await expect(detail.getByText('Todos los tipos sociales', { exact: true }).first()).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Comparar con vigente' })).toHaveCount(0);
  });
});

test.describe('Motor de reglas societarias', () => {
  test('gate bloquea la cobertura incompleta y una materia lista abre expediente', async ({ page }) => {
    const entityId = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
    await page.goto(
      `/secretaria/catalogo-materias?scope=sociedad&entity=${entityId}&materia=REMUNERACION_CONSEJEROS&vista=simular`,
    );

    await expect(page.getByRole('heading', { name: 'Materias y reglas' })).toBeVisible({
      timeout: 10_000,
    });
    const detail = page.getByRole('complementary', { name: 'Detalle de la materia seleccionada' });
    await expect(detail.getByRole('heading', { name: 'Política de remuneración de consejeros' })).toBeVisible();
    await expect(detail.getByText('Expediente bloqueado.')).toBeVisible();
    await expect(detail.getByText(/falta plantilla activa de modelo de acuerdo/i).first()).toBeVisible();
    await expect(detail.getByRole('link', { name: 'Iniciar expediente', exact: true })).toHaveCount(0);

    await page.goto(
      `/secretaria/catalogo-materias?scope=sociedad&entity=${entityId}&materia=DIVIDENDO_A_CUENTA`,
    );
    await page.getByRole('button', { name: /Distribución de dividendo a cuenta art\. 277 LSC/i }).click();
    await expect(page.getByRole('tab', { name: 'Resumen Cadena completa de decisión' })).toBeVisible();
    await expect(page.getByText('Cadena de decisión', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Plantillas Comprobación documental previa' }).click();
    await expect(page.getByText('Documentos y plantillas de esta materia').first()).toBeVisible();
    await expect(page.getByText('Vigente para nuevos expedientes').first()).toBeVisible();

    await page.getByRole('tab', { name: 'Verificación Requisitos antes de iniciar' }).click();
    await expect(page.getByText('Resultado de la verificación').first()).toBeVisible();
    await expect(page.getByText('Plantillas mínimas', { exact: true })).toBeVisible();

    // El CTA contextual "Iniciar expediente" aparece también en el panel de estado de la materia.
    // Lote 1 coherencia (A1): el CTA abre el PROCESO DE ADOPCIÓN (convocatoria
    // del órgano competente con la materia pre-sembrada), no la fase registral.
    await page.getByRole('link', { name: 'Iniciar expediente', exact: true }).first().click();
    await expect(page).toHaveURL(/\/secretaria\/convocatorias\/nueva.*materia=DIVIDENDO_A_CUENTA/);
    await expect(page.getByText('Materia recibida para la adopción del acuerdo')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL('/login');
  });

  test('alias del art. 308 y viaje Materias → Plantillas → Gestor conservan contexto', async ({ page }) => {
    const entityId = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
    await page.goto(
      `/secretaria/catalogo-materias?scope=sociedad&entity=${entityId}&materia=EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE&vista=plantillas`,
    );

    await expect(
      page.locator('h2').filter({ hasText: 'Exclusión o supresión del derecho de preferencia' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/También denominada exclusión del derecho de suscripción preferente/i),
    ).toBeVisible();

    await page.getByRole('link', { name: /Ver en catálogo de plantillas/i }).click();
    await expect(page).toHaveURL(/\/secretaria\/plantillas\?.*materia=SUPRESION_PREFERENTE/);
    await expect(page).toHaveURL(new RegExp(`entity=${entityId}`));

    await page.getByRole('button', { name: /Administrar esta plantilla/i }).click();
    await expect(page).toHaveURL(/\/secretaria\/gestor-plantillas\?.*tab=catalogo/);
    await expect(page).toHaveURL(/plantilla=/);
    await expect(page).toHaveURL(new RegExp(`entity=${entityId}`));

    await page.getByRole('button', { name: /Ver materia y regla:/i }).first().click();
    await expect(page).toHaveURL(/\/secretaria\/catalogo-materias\?.*materia=SUPRESION_PREFERENTE/);
    await expect(page).toHaveURL(/vista=plantillas/);
  });

  test('deep-link de materia inexistente conserva el código y permite volver al catálogo', async ({ page }) => {
    const missingMatter = 'MATERIA_QUE_NO_EXISTE';
    await page.goto(`/secretaria/catalogo-materias?scope=grupo&materia=${missingMatter}&vista=resumen`);

    await expect(
      page.getByText('No se ha encontrado la materia solicitada en este ámbito.'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp(`materia=${missingMatter}`));

    await page.getByRole('button', { name: 'Mostrar materias disponibles' }).click();
    await expect(page).not.toHaveURL(new RegExp(`materia=${missingMatter}`));
    await expect(page).toHaveURL(/scope=grupo/);
  });

  test('combina filtros explícitos, selecciona desde tabla y conserva contexto al revisar plantillas', async ({ page }) => {
    const entityId = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
    await page.goto(
      `/secretaria/catalogo-materias?scope=sociedad&entity=${entityId}&materia=FORMULACION_CUENTAS&vista=regla&presentacion=tabla`,
    );

    await expect(page.getByRole('heading', { name: 'Materias y reglas' })).toBeVisible({ timeout: 10_000 });
    const controls = page.getByTestId('materias-catalog-controls');
    await controls.getByLabel('Buscar por materia, artículo o documento').fill('estado contable');
    await controls.getByLabel('Mayoría mínima (catálogo)').selectOption('SIMPLE');
    await controls.getByLabel('Formalización').selectOption('ARCHIVO_INTERNO');
    await controls.getByLabel('Estado').selectOption('lista');

    await expectSearchParams(page, {
      q: 'estado contable',
      mayoria: 'SIMPLE',
      formalizacion: 'ARCHIVO_INTERNO',
      estado: 'lista',
      presentacion: 'tabla',
      vista: 'regla',
      scope: 'sociedad',
      entity: entityId,
    });
    await expect(page.getByText(/1 de 48 materias/)).toBeVisible();
    const catalogRestWrites: string[] = [];
    page.on('request', (request) => {
      if (
        request.url().includes('/rest/v1/')
        && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())
      ) {
        catalogRestWrites.push(`${request.method()} ${request.url()}`);
      }
    });
    const [catalogDownload] = await Promise.all([
      page.waitForEvent('download'),
      controls.getByRole('button', { name: 'Exportar matriz CSV' }).click(),
    ]);
    expect(catalogDownload.suggestedFilename()).toMatch(
      /^secretaria-matriz-materias-arga-seguros(?:-s-a)?-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const catalogDownloadPath = await catalogDownload.path();
    expect(catalogDownloadPath).toBeTruthy();
    const catalogCsv = await readFile(catalogDownloadPath!, 'utf8');
    expect(catalogCsv.startsWith('\uFEFFCódigo de materia;Materia;Grupo funcional;Ámbito;')).toBe(true);
    expect(catalogCsv).toContain('DIVIDENDO_A_CUENTA;Distribución de dividendo a cuenta;');
    expect(catalogCsv).toMatch(
      /;Sociedad;ARGA Seguros(?: S\.A\.)?;6d7ed736-f263-4531-a59d-c6ca0cd41602;/,
    );
    expect(catalogCsv.match(/\r\nDIVIDENDO_A_CUENTA;/g)).toHaveLength(1);
    await expect(controls).toContainText('1 materia exportada');
    expect(catalogRestWrites).toEqual([]);

    const comparison = page.getByRole('region', { name: 'Comparación de materias y reglas' });
    const dividendRow = comparison.getByRole('row', { name: /Distribución de dividendo a cuenta/i });
    await expect(dividendRow).toBeVisible();
    await dividendRow.getByRole('button', { name: 'Ver detalle de Distribución de dividendo a cuenta' }).click();
    await expectSearchParams(page, { materia: 'DIVIDENDO_A_CUENTA' });
    await expect(
      page.getByRole('complementary', { name: 'Detalle de la materia seleccionada' })
        .getByRole('heading', { name: 'Distribución de dividendo a cuenta' }),
    ).toBeVisible();

    await controls.getByRole('button', { name: 'Tarjetas' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('presentacion')).toBeNull();
    await expect(page.getByTestId('materias-card-view')).toBeVisible();

    await controls.getByRole('button', { name: 'Tabla comparativa' }).click();
    await expectSearchParams(page, { presentacion: 'tabla' });
    await expect(comparison).toBeVisible();

    const engineSummary = page.getByRole('region', {
      name: 'Reglas aplicables y requisitos para tramitar',
    });
    await engineSummary
      .getByRole('button', { name: 'Ver documentos y plantillas de esta materia' })
      .click();
    await expectSearchParams(page, {
      q: 'estado contable',
      mayoria: 'SIMPLE',
      formalizacion: 'ARCHIVO_INTERNO',
      estado: 'lista',
      presentacion: 'tabla',
      vista: 'plantillas',
      scope: 'sociedad',
      entity: entityId,
      materia: 'DIVIDENDO_A_CUENTA',
    });
    await expect(page.getByRole('tabpanel', { name: /Plantillas/i })).toBeVisible();
  });

  test('alias de reglamento resuelve la regla versionada y preserva contexto en materias relacionadas', async ({ page }) => {
    const entityId = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
    const baseQuery = `scope=sociedad&entity=${entityId}&vista=regla&presentacion=tabla`;
    const detail = page.getByRole('complementary', { name: 'Detalle de la materia seleccionada' });
    const matterHeading = detail.getByRole('heading', {
      name: 'Aprobación o modificación del Reglamento del Consejo',
    });

    await page.goto(`/secretaria/catalogo-materias?${baseQuery}&materia=MODIFICACION_REGLAMENTO`);
    await expect(matterHeading).toBeVisible({ timeout: 10_000 });
    await expect(detail.getByText(/Regla versionada activa v\d/)).toBeVisible();
    await expect(detail.getByText(/art\. 528 LSC/).first()).toBeVisible();

    await page.goto(`/secretaria/catalogo-materias?${baseQuery}&materia=APROBACION_REGLAMENTO_CONSEJO`);
    await expect(matterHeading).toBeVisible({ timeout: 10_000 });

    const controls = page.getByTestId('materias-catalog-controls');
    const search = controls.getByLabel('Buscar por materia, artículo o documento');
    const comparison = page.getByRole('region', { name: 'Comparación de materias y reglas' });
    const matchingRow = comparison.getByRole('row', {
      name: /Aprobación o modificación del Reglamento del Consejo/i,
    });

    await search.fill('MODIFICACION_REGLAMENTO');
    await expect(page.getByText('1 de 48 materias')).toBeVisible();
    await expect(matchingRow).toBeVisible();

    await search.fill('APROBACION_REGLAMENTO_CONSEJO');
    await expect(page.getByText('1 de 48 materias')).toBeVisible();
    await expect(matchingRow).toBeVisible();

    await detail.getByRole('link', { name: 'Ver Modificación de estatutos' }).click();
    await expectSearchParams(page, {
      q: 'APROBACION_REGLAMENTO_CONSEJO',
      presentacion: 'tabla',
      vista: 'regla',
      scope: 'sociedad',
      entity: entityId,
      materia: 'MODIFICACION_ESTATUTOS',
    });
    await expect(
      detail.getByRole('heading', { name: 'Modificación de estatutos sociales' }),
    ).toBeVisible();
  });

  test('explica fuente determinante y conserva variantes por órgano', async ({ page }) => {
    const entityId = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
    await page.goto(
      `/secretaria/catalogo-materias?scope=sociedad&entity=${entityId}&materia=FORMULACION_CUENTAS&vista=fuentes`,
    );
    await expect(page.getByText('¿Por qué se aplica esta regla?')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Fuente determinante', { exact: true })).toBeVisible();
    await expect(page.getByText('Fuentes revisadas', { exact: true })).toBeVisible();
    await expect(page.getByText(/248\.1 LSC/).first()).toBeVisible();

    await page.goto(
      `/secretaria/catalogo-materias?scope=sociedad&entity=${entityId}&materia=AUTORIZACION_GARANTIA&vista=regla`,
    );
    await expect(page.getByRole('heading', { name: 'Consejo de Administración', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Junta General', exact: true })).toBeVisible();

    await page.goto(
      `/secretaria/catalogo-materias?scope=sociedad&entity=${entityId}&materia=AUMENTO_CAPITAL&vista=plantillas`,
    );
    const detail = page.getByRole('complementary', {
      name: 'Detalle de la materia seleccionada',
    });
    const preAgreementStage = detail.locator('article').filter({
      has: page.getByRole('heading', { name: 'Pre-acuerdo', exact: true }),
    });
    const certificationStage = detail.locator('article').filter({
      has: page.getByRole('heading', { name: 'Certificación', exact: true }),
    });
    await expect(preAgreementStage.getByText('Activa', { exact: true })).toBeVisible();
    await expect(certificationStage.getByText('Activa', { exact: true })).toBeVisible();
    expect(await preAgreementStage.getByText('Vigente para nuevos expedientes').count()).toBeGreaterThan(0);
    expect(await certificationStage.getByText('Vigente para nuevos expedientes').count()).toBeGreaterThan(0);
  });

  test('materia informativa mantiene constancia y no ofrece expediente decisorio', async ({ page }) => {
    await page.goto(
      '/secretaria/catalogo-materias?scope=grupo&materia=SEGUIMIENTO_PLAN_NEGOCIO&vista=simular',
    );
    const detail = page.getByRole('complementary', { name: 'Detalle de la materia seleccionada' });
    await expect(detail.getByText('No aplica abrir expediente', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect(detail.getByText('Solo constancia', { exact: true }).first()).toBeVisible();
    await expect(detail.getByText(/dejar constancia en acta/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Iniciar expediente', exact: true })).toHaveCount(0);

    const helpHeading = page.getByRole('heading', { name: 'Cómo interpretar el catálogo' });
    const helpDisclosure = page.locator('details').filter({ has: helpHeading });
    const helpSummary = helpDisclosure.locator(':scope > summary');
    await helpSummary.focus();
    await expect(helpSummary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(helpDisclosure).toHaveAttribute('open', '');

    const informativeSummary = helpDisclosure.locator('summary').filter({ hasText: /^Informativa$/ });
    const informativeHelp = informativeSummary.locator('..');
    await informativeSummary.focus();
    await expect(informativeSummary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(informativeHelp).toHaveAttribute('open', '');
    await expect(informativeHelp.getByText('Definición', { exact: true })).toBeVisible();
    await expect(informativeHelp.getByText('Consecuencia', { exact: true })).toBeVisible();
    await expect(informativeHelp.getByText('Qué hacer', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: /Resumen/ }).click();
    await expect(page).toHaveURL(/vista=resumen/);
    await page.getByRole('tab', { name: /Regla aplicable/ }).click();
    await expect(page).toHaveURL(/vista=regla/);
    await page.getByRole('tab', { name: /Plantillas/ }).click();
    await expect(page).toHaveURL(/vista=plantillas/);
    await page.getByRole('tab', { name: /Fuentes/ }).click();
    await expect(page).toHaveURL(/vista=fuentes/);
    await page.getByRole('tab', { name: /Verificación/ }).click();
    await expect(page).toHaveURL(/vista=simular/);
  });

  test('restricción por tipo social distingue SA y SL con los datos Cloud', async ({ page }) => {
    const argaSegurosId = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
    const argaDigitalId = 'f653c44c-15ce-4428-b3d3-f4ed17efe93b';
    const materia = 'PRESTACIONES_ACCESORIAS';

    await page.goto(
      `/secretaria/catalogo-materias?scope=sociedad&entity=${argaSegurosId}&materia=${materia}&vista=simular`,
    );
    const segurosDetail = page.getByRole('complementary', {
      name: 'Detalle de la materia seleccionada',
    });
    await expect(
      segurosDetail.getByRole('heading', {
        name: 'Creación, modificación o supresión de prestaciones accesorias',
      }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      segurosDetail.getByText('No aplica a esta sociedad', { exact: true }).first(),
    ).toBeVisible();
    await expect(segurosDetail.getByRole('link', { name: 'Iniciar expediente', exact: true })).toHaveCount(0);

    await page.goto(
      `/secretaria/catalogo-materias?scope=sociedad&entity=${argaDigitalId}&materia=${materia}&vista=regla`,
    );
    const digitalDetail = page.getByRole('complementary', {
      name: 'Detalle de la materia seleccionada',
    });
    await expect(
      digitalDetail.getByRole('heading', {
        name: 'Creación, modificación o supresión de prestaciones accesorias',
      }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Configuración societaria incoherente')).toHaveCount(0);
    await expect(digitalDetail.getByText(/Aplicabilidad por tipo social: Aplica a S\.L\./)).toBeVisible();
    await expect(digitalDetail.getByText('No aplica a esta sociedad', { exact: true })).toHaveCount(0);
  });
});

test.describe('Libros Obligatorios', () => {
  test('lista de libros muestra alertas de legalización', async ({ page }) => {
    await page.goto('/secretaria/libros');
    await expect(
      page.getByText('Libro').or(page.getByText('legaliz').or(page.getByText('alerta'))).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

// Lote 1 coherencia — flujo de adopción vs tramitador (A2/A3).
test.describe('Flujo de adopción — intakes y rescate', () => {
  test('tramitador sin acuerdos de la materia ofrece iniciar la adopción y no degrada en silencio', async ({ page }) => {
    await page.goto('/secretaria/tramitador/nuevo?materia=FUSION_ESCISION&scope=grupo');

    await expect(page.getByText('Entrada desde Materias y reglas')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/La tramitación registral llega después de la adopción/),
    ).toBeVisible();
    const rescate = page.getByRole('link', { name: 'Iniciar adopción de esta materia' });
    await expect(rescate).toBeVisible();
    await expect(rescate).toHaveAttribute(
      'href',
      /\/secretaria\/(convocatorias\/nueva|acuerdos-sin-sesion|decisiones-unipersonales)\S*materia=FUSION_ESCISION/,
    );
    // La lista completa solo aparece bajo acción explícita.
    await expect(page.getByText('Se muestran el resto de acuerdos tramitables')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ver otros acuerdos tramitables' }).click();
    await expect(page.getByText('Se muestran el resto de acuerdos tramitables')).toBeVisible();
  });

  test('co-aprobación pre-selecciona la clase de materia desde ?materia=', async ({ page }) => {
    await page.goto('/secretaria/acuerdos-sin-sesion/co-aprobacion?materia=MODIFICACION_ESTATUTOS&scope=grupo');

    await expect(page.locator('#coaprobacion-materia')).toHaveValue('MOD_ESTATUTOS', { timeout: 10_000 });
  });
});
