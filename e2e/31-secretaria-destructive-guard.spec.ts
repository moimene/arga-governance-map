import { expect, test } from './fixtures/secretaria-destructive';

test.describe('Secretaría destructive E2E guard', () => {
  test.skip(process.env.SECRETARIA_E2E_DESTRUCTIVE !== '1', 'Destructive Secretaría E2E is opt-in only');

  test('solo permite escrituras Supabase contra tenants fixture autorizados', async ({ page, secretariaDestructiveRun }) => {
    await page.goto('/secretaria');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible();
    expect(secretariaDestructiveRun.tenantIds.length).toBeGreaterThan(0);
  });
});
