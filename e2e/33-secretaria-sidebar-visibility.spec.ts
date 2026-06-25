import { test, expect } from "./fixtures/base";

/**
 * IA Secretaría — contrato canónico.
 * Verifica que el lateral mantiene la secuencia:
 *   Acuerdo → Adopción → Documentación → Registro público → Libros
 * y que los accesos documentales son bandejas/vistas filtradas, no formularios
 * libres de acta, certificación o tramitación.
 */

async function selectArgaSociedad(page) {
  await page.goto("/secretaria");
  await page.getByRole("button", { name: "Sociedad", exact: true }).click();

  const sociedadSelect = page.getByLabel("Sociedad seleccionada");
  await expect(sociedadSelect).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => sociedadSelect.locator("option").count()).toBeGreaterThan(1);

  const sociedadValue = await sociedadSelect.evaluate((select) => {
    const options = Array.from((select as HTMLSelectElement).options);
    return (
      options.find((option) => option.textContent?.includes("ARGA Seguros, S.A."))?.value ?? options[1]?.value
    );
  });

  expect(sociedadValue).toBeTruthy();
  await sociedadSelect.selectOption(sociedadValue!);
  await expect(page.locator('[data-sidebar-section="Inicio"]').first()).toBeVisible({ timeout: 10_000 });
}

test.describe("Secretaría sidebar — IA canónica + visibilidad por contexto", () => {
  test("modo sociedad muestra las secciones del contrato canónico", async ({ page }) => {
    await selectArgaSociedad(page);

    for (const section of [
      "Inicio",
      "Adopción",
      "Documentación",
      "Registro público",
      "Libros y registros sociales",
      "Sociedades y personas",
      "Configuración y reglas",
    ]) {
      await expect(page.locator(`[data-sidebar-section="${section}"]`).first()).toBeVisible();
    }

    await expect(page.locator('[data-sidebar-item="Materias y reglas"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Catálogo de órganos"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Gestor de Reglas"]')).toHaveCount(0);
  });

  test("ARGA (SA + CDA) muestra flujos colegiados y oculta Decisiones unipersonales", async ({ page }) => {
    await selectArgaSociedad(page);

    await expect(page.locator('[data-sidebar-item="Convocatorias"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Reuniones"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Acuerdos sin sesión"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Actas"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Actas pendientes"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Certificaciones de acuerdos"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Tramitador registral"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Subsanaciones"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Libro de socios"]').first()).toBeVisible();

    await expect(page.locator('[data-sidebar-item="Decisiones unipersonales"]')).toHaveCount(0);
  });

  test("Documentación usa bandejas de origen trazable, no alta libre de acta/certificación", async ({ page }) => {
    await selectArgaSociedad(page);

    await page.locator('[data-sidebar-item="Actas pendientes"]').first().click();
    await expect(page).toHaveURL(/\/secretaria\/actas\?.*vista=pendientes/);
    await expect(page.getByText("Actas pendientes de origen trazable")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Esta bandeja no crea actas libres.")).toBeVisible();

    await page.locator('[data-sidebar-item="Certificaciones de acuerdos"]').first().click();
    await expect(page).toHaveURL(/\/secretaria\/actas\?.*vista=certificaciones/);
    await expect(page.getByRole("heading", { name: "Actas y certificaciones vinculadas" })).toBeVisible();

    await expect(page.locator('a[href*="/secretaria/actas/generar"]')).toHaveCount(0);
    await expect(page.locator('a[href*="/secretaria/certificaciones/nueva"]')).toHaveCount(0);
    await expect(page.locator('a[href*="/secretaria/tramitaciones/nueva"]')).toHaveCount(0);
  });

  test("Registro público navega a vistas filtradas del tramitador", async ({ page }) => {
    await selectArgaSociedad(page);

    await page.locator('[data-sidebar-item="Subsanaciones"]').first().click();
    await expect(page).toHaveURL(/\/secretaria\/tramitador\?.*estado=SUBSANACION/);
    await expect(page.getByRole("button", { name: "Subsanaciones" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Iniciar desde acuerdo" })).toBeVisible();

    await page.locator('[data-sidebar-item="Presentaciones registrales"]').first().click();
    await expect(page).toHaveURL(/\/secretaria\/tramitador\?.*estado=PRESENTADA/);
    await expect(page.getByRole("button", { name: "Presentaciones registrales" })).toHaveAttribute("aria-pressed", "true");
  });

  test("item Procesos navega a /secretaria/calendario (deep link legacy intacto)", async ({ page }) => {
    await selectArgaSociedad(page);

    await expect(page.locator('[data-sidebar-item="Procesos"]').first()).toBeVisible();
    await page.locator('[data-sidebar-item="Procesos"]').first().click();
    await expect(page).toHaveURL(/\/secretaria\/calendario/);
    await expect(page.locator("main").getByRole("heading", { name: "Calendario de vencimientos", exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("AcuerdosSinSesion: CTA Sin sesión (unanimidad) presente para ARGA (CDA)", async ({ page }) => {
    await selectArgaSociedad(page);

    await page.locator('[data-sidebar-item="Acuerdos sin sesión"]').first().click();
    await expect(page).toHaveURL(/\/secretaria\/acuerdos-sin-sesion/);

    await expect(page.locator('[data-cta="no-session"]')).toBeVisible();
    await expect(page.locator('[data-cta="co-aprobacion"]')).toHaveCount(0);
    await expect(page.locator('[data-cta="solidario"]')).toHaveCount(0);
  });
});
