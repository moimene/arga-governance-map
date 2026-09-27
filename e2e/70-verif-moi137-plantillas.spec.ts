import { test, expect, type Page } from "@playwright/test";
import { loginAsDemo, type Entorno } from "./fixtures/demo-credentials";
import { watchReadOnly } from "./fixtures/read-only-guard";

// Verificación por pantalla, SOLO LECTURA, de MOI-137 (verif-a, 2026-09-27).
//
// MOI-137 pide: ninguna plantilla con marcador de demostración (o con una
// aprobación citada "en origen" de otro grupo) debe verse como
// "Aprobada legalmente" en /secretaria/plantillas ni en
// /secretaria/gestor-plantillas (pestañas catálogo y panel), en ARGA,
// Garrigues y Grupo Nuevo; en ARGA, las que dependen del informe del Comité
// Legal del 01-05 (decisión D-20, solo ARGA) deben seguir como estaban.
//
// Réplica en el test (sin importar código de la app: es una comprobación de
// PANTALLA) del mismo vocabulario que usa
// src/lib/secretaria/template-admin/patterns.ts para detectar, en el texto
// "Aprobada: <fecha> por <aprobada_por>" que pinta el panel de detalle
// (PlantillaDetailPanel), si el aprobador es un marcador de demo o una cita
// de aprobación de origen — que es justo lo que MOI-137 dice que NUNCA debe
// coincidir con el badge "Aprobada legalmente".
const DEMO_MARKER_RE =
  /\b(demo|demo-operativo|seed|prototipo|remediaci[oó]n|simulad[oa]|prueba|fictici[oa]|ejemplo|test|placeholder)\b|demo\s+operativo/i;
const CITED_ORIGIN_RE = /aprobada en origen por/i;

const ENTORNOS: Entorno[] = ["arga", "garrigues", "nuevo"];

async function openCatalogTab(page: Page) {
  await page.goto("/secretaria/gestor-plantillas?tab=catalogo");
  const listContainer = page.locator(
    '[aria-label="Plantillas agrupadas por tipo, materia y variante jurídica"]',
  );
  await expect(listContainer).toBeVisible({ timeout: 20_000 });
  // Espera a que termine "Cargando…" y aparezcan filas reales.
  await expect(listContainer.getByText("Cargando…")).toHaveCount(0, { timeout: 20_000 });
  await expect(listContainer.locator("button[aria-pressed]").first()).toBeVisible({ timeout: 20_000 });
  return listContainer;
}

test.describe("MOI-137 — plantillas sin aprobación nominativa por marcador demo", () => {
  for (const entorno of ENTORNOS) {
    test(`${entorno}: /secretaria/plantillas no pinta "Aprobada legalmente" en ningún sitio`, async ({ page }) => {
      const violations = await watchReadOnly(page, { block: true });
      await loginAsDemo(page, entorno);
      await page.goto("/secretaria/plantillas");
      await expect(page.getByRole("heading", { name: "Plantillas" }).first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1500); // deja asentar el query de plantillas

      const aprobadaCount = await page.getByText("Aprobada legalmente", { exact: false }).count();
      expect(
        aprobadaCount,
        `[${entorno}] /secretaria/plantillas no debería pintar "Aprobada legalmente" en ningún lugar de esta pantalla`,
      ).toBe(0);

      const kpiLocator = page.getByText(/Revisión legal pendiente/i).first();
      if (await kpiLocator.count()) {
        const kpiText = await kpiLocator.evaluate((el) => el.closest("div")?.textContent ?? el.textContent ?? "");
        console.log(`[verif-a][MOI-137][${entorno}] /secretaria/plantillas KPI: ${kpiText.trim()}`);
      }

      await page.screenshot({
        path: `docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-a/moi137-plantillas-${entorno}.png`,
        fullPage: true,
      });

      expect(violations, `[${entorno}] escrituras de dominio detectadas en /secretaria/plantillas`).toEqual([]);
    });

    test(`${entorno}: gestor-plantillas (catálogo + panel) — recuento de estados y cero demo aprobado`, async ({
      page,
    }) => {
      const violations = await watchReadOnly(page, { block: true });
      await loginAsDemo(page, entorno);
      const listContainer = await openCatalogTab(page);

      const rows = listContainer.locator("button[aria-pressed]");
      const rowCount = await rows.count();
      expect(rowCount, `[${entorno}] el catálogo debería listar al menos una plantilla vigente`).toBeGreaterThan(0);

      const labels = [
        "Aprobada legalmente",
        "Vigente sin aprobación nominativa",
        "Revisión legal",
        "Cobertura provisional",
        "En preparación",
      ];
      const counts: Record<string, number> = {};
      for (const l of labels) counts[l] = 0;

      const approvedRowIndexes: number[] = [];
      for (let i = 0; i < rowCount; i++) {
        const text = (await rows.nth(i).innerText()).trim();
        const matched = labels.find((l) => text.includes(l));
        if (matched) {
          counts[matched] += 1;
          if (matched === "Aprobada legalmente") approvedRowIndexes.push(i);
        }
      }

      console.log(
        `[verif-a][MOI-137][${entorno}] gestor-plantillas catálogo — ${rowCount} filas vigentes; recuento por rótulo: ${JSON.stringify(counts)}`,
      );

      await page.screenshot({
        path: `docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-a/moi137-gestor-catalogo-${entorno}.png`,
        fullPage: true,
      });

      // Para cada fila rotulada "Aprobada legalmente", abre el panel de detalle
      // (columna derecha) y comprueba que el texto "Aprobada: ... por ..."
      // NO contiene un marcador de demo ni una cita de aprobación "en origen".
      const demoApprovedViolations: string[] = [];
      let panelChecked = 0;
      for (const idx of approvedRowIndexes) {
        await rows.nth(idx).click();
        const panelApproved = page.getByText(/^Aprobada: /).first();
        // No todas las filas "Aprobada legalmente" tienen por qué mostrar la
        // línea "Aprobada: … por …" (depende de si fecha_aprobacion está
        // informada), así que se tolera su ausencia sin fallar el test.
        if (await panelApproved.count()) {
          const panelText = (await panelApproved.first().innerText()).trim();
          panelChecked += 1;
          if (DEMO_MARKER_RE.test(panelText) || CITED_ORIGIN_RE.test(panelText)) {
            demoApprovedViolations.push(`fila ${idx}: "${panelText}"`);
          }
        }
      }

      console.log(
        `[verif-a][MOI-137][${entorno}] paneles comprobados con línea "Aprobada: …": ${panelChecked}/${approvedRowIndexes.length}`,
      );

      if (approvedRowIndexes.length > 0) {
        await page.screenshot({
          path: `docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-a/moi137-gestor-panel-${entorno}.png`,
          fullPage: true,
        });
      }

      expect(
        demoApprovedViolations,
        `[${entorno}] plantillas con marcador demo o cita "en origen" que igualmente se pintan "Aprobada legalmente"`,
      ).toEqual([]);

      expect(violations, `[${entorno}] escrituras de dominio detectadas en gestor-plantillas`).toEqual([]);
    });
  }
});
