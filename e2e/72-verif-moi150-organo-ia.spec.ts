import { test, expect } from "@playwright/test";
import { loginAsDemo, type Entorno } from "./fixtures/demo-credentials";
import { watchReadOnly } from "./fixtures/read-only-guard";

/**
 * Verificación de SOLO LECTURA de MOI-150 (F2.T9 ya aplicado, cambio de
 * F2.T15 ya en Cloud): el órgano de gobierno de la IA se resuelve por dato
 * (`useAiGovernanceBody`, `src/lib/aims/governing-body.ts`), no por el mapa
 * fijo retirado `AI_GOVERNANCE_BODY_BY_TENANT`.
 *
 * Estado medido en Cloud el 2026-09-27 (post F2.T15):
 *   - ARGA: PR-024.owner_body_id = CATIT y los 8 sistemas de ARGA tienen
 *     `ai_policy_id = PR-024` → el panel SÍ aparece con el CATIT (cambio
 *     visible declarado en F2.T15, autorizado en ese carril — no aquí).
 *   - Garrigues: PI-30.owner_body_id ya era el Comité de Gobernanza de la IA
 *     y sus 6 sistemas tienen `ai_policy_id = PI-30` → panel con el comité.
 *   - Grupo Nuevo (`…0003`): 0 filas en `aims_ria_subjects` con
 *     `governing_body_id`, 0 políticas de IA con `owner_body_id`, y sus 7
 *     sistemas sin `ai_policy_id` → sin órgano acreditado, sin panel. Esta
 *     tarea (MOI-150) sólo deja un script en DRY-RUN para ese tenant: no se
 *     ha aplicado nada, así que "sin panel" es el estado real, no una
 *     suposición.
 *
 * Guard de red bloqueante en los tres: este spec no debe escribir nada en
 * Cloud (ni siquiera un efecto colateral de pantalla), en ninguno de los tres
 * tenants.
 */

const EVIDENCIA_DIR = "docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-moi150";

interface CasoOrgano {
  entorno: Entorno;
  /** Si se declara, el nombre exacto que debe pintarse en el panel. */
  esperado: { name: string; slug: string } | null;
}

const CASOS: CasoOrgano[] = [
  { entorno: "arga", esperado: { name: "Comité Asesor de Tecnología e Innovación (CATIT)", slug: "comite-tecnologia" } },
  {
    entorno: "garrigues",
    esperado: { name: "Comité de Gobernanza de la Inteligencia Artificial", slug: "garrigues-comite-gobernanza-ia" },
  },
  { entorno: "nuevo", esperado: null },
];

test.describe("MOI-150 — órgano de gobierno de la IA en /ai-governance, por tenant", () => {
  for (const caso of CASOS) {
    test(`${caso.entorno}: ${caso.esperado ? `muestra ${caso.esperado.name}` : "no muestra panel"}`, async ({ page }) => {
      const violations = await watchReadOnly(page, { block: true });

      await loginAsDemo(page, caso.entorno);
      await page.goto("/ai-governance");
      await expect(page.getByRole("heading", { name: "Mesa de trabajo AI Governance" })).toBeVisible({ timeout: 20_000 });
      // El panel depende de una consulta a Cloud (useAiGovernanceBody): dar
      // tiempo a que la red se asiente antes de decidir presencia/ausencia,
      // igual que MOI-193/verif-a con el selector de ámbito.
      await page.waitForLoadState("networkidle").catch(() => {});

      const etiqueta = page.getByText("Órgano de gobierno de la IA");

      if (caso.esperado) {
        await expect(etiqueta, `[${caso.entorno}] el panel del órgano no aparece`).toBeVisible({ timeout: 15_000 });
        const enlace = page.getByRole("link", { name: new RegExp(caso.esperado.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
        await expect(enlace, `[${caso.entorno}] no se pinta el nombre esperado del órgano`).toBeVisible();
        await expect(enlace).toHaveAttribute("href", `/organos/${caso.esperado.slug}`);
      } else {
        await expect(etiqueta, `[${caso.entorno}] el panel aparece sin que se haya declarado ningún órgano`).toHaveCount(0);
      }

      await page.screenshot({ path: `${EVIDENCIA_DIR}/moi150-ai-governance-${caso.entorno}.png` });

      expect(violations, `[${caso.entorno}] escrituras de dominio detectadas en /ai-governance`).toEqual([]);
    });
  }
});
