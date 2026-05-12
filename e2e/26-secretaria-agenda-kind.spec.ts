import { test, expect } from "./fixtures/base";

/**
 * R12 regression smoke for v1.3 agenda_item.kind infrastructure.
 *
 * Verifies the secretaria module renders correctly with new infrastructure
 * deployed (5 triggers + audit log + hooks + UI changes) when no user has
 * yet exercised reclassification.
 *
 * Contract:
 * - convocatorias listing renders with H1 visible and no page errors.
 * - reuniones listing renders with H1 visible and no page errors.
 * - No snapshot assertions (avoids baseline-file maintenance burden).
 * - Uses pageerror listener + networkidle + heading visibility + DOM text smell tests.
 *
 * Auth: relies on shared storageState (.auth/session.json) seeded by auth.setup.ts,
 * the same pattern used by every other spec under e2e/. Do NOT call /login here.
 *
 * Deferred tests (v1.4):
 * - kind chips per agenda item on reunion detail view
 * - kind selector on convocatoria stepper agenda items step
 */
test.describe("agenda_item.kind v1.3 — regression smoke", () => {
  test("convocatorias listing renders without errors after kind infra deployed", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/secretaria/convocatorias");
    await expect(page).not.toHaveURL("/login");
    await expect(page.getByRole("heading", { name: /convocatorias/i })).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);

    const main = page.locator("main").first();
    const bodyText = (await main.textContent()) ?? "";
    expect(bodyText).not.toMatch(/\bError\b.*loading|TypeError|\[object Object\]|\bundefined\b\s*</i);
  });

  test("reuniones listing renders without errors after kind infra deployed", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/secretaria/reuniones");
    await expect(page).not.toHaveURL("/login");
    await expect(page.getByRole("heading", { name: /reuniones/i })).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);

    const main = page.locator("main").first();
    const bodyText = (await main.textContent()) ?? "";
    expect(bodyText).not.toMatch(/\bError\b.*loading|TypeError|\[object Object\]|\bundefined\b\s*</i);
  });

  test.skip("reuniones detail shows kind chips per agenda item (post seed mixed)", async () => {
    // Posterga: requiere navegar a una reunión específica del seed mixto.
    // Validar manualmente con datos demo: reunión c3305c16-... tiene 4 INFO/2 DELIB/3 DECIS chips.
  });

  test.skip("convocatoria stepper offers kind selector in agenda items step", async () => {
    // Posterga: requiere completar el flujo de stepper hasta el paso "Orden del día".
    // Validar manualmente: aparecen 3 botones radio (Informativo/Deliberativo/Decisorio).
  });
});
