import { test, expect } from './fixtures/base';

test.describe('GRC Compass DORA & Penal E2E Flow', () => {
  test('TPRM CIFA Workbench & Exit Plan Sealing Flow', async ({ page }) => {
    // 1. Go to the TPRM Workbench
    await page.goto('/grc/tprm');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('TPRM CIFA Workbench').first()).toBeVisible({ timeout: 10_000 });

    // 2. Register a brand new unique supplier to ensure idempotency in the WORM environment
    const providerName = 'Proveedor Test E2E - ' + Date.now();
    await page.getByRole('button', { name: 'Registrar Tercero' }).click();
    await expect(page.getByText('Registrar Nuevo Tercero (TPRM)').first()).toBeVisible();

    await page.locator('#new-prov-name').fill(providerName);
    await page.locator('#new-prov-service').fill('Servicio cloud crítico de almacenamiento');
    await page.locator('#new-prov-owner').fill('Lucía Martín');
    await page.getByRole('button', { name: 'Guardar Tercero' }).click();

    // Verify it is created successfully and modal closes
    await expect(page.getByText('Registrar Nuevo Tercero (TPRM)').first()).not.toBeVisible();

    // 3. Search & Select the newly created supplier
    const searchInput = page.getByPlaceholder('Buscar proveedor o servicio…');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(providerName);

    // Wait for the supplier to appear and select it
    const supplierItem = page.getByText(providerName).first();
    await expect(supplierItem).toBeVisible({ timeout: 5000 });
    await supplierItem.click();
    await expect(page.getByText('Ficha General').first()).toBeVisible();

    // 4. Complete CIFA Assessment
    await page.getByRole('button', { name: 'Evaluación CIFA DORA' }).click();
    await expect(page.getByText('Criterios CIFA').first()).toBeVisible();

    // Click "Sí" on the first question to trigger criticality classification
    const yesButtons = page.getByRole('button', { name: 'Sí' });
    await expect(yesButtons.first()).toBeVisible();
    await yesButtons.first().click();

    // Check if criticality updates to show critical
    await expect(page.getByText('PROVEEDOR CRÍTICO DORA').first()).toBeVisible({ timeout: 5000 });

    // 5. Document and WORM seal the Exit Plan
    // El proveedor no emite firma cualificada, así que el rótulo ya no dice QES.
    await page.getByRole('button', { name: 'Plan de Contingencia / Firma' }).click();
    
    // Document some plan strategy
    const exitTextarea = page.locator('#exit-strategy-text');
    await expect(exitTextarea).toBeVisible();
    await exitTextarea.fill('Estrategia de contingencia activa: Migración en caliente hacia multi-cloud secundaria activa en caso de desconexión prolongada.');

    // Fill signatory details
    const nameInput = page.locator('#tprm-sign-name');
    const emailInput = page.locator('#tprm-sign-email');
    await nameInput.fill('Lucía Martín');
    await emailInput.fill('lucia@arga-seguros.com');

    // Click seal exit plan button
    const signBtn = page.getByRole('button', { name: 'Firmar y Sellar Exit Plan' });
    await expect(signBtn).toBeVisible();
    await signBtn.click();

    // Wait for EAD Trust sealing simulator to complete and WORM evidence metadata to appear
    await expect(page.getByText('PLAN DE SALIDA SELLADO EN LEDGER WORM').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Lucía Martín').first()).toBeVisible();
    await expect(page.getByText('Hash SHA-512:').first()).toBeVisible();
  });

  test('Penal Compliance Matrix & QSeal Sealing Flow', async ({ page }) => {
    // 1. Go to the Penal/Anticorrupcion Compliance Matrix
    await page.goto('/grc/penal-anticorrupcion');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByText('Matriz de Compliance Penal e ISO 37001').first()).toBeVisible({ timeout: 10_000 });

    // 2. Click to expand the first Delito Accordion Category if not already expanded
    const cohechoHeader = page.getByRole('heading', { name: '1. Cohecho y Corrupción en los Negocios' });
    await expect(cohechoHeader).toBeVisible();
    
    const risksButton = page.getByRole('button', { name: /Riesgos Penales/i }).first();
    const isExpanded = await risksButton.isVisible().catch(() => false);
    if (!isExpanded) {
      await cohechoHeader.click();
    }

    // 3. Verify Risks Tab is active and display rows
    await expect(page.getByRole('button', { name: /Riesgos Penales/i }).first()).toBeVisible();
    await expect(page.getByText('Cohecho relaciones sector público').first()).toBeVisible({ timeout: 10_000 });

    // 4. Click the QSeal action button for the risk
    const sealRiskBtn = page.getByRole('button', { name: 'QSeal' }).first();
    await expect(sealRiskBtn).toBeVisible();
    await sealRiskBtn.click();

    // 5. Verify the EAD Trust modal is open and fill form
    await expect(page.getByText('Certificación Forense QSeal (EAD Trust)').first()).toBeVisible();

    const auditorName = page.locator('#auditor-name-input');
    const auditorEmail = page.locator('#auditor-email-input');
    const evidenceDocName = page.locator('#evidence-docname-input');

    await auditorName.fill('Lucía Martín');
    await auditorEmail.fill('lucia@arga-seguros.com');
    await evidenceDocName.fill('EVIDENCIA-TEST-COHECHO.pdf');

    // Click Submit Sealing
    const submitBtn = page.getByRole('button', { name: 'Sellar Evidencia QSeal' });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 6. Confirm toast success and that modal closed
    await expect(page.getByText('Certificación Forense QSeal (EAD Trust)').first()).not.toBeVisible({ timeout: 15_000 });
    
    // Check if the Evidences sub-tab reflects the new bundle
    await page.getByRole('button', { name: /Evidencias Forenses/i }).click();
    await expect(page.getByText('Lucía Martín (lucia@arga-seguros.com)').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('QSeal Custodia').first()).toBeVisible();
  });
});
