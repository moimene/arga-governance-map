import {
  test,
  expect,
  CERTIFICACION_PIPELINE_BUTTON,
  CONVOCATORIA_DRAFT_DOCX_BUTTON as convocatoriaDocxButton,
} from './fixtures/base';

test.describe.configure({ timeout: 40_000 });

async function expectDocxDownload(page, buttonName: string | RegExp, filenamePattern: RegExp) {
  const button = page.getByRole('button', { name: buttonName }).first();
  await expect(button).toBeVisible({ timeout: 10_000 });
  await expect(button).toBeEnabled({ timeout: 20_000 });

  await page.evaluate(() => {
    const win = window as Window & {
      __docxDownloads?: string[];
      __docxDownloadSpyInstalled?: boolean;
    };
    win.__docxDownloads = [];
    if (win.__docxDownloadSpyInstalled) return;

    window.addEventListener('tgms:docx-download', (event) => {
      const detail = (event as CustomEvent<{ filename?: string }>).detail;
      if (detail?.filename) {
        win.__docxDownloads?.push(detail.filename);
      }
    });
    win.__docxDownloadSpyInstalled = true;
  });

  await button.click();

  const capa3Dialog = page.getByRole('dialog', { name: 'Completar campos editables' });
  await capa3Dialog.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {});
  if (await capa3Dialog.isVisible().catch(() => false)) {
    const textboxes = capa3Dialog.getByRole('textbox');
    const count = await textboxes.count();
    for (let index = 0; index < count; index += 1) {
      const textbox = textboxes.nth(index);
      if (!(await textbox.inputValue())) {
        await textbox.fill(`Dato demo documental ${index + 1}`);
        await page.waitForTimeout(50);
      }
    }
    // Capa 3 renderiza <select> para campos con lista cerrada (`opciones`);
    // hay que elegir una opción real igual que lo haría el usuario.
    const comboboxes = capa3Dialog.getByRole('combobox');
    const comboCount = await comboboxes.count();
    for (let index = 0; index < comboCount; index += 1) {
      const combobox = comboboxes.nth(index);
      if (!(await combobox.inputValue())) {
        await combobox.selectOption({ index: 1 });
        await page.waitForTimeout(50);
      }
    }
    await capa3Dialog.getByRole('button', { name: 'Generar DOCX' }).click();
  }

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const win = window as Window & { __docxDownloads?: string[] };
          return win.__docxDownloads?.[0] ?? '';
        }),
      { timeout: 15_000 },
    )
    .toMatch(filenamePattern);
}

async function openFirstConvocatoriaDetalle(page) {
  await page.goto('/secretaria/convocatorias?scope=grupo');
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  await firstRow.locator('td').first().click();
  if (!/\/secretaria\/convocatorias\/[^/?]+/.test(page.url())) {
    await firstRow.locator('td').first().dblclick();
  }
  await expect(page).toHaveURL(/\/secretaria\/convocatorias\/[^/?]+/);
}

async function openFirstActaDetalle(page) {
  await page.goto('/secretaria/actas');
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  await firstRow.locator('td').first().click();
  if (!/\/secretaria\/actas\/[^/?]+/.test(page.url())) {
    await firstRow.locator('td').first().dblclick();
  }
  await expect(page).toHaveURL(/\/secretaria\/actas\/[^/?]+/);
}

test.describe('Secretaría — documentos DOCX', () => {
  test('convocatoria expone botones documentales', async ({ page }) => {
    await openFirstConvocatoriaDetalle(page);

    await expect(page.getByRole('button', { name: convocatoriaDocxButton })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Informe PRE' })).toBeVisible();
  });

  // Desde el cierre del 2026-07-21 la convocatoria NO se renderiza en el
  // navegador: el DOCX sale del manifiesto inmutable en servidor
  // (process-documents.ts:987-993 exige `archive.archived` y el binario
  // autoritativo, y aborta si no los hay). De ahí dos consecuencias que este
  // spec fijaba mal:
  //   1. El nombre ya no es `convocatoria_<id8>_<fecha>.docx` sino el que
  //      acuña el renderer de servidor
  //      (convocation-artifact-register/renderer.ts:694), que declara en el
  //      propio nombre que es una simulación DEMO.
  //   2. Un registro legacy sin manifiesto canónico NO puede entregar DOCX, y
  //      el producto hace bien en negarse. Abrir «la primera fila» hacía caer
  //      el spec siempre en uno de esos registros.
  // La invariante que sí se puede exigir hoy: ninguna convocatoria responde en
  // silencio —o entrega el artefacto de servidor, o dice por qué no— y al
  // menos una del inventario demo lo entrega. No se fija el UUID canónico: es
  // trazabilidad, no constante (CLAUDE.md).
  test('convocatoria entrega el DOCX renderizado en servidor o explica por qué no', async ({ page }) => {
    test.setTimeout(180_000); // barrido de hasta 8 convocatorias contra la Edge Function
    await page.goto('/secretaria/convocatorias?scope=grupo');
    await expect(page.locator('tbody')).toContainText('ARGA', { timeout: 20_000 });
    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount, 'el inventario demo de convocatorias no puede estar vacío').toBeGreaterThan(0);

    const entregados: string[] = [];
    const rechazados: string[] = [];

    for (let index = 0; index < Math.min(rowCount, 8); index += 1) {
      await page.goto('/secretaria/convocatorias?scope=grupo');
      await expect(page.locator('tbody')).toContainText('ARGA', { timeout: 20_000 });
      await page.locator('tbody tr').nth(index).click();
      await expect(page).toHaveURL(/\/secretaria\/convocatorias\/[^/?]+/);
      await expect(page.getByRole('button', { name: 'Volver al listado' })).toBeVisible({ timeout: 15_000 });

      await page.evaluate(() => {
        const win = window as Window & { __docxDownloads?: string[] };
        win.__docxDownloads = [];
        window.addEventListener('tgms:docx-download', (event) => {
          const detail = (event as CustomEvent<{ filename?: string }>).detail;
          if (detail?.filename) win.__docxDownloads?.push(detail.filename);
        });
      });

      const button = page.getByRole('button', { name: convocatoriaDocxButton }).first();
      await expect(button).toBeVisible({ timeout: 10_000 });
      await expect(button).toBeEnabled({ timeout: 20_000 });
      await button.click();

      // O sale el fichero, o sale el aviso. El bucle espera a lo primero que
      // ocurra: el silencio agota el plazo y rompe la aserción de abajo.
      const notificaciones = page.locator('[aria-label*="Notification"]');
      let entregado = '';
      let aviso = '';
      for (let intento = 0; intento < 12 && !entregado && !aviso; intento += 1) {
        await page.waitForTimeout(1_000);
        entregado = await page.evaluate(() => {
          const win = window as Window & { __docxDownloads?: string[] };
          return win.__docxDownloads?.[0] ?? '';
        });
        aviso = (await notificaciones.allInnerTexts()).join(' ').trim();
      }

      if (entregado) {
        entregados.push(entregado);
      } else {
        expect(aviso, `la convocatoria de la fila ${index} no entregó DOCX y tampoco dijo por qué`).toMatch(
          /No se pudo generar/i,
        );
        rechazados.push(aviso.replace(/\s+/g, ' '));
      }
    }

    expect(
      entregados.length,
      `ninguna convocatoria del inventario demo entregó el DOCX autoritativo. Rechazos: ${JSON.stringify(rechazados)}`,
    ).toBeGreaterThan(0);
    for (const filename of entregados) {
      expect(filename).toMatch(/^Simulacion_DEMO_Convocatoria_.+_\d{4}-\d{2}-\d{2}\.docx$/);
    }
  });

  test('informe PRE de convocatoria descarga DOCX', async ({ page }) => {
    await openFirstConvocatoriaDetalle(page);

    await expectDocxDownload(
      page,
      'Informe PRE',
      /^informe_pre_convocatoria_[a-zA-Z0-9-]{8}_\d{4}-\d{2}-\d{2}\.docx$/,
    );
  });

  test('acta expone generación DOCX en detalle', async ({ page }) => {
    await openFirstActaDetalle(page);

    await expect(page.getByRole('button', { name: 'Acta DOCX' })).toBeVisible({ timeout: 10_000 });

    // El botón es una máquina de estados, no un rótulo fijo: «Preparar
    // certificación» → «Pendiente de artefacto final» → «Validar evidencia y
    // emitir» → «Emitir certificación» → «Certificación emitida»
    // (EmitirCertificacionButton.tsx:378-388). Exigir el literal «Emitir
    // certificación» era exigir un estado concreto del dato demo, no que el
    // pipeline estuviera montado. Y la enumeración de motivos de bloqueo
    // tampoco cubría el gate de fuente que entró en el cierre del 2026-09-05
    // («Una simulación demo no puede servir de fuente…»), así que se
    // comprueba estructuralmente: si está bloqueado, el botón dice por qué en
    // su `title` (línea 477 del componente). Una pantalla en blanco no monta
    // ningún botón y sigue rompiendo el test.
    const certificacion = page.getByRole('button', { name: CERTIFICACION_PIPELINE_BUTTON }).first();
    await expect(certificacion, 'el detalle de acta debe montar el pipeline de certificación').toBeVisible({
      timeout: 10_000,
    });
    if (!(await certificacion.isEnabled())) {
      await expect(
        certificacion,
        'una certificación bloqueada tiene que decir el motivo, no quedarse muda',
      ).toHaveAttribute('title', /\S/);
    }
  });

  test('acta explica trazabilidad legal hacia certificación y tramitador', async ({ page }) => {
    await openFirstActaDetalle(page);

    await expect(page.getByRole('heading', { name: 'Revisión legal para certificación' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Certificables', { exact: true })).toBeVisible();
    await expect(page.getByText('Acuerdo 360').first()).toBeVisible();
    await expect(page.getByText('Refs. por punto')).toBeVisible();
    await expect(page.getByText(/Estado Acuerdo 360|Falta snapshot legal por punto/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Acta DOCX' })).toBeVisible();

    const abrirTramitador = page.getByRole('button', { name: 'Abrir en tramitador' }).first();
    if (await abrirTramitador.isVisible().catch(() => false)) {
      await abrirTramitador.click();
      await expect(page).toHaveURL(/\/secretaria\/tramitador\/nuevo\?certificacion=/);
      await expect(page.getByText('Entrada desde certificación')).toBeVisible({ timeout: 10_000 });
      await expect(
        page.getByText(/Firmada|Pendiente de firma|Evidencia operativa pendiente|Evidencia demo\/operativa vinculada/i).first()
      ).toBeVisible();
    } else {
      await expect(page.getByText('Sin certificaciones emitidas.')).toBeVisible();
      await expect(page.getByRole('button', { name: CERTIFICACION_PIPELINE_BUTTON }).first()).toBeVisible();
    }
  });

  test('gestor permite usar fixture registral local sin cargarlo en Supabase', async ({ page }) => {
    await page.goto('/secretaria/gestor-plantillas');

    await expect(page.getByRole('heading', { name: 'Gobierno de plantillas' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('tab', { name: 'Catálogo gobernado' }).click();
    await expect(page.getByText('Catálogo de plantillas protegidas')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('combobox', { name: /Revisi[oó]n legal/i }).selectOption('LOCAL_FIXTURE');
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('Documento registral');

    await page.getByRole('button', { name: /Documento registral/ }).first().click();
    await expect(page.getByText('Cobertura provisional pendiente de aprobación').first()).toBeVisible();
    await expect(page.getByText('Cobertura provisional · pendiente de aprobación').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Elegir trámite' })).toBeVisible();

    await page.getByRole('button', { name: 'Elegir trámite' }).click();
    await expect(page).toHaveURL(
      /\/secretaria\/tramitador\?plantilla=legal-fixture-documento-registral-es&tipo=DOCUMENTO_REGISTRAL/,
    );
  });
});
