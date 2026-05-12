/**
 * E2E — TemplateImportWizard (Sprint 1, Commit 6, Task 6.6).
 *
 * IMPORTANTE — RBAC: la tab `Importar` solo es accesible para
 * ADMIN_TENANT (puerta del Commit 5). El usuario demo del proyecto
 * (`demo@arga-seguros.com`) tiene el rol SECRETARIO y por tanto NO
 * puede ver la tab. Este test cubre dos rutas:
 *
 *  1. **Happy path completo (skipped por defecto)** — sube fixture
 *     `template-import-valid.json`, ejecuta preflight y verifica
 *     toast de éxito. Requiere usuario ADMIN_TENANT en Cloud, que
 *     no existe en el seed demo. Se preserva como smoke test para
 *     futuros sprints con RBAC real.
 *
 *  2. **RBAC denial (run by default)** — verifica que SECRETARIO
 *     navegando a `?tab=importar` NO ve el wizard (la tab queda
 *     filtrada por `visibleTabsForRole`). Este path valida que la
 *     puerta RBAC sigue cerrada y el wizard no se expone por error.
 *
 * El RBAC negativo es la ruta operacional hoy; el happy path se
 * documenta para regresión cuando exista un usuario ADMIN_TENANT
 * en Cloud (Sprint 2: integración con auth real).
 */

import { test, expect } from "./fixtures/base";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_PATH = resolve(__dirname, "../src/test/fixtures/template-import-valid.json");

test.describe("Gestor de Plantillas — Wizard de importación", () => {
  test("SECRETARIO no puede acceder al wizard (RBAC denial)", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("usuario@argaseguros.com").fill("demo@arga-seguros.com");
    await page.getByPlaceholder("••••••••").fill("TGMSdemo2026!");
    await page.getByRole("button", { name: "Acceder", exact: true }).click();
    await page.waitForURL("/", { timeout: 20_000 });

    // El usuario demo es SECRETARIO. Al navegar a `?tab=importar` la
    // tab debe estar filtrada por el RBAC del shell.
    await page.goto("/secretaria/gestor-plantillas?tab=importar");

    // Esperar a que cargue el shell.
    await expect(
      page
        .getByRole("heading", { name: /Gestor de plantillas/i })
        .or(page.getByText(/Gestor de plantillas/i).first()),
    ).toBeVisible({ timeout: 10_000 });

    // El wizard NO debe estar visible — la tab está restringida a
    // ADMIN_TENANT. Verificamos por ausencia del título del paso 1.
    await expect(
      page.getByRole("heading", { name: /Descargar plantilla base/i }),
    ).toHaveCount(0);
  });

  test.skip("Happy path: subir JSON válido y crear borrador (requiere ADMIN_TENANT)", async ({
    page,
  }) => {
    // SKIPPED por defecto — depende de un usuario ADMIN_TENANT en Cloud
    // que no existe en el seed demo actual. Se desbloquea cuando el
    // sprint de auth real cree el rol y permisos correspondientes.
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@arga-seguros.com");
    await page.fill('input[name="password"]', "TGMSdemo2026!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/", { timeout: 15_000 });

    await page.goto("/secretaria/gestor-plantillas?tab=importar");
    await page.getByRole("button", { name: /Saltar a subir/i }).click();

    await page.setInputFiles('input[type="file"]', FIXTURE_PATH);
    await page.getByRole("button", { name: /Ejecutar preflight/i }).click();

    await expect(
      page.getByText(/borrador creado correctamente/i),
    ).toBeVisible({ timeout: 15_000 });
  });
});
