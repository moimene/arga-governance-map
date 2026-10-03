import { test, expect } from "@playwright/test";
import { loginAsDemo } from "./fixtures/demo-credentials";
import { watchReadOnly } from "./fixtures/read-only-guard";

/**
 * Verificación de SOLO LECTURA de H-51 (MOI-15) sobre la reunión real del
 * grupo nuevo `81a4de74…` (Consejo de Corporación Nueva, S.A., EN_CURSO):
 * punto 1 de convocatoria ya ADOPTED con acuerdo y snapshot certificable, y
 * punto 2 DECISORIO nacido en sesión (`dc938c06…`) sin resolución.
 *
 * Antes del arreglo, `puedeRecalcularResoluciones` ignoraba que hay más
 * puntos votables que resoluciones y el botón "Registrar/Recalcular
 * votación…" desaparecía del DOM (captura
 * `HALLAZGO-h51-sin-boton-registrar.png`, ola 5). Este spec comprueba que el
 * control vuelve a existir y que, sin votos del punto 2, queda deshabilitado
 * con el motivo correcto — NO lo pulsa: registrar la votación escribiría en
 * Cloud, y eso es el recorrido que hace Moisés (o su agente) con las
 * migraciones de la ola 6 ya aplicadas.
 *
 * Guard de red bloqueante: cualquier escritura de dominio se aborta antes de
 * llegar a Cloud y hace fallar el test.
 */

const EVIDENCIA_DIR = "docs/superpowers/reviews/2026-10-03-verificacion-pantalla/verif-moi15-h51";
const MEETING_ID = "81a4de74-2bc4-4f99-8a98-12bfc038a630";
const ENTITY_ID = "45c8df67-64c9-42a3-abff-8047dd23748b";

test.describe("MOI-15 / H-51 — el paso Votaciones vuelve a ofrecer el registro cuando hay un punto votable sin resolución", () => {
  test("grupo nuevo, reunión 81a4de74…: botón presente, deshabilitado hasta registrar el voto del punto nacido en sesión", async ({
    page,
  }) => {
    const violations = await watchReadOnly(page, { block: true });

    await loginAsDemo(page, "nuevo");
    await expect(page.getByText(/GRUPO NUEVO/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto(`/secretaria/reuniones/${MEETING_ID}?scope=sociedad&entity=${ENTITY_ID}`);
    await expect(page.getByRole("heading", { name: "Asistente de sesión societaria" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /Votaciones/ }).first().click();
    await expect(page.getByRole("heading", { name: /Paso 5\. Votaciones/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Evaluación de adopción por punto")).toBeVisible({ timeout: 15_000 });
    // Los dos puntos votables (convocatoria + nacido en sesión) están en el carril de votación.
    await expect(page.getByRole("button", { name: "Punto 2" })).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    const registrar = page.getByRole("button", {
      name: /Registrar votaci[oó]n del acuerdo y crear expediente Acuerdo 360|Recalcular votaci[oó]n del acuerdo y crear expediente Acuerdo 360/,
    });
    await expect(registrar, "H-51: el botón de registro debe existir en el DOM").toBeVisible({ timeout: 15_000 });
    // Sin voto expreso del punto 2 el botón existe pero no se puede pulsar, y
    // dice por qué. (Control anti-vacuidad: no basta con que exista.)
    await expect(registrar).toBeDisabled();
    await expect(registrar).toHaveAttribute("title", /Registra voto expreso de cada votante elegible/);
    await expect(page.getByText(/punto\(s\) decisorio\(s\) sin votación registrada/i)).toBeVisible();

    await page.screenshot({ path: `${EVIDENCIA_DIR}/h51-boton-registrar-presente.png`, fullPage: true });

    expect(violations, "escrituras de dominio detectadas en una verificación de solo lectura").toEqual([]);
  });
});
