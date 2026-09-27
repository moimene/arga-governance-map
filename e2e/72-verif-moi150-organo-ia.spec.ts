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
 *   - Grupo Nuevo (`…0003`): D-28 bis (migración `20260928172000`, ensayada
 *     y revertida, NO aplicada aún a Cloud) añade `p_governing_body_id` a
 *     `fn_aims_proponer_sujeto`/`fn_aims_confirmar_sujeto` para que el sujeto
 *     de este tenant pueda declarar el Consejo de Administración de
 *     Corporación Nueva, S.A. (`scripts/aims/seed-organo-ia-grupo-nuevo.ts`,
 *     que sigue en DRY-RUN — nadie ha corrido `--commit`). El caso `nuevo` de
 *     abajo espera YA el panel con ese órgano: hoy (migración y siembra sin
 *     aplicar) este caso queda EN ROJO a propósito — es el criterio de hecho
 *     del issue, no un error del spec. Se pone en verde solo cuando el
 *     orquestador aplique la migración y la siembra en Cloud.
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
  {
    entorno: "nuevo",
    // D-28 (MOI-150): Consejo de Administración de Corporación Nueva, S.A.
    // (`db8073bb-5089-4bbf-a9a9-456d457f59b7`, tal cual está en Cloud —
    // sin tilde en "Administracion"). En rojo hasta que la migración
    // `20260928172000` y el seed se apliquen (ver cabecera del fichero).
    esperado: { name: "Consejo de Administracion", slug: "corporacion-nueva-s-a-1790294732310-admin-onboarding" },
  },
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
