import { test, expect } from './fixtures/base';

test.describe.configure({ timeout: 40_000 });

async function expectDocxDownload(page, buttonName: string, filenamePattern: RegExp) {
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

    await expect(page.getByRole('button', { name: 'Convocatoria DOCX' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Informe PRE' })).toBeVisible();
  });

  test('convocatoria dispara descarga DOCX', async ({ page }) => {
    await openFirstConvocatoriaDetalle(page);

    await expectDocxDownload(page, 'Convocatoria DOCX', /^convocatoria_[a-zA-Z0-9-]{8}_\d{4}-\d{2}-\d{2}\.docx$/);
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

    const emitirCertificacion = page.getByRole('button', { name: 'Emitir certificación' }).first();
    if (await emitirCertificacion.isVisible().catch(() => false)) {
      if (!(await emitirCertificacion.isEnabled())) {
        await expect(
          page.getByText(/Falta snapshot legal|No hay acuerdos proclamables|Cargando snapshot legal/i).first()
        ).toBeVisible();
      }
    }
  });

  test('acta explica trazabilidad legal hacia certificación y tramitador', async ({ page }) => {
    await openFirstActaDetalle(page);

    await expect(page.getByRole('heading', { name: 'Revisión legal para certificación' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Certificables')).toBeVisible();
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
    }
  });

  test('gestor permite usar fixture registral local sin cargarlo en Supabase', async ({ page }) => {
    await page.goto('/secretaria/gestor-plantillas');

    await expect(page.getByRole('heading', { name: 'Plantillas con contenido jurídico' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('Documento registral');

    await page.getByRole('button', { name: /Documento registral/ }).first().click();
    await expect(page.getByText('Fixture local no persistido').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Elegir trámite' })).toBeVisible();

    await page.getByRole('button', { name: 'Elegir trámite' }).click();
    await expect(page).toHaveURL(
      /\/secretaria\/tramitador\?plantilla=legal-fixture-documento-registral-es&tipo=DOCUMENTO_REGISTRAL/,
    );
  });
});
