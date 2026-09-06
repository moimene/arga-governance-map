import type { Page } from '@playwright/test';
import { test, expect, CONVOCATORIA_DRAFT_DOCX_BUTTON } from './fixtures/base';

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
    const docButton = page.getByRole('button', { name: CONVOCATORIA_DRAFT_DOCX_BUTTON }).first();
    if (!(await expect(docButton).toBeVisible({ timeout: 15_000 }).then(() => true).catch(() => false))) {
      continue;
    }
    const convocatoriaUrl = page.url();
    const action = page.getByRole('button', { name: /Programar reunión|Abrir reunión/ }).first();
    const actionReady =
      (await expect(action).toBeVisible({ timeout: 10_000 }).then(() => true).catch(() => false)) &&
      (await expect(action).toBeEnabled({ timeout: 20_000 }).then(() => true).catch(() => false));
    if (!actionReady) {
      continue;
    }

    // Que el botón esté habilitado NO significa que la sesión se pueda abrir:
    // un expediente rectificado conserva su «Abrir reunión» pero su reunión
    // quedó CANCELADA, y el paso 1 bloquea la apertura —correctamente— con
    // «El estado actual de la reunión no permite declarar su apertura». El
    // golden path necesita una sesión abrible de verdad, así que se comprueba
    // en el propio stepper y, si no sirve, se sigue con la siguiente fila.
    // Solo se sondea «Abrir reunión»: sondear «Programar reunión» crearía
    // reuniones que luego se descartarían.
    if (/Abrir reunión/.test((await action.innerText()).trim())) {
      await action.click();
      await expect(page).toHaveURL(/\/secretaria\/reuniones\/[^/?]+/);
      await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
        timeout: 20_000,
      });
      const abrible =
        (await expect(page.getByRole('button', { name: 'Declarar apertura de la sesión' }).first())
          .toBeEnabled({ timeout: 10_000 })
          .then(() => true)
          .catch(() => false)) ||
        // Sesión ya en curso: los pasos posteriores están desbloqueados.
        (await expect(page.getByRole('button', { name: /Asistentes/ }).first())
          .toBeEnabled({ timeout: 5_000 })
          .then(() => true)
          .catch(() => false));
      if (!abrible) {
        continue;
      }
      await page.goto(convocatoriaUrl);
      await expect(page.getByRole('button', { name: 'Volver al listado' })).toBeVisible({ timeout: 15_000 });
    }

    return action;
  }

  throw new Error('No hay convocatoria demo cuya sesión se pueda abrir para el golden path.');
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
      await expect(page.getByRole('button', { name: CONVOCATORIA_DRAFT_DOCX_BUTTON })).toBeVisible();
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
      // El stepper abre en el primer paso INCOMPLETO, no en el 1. Si la reunión
      // ya está en curso —dato de demo que una ejecución anterior dejó abierto—
      // arranca en «Paso 4. Agenda y debate» y el panel de Constitución no está
      // en pantalla, así que la aserción de estado no encontraba nada y el
      // fallo parecía del producto. Se navega al paso explícitamente en vez de
      // dar por hecho dónde abre: así se juzga el panel que se quiere juzgar.
      await goStep(page, /Constitución/, /Paso 1\. Constitución/);
      // El botón nace deshabilitado hasta que resuelve la consulta de la reunión
      // (`openingAvailability` se calcula sobre datos que aún no han llegado).
      // Preguntar `isEnabled()` a bocajarro daba false en una sesión
      // perfectamente abrible —medido el 2026-09-06—, el clic no ocurría y el
      // fallo aparecía dos pasos más allá, en «Asistentes», como si el producto
      // bloqueara el paso. Se espera a que se habilite; si nunca lo hace es que
      // la sesión ya está abierta, y eso lo comprueba la aserción siguiente.
      await expect(page.getByRole('button', { name: 'Declarar apertura de la sesión' }).first())
        .toBeEnabled({ timeout: 15_000 })
        .catch(() => null);
      await clickIfVisibleAndEnabled(page, 'Declarar apertura de la sesión');
      // ITEM-146: apertura → EN_CURSO (badge "En curso"); CELEBRADA es post-cierre.
      // Se asertaba «Sesión declarada abierta|En curso|Estado actual», y
      // «Estado actual» es el rótulo FIJO de la ficha: está en pantalla con la
      // sesión abierta y sin abrir, así que la aserción no podía fallar y daba
      // por abierta una sesión que seguía convocada. Se juzga el estado, no el
      // rótulo que lo precede.
      await expect(
        page.getByText(/^(En curso|Celebrada)$/).first(),
      ).toBeVisible({ timeout: 20_000 });

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
      // La agenda es dato de la convocatoria, no del spec. `mergeMeetingAgendaSources`
      // reescribe el título con el de su fuente (`punto: source.punto || point.punto`,
      // src/lib/secretaria/meeting-agenda.ts), así que un título tecleado aquí NO
      // sobrevive a la recarga: el spec inventaba «Nombramiento de consejero por
      // cooptación», lo tecleaba dentro de un `if` que se saltaba en silencio y luego
      // lo buscaba en el paso 5, donde el producto nunca podía pintarlo. Y forzar el
      // tipo del punto 1 a «Acuerdo» habría dejado un punto decisorio sin texto
      // resolutivo, que es justo lo que deshabilita el guardado del paso.
      // El invariante que sí sostiene el producto es el ARRASTRE: el punto decisorio
      // guardado en el paso 4 es el que se somete a votación en el paso 5, con su
      // título y su clasificación. Se lee de la pantalla; no se fabrica.
      const kindSelects = page.locator('main select[title]'); // «Tipo de punto»: único select con title
      const titleInputs = page.getByPlaceholder('p.ej. Aprobación de cuentas anuales ejercicio 2025');
      // Se sondea hasta que la agenda llega: el paso monta con un punto vacío
      // (`newSessionAgendaPoint`, kind DELIBERATIVO) y lo sustituye cuando resuelve
      // `useMeetingAgendaSources`; leerlo de una sola pasada daba «sin punto
      // decisorio» de forma intermitente.
      let decisionOrdinal = 0;
      await expect
        .poll(
          async () => {
            decisionOrdinal = 0;
            const count = await kindSelects.count();
            for (let index = 0; index < count; index += 1) {
              if ((await kindSelects.nth(index).inputValue()) !== 'DECISORIO') continue;
              decisionOrdinal = index + 1;
              break;
            }
            return decisionOrdinal;
          },
          { timeout: 20_000, message: 'el golden path necesita un punto decisorio en la agenda para votarlo' },
        )
        .toBeGreaterThan(0);
      const decisionTitle = (await titleInputs.nth(decisionOrdinal - 1).inputValue()).trim();
      expect(decisionTitle, 'el punto decisorio de la agenda debe llegar con título').not.toBe('');

      // «Guardar debates» persiste las CONSTANCIAS de los puntos no decisorios,
      // y sin ellas el acta es inalcanzable («every non-decision point requires
      // a persisted constancia»). Hasta el 2026-09-06 este clic abortaba en una
      // reunión nacida de convocatoria EMITIDA porque `handleSave` emitía un
      // UPDATE sobre `agenda_items` que la BD rechaza (AGENDA_EMITIDA_RPC_REQUIRED)
      // ANTES de guardar las constancias; hoy el producto no intenta reescribir
      // la agenda inmutable y guarda debate y constancias. Se exige el toast de
      // éxito literal: una pantalla que falle en silencio no lo satisface.
      const saveDebates = page.getByRole('button', { name: 'Guardar debates' });
      await expect(saveDebates).toBeEnabled({ timeout: 10_000 });
      await saveDebates.click();
      await expect(page.getByText('Agenda, debate y constancias guardados').first()).toBeVisible({
        timeout: 20_000,
      });
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
        timeout: 20_000,
      });

      await goStep(page, /Votaciones/, /Paso 5\. Votaciones/);
      // Tras la recarga (estado en memoria del paso 4 descartado), el punto
      // decisorio de la agenda llega al carril de votación con el mismo ordinal, el
      // mismo título y su clasificación materia · clase · origen resuelta por el
      // motor.
      await page.getByRole('button', { name: new RegExp(`^Punto ${decisionOrdinal}\\b`) }).first().click();
      await expect(page.getByText(decisionTitle).first()).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByText(/ · (ORDINARIA|ESTATUTARIA|ESTRUCTURAL|ESPECIAL) · /).first(),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Evaluación de adopción por punto')).toBeVisible({ timeout: 20_000 });
      // Rótulos vigentes del producto (ReunionStepper.tsx): el botón dice «votación
      // del acuerdo», no «resolución», y el estado de ya-registrado dice «acuerdos ya
      // están votados y registrados». Con los literales antiguos el `if` no
      // encontraba el botón, caía siempre al `else` y juzgaba una pantalla que no era
      // la que había delante.
      const saveResolutionButton = page
        .getByRole('button', { name: /(Registrar|Recalcular) votación del acuerdo y crear expediente Acuerdo 360/ })
        .first();
      if (await saveResolutionButton.isVisible().catch(() => false)) {
        await ensureAllVisibleVotesFavor(page);
        await expect(saveResolutionButton).toBeEnabled({ timeout: 20_000 });
        await saveResolutionButton.click();
      }
      // Los tres desenlaces posibles del paso, sin rama muda: votación registrada,
      // votación ya registrada de una pasada anterior, o snapshot-only del prototipo.
      await expect(
        page
          .getByText(
            /acuerdo\(s\) votado\(s\) y registrado\(s\)|ya están votados y registrados|Snapshot legal actualizado/i,
          )
          .first(),
      ).toBeVisible({ timeout: 30_000 });
    });

    await test.step('acta y certificación', async () => {
      await goStep(page, /Cierre/, /Paso 6\. Cierre/);
      const existingMinuteButton = page.getByRole('button', { name: 'Ver acta existente' });
      if (await expect(existingMinuteButton).toBeVisible({ timeout: 5_000 }).then(() => true).catch(() => false)) {
        await existingMinuteButton.click();
      } else {
        // Este botón ESTABA deshabilitado para siempre en el camino que nace de
        // una convocatoria y hoy ya se habilita: la votación vuelve a llegar al
        // acta (`patchQuorumDataSourceLinks` deja intacto el vínculo explícito,
        // y `loadActaAgendaContract` completa el espejo perdido con el snapshot
        // autoritativo de `agreements.compliance_snapshot`).
        //
        // Lo que sigue en pie —medido el 2026-09-06 y NO tapado aquí— es la
        // GENERACIÓN: `fn_secretaria_close_meeting_and_generate_minute` responde
        // «annual accounts gate: current set is absent or not APPROVED/IMMUTABLE».
        // No es un defecto: la versión de cuentas que se somete al Consejo debe
        // fijarse ANTES del inicio previsto (`fn_secretaria_fix_annual_accounts_set`
        // exige `status IN (DRAFT, CONVOCADA)` y `scheduled_start > now()`), y en
        // las convocatorias demo de ARGA con punto de formulación esa versión no
        // se fijó a tiempo; sus fechas ya pasaron, así que no hay actuación en la
        // aplicación que lo repare. El acta de esos expedientes es inalcanzable
        // POR DISEÑO, y este spec lo deja fallar aquí en vez de esconderlo.
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
