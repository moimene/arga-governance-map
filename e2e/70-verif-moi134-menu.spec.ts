import { test, expect, type Page } from "@playwright/test";
import { loginAsDemo, type Entorno } from "./fixtures/demo-credentials";
import { watchReadOnly } from "./fixtures/read-only-guard";

// Verificación por pantalla, SOLO LECTURA, de MOI-134 (verif-a, 2026-09-27).
//
// MOI-134 pide: el menú de usuario del Grupo Nuevo (…0003) no debe ofrecer
// "Cambiar a Entorno …" (ningún destino que no le devuelva a su propio
// entorno); ARGA sigue ofreciendo "Cambiar a Entorno Garrigues" en el menú
// del shell TGMS (UserMenu.tsx, ruta "/"), y Garrigues sigue ofreciendo
// "Cambiar a Entorno Corporativo" en el menú del shell Garrigues
// (GarriguesUserMenu.tsx, montado en cualquier ruta "/secretaria/*").
//
// Se comprueban las DOS superficies (shell TGMS en "/" y shell Garrigues en
// "/secretaria/plantillas") para los tres tenants, sin dar nada por
// supuesto. Se usa "/secretaria/plantillas" y NO "/secretaria" a propósito:
// SOLO la página exacta "/secretaria" (SecretariaDashboard) monta
// `useAutoScanVacanciasPresidencia`, que hace un INSERT real en
// `notifications` con solo abrir la pantalla (descubierto en la primera
// corrida de este mismo spec — ver informe verif-a). El guard de red además
// bloquea (no solo detecta) cualquier escritura de dominio en ARGA/Garrigues,
// por si otra pantalla tuviera un efecto colateral similar sin auditar.

async function openUserMenu(page: Page) {
  const trigger = page.locator('button[aria-label^="Menú de usuario"]').first();
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await trigger.click();
}

test.describe("MOI-134 — menú de usuario y cambio de entorno", () => {
  const ENTORNOS: Entorno[] = ["arga", "garrigues", "nuevo"];

  for (const entorno of ENTORNOS) {
    test(`${entorno}: shell TGMS ("/") — menú de usuario`, async ({ page }) => {
      const violations = await watchReadOnly(page, { block: true });
      await loginAsDemo(page, entorno);
      await page.goto("/");
      // El ítem depende de `tenantId` (TenantContext, resuelto por red) — se
      // espera a que la red se asiente antes de abrir el menú para no leerlo
      // a mitad de una carrera (visto en la primera corrida: el guard de
      // bloqueo añade latencia a cada petición y el menú se abría antes de
      // que `tenantId` resolviera).
      await page.waitForLoadState("networkidle").catch(() => {});
      await openUserMenu(page);
      const envItems = page.getByRole("menuitem", { name: /Cambiar a Entorno/i });
      const count = await envItems.count();
      const texts: string[] = [];
      for (let i = 0; i < count; i++) texts.push((await envItems.nth(i).innerText()).trim());
      console.log(`[verif-a][MOI-134][${entorno}] shell TGMS "/" — ítems de cambio de entorno: ${JSON.stringify(texts)}`);

      await page.screenshot({
        path: `docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-a/moi134-menu-tgms-${entorno}.png`,
      });

      if (entorno === "nuevo") {
        expect(count, `[nuevo] el shell TGMS no debe ofrecer cambio de entorno`).toBe(0);
      } else if (entorno === "arga") {
        expect(texts.some((t) => /Cambiar a Entorno Garrigues/i.test(t)), `[arga] debería seguir ofreciendo "Cambiar a Entorno Garrigues"`).toBe(true);
      }
      // Para garrigues en el shell TGMS ("/") no hay una afirmación del issue:
      // se deja constancia en el log de lo observado, sin asertar (ver informe).

      expect(violations, `[${entorno}] escrituras de dominio detectadas en "/"`).toEqual([]);
    });

    test(`${entorno}: shell Garrigues ("/secretaria/plantillas") — menú de usuario`, async ({ page }) => {
      const violations = await watchReadOnly(page, { block: true });
      await loginAsDemo(page, entorno);
      await page.goto("/secretaria/plantillas");
      // Nuevo puede no tener el módulo secretaría configurado explícitamente,
      // pero `modules` ausente falla ABIERTO (todo visible) — si redirige,
      // se declara en el log y el test no fuerza una URL.
      await page.waitForLoadState("networkidle").catch(() => {});
      const trigger = page.locator('button[aria-label^="Menú de usuario"]').first();
      if (!(await trigger.count())) {
        console.log(`[verif-a][MOI-134][${entorno}] "/secretaria/plantillas" no montó el menú de usuario del shell Garrigues (url final: ${page.url()})`);
        expect(violations, `[${entorno}] escrituras de dominio detectadas en "/secretaria/plantillas"`).toEqual([]);
        return;
      }
      await openUserMenu(page);
      const envItems = page.getByRole("menuitem", { name: /Cambiar a Entorno/i });
      const count = await envItems.count();
      const texts: string[] = [];
      for (let i = 0; i < count; i++) texts.push((await envItems.nth(i).innerText()).trim());
      console.log(`[verif-a][MOI-134][${entorno}] shell Garrigues "/secretaria/plantillas" — ítems de cambio de entorno: ${JSON.stringify(texts)}`);

      await page.screenshot({
        path: `docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-a/moi134-menu-garrigues-${entorno}.png`,
      });

      if (entorno === "nuevo") {
        expect(count, `[nuevo] el shell Garrigues no debe ofrecer cambio de entorno`).toBe(0);
      } else if (entorno === "garrigues") {
        expect(texts.some((t) => /Cambiar a Entorno Corporativo/i.test(t)), `[garrigues] debería seguir ofreciendo "Cambiar a Entorno Corporativo"`).toBe(true);
      }

      expect(violations, `[${entorno}] escrituras de dominio detectadas en "/secretaria/plantillas"`).toEqual([]);
    });
  }
});
