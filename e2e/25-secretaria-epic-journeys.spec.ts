import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';

test.describe.configure({ timeout: 90_000 });

const FATAL_UI_PATTERNS = [
  /Ha ocurrido un error/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /function .* does not exist/i,
  /permission denied/i,
  /violates row-level security/i,
];

function collectFailedSupabaseResponses(page: Page) {
  const failed: string[] = [];
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && url.includes('supabase.co/rest/v1')) {
      failed.push(`${status} ${url}`);
    }
  });
  return failed;
}

async function stubExpiredVotingCloseRpc(page: Page) {
  await page.route(/\/rest\/v1\/rpc\/fn_cerrar_votaciones_vencidas/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '0',
    });
  });
}

async function expectNoFatalUi(page: Page) {
  await expect(page).not.toHaveURL(/\/login/);
  for (const pattern of FATAL_UI_PATTERNS) {
    await expect(page.getByText(pattern).first()).toHaveCount(0);
  }
}

async function getDemoSociedadId(page: Page) {
  await page.goto('/secretaria?scope=sociedad');
  const sociedadSelect = page.locator('aside select[aria-label="Sociedad seleccionada"]');
  await expect(sociedadSelect).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => sociedadSelect.locator('option').count(), { timeout: 10_000 }).toBeGreaterThan(1);

  const selected = await sociedadSelect.evaluate((select) => {
    const options = Array.from((select as HTMLSelectElement).options);
    return options.find((option) => option.textContent?.includes('ARGA Seguros, S.A.'))?.value ?? options[1]?.value;
  });
  expect(selected).toBeTruthy();
  await sociedadSelect.selectOption(selected!);
  await expect.poll(async () => sociedadSelect.inputValue(), { timeout: 10_000 }).toBe(selected);
  return selected!;
}

async function openFirstConvocatoriaDetalle(page: Page) {
  await page.goto('/secretaria/convocatorias?scope=grupo');
  await expect(page.locator('main').getByRole('heading', { name: 'Convocatorias', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('tbody')).toContainText('ARGA', { timeout: 20_000 });

  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 10_000 });
  await firstRow.locator('td').first().click();
  if (!/\/secretaria\/convocatorias\/[^/?]+/.test(page.url())) {
    await firstRow.locator('td').first().dblclick();
  }
  await expect(page).toHaveURL(/\/secretaria\/convocatorias\/[^/?]+/);
}

test.describe('Secretaría — epic user journeys', () => {
  test('convocatoria muestra agenda, indice PRE, canales y trazabilidad documental', async ({ page }) => {
    const failedSupabaseResponses = collectFailedSupabaseResponses(page);

    await openFirstConvocatoriaDetalle(page);

    await expect(page.getByRole('button', { name: /Convocatoria DOCX|Convocatoria con plantilla/ })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: /Informe PRE/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Orden del día' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Índice documental PRE' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Canales de publicación' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reunión operativa' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trazabilidad' })).toBeVisible();
    await expectNoFatalUi(page);
    expect(failedSupabaseResponses).toEqual([]);
  });

  test('libro de socios enlaza capital, transmisiones y movimientos sin ejecutar escritura', async ({ page }) => {
    const failedSupabaseResponses = collectFailedSupabaseResponses(page);
    const entityId = await getDemoSociedadId(page);

    await page.goto(`/secretaria/sociedades/${entityId}`);
    await expect(page.getByRole('heading', { name: /ARGA Seguros/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Socios' }).click();
    await expect(page.getByRole('columnheader', { name: 'Títulos' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: '% Capital' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Transmisión' }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Transmisión' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/secretaria/sociedades/${entityId}/transmision`));
    await expect(page.getByRole('heading', { name: /Transmisión de titularidad/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Asiento de origen')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar transmisión' })).toHaveCount(0);

    await page.goto(`/secretaria/libro-socios?scope=sociedad&entity=${entityId}`);
    await expect(page.getByRole('heading', { name: /Libro de socios de/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: 'Tipo' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Δ Participaciones' })).toBeVisible();
    await expect(page.getByText(/Registro WORM append-only|Cada movimiento queda ligado al expediente societario/i).first()).toBeVisible();
    await expectNoFatalUi(page);
    expect(failedSupabaseResponses).toEqual([]);
  });

  test('decisiones unipersonales y acuerdos sin sesión exponen variantes sin certificar prematuramente', async ({ page }) => {
    const failedSupabaseResponses = collectFailedSupabaseResponses(page);
    await stubExpiredVotingCloseRpc(page);

    await page.goto('/secretaria/decisiones-unipersonales');
    await expect(page.getByRole('heading', { name: 'Decisiones de socio único / administrador único' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: 'Nueva decisión' })).toBeVisible();
    await page.getByRole('button', { name: 'Nueva decisión' }).click();
    await expect(page.getByText('Socio único (art. 15 LSC)')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Administrador único (art. 210 LSC)')).toBeVisible();
    await expect(page.getByText(/modo unipersonal sea válido/i)).toBeVisible();
    await expect(page.locator('nav[aria-label="Pasos"]').getByRole('button', { name: /Registro y documento/ })).toBeDisabled();

    await page.goto('/secretaria/acuerdos-sin-sesion');
    await expect(page.getByRole('heading', { name: 'Acuerdos escritos sin sesión' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Sin sesión (unanimidad)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Co-aprobación (k de n)' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Administrador solidario' })).toBeVisible();

    await page.getByRole('button', { name: 'Co-aprobación (k de n)' }).click();
    await expect(page.getByText('Secretaría · Co-aprobación')).toBeVisible({ timeout: 10_000 });
    await page.goto('/secretaria/acuerdos-sin-sesion/solidario');
    await expect(page.getByText('Administrador solidario')).toBeVisible({ timeout: 10_000 });
    await expectNoFatalUi(page);
    expect(failedSupabaseResponses).toEqual([]);
  });

  test('actas y tramitador mantienen frontera demo: preparado para registro, no envio RM', async ({ page }) => {
    const failedSupabaseResponses = collectFailedSupabaseResponses(page);

    await page.goto('/secretaria/actas');
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 15_000 });
    await firstRow.getByRole('link').click();
    await expect(page).toHaveURL(/\/secretaria\/actas\/[^/?]+/);
    await expect(page.getByRole('heading', { name: 'Revisión legal para certificación' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/no constituye evidencia final productiva|no final productiva/i).first()).toBeVisible();

    await page.goto('/secretaria/tramitador');
    await expect(page.getByRole('heading', { name: 'Tramitaciones registrales' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Presentado al registro')).toHaveCount(0);
    await expect(page.getByText('Enviado al Registro')).toHaveCount(0);
    await expect(page.getByText('se enviará automáticamente')).toHaveCount(0);
    await expect(page.getByText('Enviando…')).toHaveCount(0);
    await expectNoFatalUi(page);
    expect(failedSupabaseResponses).toEqual([]);
  });
});
