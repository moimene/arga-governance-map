import { test, expect } from "./fixtures/base";

test.describe("Gestor de Plantillas — redirect de tracker legacy", () => {
  test("/secretaria/plantillas-tracker redirige a ?tab=metricas", async ({ page }) => {
    await page.goto("/secretaria/plantillas-tracker");
    await expect(page).toHaveURL(/\/secretaria\/gestor-plantillas\?tab=metricas$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { name: "Gobierno de plantillas" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "Métricas" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
