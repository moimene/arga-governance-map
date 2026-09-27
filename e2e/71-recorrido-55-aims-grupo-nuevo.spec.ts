import { test, expect } from './fixtures/base';
import { fillLogin, loginAsDemo, NUEVO_DEMO_PASSWORD } from './fixtures/demo-credentials';

/**
 * MOI-55 — Recorrido por pantalla del bloque 5 del guion (AI Governance /
 * AIMS) sobre el Grupo Nuevo (tenant `…0003`), por delegación de Moisés.
 *
 * Escribe SOLO en el Grupo Nuevo, y sólo por la pantalla (nunca SQL, nunca
 * clave de servicio, nunca RPC a mano): 5.1 alta guiada de un sistema de IA,
 * 5.2 evaluar + congelar con `demo@` y revisar a cuatro ojos con `admin@` en
 * un contexto de navegador SEPARADO (ventana privada distinta: dos pestañas
 * del mismo navegador comparten la sesión de Supabase), 5.3 un incidente de
 * IA, 5.4 confirmar que el panel del órgano de gobierno de la IA no se pinta
 * (conocido: `src/lib/aims/governing-body.ts` no declara `…0003`).
 *
 * Sesión propia y aislada del storageState de ARGA: este spec nunca inicia
 * sesión en ARGA ni en Garrigues, así que la regla "sólo lectura en ARGA y
 * Garrigues" queda satisfecha por construcción (no se navega a ellos ni se
 * usan sus credenciales). Como defensa en profundidad se vigila, igual que en
 * `aims-evaluaciones.spec.ts`, que toda lectura de `ai_systems` en el cable
 * lleve el filtro `tenant_id=eq.<Grupo Nuevo>` — si una sesión aterrizara sin
 * querer en otro tenant, esta aserción lo delataría.
 */

const TENANT_NUEVO = '00000000-0000-0000-0000-000000000003';
const ADMIN_NUEVO_EMAIL = 'admin@grupo-nuevo-demo.dev';
const EVIDENCIA_DIR = 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/recorrido-55';

/** Responde una pregunta del cuestionario guiado localizándola por su cita legal (única por pregunta). */
async function responder(page: import('@playwright/test').Page, articulo: string, si: boolean) {
  const cita = page.getByText(articulo, { exact: true });
  await expect(cita).toBeVisible({ timeout: 10_000 });
  // El <p> de la cita está dos niveles por debajo del contenedor que también
  // trae los botones Sí/No (ver PreguntaGuiada.tsx): p -> div "max-w-xl" ->
  // div "flex flex-wrap ... justify-between" (hermano del div de botones).
  const tarjeta = cita.locator('xpath=ancestor::div[2]');
  await tarjeta.getByRole('button', { name: si ? 'Sí' : 'No', exact: true }).click();
}

test.describe('MOI-55 — bloque 5 AIMS en Grupo Nuevo', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.setTimeout(240_000);

  // Este spec ESCRIBE en el grupo nuevo (alta de sistema IA, evaluación
  // congelada, incidente). No debe correr en una pasada general de e2e:
  // solo se activa a propósito con E2E_ESCRIBE_GRUPO_NUEVO=1.
  test.skip(
    process.env.E2E_ESCRIBE_GRUPO_NUEVO !== '1',
    'Escribe en el grupo nuevo (…0003); activar explícitamente con E2E_ESCRIBE_GRUPO_NUEVO=1',
  );

  test('alta guiada, congelar/revisar a cuatro ojos e incidente', async ({ page, browser }) => {
    const filtrosSistemas: Array<string | null> = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.pathname === '/rest/v1/ai_systems') filtrosSistemas.push(url.searchParams.get('tenant_id'));
    });

    // ---------- 5.1 alta por cuestionario guiado, con demo@ ----------
    await loginAsDemo(page, 'nuevo');

    const nombreSistema = `Recorrido MOI-55 — Motor de triaje documental ${Date.now()}`;
    await page.goto('/ai-governance/sistemas/nuevo');
    await expect(page.getByRole('heading', { name: 'Nuevo sistema IA' })).toBeVisible({ timeout: 15_000 });
    await page.locator('#ai-system-name').fill(nombreSistema);

    // Fase 1 — Rol: no lo ha creado, ni modificado sustancialmente, ni lo
    // comercializa con su marca -> RESPONSABLE_DESPLIEGUE.
    await responder(page, 'Art. 3.3 (definición de proveedor)', false);
    await responder(page, 'Art. 3.23 y art. 25.1 (modificación sustancial y cambio de finalidad)', false);
    await responder(page, 'Arts. 3.3 y 16 (proveedor); art. 25.1 a)', false);
    await responder(page, 'Arts. 3.4 y 26 (responsable del despliegue)', false);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    // Fase 2 — Riesgo: ni práctica prohibida ni anexo III; interactúa con
    // personas (art. 50) -> nivel Limitado, sin exigir motivación art. 6.3.
    await responder(page, 'Art. 5 (prácticas prohibidas)', false);
    await responder(page, 'Art. 6.2 y anexo III', false);
    await responder(page, 'Art. 50 (transparencia)', true);
    await responder(page, 'Cap. V, arts. 51–56 (modelos de IA de uso general)', false);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    // Fase 3 — Marcos derivados (sólo lectura) y Fase 4 — Confirmación.
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByText('Responsable del despliegue', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Limitado', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar clasificación' }).click();
    await page.screenshot({ path: `${EVIDENCIA_DIR}/5.1-clasificacion-confirmada.png` });
    await page.getByRole('button', { name: 'Registrar sistema' }).click();
    await page.waitForURL(/\/ai-governance\/sistemas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const systemId = page.url().split('/').pop()!;
    await expect(page.getByText(nombreSistema)).toBeVisible({ timeout: 15_000 });

    // ---------- 5.2 evaluar y congelar, con demo@ ----------
    await page.goto(`/ai-governance/evaluaciones/nuevo?system_id=${systemId}`);
    await expect(page.locator('#eval-system')).toHaveValue(systemId, { timeout: 15_000 });
    await page.locator('#eval-framework').selectOption('EU_AI_ACT');
    await page.getByRole('button', { name: 'Continuar a Evaluación de Medidas' }).click();
    await expect(page.getByText(/^Perfil de aplicabilidad:/)).toBeVisible({ timeout: 10_000 });

    // Evalúa al menos una medida: sin ninguna evaluada, `buildEvaluationPayload`
    // deja el status en `BORRADOR` y un borrador no se congela.
    await page.getByLabel('Nivel de madurez (escala L1–L8)').first().selectOption('L5');

    await page.getByRole('button', { name: 'Revisar Plan de Adaptación (PDA)' }).click();
    await page.getByRole('button', { name: 'Guardar autodiagnóstico' }).click();
    await expect(page.getByRole('heading', { name: 'Autodiagnóstico Registrado con Éxito' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('link', { name: 'Inspeccionar Informe Completo' }).click();
    await page.waitForURL(/\/ai-governance\/evaluaciones\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const assessmentId = page.url().split('/').pop()!;

    const botonCongelar = page.getByRole('button', { name: 'Congelar evaluación' });
    await expect(botonCongelar).toBeEnabled({ timeout: 15_000 });
    await botonCongelar.click();
    await expect(page.getByText(/Congelada el /)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${EVIDENCIA_DIR}/5.2-congelada-demo.png` });

    // Quien congeló (demo@) no puede revisar: el botón está deshabilitado.
    const botonRevisarComoDemo = page.getByRole('button', { name: 'Revisar y aprobar' });
    await expect(botonRevisarComoDemo).toBeVisible();
    await expect(botonRevisarComoDemo).toBeDisabled();
    await expect(
      page.getByText('La revisión la firma una persona distinta de quien congeló: entra con otra cuenta.'),
    ).toBeVisible();

    // ---------- 5.2 revisar a cuatro ojos, con admin@ en contexto separado ----------
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    let resultadoRevision: string;
    try {
      await fillLogin(adminPage, 'nuevo', ADMIN_NUEVO_EMAIL, NUEVO_DEMO_PASSWORD);
      await adminPage.waitForURL('/', { timeout: 20_000 });
      await adminPage.goto(`/ai-governance/evaluaciones/${assessmentId}`);
      const botonRevisarComoAdmin = adminPage.getByRole('button', { name: 'Revisar y aprobar' });
      await expect(botonRevisarComoAdmin).toBeVisible({ timeout: 15_000 });
      await expect(botonRevisarComoAdmin).toBeEnabled();
      await botonRevisarComoAdmin.click();
      await expect(adminPage.getByText(/Revisada el /)).toBeVisible({ timeout: 15_000 });
      await adminPage.screenshot({ path: `${EVIDENCIA_DIR}/5.2-revisada-admin.png` });
      resultadoRevision = 'Revisión aceptada: admin@grupo-nuevo-demo.dev (ADMIN_TENANT) revisó la evaluación congelada por demo@ (SECRETARIO); la ficha muestra "Revisada el …".';
    } finally {
      await adminContext.close();
    }

    // ---------- 5.3 incidente de IA, con demo@ ----------
    await page.goto('/ai-governance/incidentes/nuevo');
    await expect(page.getByRole('heading', { name: 'Nuevo incidente IA' })).toBeVisible({ timeout: 15_000 });
    await page.locator('#ai-incident-system').selectOption(systemId);
    await page.locator('#ai-incident-title').fill('Recorrido MOI-55 — respuesta incorrecta detectada en producción');
    await page.getByRole('button', { name: 'Registrar incidente' }).click();
    await expect(page.getByText('Incidente IA registrado en AIMS.')).toBeVisible({ timeout: 15_000 });
    await page.waitForURL(/\/ai-governance\/sistemas\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await page.screenshot({ path: `${EVIDENCIA_DIR}/5.3-incidente-registrado.png` });

    // ---------- 5.4 panel del órgano de gobierno de la IA: ausente (conocido) ----------
    await page.goto('/ai-governance');
    await expect(page.getByRole('heading', { name: 'Mesa de trabajo AI Governance' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Órgano de gobierno de la IA')).toHaveCount(0);
    await page.screenshot({ path: `${EVIDENCIA_DIR}/5.4-dashboard-sin-organo.png` });

    expect(filtrosSistemas.length, 'ninguna pantalla leyó ai_systems: la aserción de tenant sería vacua').toBeGreaterThan(0);
    for (const filtro of filtrosSistemas) expect(filtro).toBe(`eq.${TENANT_NUEVO}`);

    // Deja constancia en el reporte de Playwright de los ids creados y del
    // resultado literal de la revisión a cuatro ojos, para la tabla de
    // hallazgos del guion.
    console.log(
      JSON.stringify({
        systemId,
        assessmentId,
        nombreSistema,
        congeladoPor: 'demo@grupo-nuevo-demo.dev (SECRETARIO)',
        revisadoPor: ADMIN_NUEVO_EMAIL + ' (ADMIN_TENANT)',
        resultadoRevision,
      }),
    );
  });
});
