import { test, expect } from './fixtures/base';

test.describe('AIMS 360 AI Governance — Evaluaciones E2E Flow', () => {
  test('Flujo completo de creación de evaluación de riesgo IA (EU AI Act - Conforme)', async ({ page }) => {
    // 1. Ir a la lista de evaluaciones
    await page.goto('/ai-governance/evaluaciones');
    await expect(page).not.toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Evaluaciones de riesgo IA' })).toBeVisible({ timeout: 10_000 });

    // 2. Click en el botón "Nueva evaluación"
    const newEvalBtn = page.getByRole('button', { name: 'Nueva evaluación' });
    await expect(newEvalBtn).toBeVisible();
    await newEvalBtn.click();

    // 3. Verificar que estamos en el Stepper de alta
    await expect(page).toHaveURL('/ai-governance/evaluaciones/nuevo');
    await expect(page.getByRole('heading', { name: 'Nueva evaluación AIMS' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Paso 1: Identificación del sistema e indicador normativo')).toBeVisible();

    // 4. Paso 1: Seleccionar sistema de IA y Marco de cumplimiento
    const systemSelect = page.locator('#eval-system');
    await expect(systemSelect).toBeVisible();
    await systemSelect.selectOption({ index: 1 });

    const frameworkSelect = page.locator('#eval-framework');
    await expect(frameworkSelect).toBeVisible();
    await frameworkSelect.selectOption('EU_AI_ACT');

    // Click en Siguiente
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // 5. Paso 2: Checklist Operativo
    await expect(page.getByText('Paso 2: Checklist Operativo de Requisitos')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Sistema de gestión de riesgos (Art. 9)')).toBeVisible();

    // Usar el helper Demo Quick-Pass para marcar todos Conformes
    const quickPassBtn = page.getByRole('button', { name: 'Marcar todo como Conforme (Demo Quick-Pass)' });
    await expect(quickPassBtn).toBeVisible();
    await quickPassBtn.click();

    // Click en Siguiente
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // 6. Paso 3: Score y Notas
    await expect(page.getByText('Paso 3: Análisis de readiness y dictamen general')).toBeVisible({ timeout: 5000 });
    // El score debería ser 100% gracias al quick pass
    await expect(page.getByText('100%')).toBeVisible();

    const statusSelect = page.locator('#overall-status');
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption('APROBADO');

    const notesTextarea = page.locator('#assessment-notes');
    await expect(notesTextarea).toBeVisible();
    await notesTextarea.fill('La auditoría del sistema de IA Motor Auto confirma el cumplimiento estricto de todos los artículos de la Ley de Inteligencia Artificial de la Unión Europea.');

    // Click en Guardar evaluación
    const saveBtn = page.getByRole('button', { name: 'Guardar evaluación' });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // 7. Paso 4: Confirmación & Handoff
    await expect(page.getByText('Paso 4: Evaluación consolidada en el ledger WORM')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Evaluación de riesgo IA finalizada con éxito')).toBeVisible();
    await expect(page.getByText('Sistema IA en postura de conformidad nominal')).toBeVisible();

    // Click en Volver a evaluaciones
    await page.getByRole('button', { name: 'Volver a evaluaciones' }).click();
    await expect(page).toHaveURL('/ai-governance/evaluaciones');
  });
});
