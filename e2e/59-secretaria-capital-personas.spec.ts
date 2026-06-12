// ITEM-124 — Cobertura e2e ausente en steppers de capital/personas + ruta
// sociedad de DesignarAdmin. Antes de este spec, grep de rutas sobre e2e/*.spec.ts
// para 'socio/nuevo', 'sociedades/:id/transmision', 'sociedades/:id/admin/nuevo'
// y 'personas/nueva' (stepper) devolvía 0 specs; DesignarAdminStepper solo estaba
// cubierto por e2e/44 vía /secretaria/cargos/nuevo (variante con steps distintos).
//
// Estos tests cubren el happy path UI de cuatro steppers: navegar, rellenar los
// pasos mínimos y verificar el avance/resumen. Siguen el patrón de
// e2e/18-secretaria-golden-path.spec.ts y e2e/44-personas-cargos-flow.spec.ts
// (page objects, selectores estables, auth demo vía fixture base).
//
// Política de escritura: NO confirman el submit final (que insertaría filas demo
// en Cloud governance_OS). Cada test ejercita el wizard hasta el paso de
// confirmación inclusive y valida el resumen, sin pulsar el botón de guardado
// terminal. El gate real de inserción (botón "Añadir socio" / "Registrar
// transmisión" / "Designar" / "Crear persona completa") se deja como acción
// destructiva fuera de scope de este spec, alineado con el criterio
// destructive-guard del backlog (ITEM-129).
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';

test.describe.configure({ timeout: 90_000 });

const ARGA_ENTITY_NAME = 'ARGA Seguros, S.A.';

const FATAL_UI_PATTERNS = [
  /Ha ocurrido un error/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /function .* does not exist/i,
  /permission denied/i,
  /violates row-level security/i,
  /Falta id de sociedad/i,
];

async function expectNoFatalUi(page: Page) {
  await expect(page).not.toHaveURL(/\/login/);
  for (const pattern of FATAL_UI_PATTERNS) {
    await expect(page.getByText(pattern).first()).toHaveCount(0);
  }
}

// Resuelve el entity_id canónico de ARGA Seguros vía el selector de sociedad del
// scope-switcher, sin hardcodear el UUID (mismo enfoque que e2e/34).
async function getArgaEntityId(page: Page): Promise<string> {
  await page.goto('/secretaria?scope=sociedad');
  const sociedadSelect = page.getByLabel('Sociedad seleccionada');
  await expect(sociedadSelect).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => sociedadSelect.locator('option').count(), { timeout: 15_000 })
    .toBeGreaterThan(1);

  const entityId = await sociedadSelect.evaluate((select, entityName) => {
    const options = Array.from((select as HTMLSelectElement).options);
    return options.find((option) => option.textContent?.includes(entityName))?.value ?? '';
  }, ARGA_ENTITY_NAME);

  expect(entityId, 'Debe existir ARGA Seguros en el selector de sociedad').toBeTruthy();
  return entityId;
}

// Selecciona la primera opción "real" (value no vacío) de un <select>.
async function selectFirstRealOption(select: ReturnType<Page['locator']>): Promise<string> {
  const value = await select.evaluate((el) => {
    const sel = el as HTMLSelectElement;
    const opt = Array.from(sel.options).find((o) => o.value !== '');
    return opt?.value ?? '';
  });
  expect(value, 'El selector debe tener al menos una opción seleccionable').toBeTruthy();
  await select.selectOption(value);
  return value;
}

test.describe('Secretaría — steppers de capital y personas (ITEM-124)', () => {
  // ── AnadirSocioStepper · /secretaria/sociedades/:id/socio/nuevo ──────────────
  test('AnadirSocioStepper: Persona → Participación → Confirmar (happy path)', async ({ page }) => {
    const entityId = await getArgaEntityId(page);
    await page.goto(`/secretaria/sociedades/${entityId}/socio/nuevo`);

    await expect(page.getByRole('heading', { name: /Añadir socio a/i, level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoFatalUi(page);

    // Paso 1 (Persona): el botón Siguiente está bloqueado hasta elegir titular.
    const next = page.getByRole('button', { name: 'Siguiente' });
    await expect(next).toBeDisabled();

    const personaSelect = page.getByRole('combobox').first();
    await expect(personaSelect).toBeVisible({ timeout: 15_000 });
    await selectFirstRealOption(personaSelect);
    await expect(next).toBeEnabled();
    await next.click();

    // Paso 2 (Participación): clase auto-seleccionada; rellenar número de títulos.
    await expect(page.getByText(/Clase de título/i)).toBeVisible({ timeout: 10_000 });
    const titulosInput = page.getByRole('spinbutton').first();
    await expect(titulosInput).toBeVisible();
    await titulosInput.fill('1');
    await expect(next).toBeEnabled();
    await next.click();

    // Paso 3 (Confirmar): resumen + botón terminal visible (NO se pulsa).
    await expect(page.getByText(/Revisa la participación antes de crear/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('term').filter({ hasText: /Titular/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Añadir socio/i })).toBeVisible();
    await expectNoFatalUi(page);
  });

  // ── TransmisionStepper · /secretaria/sociedades/:id/transmision ─────────────
  test('TransmisionStepper: Origen → Destino → Soporte → Confirmar (happy path)', async ({
    page,
  }) => {
    const entityId = await getArgaEntityId(page);
    await page.goto(`/secretaria/sociedades/${entityId}/transmision`);

    await expect(
      page.getByRole('heading', { name: /Transmisión de titularidad/i, level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoFatalUi(page);

    const next = page.getByRole('button', { name: 'Siguiente' });

    // Paso 1 (Origen): seleccionar asiento + títulos a transmitir.
    await expect(next).toBeDisabled();
    const origenSelect = page.getByRole('combobox').first();
    await expect(origenSelect).toBeVisible({ timeout: 15_000 });
    await selectFirstRealOption(origenSelect);
    const titulosInput = page.getByRole('spinbutton').first();
    await titulosInput.fill('1');
    await expect(next).toBeEnabled();
    await next.click();

    // Paso 2 (Destino): adquirente distinto del origen.
    await expect(page.getByText(/Persona adquirente/i)).toBeVisible({ timeout: 10_000 });
    const destinoSelect = page.getByRole('combobox').first();
    await selectFirstRealOption(destinoSelect);
    await expect(next).toBeEnabled();
    await next.click();

    // Paso 3 (Soporte): referencia documental obligatoria.
    await expect(page.getByText(/Documento soporte/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(next).toBeDisabled();
    await page
      .getByRole('textbox')
      .first()
      .fill('evidence://ead-trust/ARGA_SEG_TRANSMISION_E2E_ITEM124');
    await expect(next).toBeEnabled();
    await next.click();

    // Paso 4 (Confirmar): resumen + botón terminal visible (NO se pulsa).
    await expect(page.getByText(/cerrará la holding de origen/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('term').filter({ hasText: /Origen/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar transmisión/i })).toBeVisible();
    await expectNoFatalUi(page);
  });

  // ── DesignarAdminStepper (ruta sociedad) · /sociedades/:id/admin/nuevo ──────
  // Variante distinta a /cargos/nuevo (cubierta por e2e/44): aquí entityId viene
  // de la URL, así que NO se inserta el paso "Sociedad" y los STEPS son
  // [Persona, Cargo, Designación, Confirmar].
  test('DesignarAdminStepper ruta sociedad: Persona → Cargo → Designación → Confirmar', async ({
    page,
  }) => {
    const entityId = await getArgaEntityId(page);
    await page.goto(`/secretaria/sociedades/${entityId}/admin/nuevo`);

    await expect(
      page.getByRole('heading', { name: /Designar administrador\/consejero/i, level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoFatalUi(page);

    // Las píldoras de pasos NO deben incluir "Sociedad" (entityId viene en URL).
    const stepList = page.locator('ol').first();
    await expect(stepList).toContainText(/Persona/);
    await expect(stepList).toContainText(/Cargo/);
    await expect(stepList).not.toContainText(/Sociedad/);

    const next = page.getByRole('button', { name: 'Siguiente' });

    // Paso 1 (Persona): el segundo combobox es "Persona designada".
    await expect(next).toBeDisabled();
    const personaSelect = page.getByRole('combobox').nth(1);
    await expect(personaSelect).toBeVisible({ timeout: 15_000 });
    await selectFirstRealOption(personaSelect);
    await expect(next).toBeEnabled();
    await next.click();

    // Paso 2 (Cargo): seleccionar ADMIN_UNICO (no colegiado → sin órgano ni rep
    // requerido cuando la persona es PF) para avanzar sin dependencias.
    const cargoSelect = page.getByLabel(/Tipo de cargo/i);
    await expect(cargoSelect).toBeVisible({ timeout: 10_000 });
    await cargoSelect.selectOption('ADMIN_UNICO');
    await expect(next).toBeEnabled();
    await next.click();

    // Paso 3 (Designación): fuente + fecha ya tienen defaults → avanzar.
    await expect(page.getByText(/Fuente de designación/i)).toBeVisible({ timeout: 10_000 });
    await expect(next).toBeEnabled();
    await next.click();

    // Paso 4 (Confirmar): resumen + botón terminal visible (NO se pulsa).
    await expect(page.getByText(/condiciones_persona/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('term').filter({ hasText: /Tipo de cargo/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Designar$/i })).toBeVisible();
    await expectNoFatalUi(page);
  });

  // ── PersonaNuevaStepper · /secretaria/personas/nueva ────────────────────────
  // 6 pasos (Tipo, Identidad, Contacto, Registro, Gobierno, Confirmar). Cubrimos
  // el happy path PF rellenando los obligatorios de cada paso.
  test('PersonaNuevaStepper PF: recorre los 6 pasos hasta Confirmar (happy path)', async ({
    page,
  }) => {
    await page.goto('/secretaria/personas/nueva');

    await expect(page.getByRole('heading', { name: /Alta completa de persona/i, level: 1 })).toBeVisible(
      { timeout: 15_000 },
    );
    await expectNoFatalUi(page);

    const next = page.getByRole('button', { name: 'Siguiente' });

    // Paso 1 (Tipo): PF viene por defecto, pero lo seleccionamos explícitamente.
    await page.getByRole('button', { name: /Persona física/i }).click();
    await expect(next).toBeEnabled();
    await next.click();

    // Paso 2 (Identidad): nombre + NIF único (no colisiona con demo) + país.
    await page.getByLabel(/Nombre completo/i).fill('Persona E2E ITEM124');
    await page.getByLabel(/DNI\/NIE\/Pasaporte/i).fill('00000124-Z');
    // Esperar a que termine el precheck debounced de tax_id sin conflicto.
    await expect(page.getByText(/Comprobando disponibilidad/i)).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByText(/Ya existe una persona con este NIF/i)).toHaveCount(0);
    await expect(next).toBeEnabled({ timeout: 5_000 });
    await next.click();

    // Paso 3 (Contacto): email, teléfono, domicilio, CP, localidad, país.
    await page.getByLabel(/Email principal/i).fill('persona.e2e.item124@arga-seguros.com');
    await page.getByLabel(/^Teléfono/i).fill('+34 600 124 124');
    await page.getByLabel(/^Domicilio \*/i).fill('Paseo de la Castellana 124');
    await page.getByLabel(/Código postal/i).fill('28046');
    await page.getByLabel(/Localidad \*/i).fill('Madrid');
    await expect(next).toBeEnabled({ timeout: 5_000 });
    await next.click();

    // Paso 4 (Registro PF): nacionalidad + fecha de nacimiento.
    await page.getByLabel(/Nacionalidad/i).fill('ES');
    await page.getByLabel(/Fecha de nacimiento/i).fill('1980-01-01');
    await expect(next).toBeEnabled({ timeout: 5_000 });
    await next.click();

    // Paso 5 (Gobierno): perfil + KYC ya con defaults; evidencia obligatoria.
    await page.getByLabel(/Tipo de evidencia de alta/i).fill('DNI');
    await page.getByLabel(/Referencia de evidencia/i).fill('DOC-E2E-ITEM124');
    await expect(next).toBeEnabled({ timeout: 5_000 });
    await next.click();

    // Paso 6 (Confirmar): resumen + botón terminal visible (NO se pulsa).
    await expect(page.getByText('Persona E2E ITEM124').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Crear persona completa/i })).toBeVisible();
    await expectNoFatalUi(page);
  });
});
