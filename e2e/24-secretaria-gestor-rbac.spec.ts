import { test, expect } from "./fixtures/base";

/**
 * RBAC smoke test del Gestor de Plantillas.
 *
 * El fixture de auth (`demo@arga-seguros.com`) tiene rol SECRETARIO en
 * Cloud — es decir, READ_ROLES pero NO WRITE_ROLES. Validamos que:
 *
 * 1. La consola carga y se ve el shell completo.
 * 2. SECRETARIO NO ve las tabs de escritura (Importar / Comprobación documental).
 * 3. Al pedir una tab inválida o sin permisos, el shell redirige a
 *    Salud documental sin romper la app.
 *
 * La cobertura RBAC completa (ADMIN_TENANT, COMPLIANCE) requiere
 * fixtures de usuarios adicionales y queda fuera de scope del Commit 5
 * del Sprint 1.
 */
test.describe("Gestor de Plantillas — RBAC smoke", () => {
  test("la consola carga para el rol del fixture", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas");
    await expect(
      page.getByRole("heading", { name: "Gobierno de plantillas" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "Salud documental" })).toBeVisible();
  });

  test("SECRETARIO no ve tabs de escritura (Importar/Comprobación documental)", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas");
    await expect(
      page.getByRole("heading", { name: "Gobierno de plantillas" }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole("tab", { name: "Importar" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Comprobación documental" })).toHaveCount(0);
  });

  test("tab inválida en ?tab cae a Salud documental y canonicaliza la URL", async ({ page }) => {
    await page.goto("/secretaria/gestor-plantillas?tab=no-existe");
    await expect(
      page.getByRole("heading", { name: "Gobierno de plantillas" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "Salud documental" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page).toHaveURL(/\?tab=dashboard$/, { timeout: 10_000 });
  });

  test("no monta ningún panel protegido mientras resuelve RBAC y después redirige", async ({ page }) => {
    const cases = [
      {
        tab: "importar",
        protectedContent: page.getByRole("heading", { name: "Importar plantilla" }),
      },
      {
        tab: "validacion",
        protectedContent: page.getByRole("button", { name: "Comprobar todas las plantillas" }),
      },
      {
        tab: "configuracion",
        protectedContent: page.getByRole("heading", { name: "Configuración por sociedad" }),
      },
    ] as const;

    for (const item of cases) {
      let releaseRoles: (() => void) | null = null;
      let intercepted = false;
      const rolesGate = new Promise<void>((resolve) => {
        releaseRoles = resolve;
      });

      await page.route("**/rest/v1/rbac_user_roles**", async (route) => {
        intercepted = true;
        await rolesGate;
        await route.continue();
      });

      await page.goto(`/secretaria/gestor-plantillas?tab=${item.tab}`);
      await expect.poll(() => intercepted).toBe(true);
      await expect(page.getByRole("status")).toContainText(
        "Comprobando acceso a las secciones",
      );
      await expect(item.protectedContent).toHaveCount(0);

      releaseRoles?.();
      await expect(page).toHaveURL(/\?tab=dashboard$/, { timeout: 10_000 });
      await expect(item.protectedContent).toHaveCount(0);
      await page.unroute("**/rest/v1/rbac_user_roles**");
    }
  });
});
