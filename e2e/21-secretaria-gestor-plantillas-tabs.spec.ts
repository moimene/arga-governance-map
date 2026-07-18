import { test, expect } from "./fixtures/base";
import { readFile } from "node:fs/promises";

/**
 * Validamos las tabs READ_ROLES (Salud documental, Catálogo gobernado,
 * Cobertura por materia y órgano, Indicadores de ciclo de vida y Auditoría y
 * changelog) que son siempre visibles para SECRETARIO/COMPLIANCE/
 * ADMIN_TENANT. El usuario demo del fixture (`demo@arga-seguros.com`)
 * tiene rol SECRETARIO en Cloud, por lo que NO ve Importar/Validación
 * (esas son WRITE_ROLES, solo ADMIN_TENANT). La cobertura de
 * ADMIN_TENANT requiere fixtures de usuarios adicionales y queda fuera de
 * scope del Commit 5.
 */
const READ_TAB_LABELS = [
  "Salud documental",
  "Catálogo gobernado",
  "Cobertura por materia y órgano",
  "Indicadores de ciclo de vida",
  "Auditoría e historial de cambios",
];

test.describe("Gestor de Plantillas — consola unificada (tabs)", () => {
  test("usuario demo (SECRETARIO) ve las 5 pestañas de lectura", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas");
    await expect(
      page.getByRole("heading", { name: "Gobierno de plantillas" }),
    ).toBeVisible({ timeout: 15_000 });

    for (const label of READ_TAB_LABELS) {
      await expect(
        page.getByRole("tab", { name: label }),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("clic en tab cambia ?tab y mantiene replace history", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas");
    await expect(
      page.getByRole("heading", { name: "Gobierno de plantillas" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("tab", { name: "Catálogo gobernado" }).click();
    await expect(page).toHaveURL(/\?tab=catalogo$/);
    await expect(page.getByRole("tab", { name: "Catálogo gobernado" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByRole("tab", { name: "Auditoría e historial de cambios" }).click();
    await expect(page).toHaveURL(/\?tab=auditoria$/);
    await expect(page.getByRole("tab", { name: "Auditoría e historial de cambios" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("query param inicial preselecciona la tab", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas?tab=cobertura");
    await expect(
      page.getByRole("heading", { name: "Gobierno de plantillas" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("tab", { name: "Cobertura por materia y órgano" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("flechas y Home/End recorren las pestañas sin sacar el foco del tablist", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas?tab=dashboard");
    const salud = page.getByRole("tab", { name: "Salud documental" });
    const catalogo = page.getByRole("tab", { name: "Catálogo gobernado" });
    const auditoria = page.getByRole("tab", { name: "Auditoría e historial de cambios" });

    await salud.focus();
    await page.keyboard.press("ArrowRight");
    await expect(catalogo).toBeFocused();
    await expect(catalogo).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/\?tab=catalogo$/);

    await page.keyboard.press("End");
    await expect(auditoria).toBeFocused();
    await expect(auditoria).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Home");
    await expect(salud).toBeFocused();
    await expect(salud).toHaveAttribute("aria-selected", "true");
  });

  test("Auditoría descarga exactamente el changelog filtrado y las plantillas sin changelog", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas?tab=auditoria");
    await expect(
      page.getByRole("heading", { name: "Gobierno de plantillas" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "Auditoría e historial de cambios" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByText("CSV de trabajo; el historial disponible es incompleto.").first(),
    ).toBeVisible();

    const orphanRegion = page.getByRole("region", { name: "Plantillas sin historial de cambios" });
    const orphanHeading = orphanRegion.getByRole("heading", {
      name: /Plantillas sin historial de cambios \(\d+\)/,
    });
    const orphanButton = orphanRegion.getByRole("button", {
      name: "Exportar plantillas sin historial",
    });
    await expect(orphanButton).toBeEnabled({ timeout: 15_000 });
    const orphanHeadingText = await orphanHeading.textContent();
    const orphanCount = Number(orphanHeadingText?.match(/\((\d+)\)/)?.[1] ?? "0");
    expect(orphanCount).toBeGreaterThan(0);
    const restWrites: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().includes("/rest/v1/")
        && !["GET", "HEAD", "OPTIONS"].includes(request.method())
      ) {
        restWrites.push(`${request.method()} ${request.url()}`);
      }
    });
    const [orphanDownload] = await Promise.all([
      page.waitForEvent("download"),
      orphanButton.click(),
    ]);
    expect(orphanDownload.suggestedFilename()).toMatch(
      /^secretaria-plantillas-sin-changelog-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const orphanPath = await orphanDownload.path();
    expect(orphanPath).toBeTruthy();
    const orphanCsv = await readFile(orphanPath!, "utf8");
    expect(orphanCsv.startsWith("\uFEFFID plantilla;Tipo (raw);Tipo;Materia (raw);Materia;"))
      .toBe(true);
    const orphanIds = Array.from(
      orphanCsv.matchAll(
        /\r\n([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12});/g,
      ),
      (match) => match[1],
    );
    expect(orphanIds).toHaveLength(orphanCount);
    await expect(orphanRegion).toContainText(
      `Se han exportado ${orphanCount} plantillas sin historial de cambios.`,
    );

    const changelogHeading = page.getByRole("heading", {
      name: /Historial de cambios reciente \(\d+ de \d+\)/,
    });
    const changelogButton = page.getByRole("button", {
      name: "Exportar historial de cambios filtrado",
    });
    await expect(changelogButton).toBeEnabled({ timeout: 15_000 });
    const changelogRegion = page.getByRole("region", {
      name: "Entradas del historial de cambios de plantillas",
    });
    const visibleIdPrefix = (
      await changelogRegion.getByRole("row").nth(1).getByRole("cell").first().textContent()
    )?.trim();
    expect(visibleIdPrefix).toMatch(/^[0-9a-f]{8}$/);
    await page.getByLabel("Plantilla (id parcial)").fill(visibleIdPrefix!);
    await expect(changelogHeading).toHaveText(/Historial de cambios reciente \(1 de \d+\)/);
    const changelogHeadingText = await changelogHeading.textContent();
    const changelogCount = Number(changelogHeadingText?.match(/\((\d+) de/)?.[1] ?? "0");
    expect(changelogCount).toBeGreaterThan(0);
    const [changelogDownload] = await Promise.all([
      page.waitForEvent("download"),
      changelogButton.click(),
    ]);
    expect(changelogDownload.suggestedFilename()).toMatch(
      /^secretaria-changelog-filtrado-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const changelogPath = await changelogDownload.path();
    expect(changelogPath).toBeTruthy();
    const changelogCsv = await readFile(changelogPath!, "utf8");
    expect(changelogCsv.startsWith("\uFEFFID plantilla;Tipo de cambio (raw);Tipo de cambio;"))
      .toBe(true);
    const changelogIds = Array.from(
      changelogCsv.matchAll(
        /\r\n([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12});/g,
      ),
      (match) => match[1],
    );
    expect(changelogIds).toHaveLength(changelogCount);
    expect(changelogIds.every((id) => id.startsWith(visibleIdPrefix!))).toBe(true);
    await expect(page.locator("body")).toContainText(
      changelogCount === 1
        ? "Se ha exportado 1 entrada del historial de cambios filtrado."
        : `Se han exportado ${changelogCount} entradas del historial de cambios filtrado.`,
    );
    expect(restWrites).toEqual([]);
  });

  test("a 390 px mantiene targets de 44 px y el overflow dentro del tablist", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/secretaria/gestor-plantillas?tab=dashboard");

    const salud = page.getByRole("tab", { name: "Salud documental" });
    await expect(salud).toBeVisible({ timeout: 15_000 });
    const box = await salud.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    const hasGlobalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasGlobalOverflow).toBe(false);

    await page.goto("/secretaria/gestor-plantillas?tab=auditoria");
    const exportButtons = [
      page.getByRole("button", { name: "Exportar plantillas sin historial" }),
      page.getByRole("button", { name: "Exportar historial de cambios filtrado" }),
    ];
    for (const button of exportButtons) {
      await expect(button).toBeVisible({ timeout: 15_000 });
      const exportBox = await button.boundingBox();
      expect(exportBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const auditHasGlobalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(auditHasGlobalOverflow).toBe(false);
  });
});
