import { test, expect } from "@playwright/test";
import { loginAsDemo, type Entorno } from "./fixtures/demo-credentials";
import { watchReadOnly } from "./fixtures/read-only-guard";

// Verificación por pantalla, SOLO LECTURA, de MOI-193 (verif-a, 2026-09-27).
//
// MOI-193 pide: el selector de ámbito de Garrigues debe mostrar sus ámbitos
// reales (derivados del catálogo societario), y el de ARGA no debe cambiar.
// El selector verificado es el del shell TGMS
// (src/components/shell/ScopeSwitcher.tsx, variante "sidebar" en "/"), que es
// el que consume `scopesForTenant(branding)` — el "ScopeSwitcher" propio de
// Secretaría (src/components/secretaria/shell/ScopeSwitcher.tsx) es un
// selector de modo Grupo/Sociedad no relacionado con este issue.

const ENTORNOS: Entorno[] = ["arga", "garrigues"];

test.describe("MOI-193 — selector de ámbito por tenant", () => {
  for (const entorno of ENTORNOS) {
    test(`${entorno}: selector de ámbito en "/" (sidebar)`, async ({ page }) => {
      const violations = await watchReadOnly(page, { block: true });
      await loginAsDemo(page, entorno);
      await page.goto("/");
      // `scopesForTenant` depende de `branding` (TenantBrandContext, resuelto
      // por red) — se espera a que la red se asiente antes de abrir el
      // selector (visto en MOI-134: el guard de bloqueo añade latencia y el
      // primer render puede leerse antes de que `branding` resuelva).
      await page.waitForLoadState("networkidle").catch(() => {});

      const trigger = page.getByRole("button", { name: /^Scope:/ }).first();
      await expect(trigger).toBeVisible({ timeout: 20_000 });
      await trigger.click();

      const items = page.getByRole("menuitem");
      await expect(items.first()).toBeVisible({ timeout: 10_000 });
      const count = await items.count();
      const texts: string[] = [];
      for (let i = 0; i < count; i++) texts.push((await items.nth(i).innerText()).trim());

      console.log(`[verif-a][MOI-193][${entorno}] ámbitos del selector (${count}): ${JSON.stringify(texts)}`);

      await page.screenshot({
        path: `docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-a/moi193-scope-${entorno}.png`,
      });

      if (entorno === "garrigues") {
        expect(count, `[garrigues] debería mostrar 13 ámbitos (12 jurisdicciones + Global)`).toBe(13);
        expect(texts[0], `[garrigues] el primer ámbito debe ser "Grupo Garrigues (Global)"`).toBe(
          "Grupo Garrigues (Global)",
        );
        expect(texts, `[garrigues] España debe estar entre los ámbitos (16 entidades del catálogo)`).toContain(
          "España",
        );
      } else if (entorno === "arga") {
        // ARGA debe conservar su lista estática de 9 ámbitos (src/data/scopes.ts),
        // sin cambio alguno.
        expect(count, `[arga] la lista estática de ARGA tiene 9 ámbitos`).toBe(9);
        expect(texts[0]).toBe("Grupo ARGA (Global)");
      }

      expect(violations, `[${entorno}] escrituras de dominio detectadas en "/"`).toEqual([]);
    });
  }
});
