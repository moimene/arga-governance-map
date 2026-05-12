import { test, expect } from "./fixtures/base";

/**
 * RBAC smoke test del Gestor de Plantillas.
 *
 * El fixture de auth (`demo@arga-seguros.com`) tiene rol SECRETARIO en
 * Cloud — es decir, READ_ROLES pero NO WRITE_ROLES. Validamos que:
 *
 * 1. La consola carga y se ve el shell completo.
 * 2. SECRETARIO NO ve las tabs de escritura (Importar / Validación).
 * 3. Al pedir una tab inválida o sin permisos, el shell redirige a
 *    Dashboard sin romper la app.
 *
 * La cobertura RBAC completa (ADMIN_TENANT, COMPLIANCE) requiere
 * fixtures de usuarios adicionales y queda fuera de scope del Commit 5
 * del Sprint 1.
 */
test.describe("Gestor de Plantillas — RBAC smoke", () => {
  test("la consola carga para el rol del fixture", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas");
    await expect(
      page.getByRole("heading", { name: "Gestor de Plantillas" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "Dashboard" })).toBeVisible();
  });

  test("SECRETARIO no ve tabs de escritura (Importar/Validación)", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas");
    await expect(
      page.getByRole("heading", { name: "Gestor de Plantillas" }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole("tab", { name: "Importar" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Validación" })).toHaveCount(0);
  });

  test("tab inválida en ?tab cae al Dashboard sin romper", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas?tab=no-existe");
    await expect(
      page.getByRole("heading", { name: "Gestor de Plantillas" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "Dashboard" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("tab sin permisos en ?tab redirige a Dashboard", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas?tab=importar");
    await expect(
      page.getByRole("heading", { name: "Gestor de Plantillas" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\?tab=dashboard$/, { timeout: 10_000 });
  });
});
