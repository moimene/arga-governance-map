import { test, expect } from "./fixtures/base";

/**
 * Validamos las tabs READ_ROLES (Dashboard, Catálogo, Cobertura legal,
 * Métricas, Auditoría) que son siempre visibles para SECRETARIO/COMPLIANCE/
 * ADMIN_TENANT. El usuario demo del fixture (`demo@arga-seguros.com`)
 * tiene rol SECRETARIO en Cloud, por lo que NO ve Importar/Validación
 * (esas son WRITE_ROLES, solo ADMIN_TENANT). La cobertura de
 * ADMIN_TENANT requiere fixtures de usuarios adicionales y queda fuera de
 * scope del Commit 5.
 */
const READ_TAB_LABELS = [
  "Dashboard",
  "Catálogo",
  "Cobertura legal",
  "Métricas",
  "Auditoría",
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

    await page.getByRole("tab", { name: "Catálogo" }).click();
    await expect(page).toHaveURL(/\?tab=catalogo$/);
    await expect(page.getByRole("tab", { name: "Catálogo" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByRole("tab", { name: "Auditoría" }).click();
    await expect(page).toHaveURL(/\?tab=auditoria$/);
    await expect(page.getByRole("tab", { name: "Auditoría" })).toHaveAttribute(
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
      page.getByRole("tab", { name: "Cobertura legal" }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
