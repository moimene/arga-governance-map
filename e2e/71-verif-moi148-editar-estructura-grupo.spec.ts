/**
 * Verificación por pantalla — MOI-148, grupo nuevo (tenant …0003).
 *
 * Ola de verificación C (2026-09-27). Solo lectura vía SELECT y navegación
 * real por pantalla; ninguna escritura fuera de la que produzca la propia
 * UI con la cuenta demo@grupo-nuevo-demo.dev. Nunca clave de servicio.
 *
 * Objetivo: en la ficha de la filial 2.3 (Tecnología e Innovación Nueva,
 * S.L., matriz = Corporación Nueva, S.A., 70% hoy), cambiar por pantalla el
 * porcentaje de participación a 65, comprobar que /governance-map sigue
 * cargando la jerarquía sin errores, y dejarlo de nuevo en 70 por pantalla.
 * El histórico (audit_log) se contrasta por SELECT desde fuera del spec.
 *
 * Run:
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:5303 bunx playwright test e2e/71-verif-moi148-editar-estructura-grupo.spec.ts --project=chromium
 */
import { test, expect } from './fixtures/base';
import { loginAsDemo } from './fixtures/demo-credentials';

const FILIAL_2_3_ID = '9d209ef6-ca87-44d4-a12c-86f12a0ea368'; // Tecnología e Innovación Nueva, S.L.
const FORBIDDEN_TENANTS = [
  '00000000-0000-0000-0000-000000000001', // ARGA
  '00000000-0000-0000-0000-000000000002', // Garrigues
];

test.describe.configure({ timeout: 120_000 });
test.use({ storageState: { cookies: [], origins: [] } });

async function setPorcentaje(page: import('@playwright/test').Page, value: string, screenshotName: string) {
  const editBtn = page.getByRole('button', { name: /Editar estructura de grupo/i });
  await expect(editBtn).toBeVisible({ timeout: 15_000 });
  await editBtn.click();

  const porcentajeInput = page.getByLabel(/Porcentaje de participación/i);
  await expect(porcentajeInput).toBeVisible({ timeout: 10_000 });
  await porcentajeInput.fill(value);

  await page.screenshot({ path: `docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/${screenshotName}-antes-guardar.png` });

  const saveBtn = page.getByRole('button', { name: /^Guardar$/i });
  await saveBtn.click();

  await expect(page.getByText(/Estructura de grupo actualizada|No se pudo actualizar/i).first()).toBeVisible({ timeout: 15_000 });
  const errorVisible = await page.getByText(/No se pudo actualizar/i).first().isVisible().catch(() => false);
  await page.screenshot({ path: `docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/${screenshotName}-resultado.png` });
  return { errorVisible };
}

// Este spec ESCRIBE en el grupo nuevo (cambia y revierte un porcentaje real
// de participación). No debe correr en una pasada general de e2e: solo se
// activa a propósito con E2E_ESCRIBE_GRUPO_NUEVO=1.
test.skip(
  process.env.E2E_ESCRIBE_GRUPO_NUEVO !== '1',
  'Escribe en el grupo nuevo (…0003); activar explícitamente con E2E_ESCRIBE_GRUPO_NUEVO=1',
);

test('MOI-148 · Grupo nuevo: cambiar y revertir el porcentaje de la filial 2.3 por pantalla', async ({ page }) => {
  const crossTenantWrites: string[] = [];
  page.on('request', (req) => {
    const method = req.method();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return;
    const url = req.url();
    if (!/supabase\.co\/(rest|rpc)\//.test(url)) return;
    const postData = req.postData() ?? '';
    for (const forbidden of FORBIDDEN_TENANTS) {
      if (url.includes(forbidden) || postData.includes(forbidden)) {
        crossTenantWrites.push(`[${method}] ${url} :: ${postData.slice(0, 300)}`);
      }
    }
  });

  await loginAsDemo(page, 'nuevo');

  await page.goto(`/secretaria/sociedades/${FILIAL_2_3_ID}`);
  await expect(page.getByRole('heading', { name: /Tecnología e Innovación Nueva/i }).first()).toBeVisible({ timeout: 20_000 });

  // Pestaña Perfil (puede ser la que carga por defecto; forzamos click igual).
  const perfilTab = page.getByRole('tab', { name: /^Perfil$/i }).or(page.getByRole('button', { name: /^Perfil$/i }));
  if (await perfilTab.first().isVisible().catch(() => false)) {
    await perfilTab.first().click();
  }

  await expect(page.getByText(/% Propiedad matriz/i).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi148-perfil-antes-70.png' });

  // Cambiar 70 → 65
  const first = await setPorcentaje(page, '65', 'moi148-cambio-70-a-65');
  console.log('[MOI-148 verif-c] cambio 70→65:', first.errorVisible ? 'ERROR' : 'OK');
  await expect(page.getByText(/% Propiedad matriz/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/65%/).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi148-perfil-tras-65.png' });

  // Comprobar /governance-map sigue cargando la jerarquía sin errores tras el cambio.
  const mapErrors: string[] = [];
  page.on('pageerror', (err) => mapErrors.push(err.message));
  await page.goto('/governance-map');
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi148-governance-map-tras-65.png' });
  console.log('[MOI-148 verif-c] errores JS en /governance-map tras el cambio:', JSON.stringify(mapErrors));

  // Revertir 65 → 70
  await page.goto(`/secretaria/sociedades/${FILIAL_2_3_ID}`);
  await expect(page.getByRole('heading', { name: /Tecnología e Innovación Nueva/i }).first()).toBeVisible({ timeout: 20_000 });
  const second = await setPorcentaje(page, '70', 'moi148-revertir-65-a-70');
  console.log('[MOI-148 verif-c] revertir 65→70:', second.errorVisible ? 'ERROR' : 'OK');
  await expect(page.getByText(/70%/).first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/verif-c/moi148-perfil-revertido-70.png' });

  expect(crossTenantWrites, 'no cross-tenant domain writes to ARGA/Garrigues').toEqual([]);
});
