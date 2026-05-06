import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';

const ARGA_ENTITY_NAME = 'ARGA Seguros, S.A.';

const scopedPages = [
  {
    path: '/secretaria/convocatorias',
    heading: 'Convocatorias',
  },
  {
    path: '/secretaria/reuniones',
    heading: 'Reuniones',
  },
  {
    path: '/secretaria/actas',
    heading: 'Actas y certificaciones',
  },
];

const otherSocietyPatterns = [
  /ARGA Brasil/i,
  /ARGA Portugal/i,
  /ARGA México/i,
  /ARGA España/i,
  /Cartera ARGA/i,
  /Fundación ARGA/i,
];

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

test.describe('Secretaría — scope sociedad ARGA', () => {
  test('conserva sociedad y no mezcla órganos en convocatorias, reuniones y actas', async ({ page }) => {
    const failedSupabaseResponses: string[] = [];
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && url.includes('supabase.co/rest/v1')) {
        failedSupabaseResponses.push(`${status} ${url}`);
      }
    });

    const entityId = await getArgaEntityId(page);

    for (const scopedPage of scopedPages) {
      await page.goto(`${scopedPage.path}?scope=sociedad&entity=${entityId}`);
      await expect(page).toHaveURL(new RegExp(`${scopedPage.path}\\?scope=sociedad&entity=${entityId}`));
      await expect(page.locator('main').getByRole('heading', { name: scopedPage.heading, exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        page.locator('div')
          .filter({ hasText: 'Vista filtrada por sociedad:' })
          .filter({ hasText: ARGA_ENTITY_NAME })
          .first()
      ).toBeVisible();

      const tableBody = page.locator('tbody');
      await expect(tableBody).toBeVisible({ timeout: 10_000 });
      const tableText = await tableBody.innerText();
      for (const pattern of otherSocietyPatterns) {
        expect(tableText).not.toMatch(pattern);
      }
    }

    expect(failedSupabaseResponses, 'El scope sociedad no debe disparar errores REST').toEqual([]);
  });
});
