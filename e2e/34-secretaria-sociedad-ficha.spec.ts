import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';

const ARGA_ENTITY_NAME = 'ARGA Seguros, S.A.';

async function getArgaEntityId(page: Page) {
  await page.goto('/secretaria?scope=sociedad');
  const sociedadSelect = page.getByLabel('Sociedad seleccionada');
  await expect(sociedadSelect).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => sociedadSelect.locator('option').count(), { timeout: 10_000 }).toBeGreaterThan(1);

  const entityId = await sociedadSelect.evaluate((select, entityName) => {
    const options = Array.from((select as HTMLSelectElement).options);
    return options.find((option) => option.textContent?.includes(entityName))?.value ?? '';
  }, ARGA_ENTITY_NAME);

  expect(entityId).toBeTruthy();
  await sociedadSelect.selectOption(entityId);
  await expect.poll(async () => sociedadSelect.inputValue(), { timeout: 10_000 }).toBe(entityId);
  return entityId;
}

test.describe('Secretaría — ficha societaria ARGA golden path', () => {
  test('expone datos maestros coherentes para capital, órganos, autoridad y rule packs', async ({ page }) => {
    const failedSupabaseResponses: string[] = [];
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && url.includes('supabase.co/rest/v1')) {
        failedSupabaseResponses.push(`${status} ${url}`);
      }
    });

    const entityId = await getArgaEntityId(page);
    await page.goto(`/secretaria/sociedades/${entityId}?scope=sociedad&entity=${entityId}`);

    const main = page.locator('main');
    await expect(main.getByRole('heading', { name: /ARGA Seguros/i })).toBeVisible({ timeout: 15_000 });
    await expect(main.getByText('Ficha maestra para generación documental')).toBeVisible();
    await expect(main.getByText('NIF / CIF')).toBeVisible();
    await expect(main.getByText('A-00001001').first()).toBeVisible();
    await expect(main.getByText('Domicilio social')).toBeVisible();
    await expect(main.getByText('LEI')).toBeVisible();
    await expect(main.getByText('PJ (PERSONS)')).toHaveCount(0);
    await expect(main.getByRole('button', { name: /^Clases$/ })).toHaveCount(0);

    await main.getByRole('button', { name: 'Capital' }).click();
    await expect(main.getByText('Capital social y clases de acciones forman una unidad funcional')).toBeVisible();
    await expect(main.getByText('Capital desembolsado')).toBeVisible();
    await expect(main.getByText(/307[.,]955[.,]327[.,]3 EUR/).first()).toBeVisible();
    await expect(main.getByText('Clases de acciones / participaciones')).toBeVisible();
    await expect(main.getByText('ORD').first()).toBeVisible();
    await expect(main.getByText('Acciones ordinarias de la misma clase')).toBeVisible();

    await main.getByRole('button', { name: 'Órganos' }).click();
    await expect(main.getByText('un único Consejo de Administración')).toBeVisible();
    await expect(main.getByText('Junta General de Accionistas')).toBeVisible();
    await expect(main.getByRole('link', { name: 'Consejo de Administración' })).toBeVisible();

    await main.getByRole('button', { name: 'Administradores' }).click();
    await expect(main.getByText('composición vigente del Consejo de Administración')).toBeVisible();
    await expect(main.getByText('Sin administradores vigentes.')).toHaveCount(0);
    await expect(main.getByRole('cell', { name: 'Consejo de Administración' }).first()).toBeVisible();
    await expect(main.getByText(/NIF-DEMO-/).first()).toBeVisible();

    await main.getByRole('button', { name: 'Representaciones' }).click();
    await expect(main.getByText('representaciones permanentes de personas jurídicas')).toBeVisible();
    await expect(main.getByText('Representante persona jurídica')).toBeVisible();
    await expect(main.getByText(/1\/1\/2025.*vigente/).first()).toBeVisible();
    await expect(main.getByText('evidence://ead-trust/ARGA_SEG_REPRESENTANTE_PJ_2025')).toBeVisible();

    await main.getByRole('button', { name: 'Autoridad' }).click();
    await expect(main.getByText('Autoridad no es la lista completa de miembros del órgano')).toBeVisible();
    await expect(main.getByText('Cargo certificante')).toBeVisible();

    await main.getByRole('button', { name: 'Marco normativo' }).click();
    await expect(main.getByRole('heading', { name: 'Motor de reglas por materia' })).toBeVisible({ timeout: 15_000 });
    await expect(main.getByText('Acuerdo 360 es el expediente trazable')).toBeVisible();
    await expect(main.getByText(/rule packs activos/)).toBeVisible();

    expect(failedSupabaseResponses, 'La ficha societaria ARGA no debe disparar errores REST').toEqual([]);
  });
});
