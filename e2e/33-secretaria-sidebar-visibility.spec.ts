import { test, expect } from "./fixtures/base";

/**
 * Taxonomía sidebar Secretaría — versión 2026-05-12.
 * Verifica que:
 *  - Las secciones del modo sociedad muestren los labels nuevos.
 *  - En SA + CDA (ARGA Seguros) los flujos colegiados están visibles
 *    y Decisiones unipersonales NO aparece (ni en la sección Expedientes).
 *  - El CTA "Sin sesión (unanimidad)" sigue activo en AcuerdosSinSesion.
 *  - Los deep links legacy siguen funcionando tras el rename del item
 *    Calendario → Procesos.
 */

test.describe("Secretaría sidebar — nueva taxonomía + visibilidad por contexto", () => {
  test("modo sociedad muestra CONTEXTO/EXPEDIENTES/REGISTRO/CONFIGURACIÓN Y REGLAS", async ({ page }) => {
    await page.goto("/secretaria");

    // Forzar modo sociedad seleccionando ARGA Seguros
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

    // Esperar a que el sidebar termine de hidratarse
    await expect(page.locator('[data-sidebar-section="Contexto"]').first()).toBeVisible({ timeout: 10_000 });

    // Las 4 secciones de la nueva taxonomía deben estar presentes
    await expect(page.locator('[data-sidebar-section="Contexto"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-section="Expedientes"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-section="Registro"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-section="Configuración y reglas"]').first()).toBeVisible();
  });

  test("ARGA (SA + CDA) muestra flujos colegiados y oculta Decisiones unipersonales", async ({ page }) => {
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
    await sociedadSelect.selectOption(sociedadValue!);

    // CDA: Convocatorias, Reuniones, Actas, Acuerdos sin sesión visibles
    await expect(page.locator('[data-sidebar-item="Convocatorias"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-sidebar-item="Reuniones"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Actas"]').first()).toBeVisible();
    await expect(page.locator('[data-sidebar-item="Acuerdos sin sesión"]').first()).toBeVisible();
    // ARGA Seguros NO tiene admin único → Decisiones unipersonales oculto en sociedad mode
    await expect(page.locator('[data-sidebar-item="Decisiones unipersonales"]')).toHaveCount(0);
  });

  test("item Procesos navega a /secretaria/calendario (deep link legacy intacto)", async ({ page }) => {
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
    await sociedadSelect.selectOption(sociedadValue!);

    await expect(page.locator('[data-sidebar-item="Procesos"]').first()).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-sidebar-item="Procesos"]').first().click();
    await expect(page).toHaveURL(/\/secretaria\/calendario/);
    await expect(page.locator("main").getByRole("heading", { name: "Calendario de vencimientos", exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("AcuerdosSinSesion: CTA Sin sesión (unanimidad) presente para ARGA (CDA)", async ({ page }) => {
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
    await sociedadSelect.selectOption(sociedadValue!);

    await page.locator('[data-sidebar-item="Acuerdos sin sesión"]').first().click();
    await expect(page).toHaveURL(/\/secretaria\/acuerdos-sin-sesion/);

    // Sin sesión SIEMPRE visible para CDA. CO_APROBACION y SOLIDARIO ocultos
    // (ARGA no es ADMIN_MANCOMUNADO ni ADMIN_SOLIDARIO).
    await expect(page.locator('[data-cta="no-session"]')).toBeVisible();
    await expect(page.locator('[data-cta="co-aprobacion"]')).toHaveCount(0);
    await expect(page.locator('[data-cta="solidario"]')).toHaveCount(0);
  });
});
