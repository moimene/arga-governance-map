// e2e/20-secretaria-plantillas-overrides.spec.ts
/**
 * R12 — Regresión estricta para v2.0.
 *
 * Verifica que el composer renderiza idénticamente con y sin la infra v2
 * cuando NO hay overrides activos (cero filas en entity_settings,
 * plantilla_capa3_overrides_por_entidad, bloque_insertions).
 *
 * Si esto falla, hay regresión introducida por v2 — bloquea el merge.
 */
import { test, expect } from "@playwright/test";

const DEMO_USER = "demo@arga-seguros.com";
const DEMO_PASS = "TGMSdemo2026!";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await page.getByLabel(/email/i).fill(DEMO_USER);
  await page.getByLabel(/password/i).fill(DEMO_PASS);
  await page.getByRole("button", { name: /sign in|entrar|login/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"));
}

test.describe("v2 plantillas overrides — regresión sin overrides activos", () => {
  test("listado de plantillas: snapshot DOM normalizado para detectar regresión", async ({ page }) => {
    await login(page);
    await page.goto("/secretaria/plantillas");
    await expect(page.getByRole("heading", { name: /plantillas/i })).toBeVisible();

    // Snapshot del DOM principal — detecta cambios inesperados tras desplegar
    // la infra v2. Normalizamos UUIDs, timestamps y fechas para estabilidad.
    const main = page.locator("main").first();
    const html = await main.innerHTML();
    const normalized = html
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, "<UUID>")
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.?\d*Z?/g, "<TS>")
      .replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, "<DATE>");
    expect(normalized).toMatchSnapshot("plantillas-listado-baseline.html");
  });

  test("tramitador composer carga sin errores con infra v2 desplegada", async ({ page }) => {
    await login(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/secretaria/tramitador");
    await expect(page.getByRole("heading")).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState("networkidle");
    // Sin overrides activos en BD, el composer debe cargar igual que antes de v2
    expect(errors).toEqual([]);
  });

  test.skip("BloquesSectorialesPanel no aparece para sociedad GENERICO sin showAll", async () => {
    // Posterga a v2.1: el panel BloquesSectorialesPanel es opt-in (R6) y no se
    // enchufa todavía a TramitadorStepper/GenerarDocumentoStepper en v2.0.
    // Cuando se conecte (v2.1), este test verificará el comportamiento R10.
  });
});
