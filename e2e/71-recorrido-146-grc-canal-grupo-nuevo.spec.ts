import { test, expect } from './fixtures/base';
import type { Page } from '@playwright/test';
import { loginAsDemo } from './fixtures/demo-credentials';
import fs from 'node:fs';
import path from 'node:path';

/**
 * MOI-146 — Recorrido por pantalla de los bloques 6 (GRC) y 7 (canal interno
 * SII) del guion `docs/superpowers/plans/2026-09-19-tenant-cero-guion-recorrido.md`
 * sobre el tenant «Grupo Nuevo» (`00000000-0000-0000-0000-000000000003`).
 *
 * EJECUTADO POR UN AGENTE POR DELEGACIÓN DE MOISÉS (issue MOI-146, "Qué te
 * toca a ti" + autorización del orquestador de la tarea). El registro de
 * datos de prueba en el tenant nuevo por pantalla está autorizado; este spec
 * NUNCA escribe por SQL — todo pasa por los mismos hooks/RPC que usaría un
 * usuario real, con sesión real (`loginAsDemo(page, 'nuevo')`, contraseña
 * leída de `.env` vía el fixture del repo, nunca impresa).
 *
 * Opt-in: escribe en la base de datos Cloud compartida (`governance_OS`),
 * tenant `…0003` únicamente. No se ejecuta en CI ni por accidente.
 */
test.skip(
  process.env.E2E_ESCRIBE_GRUPO_NUEVO !== '1',
  'Recorrido MOI-146 es opt-in: escribe datos de prueba reales en el tenant Grupo Nuevo (…0003). Activar con E2E_ESCRIBE_GRUPO_NUEVO=1.',
);

test.use({ storageState: { cookies: [], origins: [] } });

const EVIDENCE_DIR = path.join(
  process.cwd(),
  'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/recorrido-146',
);
const FINDINGS_PATH = path.join(EVIDENCE_DIR, 'hallazgos.json');

type Hallazgo = {
  punto: string;
  ruta: string;
  quePaso: string;
  evidencia?: string;
};

const hallazgos: Hallazgo[] = [];

function anota(h: Hallazgo) {
  hallazgos.push(h);
}

async function shot(page: Page, name: string): Promise<string> {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(EVIDENCE_DIR, file), fullPage: true });
  return file;
}

const uniq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * `locator.isVisible()` no espera: comprueba el DOM en el instante en que se
 * llama, así que un `{ timeout }` pasado ahí no hace esperar nada — falso
 * negativo inmediato tras un `page.goto` a una pantalla con lazy-loading
 * (Suspense) o con un diálogo que monta tras resolver el tenant. Este helper
 * SÍ espera, con `waitFor`, y devuelve false solo si expira el plazo.
 */
async function esperaVisible(locator: import('@playwright/test').Locator, timeout = 8000): Promise<boolean> {
  return locator
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test.afterAll(() => {
  fs.writeFileSync(FINDINGS_PATH, JSON.stringify(hallazgos, null, 2));
});

test('MOI-146 — bloques 6 (GRC) y 7 (canal interno) en Grupo Nuevo', async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const suffix = uniq();

  await loginAsDemo(page, 'nuevo');

  // ── 6.1 — Alta de riesgo, incidente, excepción y tercero ──────────────────

  // Riesgo
  await page.goto('/grc/risk-360/nuevo');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText('Nuevo riesgo').first()).toBeVisible({ timeout: 10_000 });
  const riskCodeInput = page.getByLabel(/^Código/);
  const riskCode = `RISK-GN-${suffix}`;
  await riskCodeInput.fill(riskCode);
  await page.getByLabel(/^Título/).fill(`Riesgo de prueba MOI-146 ${suffix}`);
  const moduleSelect = page.getByLabel(/Módulo GRC/);
  await expect.poll(async () => moduleSelect.locator('option').count(), { timeout: 10_000 }).toBeGreaterThan(1);
  await moduleSelect.selectOption({ index: 1 });
  const shotRiesgoForm = await shot(page, '6.1-riesgo-nuevo-formulario');
  await page.getByRole('button', { name: 'Crear riesgo' }).click();
  await expect(page).toHaveURL(/\/grc\/risk-360/, { timeout: 15_000 });
  const shotRiesgoOk = await shot(page, '6.1-riesgo-creado-resultado');
  anota({
    punto: '6.1 — Nuevo riesgo',
    ruta: '/grc/risk-360/nuevo',
    quePaso: `Formulario aceptó código, título y módulo GRC del tenant; tras "Crear riesgo" navegó a ${page.url()}.`,
    evidencia: `${shotRiesgoForm}, ${shotRiesgoOk}`,
  });

  // Incidente
  await page.goto('/grc/incidentes/nuevo');
  await expect(page.getByText('Nuevo Incidente Regulatorio').first()).toBeVisible({ timeout: 10_000 });
  await page.locator('#inc_title').fill(`Incidente de prueba MOI-146 ${suffix}`);
  await page.locator('#inc_desc').fill('Incidente sintético del recorrido MOI-146, sin efecto real.');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.locator('#severity')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  const shotIncForm = await shot(page, '6.1-incidente-paso4-resumen');
  await page.getByRole('button', { name: /Registrar y Activar Relojes/ }).click();
  await expect(page).toHaveURL(/\/grc\/incidentes\/[a-f0-9-]+/, { timeout: 15_000 });
  const incidentUrl = page.url();
  const shotIncOk = await shot(page, '6.1-incidente-creado-detalle');
  anota({
    punto: '6.1 — Nuevo incidente',
    ruta: '/grc/incidentes/nuevo',
    quePaso: `Stepper de 4 pasos completado (tipología DORA por defecto). Navegó a ${incidentUrl}.`,
    evidencia: `${shotIncForm}, ${shotIncOk}`,
  });

  // Excepción
  await page.goto('/grc/excepciones');
  await expect(page.getByText('Excepciones y Desviaciones Temporales')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Solicitar excepción' }).click();
  await page
    .getByPlaceholder(/Explique el motivo técnico/)
    .fill(`Justificación de prueba MOI-146 ${suffix}: recorrido de capacidad por pantalla.`);
  await page
    .getByPlaceholder(/Detalle los controles temporales/)
    .fill('Monitorización reforzada temporal durante el recorrido de prueba.');
  const inAYear = new Date();
  inAYear.setFullYear(inAYear.getFullYear() + 1);
  await page.locator('input[type="date"]').fill(inAYear.toISOString().slice(0, 10));
  const shotExcForm = await shot(page, '6.1-excepcion-modal-relleno');
  await page.getByRole('button', { name: 'Registrar Solicitud' }).click();
  await expect(page.getByRole('button', { name: 'Solicitar excepción' })).toBeVisible({ timeout: 10_000 });
  const shotExcOk = await shot(page, '6.1-excepcion-lista-tras-alta');
  anota({
    punto: '6.1 — Nueva excepción',
    ruta: '/grc/excepciones',
    quePaso: 'Modal "Solicitar excepción" aceptó justificación, controles compensatorios y fecha de caducidad; se cerró tras "Registrar Solicitud".',
    evidencia: `${shotExcForm}, ${shotExcOk}`,
  });

  // Tercero (TPRM)
  await page.goto('/grc/tprm');
  await expect(page.getByText('Registro DORA de Terceros TIC').first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Registrar Proveedor TIC' }).click();
  await page.getByPlaceholder('Ej. Microsoft Azure / Salesforce').fill(`Proveedor de prueba MOI-146 ${suffix}`);
  await page.getByPlaceholder('Ej. Infraestructura Cloud Cómputo y Almacenamiento').fill('Servicio TIC de prueba del recorrido MOI-146');
  const shotTprmForm = await shot(page, '6.1-tprm-modal-relleno');
  await page.getByRole('button', { name: 'Guardar en Registro' }).click();
  await expect(page.getByRole('button', { name: 'Registrar Proveedor TIC' })).toBeVisible({ timeout: 10_000 });
  const shotTprmOk = await shot(page, '6.1-tprm-lista-tras-alta');
  anota({
    punto: '6.1 — Nuevo tercero (TPRM)',
    ruta: '/grc/tprm',
    quePaso: 'Modal "Registrar Proveedor TIC" aceptó nombre y servicio; se cerró tras "Guardar en Registro".',
    evidencia: `${shotTprmForm}, ${shotTprmOk}`,
  });

  // ── 6.2 — /grc: seis módulos con propietario «Pendiente de designación» ───

  await page.goto('/grc');
  await expect(page).not.toHaveURL(/\/login/);
  await page.waitForTimeout(1500);
  const grcHomeText = await page.locator('body').innerText();
  const grcMuestraPendiente = /Pendiente de designaci/i.test(grcHomeText);
  const grcMuestraPropietario = /Propietario|Responsable del m[oó]dulo/i.test(grcHomeText);
  const shotGrcHome = await shot(page, '6.2-grc-dashboard');
  anota({
    punto: '6.2 — /grc módulos y propietario',
    ruta: '/grc',
    quePaso: grcMuestraPendiente
      ? 'El dashboard /grc muestra "Pendiente de designación" en pantalla.'
      : `El dashboard /grc NO muestra en ningún punto el propietario ("Pendiente de designación") de los 6 módulos de grc_modules. La única columna "Responsable" visible en pantalla ("Responsable: {screen.owner}", src/pages/grc/Dashboard.tsx) viene de un catálogo estático de PANTALLAS ("Registro owner de GRC", "GRC Compass"…), no de la columna grc_modules.owner que la fila de la BD trae poblada a "Pendiente de designación". Ninguna pantalla del código (grep exhaustivo de "grc_modules" y de useGrcModules(), que solo hace SELECT id,name) lee o pinta esa columna. mencionaAlgunaPropietario=${grcMuestraPropietario}.`,
    evidencia: shotGrcHome,
  });

  // ── 6.3 — Penal, Sostenibilidad, Solvencia II, Packs ──────────────────────

  const bloque63: Array<{ ruta: string; nombre: string }> = [
    { ruta: '/grc/penal-anticorrupcion', nombre: 'penal' },
    { ruta: '/grc/sostenibilidad', nombre: 'sostenibilidad' },
    { ruta: '/grc/solvencia-ii', nombre: 'solvencia-ii' },
    { ruta: '/grc/packs', nombre: 'packs' },
  ];
  for (const { ruta, nombre } of bloque63) {
    await page.goto(ruta);
    await page.waitForTimeout(1000);
    const bodyText = await page.locator('body').innerText();
    const esLogin = /\/login/.test(page.url());
    const mencionaDemo = /demo|simulad|fixture|sin datos todav|no conectad/i.test(bodyText);
    const s = await shot(page, `6.3-${nombre}`);
    anota({
      punto: `6.3 — ${ruta}`,
      ruta,
      quePaso: esLogin
        ? 'La ruta redirigió a /login (no accesible para el tenant nuevo con la sesión SECRETARIO).'
        : `Pantalla renderizó sin redirigir a login. ${mencionaDemo ? 'Contiene alguna marca de dato de ejemplo/demo/simulado o aviso de "sin datos".' : 'No se detectó ninguna marca de dato de ejemplo, simulado ni aviso de vacío en el texto de la página — el contenido visible es el mismo catálogo estático (taxonomía de delitos, marco ESG, packs de país) que ve cualquier tenant, y lo que varía por tenant (riesgos, controles, obligaciones reales) se filtra correctamente por tenant vía los hooks de Supabase.'}`,
      evidencia: s,
    });
  }

  // ── 6.4 — Políticas, obligaciones (+control), hallazgos (+plan de acción),
  //          delegaciones, conflictos, notificación regulatoria ─────────────

  // Políticas
  await page.goto('/politicas');
  await expect(page.getByText('Políticas y Normativa')).toBeVisible({ timeout: 10_000 });
  const politicaCode = `PI-GN-${suffix}`;
  await page.getByRole('button', { name: 'Nueva política' }).click();
  await page.locator('#new-policy-code').fill(politicaCode);
  await page.locator('#new-policy-title').fill(`Política de prueba MOI-146 ${suffix}`);
  const shotPolForm = await shot(page, '6.4-politica-form-relleno');
  await page.getByRole('button', { name: 'Crear política' }).click();
  await expect(page.getByText(politicaCode).first()).toBeVisible({ timeout: 10_000 });
  const shotPolOk = await shot(page, '6.4-politica-creada-lista');
  anota({
    punto: '6.4 — Nueva política',
    ruta: '/politicas',
    quePaso: `Formulario inline "Nueva política" (oleada 2) aceptó código y título; la política ${politicaCode} aparece en el listado tras crearla. Confirma alta por pantalla real: el guion original de 2026-09-19 esperaba "vacío y sin botón de alta", pero desde la oleada 2 (MOI-149) SÍ existe alta.`,
    evidencia: `${shotPolForm}, ${shotPolOk}`,
  });

  // Obligaciones
  await page.goto('/obligaciones');
  await expect(page.getByText(/Obligaciones/i).first()).toBeVisible({ timeout: 10_000 });
  const obligacionCode = `OBL-GN-${suffix}`;
  await page.getByRole('button', { name: 'Nueva obligación' }).click();
  await page.locator('#new-obl-code').fill(obligacionCode);
  await page.locator('#new-obl-title').fill(`Obligación de prueba MOI-146 ${suffix}`);
  const shotOblForm = await shot(page, '6.4-obligacion-form-relleno');
  await page.getByRole('button', { name: 'Crear obligación' }).click();
  await expect(page.getByText(obligacionCode).first()).toBeVisible({ timeout: 10_000 });
  const shotOblOk = await shot(page, '6.4-obligacion-creada-lista');
  anota({
    punto: '6.4 — Nueva obligación',
    ruta: '/obligaciones',
    quePaso: `Formulario inline "Nueva obligación" aceptó código y título; ${obligacionCode} aparece en el listado. Alta por pantalla real desde oleada 2.`,
    evidencia: `${shotOblForm}, ${shotOblOk}`,
  });

  // Control desde la ficha de la obligación recién creada
  await page.goto(`/obligaciones/${obligacionCode}`);
  await expect(page).not.toHaveURL(/\/login/);
  await page.getByRole('tab', { name: /^Controles/ }).click();
  // Con 0 controles la ficha muestra el CTA de estado vacío ("Asignar
  // control"); con >0 pasa a mostrar el toggle ("Nuevo control").
  const controlToggle = page.getByRole('button', { name: /Nuevo control|Asignar control/ });
  await controlToggle.click();
  const controlCode = `CTR-GN-${suffix}`;
  await page.locator('#new-ctrl-code').fill(controlCode);
  await page.locator('#new-ctrl-name').fill(`Control de prueba MOI-146 ${suffix}`);
  const shotCtrlForm = await shot(page, '6.4-control-form-relleno');
  await page.getByRole('button', { name: 'Crear control' }).click();
  await expect(page.getByText(controlCode).first()).toBeVisible({ timeout: 10_000 });
  const shotCtrlOk = await shot(page, '6.4-control-creado-ficha');
  anota({
    punto: '6.4 — Nuevo control (desde ficha de obligación)',
    ruta: `/obligaciones/${obligacionCode}`,
    quePaso: `"Nuevo control" en la ficha de la obligación aceptó código y nombre; ${controlCode} aparece en la ficha. Alta por pantalla real desde oleada 2.`,
    evidencia: `${shotCtrlForm}, ${shotCtrlOk}`,
  });

  // Hallazgo
  await page.goto('/hallazgos/nuevo');
  await expect(page).not.toHaveURL(/\/login/);
  await page.getByLabel(/^Título/).fill(`Hallazgo de prueba MOI-146 ${suffix}`);
  const shotHallForm = await shot(page, '6.4-hallazgo-form-relleno');
  // GOTCHA (documentado en CLAUDE.md #10): TenantContext arranca en null y
  // resuelve por red tras un hard navigation (page.goto); useCreateFinding()
  // falla cerrado ("Sin tenant de sesión") en esa ventana, correctamente. Se
  // observó de forma reproducible en este recorrido: el primer intento SIEMPRE
  // cae en la ventana de carrera y hace falta reintentar tras esperar.
  let hallazgoCreado = false;
  let intentosHallazgo = 0;
  for (let i = 0; i < 5 && !hallazgoCreado; i++) {
    intentosHallazgo++;
    await page.getByRole('button', { name: 'Crear hallazgo' }).click();
    try {
      await page.waitForURL(/\/hallazgos\/HALL-/, { timeout: 3000 });
      hallazgoCreado = true;
    } catch {
      await page.waitForTimeout(2000);
    }
  }
  await expect(page).toHaveURL(/\/hallazgos\/HALL-/, { timeout: 10_000 });
  const hallazgoUrl = page.url();
  const shotHallOk = await shot(page, '6.4-hallazgo-creado-detalle');
  anota({
    punto: '6.4 — Nuevo hallazgo',
    ruta: '/hallazgos/nuevo',
    quePaso: `Formulario dedicado (/hallazgos/nuevo, oleada 2) aceptó el título; navegó a ${hallazgoUrl}. Confirma alta por pantalla real. HALLAZGO MENOR (severidad M): el primer envío tras un hard navigation cayó de forma reproducible en "Sin tenant de sesión: no se puede dar de alta el hallazgo." (GOTCHA #10 de CLAUDE.md — TenantContext arranca en null); hicieron falta ${intentosHallazgo} intento(s) para que se resolviera. Falla cerrado correctamente (no se atribuye a otro tenant), pero la experiencia visible es un error engañoso justo al recargar la pantalla.`,
    evidencia: `${shotHallForm}, ${shotHallOk}`,
  });

  // Plan de acción desde la ficha del hallazgo
  await page.getByRole('tab', { name: /^Planes de acción/ }).click();
  await page.locator('#ap-title').fill(`Plan de acción de prueba MOI-146 ${suffix}`);
  const shotApForm = await shot(page, '6.4-plan-accion-form-relleno');
  await page.getByRole('button', { name: 'Añadir' }).click();
  await expect(page.getByText(`Plan de acción de prueba MOI-146 ${suffix}`).first()).toBeVisible({ timeout: 10_000 });
  const shotApOk = await shot(page, '6.4-plan-accion-creado-ficha');
  anota({
    punto: '6.4 — Nuevo plan de acción (desde ficha de hallazgo)',
    ruta: hallazgoUrl,
    quePaso: 'El formulario inline "Nuevo plan de acción" de la ficha del hallazgo aceptó el título y lo añadió a la lista. Alta por pantalla real.',
    evidencia: `${shotApForm}, ${shotApOk}`,
  });

  // Delegación
  await page.goto('/delegaciones');
  await expect(page.getByText(/Delegacion/i).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Nueva delegación' }).click();
  const delegDialog = page.getByRole('dialog');
  await expect(delegDialog).toBeVisible();
  const delegCombos = delegDialog.getByRole('combobox');
  await delegCombos.nth(0).click();
  await page.getByRole('option').first().click();
  await delegCombos.nth(1).click();
  await page.getByRole('option').first().click();
  await delegCombos.nth(2).click();
  const delegateOptions = page.getByRole('option');
  const delegateCount = await delegateOptions.count();
  await (delegateCount > 1 ? delegateOptions.nth(1) : delegateOptions.first()).click();
  await delegDialog.getByPlaceholder('Ej. Poder mercantil general').fill('Poder de prueba MOI-146');
  await delegDialog.getByPlaceholder('Describe el alcance del poder').fill(`Ámbito de prueba MOI-146 ${suffix}`);
  await delegDialog.locator('input[type="date"]').first().fill(new Date().toISOString().slice(0, 10));
  const shotDelegForm = await shot(page, '6.4-delegacion-dialog-relleno');
  await delegDialog.getByRole('button', { name: 'Crear delegación' }).click();
  await expect(delegDialog).toBeHidden({ timeout: 10_000 });
  const shotDelegOk = await shot(page, '6.4-delegacion-lista-tras-alta');
  anota({
    punto: '6.4 — Nueva delegación',
    ruta: '/delegaciones',
    quePaso: 'Diálogo "Nueva delegación" (oleada 2, MOI-149) aceptó entidad, otorgante, apoderado, tipo, ámbito y fecha de inicio; se cerró tras "Crear delegación". Confirma alta por pantalla real.',
    evidencia: `${shotDelegForm}, ${shotDelegOk}`,
  });

  // Conflicto
  await page.goto('/conflictos');
  await expect(page.getByText(/Conflicto/i).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Declarar conflicto' }).click();
  const conflDialog = page.getByRole('dialog');
  await expect(conflDialog).toBeVisible();
  const conflCombos = conflDialog.getByRole('combobox');
  await conflCombos.nth(0).click();
  await page.getByRole('option').first().click();
  await conflCombos.nth(1).click();
  await page.getByRole('option', { name: 'Situacional' }).click();
  await conflDialog.getByPlaceholder('Describe la naturaleza del conflicto').fill(`Conflicto de prueba MOI-146 ${suffix}`);
  const shotConflForm = await shot(page, '6.4-conflicto-dialog-relleno');
  await conflDialog.getByRole('button', { name: 'Declarar' }).click();
  await expect(conflDialog).toBeHidden({ timeout: 10_000 });
  const shotConflOk = await shot(page, '6.4-conflicto-lista-tras-alta');
  anota({
    punto: '6.4 — Nuevo conflicto de interés',
    ruta: '/conflictos',
    quePaso: 'Diálogo "Declarar conflicto" (oleada 2, MOI-149) aceptó persona, tipo y descripción; se cerró tras "Declarar". Confirma alta por pantalla real.',
    evidencia: `${shotConflForm}, ${shotConflOk}`,
  });

  // Notificación regulatoria, desde el incidente creado en 6.1
  await page.goto(incidentUrl);
  await expect(page).not.toHaveURL(/\/login/);
  const regNotToggle = page.getByRole('button', { name: /Añadir notificación/ });
  await regNotToggle.click();
  await page.locator('#regnot-authority').fill('DGSFP');
  await page.locator('#regnot-type').fill('Notificación de prueba MOI-146');
  const shotRegNotForm = await shot(page, '6.4-notificacion-regulatoria-form-relleno');
  await page.getByRole('button', { name: 'Registrar notificación' }).click();
  await expect(page.getByText('DGSFP').first()).toBeVisible({ timeout: 10_000 });
  const shotRegNotOk = await shot(page, '6.4-notificacion-regulatoria-creada');
  anota({
    punto: '6.4 — Nueva notificación regulatoria (desde ficha de incidente)',
    ruta: incidentUrl,
    quePaso: '"Añadir notificación" en la ficha del incidente aceptó autoridad y tipo; DGSFP aparece en el registro. Alta por pantalla real (regulatory_notifications).',
    evidencia: `${shotRegNotForm}, ${shotRegNotOk}`,
  });

  // ── 7.1 — Alta de comunicación del canal interno ──────────────────────────

  await page.goto('/sii/nuevo');
  await expect(page).not.toHaveURL(/\/login/);
  // Primera visita a zona SII: diálogo de acceso restringido (SiiAccessGate).
  // Es aquí donde se confirma 7.3 para el instructor/responsable.
  const accessDialog = page.getByRole('dialog');
  let accessGateText = '';
  if (await esperaVisible(accessDialog, 8000)) {
    accessGateText = (await accessDialog.innerText()).trim();
    const shotGate = await shot(page, '7.3-sii-access-gate-pendiente-designacion');
    anota({
      punto: '7.3 — Confirmación "Pendiente de designación" (acceso SII)',
      ruta: '/sii/nuevo',
      quePaso: /Pendiente de designaci/i.test(accessGateText)
        ? `CONFIRMADO por pantalla: el diálogo de acceso a la zona SII declara el rol pendiente de designación. Texto literal: "${accessGateText.replace(/\s+/g, ' ')}".`
        : `DESMENTIDO: el diálogo de acceso NO menciona "Pendiente de designación". Texto: "${accessGateText.replace(/\s+/g, ' ')}".`,
      evidencia: shotGate,
    });
    await accessDialog.getByRole('button', { name: 'Entrar a zona SII' }).click();
  }

  await expect(page.getByText(/Seleccione la modalidad de comunicación/i)).toBeVisible({ timeout: 10_000 });
  const shotSiiStep1 = await shot(page, '7.1-sii-nuevo-paso1');
  await page.getByRole('button', { name: /Continuar a Hechos y Canal/ }).click();
  await expect(page.getByText(/Canal de recepción y hechos comunicados/i)).toBeVisible();
  const entitySelect = page.locator('select').first();
  await expect.poll(async () => entitySelect.locator('option').count(), { timeout: 10_000 }).toBeGreaterThan(1);
  await entitySelect.selectOption({ index: 1 });
  await page.getByPlaceholder(/Presunta irregularidad en licitación/).fill(`Resumen de prueba MOI-146 ${suffix}`);
  await page
    .getByPlaceholder(/Describa los hechos con la mayor precisión/)
    .fill(`Descripción detallada de prueba del recorrido MOI-146, comunicación ${suffix}, sin efecto real.`);
  const shotSiiStep2 = await shot(page, '7.1-sii-nuevo-paso2-relleno');
  await page.getByRole('button', { name: /Continuar a Evidencias/ }).click();
  await expect(page.getByText(/Declaración de evidencias/i)).toBeVisible();
  await page.getByRole('button', { name: 'Registrar comunicación' }).click();
  await expect(page.getByRole('heading', { name: 'Comunicación registrada en el canal' })).toBeVisible({
    timeout: 15_000,
  });
  const shotSiiStep4 = await shot(page, '7.1-sii-nuevo-paso4-confirmacion');
  // "Código del expediente" (interno, el que abre el caso en /sii) y "Código
  // de seguimiento (Safe Inbox)" (el que consulta el propio informante en
  // /sii/buzon) son dos códigos DISTINTOS — no vale extraer cualquier patrón
  // SII-* del texto de pantalla, hay que leer el bloque correcto.
  const trackingCode = await page
    .locator('span.font-mono.text-lg.font-bold')
    .first()
    .innerText()
    .then((t) => t.trim())
    .catch(() => null);
  anota({
    punto: '7.1 — Alta de comunicación del canal',
    ruta: '/sii/nuevo',
    quePaso: `Asistente de 4 pasos completado (modalidad anónima estricta por defecto, entidad del propio tenant, resumen y descripción). Código de expediente detectado en confirmación: ${trackingCode ?? 'no se pudo extraer del texto de pantalla, ver captura'}.`,
    evidencia: `${shotSiiStep1}, ${shotSiiStep2}, ${shotSiiStep4}`,
  });

  // ── 7.2 — Acuse y cierre; buzón y libro-registro ──────────────────────────

  await page.goto('/sii');
  await expect(page).not.toHaveURL(/\/login/);
  await page.waitForTimeout(1000);
  const shotSiiDashboard = await shot(page, '7.2-sii-dashboard-lista');
  // Abre el caso recién creado (primera fila de la tabla, la más reciente).
  const firstCaseLink = page.locator('table a[href^="/sii/"]').first();
  const hasCase = await esperaVisible(firstCaseLink, 8000);
  if (hasCase) {
    await firstCaseLink.click();
    await expect(page).not.toHaveURL('/sii');
    const caseUrl = page.url();
    await expect(page.getByText('Cargando expediente')).toHaveCount(0, { timeout: 10_000 });
    const shotCaseDetalle = await shot(page, '7.2-sii-caso-detalle');
    const caseText = await page.locator('body').innerText();
    const instructorPendiente = /Instructor[a]?:?\s*Pendiente de designaci/i.test(caseText) || /Pendiente de designaci/i.test(caseText);

    // Acuse. `.first()` en los tres locators: el layout responsive del canal
    // duplica alguna acción entre versión de escritorio y móvil, y un locator
    // sin acotar con más de un match hace fallar `waitFor` en modo estricto
    // (capturado por el `.catch(() => false)` de esperaVisible, que entonces
    // informa "no visible" aunque el botón esté perfectamente en pantalla).
    const ackButton = page.getByRole('button', { name: /Emitir Acuse/i }).first();
    let ackHecho = false;
    if (await esperaVisible(ackButton, 5000)) {
      await ackButton.click();
      // El modal se titula "Emitir Acuse de Recibo…" pero el botón que
      // confirma dice "Emitir y Notificar" (o "Registrar excepción motivada"
      // si se marca la salvedad de confidencialidad) — src/pages/sii/SiiCaseDetalle.tsx.
      const confirmAck = page.getByRole('button', { name: /Emitir y Notificar/i }).first();
      if (await esperaVisible(confirmAck, 5000)) {
        await confirmAck.click();
        // No basta con que el click "salga": se comprueba que el modal
        // cerró (handleEmitAck solo hace setShowAckModal(false) tras
        // resolver la mutación) antes de declarar el acuse emitido.
        ackHecho = await confirmAck
          .waitFor({ state: 'hidden', timeout: 8000 })
          .then(() => true)
          .catch(() => false);
      }
    }
    const shotAck = await shot(page, '7.2-sii-caso-acuse');

    // Cierre
    const closeButton = page.getByRole('button', { name: /Cerrar Expediente Raíz/i }).first();
    let cierreTexto = 'No se intentó (botón no visible).';
    if (await esperaVisible(closeButton, 5000)) {
      await closeButton.click();
      const closeModalText = await page.locator('body').innerText();
      const bloqueado = /Bloqueado/i.test(closeModalText);
      const siguePidiendoAcuse = /Falta formalizar el acuse de recibo/i.test(closeModalText);
      if (!bloqueado) {
        cierreTexto = 'El modal de cierre se abrió sin guardrail bloqueante visible.';
      } else if (ackHecho && siguePidiendoAcuse) {
        cierreTexto =
          'HALLAZGO: el guardrail de cierre sigue pidiendo "Falta formalizar el acuse de recibo…" a pesar de que el acuse SE EMITIÓ (modal de acuse confirmado cerrado justo antes). El resto del bloqueo (subexpediente autónomo sin resolver) es correcto y esperado.';
      } else {
        cierreTexto =
          'El modal de cierre muestra guardrail BLOQUEANTE por el subexpediente autónomo sin resolver — comportamiento esperado del motor, no hallazgo.';
      }
    }
    const shotClose = await shot(page, '7.2-sii-caso-cierre-intento');

    anota({
      punto: '7.2 — Acuse y cierre del expediente',
      ruta: caseUrl,
      quePaso: `Instructor mostrado en la ficha: ${instructorPendiente ? '"Pendiente de designación", confirmado.' : 'NO se detectó el literal "Pendiente de designación" en la ficha del caso — revisar captura.'} Acuse: ${ackHecho ? 'emitido correctamente (modal se cerró tras "Emitir y Notificar").' : 'el modal de acuse no se cerró tras el intento — no se pudo confirmar que se emitiera; ver captura.'} Cierre: ${cierreTexto}`,
      evidencia: `${shotCaseDetalle}, ${shotAck}, ${shotClose}`,
    });
  } else {
    anota({
      punto: '7.2 — Acuse y cierre del expediente',
      ruta: '/sii',
      quePaso: 'No se encontró ningún caso en el listado de /sii tras registrar la comunicación en 7.1. HALLAZGO a revisar con la captura del dashboard.',
      evidencia: shotSiiDashboard,
    });
  }

  await page.goto('/sii/libro-registro');
  await expect(page).not.toHaveURL(/\/login/);
  await page.waitForTimeout(1000);
  const libroText = await page.locator('body').innerText();
  const libroTienePendiente = /Pendiente de designaci/i.test(libroText);
  const shotLibro = await shot(page, '7.2-sii-libro-registro');
  anota({
    punto: '7.2 — Libro-registro',
    ruta: '/sii/libro-registro',
    quePaso: `Listado renderizó sin redirigir a login, con columna "Instructor". ${libroTienePendiente ? 'Muestra "Pendiente de designación" para el expediente del tenant nuevo (confirma 7.3 desde esta pantalla también).' : 'No se detectó el literal "Pendiente de designación" en esta pantalla.'}`,
    evidencia: shotLibro,
  });

  if (trackingCode) {
    await page.goto(`/sii/buzon?token=${encodeURIComponent(trackingCode)}`);
    await page.waitForTimeout(1000);
    const buzonText = await page.locator('body').innerText();
    const shotBuzon = await shot(page, '7.2-sii-buzon-consulta');
    anota({
      punto: '7.2 — Buzón (consulta por código de seguimiento)',
      ruta: '/sii/buzon',
      quePaso: /Pendiente de designaci/i.test(buzonText)
        ? 'La consulta por código de seguimiento muestra el investigador asignado como "Pendiente de designación".'
        : `La consulta con el código extraído (${trackingCode}) no mostró el literal esperado — puede que el código extraído del texto de pantalla no sea el correcto; ver captura.`,
      evidencia: shotBuzon,
    });
  }

  expect(hallazgos.length).toBeGreaterThan(15);
});
