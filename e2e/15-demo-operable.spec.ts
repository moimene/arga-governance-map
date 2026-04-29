import { test, expect } from './fixtures/base';

const scenarioCases = [
  { id: 'JUNTA_UNIVERSAL_OK', label: 'Junta universal correcta', outcome: 'ADOPTADO' },
  { id: 'JUNTA_UNIVERSAL_FAIL_99', label: 'Universal incompleta', outcome: 'BLOQUEADO' },
  { id: 'VETO_BLOCK', label: 'Veto pactado', outcome: 'BLOQUEADO' },
  { id: 'DOBLE_UMBRAL_FAIL', label: 'Doble umbral fallido', outcome: 'BLOQUEADO' },
  { id: 'CONFLICTO_EXCLUSION_OK', label: 'Conflicto con exclusion', outcome: 'ADOPTADO' },
] as const;

function isShellSupabaseRead(url: string) {
  return url.includes('/rest/v1/user_profiles?') || url.includes('/rest/v1/notifications?');
}

function isBlockedDemoExternalCall(url: string, blockSupabaseDomainReads = false) {
  const supabaseDomainRead =
    url.includes('supabase.co') &&
    (url.includes('/rest/v1') || url.includes('/rpc/') || url.includes('/storage/v1')) &&
    !isShellSupabaseRead(url);

  return (
    url.includes('legalappfactory.okta.com') ||
    url.includes('api.int.gcloudfactory.com') ||
    url.includes('/digital-trust') ||
    url.includes('/signature-manager') ||
    (blockSupabaseDomainReads && supabaseDomainRead)
  );
}

function collectBlockedDemoExternalCalls(page, blockSupabaseDomainReads = false) {
  const blockedExternalCalls: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (isBlockedDemoExternalCall(url, blockSupabaseDomainReads)) {
      blockedExternalCalls.push(url);
    }
  });
  return blockedExternalCalls;
}

test.describe('Demo-Operable commercial shell', () => {
  test('dashboard exposes board-oriented demo surface and five controlled scenarios', async ({ page }) => {
    const blockedExternalCalls = collectBlockedDemoExternalCalls(page);

    await page.goto('/');

    await expect(page.getByText('Consola de decisión del Consejo')).toBeVisible();
    await expect(page.getByText('DEMO MODE')).toBeVisible();
    await expect(page.getByText('Sandbox verificable')).toBeVisible();
    await expect(page.getByText('Casos de consejo')).toBeVisible();
    await expect(page.getByText('Entorno sandbox controlado')).toBeVisible();

    for (const scenario of scenarioCases.map((item) => item.id)) {
      await expect(page.locator(`a[href="/demo-operable/${scenario}"]`).first()).toBeVisible();
    }

    await expect(page.getByText('Adoptable').first()).toBeVisible();
    await expect(page.getByText('Bloqueada').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Ver decisión: Junta universal correcta/i })).toBeVisible();
    expect(blockedExternalCalls).toEqual([]);
  });

  test('primary demo scenario opens deterministic Sprint 2 result', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Simular junta universal/i }).click();

    await expect(page).toHaveURL(/\/demo-operable\/JUNTA_UNIVERSAL_OK/);
    await expect(page.getByRole('heading', { name: /El consejo puede avanzar/i })).toBeVisible();
    await expect(page.getByText('Junta universal correcta')).toBeVisible();
    await expect(page.getByText('Dashboard por rol de gobierno')).toBeVisible();
    await expect(page.getByText('Validación del acuerdo')).toBeVisible();
    await expect(page.getByText('Explicación para el consejero')).toBeVisible();
    await expect(page.getByText('Confianza demo')).toBeVisible();
    await expect(page.getByText('Integración QTSP API preparada')).toBeVisible();
    await expect(page.getByText('Proxy servidor requerido')).toBeVisible();
    await expect(page.getByText('QES_SANDBOX')).toBeVisible();
    await expect(page.getByText('/api/v1/private/signature-requests').first()).toBeVisible();
    await expect(page.getByText('ARGA_DEMO_PACK_V1')).toBeVisible();
    await expect(page.getByText('source_of_truth=none')).toBeVisible();
    await expect(page.getByText('finalEvidence=false')).toBeVisible();
    await expect(page.getByText('EAD Trust · SANDBOX')).toBeVisible();
  });

  test('all canonical demo scenarios render deterministic local outcomes', async ({ page }) => {
    const blockedExternalCalls = collectBlockedDemoExternalCalls(page, true);

    for (const scenario of scenarioCases) {
      await test.step(`scenario ${scenario.id}`, async () => {
        await page.goto(`/demo-operable/${scenario.id}`);

        await expect(page.getByText(scenario.label)).toBeVisible();
        await expect(page.getByText(scenario.outcome, { exact: true }).first()).toBeVisible();
        await expect(page.getByText('Dashboard por rol de gobierno')).toBeVisible();
        await expect(page.getByText('Validación del acuerdo')).toBeVisible();
        await expect(page.getByText('Confianza demo')).toBeVisible();
        await expect(page.getByText('source_of_truth=none')).toBeVisible();
        await expect(page.getByText('finalEvidence=false')).toBeVisible();
      });
    }

    expect(blockedExternalCalls).toEqual([]);
  });

  test('presenter mode provides guided reset and scenario navigation without external writes', async ({ page }) => {
    const blockedExternalCalls = collectBlockedDemoExternalCalls(page, true);

    await page.goto('/demo-operable/JUNTA_UNIVERSAL_OK?presenter=1');

    await expect(page).toHaveURL(/\/demo-operable\/JUNTA_UNIVERSAL_OK\?presenter=1/);
    await expect(page.getByText('Modo presentación activo')).toBeVisible();
    await expect(page.getByText('Modo presentación').first()).toBeVisible();
    await expect(page.getByText('Caso 1/5')).toBeVisible();
    await expect(page.getByText('Handoff pausado en modo presentación')).toBeVisible();

    await page.getByRole('button', { name: /Iniciar presentación/i }).click();
    await expect(page.getByText('Auto-running')).toBeVisible();
    await page.getByRole('button', { name: /Pausar/i }).click();
    await expect(page.getByText('Pausado', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Siguiente paso/i }).click();
    await expect(page.getByText('Paso 2 de 6')).toBeVisible();

    await page.getByRole('button', { name: /Siguiente escenario/i }).click();
    await expect(page).toHaveURL(/\/demo-operable\/JUNTA_UNIVERSAL_FAIL_99\?presenter=1/);
    await expect(page.getByText('Caso 2/5')).toBeVisible();

    await page.getByRole('button', { name: /Reset demo/i }).click();
    await expect(page).toHaveURL(/\/demo-operable\/JUNTA_UNIVERSAL_OK\?presenter=1/);
    await expect(page.getByText('Preparado', { exact: true })).toBeVisible();
    expect(blockedExternalCalls).toEqual([]);
  });

  test('blocked demo scenario shows gate block without external dependencies', async ({ page }) => {
    await page.goto('/demo-operable/VETO_BLOCK');

    await expect(page.getByRole('heading', { name: /La consola bloquea/i })).toBeVisible();
    await expect(page.getByText('Veto pactado')).toBeVisible();
    await expect(page.getByText('BLOQUEADO', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Validación del acuerdo')).toBeVisible();
    await expect(page.getByText('Validación bloqueante').first()).toBeVisible();
    await expect(page.getByText('Veto aplicable')).toBeVisible();
    await expect(page.getByText(/veto/i).first()).toBeVisible();
    await expect(page.getByText('Firma no procede por gate bloqueante')).toBeVisible();
    await expect(page.getByText('finalEvidence=false')).toBeVisible();
  });

  test('demo result keeps board briefing readable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo-operable/JUNTA_UNIVERSAL_OK');

    await expect(page.getByRole('heading', { name: /El consejo puede avanzar/i })).toBeVisible();
    await expect(page.getByText('Dashboard por rol de gobierno')).toBeVisible();
    await expect(page.getByText('Presidente')).toBeVisible();
    await expect(page.getByRole('link', { name: /Continuar en Secretaría Societaria/i })).toBeVisible();
  });
});
