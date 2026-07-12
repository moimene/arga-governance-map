import { test, expect } from './fixtures/base';

test.describe('Secretaría — consumo contextual de plantillas', () => {
  test('desde gestor expone una plantilla usable y abre el flujo con contexto de plantilla', async ({ page }) => {
    const fixtureTemplateId = 'legal-fixture-documento-registral-es';

    await page.goto('/secretaria/gestor-plantillas?scope=grupo');
    await expect(page.getByRole('heading', { name: 'Gobierno de plantillas' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('tab', { name: 'Catálogo gobernado' }).click();
    await expect(page.getByText('Catálogo de plantillas protegidas')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('combobox', { name: /Revisi[oó]n legal/i }).selectOption('LOCAL_FIXTURE');
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('Documento registral');
    await page.getByRole('button', { name: /Documento registral/i }).first().click();

    const useTemplateButton = page.getByRole('button', { name: /Elegir tr[aá]mite/i });
    await expect(useTemplateButton).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Fixture local no persistido/i).first()).toBeVisible();
    await expect(page.getByText('Fixture local · puente de cobertura').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver en catálogo de uso' })).toHaveCount(0);
    await expect(page.getByText(/No aparece en el catálogo de uso/i)).toBeVisible();

    await useTemplateButton.click();
    await expect(page).toHaveURL(new RegExp(`/secretaria/tramitador\\?plantilla=${fixtureTemplateId}&tipo=DOCUMENTO_REGISTRAL&scope=grupo`));

    await page.getByRole('button', { name: 'Iniciar desde acuerdo' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/secretaria/tramitador/nuevo\\?plantilla=${fixtureTemplateId}&tipo=DOCUMENTO_REGISTRAL&scope=grupo`),
    );

    await expect(page.getByText(/Entrada desde plantilla/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/plantilla\s+legal-fi/i)).toBeVisible();
  });

  test('gestor muestra panel de revisión legal sin persistir cambios', async ({ page }) => {
    await page.goto('/secretaria/gestor-plantillas');

    await expect(page.getByRole('heading', { name: 'Gobierno de plantillas' })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('tab', { name: 'Catálogo gobernado' }).click();
    await expect(page.getByText('Catálogo de plantillas protegidas')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('combobox', { name: /Revisi[oó]n legal/i })).toBeVisible();

    await page.getByRole('combobox', { name: /Revisi[oó]n legal/i }).selectOption('LOCAL_FIXTURE');
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('Documento registral');
    await page.getByRole('button', { name: /Documento registral/i }).first().click();

    await expect(page.getByText(/Fixture local no persistido/i).first()).toBeVisible();
    await expect(page.getByText(/Revisi[oó]n legal/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vista legal' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /Capa 1.*Texto jur[ií]dico y variables/i })).toBeVisible();
    await page.getByRole('button', { name: /Capa 2.*Variables autom[aá]ticas/i }).click();
    await expect(page.getByRole('columnheader', { name: 'Uso en el texto' })).toBeVisible();
    await expect(page.getByText('denominacion_social').first()).toBeVisible();

    await page.getByRole('button', { name: 'Vista técnica' }).click();
    await expect(page).toHaveURL(/modo=tecnica/);
    await expect(page.getByRole('button', { name: 'Vista técnica' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Editor de contenido capa 1')).toBeVisible();
  });

  test('deep-links de plantilla inexistente conservan el contexto y ofrecen recuperación', async ({ page }) => {
    const entityId = '6d7ed736-f263-4531-a59d-c6ca0cd41602';
    const missingTemplate = 'template-does-not-exist';

    await page.goto(
      `/secretaria/gestor-plantillas?tab=catalogo&plantilla=${missingTemplate}&estado=ACTIVA&scope=sociedad&entity=${entityId}`,
    );
    await expect(
      page.getByText('No se ha encontrado la plantilla solicitada en este ámbito.'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp(`plantilla=${missingTemplate}`));
    await page.getByRole('button', { name: 'Mostrar plantillas disponibles' }).click();
    await expect(page).not.toHaveURL(/plantilla=template-does-not-exist/);
    await expect(page).toHaveURL(new RegExp(`scope=sociedad.*entity=${entityId}`));

    await page.goto(
      `/secretaria/plantillas?plantilla=${missingTemplate}&ciclo=vigentes&scope=sociedad&entity=${entityId}`,
    );
    await expect(
      page.getByText('No se ha encontrado la plantilla solicitada en este ámbito.'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp(`plantilla=${missingTemplate}`));
    await page.getByRole('button', { name: 'Mostrar plantillas disponibles' }).click();
    await expect(page).not.toHaveURL(/plantilla=template-does-not-exist/);
    await expect(page).toHaveURL(new RegExp(`scope=sociedad.*entity=${entityId}`));
  });

  test('la materia deep-linked se presenta como contexto jurídico separado de la búsqueda libre', async ({ page }) => {
    await page.goto('/secretaria/gestor-plantillas?tab=catalogo&materia=DISOLUCION&estado=ACTIVA&scope=grupo');

    await expect(page.getByText('Materia: Disolución')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('');
    await expect(page).toHaveURL(/materia=DISOLUCION/);

    await page.getByRole('searchbox', { name: 'Buscar' }).fill('LSC');
    await expect(page).toHaveURL(/q=LSC/);
    await expect(page).toHaveURL(/materia=DISOLUCION/);
  });

  test('un deep-link histórico expande su familia y revela la fila exacta dentro del catálogo agrupado', async ({ page }) => {
    const templateId = '1b1118a6-577d-45ed-96ee-77be89358aa0';
    await page.goto(`/secretaria/gestor-plantillas?tab=catalogo&plantilla=${templateId}&estado=ARCHIVADA&scope=grupo`);

    const list = page.getByLabel('Plantillas agrupadas por tipo, materia y variante jurídica');
    const selected = list.locator('button[aria-pressed="true"]');
    await expect(selected).toHaveCount(1, { timeout: 10_000 });
    await expect(selected).toBeVisible();
    await expect(selected).toContainText('Versión 1.2.0');
    await expect(selected).toContainText('Archivada');
    await expect(page).toHaveURL(new RegExp(`plantilla=${templateId}.*estado=ARCHIVADA`));

    const geometry = await page.evaluate(() => {
      const container = document.querySelector('[aria-label="Plantillas agrupadas por tipo, materia y variante jurídica"]');
      const row = container?.querySelector('button[aria-pressed="true"]');
      if (!container || !row) return null;
      const containerRect = container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      return {
        topVisible: rowRect.top >= containerRect.top - 1,
        bottomVisible: rowRect.bottom <= containerRect.bottom + 1,
      };
    });
    expect(geometry).toEqual({ topVisible: true, bottomVisible: true });
  });
});
