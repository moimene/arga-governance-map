import type { Page } from "@playwright/test";

/**
 * Credenciales demo para e2e. Desde la rotación del 2026-09-05 la contraseña
 * NO vive en el repo: llega por `.env` (DEMO_PASSWORD_ARGA / DEMO_PASSWORD_GARRIGUES,
 * cargado por playwright.config.ts) o por E2E_DEMO_EMAIL / E2E_DEMO_PASSWORD.
 */
export const DEMO_EMAIL = process.env.E2E_DEMO_EMAIL ?? "demo@arga-seguros.com";
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? process.env.DEMO_PASSWORD_ARGA ?? "";

export const GARRIGUES_DEMO_EMAIL = "demo@garrigues-demo.dev";
export const GARRIGUES_DEMO_PASSWORD = process.env.DEMO_PASSWORD_GARRIGUES ?? "";

export type Entorno = "arga" | "garrigues";

/** Rellena el formulario de /login (ya no existe ningún botón de acceso directo). */
export async function fillLogin(page: Page, entorno: Entorno, email: string, password: string) {
  await page.goto(`/login?tenant=${entorno}`);
  await page.getByLabel("Usuario corporativo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: /^Acceder a / }).click();
}

export async function loginAsDemo(page: Page, entorno: Entorno = "arga") {
  const email = entorno === "arga" ? DEMO_EMAIL : GARRIGUES_DEMO_EMAIL;
  const password = entorno === "arga" ? DEMO_PASSWORD : GARRIGUES_DEMO_PASSWORD;
  if (!password) {
    throw new Error(
      `falta DEMO_PASSWORD_${entorno.toUpperCase()} (o E2E_DEMO_PASSWORD) en .env: la contraseña demo se rotó el 2026-09-05 y ya no está en el repo`,
    );
  }
  await fillLogin(page, entorno, email, password);
  await page.waitForURL("/", { timeout: 20_000 });
}
