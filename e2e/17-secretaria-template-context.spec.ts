import { test, expect } from './fixtures/base';

test.describe('Secretaría — consumo contextual de plantillas', () => {
  test('desde gestor expone una plantilla usable y abre el flujo con contexto de plantilla', async ({ page }) => {
    const fixtureTemplateId = 'legal-fixture-documento-registral-es';

    await page.goto('/secretaria/gestor-plantillas');
    await expect(page.getByRole('heading', { name: /Plantillas con contenido jur[ií]dico/i })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('searchbox', { name: 'Buscar' }).fill('Documento registral');
    await page.getByRole('button', { name: /Documento registral/i }).first().click();

    const useTemplateButton = page.getByRole('button', { name: /Elegir tr[aá]mite/i });
    await expect(useTemplateButton).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Fixture local no persistido/i).first()).toBeVisible();

    await useTemplateButton.click();
    await expect(page).toHaveURL(new RegExp(`/secretaria/tramitador\\?plantilla=${fixtureTemplateId}&tipo=DOCUMENTO_REGISTRAL`));

    // The registry list preserves the chosen template in the URL; the contextual
    // stepper is the current fallback entrypoint for asserting the template state.
    await page.goto(`/secretaria/tramitador/nuevo?materia=APROBACION_CUENTAS&plantilla=${fixtureTemplateId}`);

    await expect(page.getByText(/Entrada desde plantilla/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/para materia/i)).toBeVisible();
    await expect(page.getByText('APROBACION_CUENTAS', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/plantilla\s+legal-fi/i)).toBeVisible();
  });

  test('gestor muestra panel de revisión legal sin persistir cambios', async ({ page }) => {
    await page.goto('/secretaria/gestor-plantillas');

    await expect(page.getByRole('heading', { name: /Plantillas con contenido jur[ií]dico/i })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByText(/Panel de revisi[oó]n legal/i)).toBeVisible();
    await expect(page.getByText(/Activa operativa frente a aprobada legalmente/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Revisi[oó]n legal/i })).toBeVisible();

    await page.getByRole('combobox', { name: /Revisi[oó]n legal/i }).selectOption('LOCAL_FIXTURE');
    await page.getByRole('searchbox', { name: 'Buscar' }).fill('Documento registral');
    await page.getByRole('button', { name: /Documento registral/i }).first().click();

    await expect(page.getByText(/Fixture local no persistido/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Capa 1.*Contenido inmutable/i })).toBeVisible();
    await page.getByRole('button', { name: /Capa 2.*Variables del motor/i }).click();
    await expect(page.getByText('{{denominacion_social}}').first()).toBeVisible();
  });
});
