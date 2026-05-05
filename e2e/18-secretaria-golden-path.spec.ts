import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';

test.describe.configure({ timeout: 120_000 });

const FATAL_UI_PATTERNS = [
  /Ha ocurrido un error/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /function .* does not exist/i,
  /permission denied/i,
  /violates row-level security/i,
];

async function expectNoFatalUi(page: Page) {
  await expect(page).not.toHaveURL(/\/login/);
  for (const pattern of FATAL_UI_PATTERNS) {
    await expect(page.getByText(pattern).first()).toHaveCount(0);
  }
}

async function installDocxSpy(page: Page) {
  await page.evaluate(() => {
    const win = window as Window & {
      __docxDownloads?: string[];
      __docxDownloadSpyInstalled?: boolean;
    };
    win.__docxDownloads = [];
    if (win.__docxDownloadSpyInstalled) return;
    window.addEventListener('tgms:docx-download', (event) => {
      const detail = (event as CustomEvent<{ filename?: string }>).detail;
      if (detail?.filename) win.__docxDownloads?.push(detail.filename);
    });
    win.__docxDownloadSpyInstalled = true;
  });
}

async function completeCapa3IfNeeded(page: Page) {
  const capa3Dialog = page.getByRole('dialog', { name: 'Completar campos editables' });
  const opened = await expect(capa3Dialog)
    .toBeVisible({ timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) return;

  const textboxes = capa3Dialog.getByRole('textbox');
  const count = await textboxes.count();
  for (let index = 0; index < count; index += 1) {
    const textbox = textboxes.nth(index);
    const current = await textbox.inputValue();
    await textbox.fill(current || `Dato legal prototipo ${index + 1}`);
  }
  await capa3Dialog.getByRole('button', { name: 'Generar DOCX' }).evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const win = window as Window & { __docxDownloads?: string[] };
          return win.__docxDownloads?.length ?? 0;
        }),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  if (await capa3Dialog.isVisible().catch(() => false)) {
    await capa3Dialog.getByRole('button', { name: 'Cancelar' }).click();
  }
}

async function expectDocxDownload(page: Page, buttonName: string | RegExp, filenamePattern: RegExp) {
  await installDocxSpy(page);
  const button = page.getByRole('button', { name: buttonName }).first();
  await expect(button).toBeVisible({ timeout: 15_000 });
  await expect(button).toBeEnabled({ timeout: 20_000 });
  await button.click();
  await completeCapa3IfNeeded(page);
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const win = window as Window & { __docxDownloads?: string[] };
          return win.__docxDownloads?.[0] ?? '';
        }),
      { timeout: 20_000 },
    )
    .toMatch(filenamePattern);
}

async function openConvocatoriaWithMeetingAction(page: Page) {
  await page.goto('/secretaria/convocatorias?scope=grupo');
  await expect(page.locator('tbody')).toContainText('ARGA', { timeout: 20_000 });

  const preferredRows = page.locator('tbody tr');
  const rowCount = await preferredRows.count();
  for (let index = 0; index < Math.min(rowCount, 8); index += 1) {
    await page.goto('/secretaria/convocatorias?scope=grupo');
    await expect(page.locator('tbody')).toContainText('ARGA', { timeout: 20_000 });
    const row = page.locator('tbody tr').nth(index);
    await expect(row).toBeVisible({ timeout: 10_000 });
    const bodyText = (await row.locator('td').nth(0).innerText()).trim();
    const entityText = (await row.locator('td').nth(1).innerText()).trim();
    if (bodyText !== 'Consejo de Administración' || !/^ARGA Seguros\b/.test(entityText)) {
      continue;
    }
    await row.click();
    if (!/\/secretaria\/convocatorias\/[^/?]+/.test(page.url())) {
      await row.dblclick();
    }
    await expect(page).toHaveURL(/\/secretaria\/convocatorias\/[^/?]+/);
    const docButton = page.getByRole('button', { name: /Convocatoria DOCX|Convocatoria con plantilla/ }).first();
    if (!(await expect(docButton).toBeVisible({ timeout: 15_000 }).then(() => true).catch(() => false))) {
      continue;
    }
    const action = page.getByRole('button', { name: /Programar reunión|Abrir reunión/ }).first();
    const actionReady =
      (await expect(action).toBeVisible({ timeout: 10_000 }).then(() => true).catch(() => false)) &&
      (await expect(action).toBeEnabled({ timeout: 20_000 }).then(() => true).catch(() => false));
    if (actionReady) {
      return action;
    }
  }

  throw new Error('No hay convocatoria demo con acción de reunión disponible para el golden path.');
}

async function goStep(page: Page, label: string | RegExp, heading: string | RegExp) {
  await page.getByRole('button', { name: label }).first().click();
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 10_000 });
  await expectNoFatalUi(page);
}

async function clickIfVisibleAndEnabled(page: Page, buttonName: string | RegExp) {
  const button = page.getByRole('button', { name: buttonName }).first();
  if ((await button.isVisible().catch(() => false)) && (await button.isEnabled().catch(() => false))) {
    await button.click();
    return true;
  }
  return false;
}

async function ensureAllVisibleVotesFavor(page: Page) {
  const pointButtons = page.getByRole('button', { name: /Punto \d+/ });
  const pointCount = Math.max(await pointButtons.count(), 1);

  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    if (pointIndex > 0) await pointButtons.nth(pointIndex).click();
    const voteSelects = page.locator('tbody select');
    await expect(voteSelects.first()).toBeVisible({ timeout: 10_000 });
    const voteCount = await voteSelects.count();
    for (let index = 0; index < voteCount; index += 1) {
      await voteSelects.nth(index).selectOption('FAVOR');
    }
  }
}

async function openTramitadorFromCertification(page: Page) {
  let openButton = page.getByRole('button', { name: 'Abrir en tramitador' }).first();
  if (!(await openButton.isVisible().catch(() => false))) {
    const emitir = page.getByRole('button', { name: 'Emitir certificación' }).first();
    await expect(emitir).toBeVisible({ timeout: 15_000 });
    await expect(emitir).toBeEnabled({ timeout: 20_000 });
    await emitir.click();
    await expect(page.getByText(/Certificación emitida|Evidencia demo\/operativa vinculada/i).first()).toBeVisible({
      timeout: 30_000,
    });
    openButton = page.getByRole('button', { name: 'Abrir en tramitador' }).first();
  }

  await expect(openButton).toBeVisible({ timeout: 20_000 });
  await openButton.click();
  await expect(page).toHaveURL(/\/secretaria\/tramitador\/nuevo\?certificacion=/);
  await expectNoFatalUi(page);
}

test.describe('Secretaría — golden path prototipo legal', () => {
  test('Convocatoria → Reunión → Votación → Acta → Certificación → Tramitador → Documento', async ({ page }) => {
    await test.step('convocatoria y documentos previos', async () => {
      await openConvocatoriaWithMeetingAction(page);
      await expect(page.getByRole('button', { name: /Convocatoria DOCX|Convocatoria con plantilla/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Informe PRE/ })).toBeVisible();
      const action = page.getByRole('button', { name: /Programar reunión|Abrir reunión/ }).first();
      await expect(action).toBeEnabled({ timeout: 20_000 });
      await action.click();
      await expect(page).toHaveURL(/\/secretaria\/reuniones\/[^/?]+/);
      await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
        timeout: 20_000,
      });
    });

    await test.step('reunión, constitución y asistencia', async () => {
      await clickIfVisibleAndEnabled(page, 'Declarar apertura de la sesión');
      await expect(page.getByText(/Sesión declarada abierta|CELEBRADA|Estado actual/i).first()).toBeVisible({ timeout: 20_000 });

      await goStep(page, /Asistentes/, /Paso 2\. Asistentes/);
      const saveAttendance = page.getByRole('button', { name: 'Guardar asistencia' });
      if (await expect(saveAttendance).toBeAttached({ timeout: 20_000 }).then(() => true).catch(() => false)) {
        await saveAttendance.scrollIntoViewIfNeeded();
        await expect(saveAttendance).toBeEnabled({ timeout: 20_000 });
        await saveAttendance.click();
        await expect(page.getByText(/Asistencia de \d+ miembros guardada/i).first()).toBeVisible({
          timeout: 20_000,
        });
      } else {
        await expect(page.getByText(/No hay censo vigente del órgano/)).toBeVisible({ timeout: 20_000 });
      }
      await expect(page.getByText(/Censo demo de prototipo no persistido/i)).toHaveCount(0);
    });

    await test.step('quórum, agenda y votación', async () => {
      await goStep(page, /Quórum/, /Paso 3\. Quórum/);
      await expect(page.getByText(/No hay lista de asistentes guardada/i)).toHaveCount(0);
      await expect(page.getByText(/Evaluación Motor V2|QUÓRUM ALCANZADO/i).first()).toBeVisible({ timeout: 20_000 });
      if (await clickIfVisibleAndEnabled(page, 'Confirmar quórum y continuar')) {
        await expect(page.getByText(/Quórum ya registrado/i).first()).toBeVisible({ timeout: 20_000 });
      }

      await goStep(page, /Agenda y debate/, /Paso 4\. Agenda y debate/);
      await expect(page.getByText(/Agenda formal|Punto 1/i).first()).toBeVisible({ timeout: 20_000 });
      const materiaSelect = page.locator('main select').first();
      if (await expect(materiaSelect).toBeVisible({ timeout: 10_000 }).then(() => true).catch(() => false)) {
        await materiaSelect.selectOption('NOMBRAMIENTO_CONSEJERO');
        await expect(materiaSelect).toHaveValue('NOMBRAMIENTO_CONSEJERO', { timeout: 5_000 });
      }
      const agendaTitle = page.getByRole('textbox', { name: /Aprobación de cuentas anuales/i }).first();
      if (await agendaTitle.isVisible().catch(() => false)) {
        await agendaTitle.fill('Nombramiento de consejero por cooptación');
      }
      const saveDebates = page.getByRole('button', { name: 'Guardar debates' });
      await expect(saveDebates).toBeEnabled({ timeout: 10_000 });
      await saveDebates.click();
      await expect(page.getByText('Agenda y debate guardados').first()).toBeVisible({ timeout: 20_000 });
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
        timeout: 20_000,
      });

      await goStep(page, /Votaciones/, /Paso 5\. Votaciones/);
      await expect(page.getByText('Nombramiento de consejero por cooptación').first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(/fallback tecnico de prototipo|Nombramiento de consejero · ORDINARIA/i).first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText('Evaluación de adopción por punto')).toBeVisible({ timeout: 20_000 });
      const saveResolutionButton = page.getByRole('button', {
        name: /Registrar resolución y crear expediente Acuerdo 360|Recalcular resolución y crear expediente Acuerdo 360/,
      }).first();
      if (await saveResolutionButton.isVisible().catch(() => false)) {
        await ensureAllVisibleVotesFavor(page);
        if (await saveResolutionButton.isVisible().catch(() => false)) {
          await expect(saveResolutionButton).toBeEnabled({ timeout: 20_000 });
          await saveResolutionButton.click();
          await expect(page.getByText(/Snapshot legal actualizado|resolución\(es\) registrada\(s\)|resoluciones ya están registradas/i).first()).toBeVisible({
            timeout: 30_000,
          });
        } else {
          await expect(page.getByText(/resoluciones ya están registradas/i).first()).toBeVisible({ timeout: 10_000 });
        }
      } else {
        await expect(page.getByText(/resoluciones ya están registradas/i).first()).toBeVisible({ timeout: 10_000 });
      }
      await expect(page.getByText(/Snapshot legal actualizado|resoluciones ya están registradas/i).first()).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step('acta y certificación', async () => {
      await goStep(page, /Cierre/, /Paso 6\. Cierre/);
      const existingMinuteButton = page.getByRole('button', { name: 'Ver acta existente' });
      if (await expect(existingMinuteButton).toBeVisible({ timeout: 5_000 }).then(() => true).catch(() => false)) {
        await existingMinuteButton.click();
      } else {
        await expect(page.getByRole('button', { name: 'Confirmar cierre y generar acta' })).toBeEnabled({
          timeout: 20_000,
        });
        await page.getByRole('button', { name: 'Confirmar cierre y generar acta' }).click();
        await expect(page.locator('main').getByText('Acta generada en borrador')).toBeVisible({ timeout: 30_000 });
        await page.getByRole('button', { name: 'Ver acta' }).click();
      }

      await expect(page).toHaveURL(/\/secretaria\/actas\/[^/?]+/);
      await expect(page.getByRole('heading', { name: 'Revisión legal para certificación' })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText('Acuerdo 360').first()).toBeVisible();
      const createAgreement = page.getByRole('button', { name: 'Crear expediente Acuerdo 360' }).first();
      if (await createAgreement.isVisible().catch(() => false)) {
        await expect(createAgreement).toBeEnabled({ timeout: 20_000 });
        await createAgreement.click();
        await expect(page.getByText(/Expediente Acuerdo 360 creado|Expediente Acuerdo 360 enlazado/i).first()).toBeVisible({
          timeout: 30_000,
        });
      }
      await expect(page.getByRole('button', { name: 'Acta DOCX' })).toBeVisible();
      await openTramitadorFromCertification(page);
    });

    await test.step('tramitador y documento registral', async () => {
      await expect(page.getByText('Entrada desde certificación')).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByText(/Firmada|Pendiente de firma|Evidencia demo\/operativa vinculada|Evidencia operativa pendiente/i).first(),
      ).toBeVisible();

      const agreementButton = page.getByRole('button', { name: /Incluido en certificación|ADOPTADO|CERTIFICADO/i }).first();
      if (await agreementButton.isVisible().catch(() => false)) {
        await agreementButton.click();
      }
      await goStep(page, /Vía de presentación/, /Vía de presentación/);
      await expect(page.getByText(/Análisis de inscribibilidad|Estado del trámite/i).first()).toBeVisible({
        timeout: 20_000,
      });

      await goStep(page, /Seguimiento/, /Seguimiento/);
      const docButton = page.getByRole('button', { name: 'Documento registral DOCX' }).first();
      if (await docButton.isVisible().catch(() => false)) {
        await expectDocxDownload(page, 'Documento registral DOCX', /^documento_registral_[\w-]+_\d{4}-\d{2}-\d{2}\.docx$/);
      } else {
        await expect(page.getByText(/Instrumento requerido|No requiere escritura|Seleccione un acuerdo/i).first()).toBeVisible();
      }
    });

    await expectNoFatalUi(page);
  });
});
