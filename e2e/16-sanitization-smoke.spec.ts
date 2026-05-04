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
  /JWT expired/i,
];

async function isVisible(page: Page, pattern: RegExp): Promise<boolean> {
  const heading = page.getByRole('heading', { name: pattern }).first();
  if (await heading.isVisible().catch(() => false)) return true;
  return page.getByText(pattern).first().isVisible().catch(() => false);
}

async function expectAnySignal(page: Page, signals: RegExp[]) {
  await expect
    .poll(async () => {
      for (const signal of signals) {
        if (await isVisible(page, signal)) return true;
      }
      return false;
    }, { timeout: 15_000 })
    .toBe(true);
}

async function expectNoFatalUi(page: Page) {
  await expect(page).not.toHaveURL(/\/login/);
  for (const pattern of FATAL_UI_PATTERNS) {
    await expect(page.getByText(pattern).first()).toHaveCount(0);
  }
}

async function restoreDemoSessionIfNeeded(page: Page, path: string) {
  const isLoginUrl = /\/login/.test(page.url());
  const loginButton = page.getByRole('button', { name: 'Acceder como demo' });
  const isLoginScreen = await loginButton.isVisible().catch(() => false);

  if (!isLoginUrl && !isLoginScreen) return;

  await loginButton.click();
  await page.waitForURL('/', { timeout: 20_000 });
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function visitRoute(page: Page, path: string, signals: RegExp[]) {
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await restoreDemoSessionIfNeeded(page, path);
  await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
  await expectAnySignal(page, signals);
  await expectNoFatalUi(page);
}

async function openFirstDataRow(
  page: Page,
  path: string,
  signals: RegExp[],
  detailUrl: RegExp,
  label: string,
) {
  await visitRoute(page, path, signals);

  const rows = page.locator('tbody tr');
  const rowCount = await rows.count();
  for (let index = 0; index < rowCount; index += 1) {
    const row = rows.nth(index);
    const cells = row.locator('td');
    if ((await cells.count()) <= 1) continue;

    await cells.first().click();
    if (!detailUrl.test(page.url())) {
      await cells.first().dblclick();
    }
    await expect(page).toHaveURL(detailUrl);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await expectNoFatalUi(page);
    return;
  }

  throw new Error(`${label}: no hay fila demo navegable para el smoke de sanitizacion`);
}

test.describe('Sanitization smoke — AIMS-GRC', () => {
  test('pantallas core renderizan contra Cloud actual', async ({ page }) => {
    const routes: Array<{ path: string; signals: RegExp[] }> = [
      { path: '/ai-governance', signals: [/AI Governance/i, /Sistemas IA activos/i, /Readiness de demo AIMS/i] },
      { path: '/ai-governance/sistemas', signals: [/Sistemas IA/i, /Buscar sistema/i] },
      { path: '/ai-governance/sistemas/nuevo', signals: [/Nuevo sistema IA/i, /Nombre del sistema/i] },
      { path: '/ai-governance/evaluaciones', signals: [/Evaluaciones/i, /Evaluaci[oó]n/i] },
      { path: '/ai-governance/incidentes', signals: [/Incidentes IA/i, /Incidente/i] },
      { path: '/ai-governance/incidentes/nuevo', signals: [/Nuevo incidente IA/i, /Sistema IA afectado/i] },
      { path: '/grc', signals: [/Mesa de trabajo GRC/i, /Riesgos cr[ií]ticos/i, /Readiness ejecutivo P0/i, /Contexto técnico y contratos/i] },
      { path: '/grc/risk-360', signals: [/Risk 360/i, /Riesgo/i] },
      { path: '/grc/risk-360/nuevo', signals: [/Nuevo riesgo/i, /Código/i] },
      { path: '/grc/penal-anticorrupcion', signals: [/Penal/i, /Anticorrupci[oó]n/i] },
      { path: '/grc/packs', signals: [/Packs por Pa[ií]s/i, /Pack/i] },
      { path: '/grc/mywork', signals: [/Mi Trabajo/i, /Trabajo/i] },
      { path: '/grc/alertas', signals: [/Alertas/i] },
      { path: '/grc/excepciones', signals: [/Excepciones/i] },
    ];

    for (const route of routes) {
      await test.step(route.path, async () => {
        await visitRoute(page, route.path, route.signals);
      });
    }
  });

  test('AIMS declara postura por pantalla y handoffs sin writes cross-module', async ({ page }) => {
    await visitRoute(page, '/ai-governance', [/Readiness de demo AIMS/i]);
    await expect(page.getByText('Contexto técnico AIMS')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Handoffs de solo lectura' })).toBeVisible();
    await expect(page.getByText('solo lectura demo').first()).toBeVisible();
    await expect(page.getByText('SECRETARIA_CERTIFICATION_ISSUED')).toBeVisible();
    await expect(page.getByText(/AIMS enruta contexto, no toma decisiones/i)).toBeVisible();
  });
});

test.describe('Sanitization smoke — Secretaria', () => {
  test('flujo convocatoria reunion acuerdo acta certificacion documento renderiza', async ({ page }) => {
    await test.step('convocatoria detalle', async () => {
      await openFirstDataRow(
        page,
        '/secretaria/convocatorias?scope=grupo',
        [/Convocatorias/i],
        /\/secretaria\/convocatorias\/[^/?]+/,
        'convocatorias',
      );
      await expect(page.getByRole('button', { name: 'Convocatoria DOCX' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Informe PRE' })).toBeVisible();
    });

    await test.step('reunion detalle', async () => {
      await openFirstDataRow(
        page,
        '/secretaria/reuniones?scope=grupo',
        [/Reuniones/i],
        /\/secretaria\/reuniones\/[^/?]+/,
        'reuniones',
      );
      await expectAnySignal(page, [/Constituci[oó]n/i, /Qu[oó]rum/i, /Debates/i, /Votaciones/i, /Cierre/i]);
    });

    await test.step('acuerdo sin sesion asistente', async () => {
      await visitRoute(
        page,
        '/secretaria/acuerdos-sin-sesion/nuevo',
        [/Asistente de acuerdo escrito sin sesi[oó]n/i, /Paso 1/i],
      );
    });

    await test.step('acta y certificacion', async () => {
      await openFirstDataRow(
        page,
        '/secretaria/actas',
        [/Actas y certificaciones/i],
        /\/secretaria\/actas\/[^/?]+/,
        'actas',
      );
      await expect(page.getByRole('button', { name: 'Acta DOCX' })).toBeVisible();
      await expectAnySignal(page, [/Certificaciones emitidas/i, /Certificaci[oó]n DOCX/i, /Emitir certificaci[oó]n/i]);
    });

    await test.step('gestor documental', async () => {
      await visitRoute(page, '/secretaria/gestor-plantillas', [/Plantillas con contenido jur[ií]dico/i]);
    });
  });
});
