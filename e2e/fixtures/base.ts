import { test as base, expect, Page } from '@playwright/test';

export const test = base.extend<{
  waitForModule: (heading: string) => Promise<void>;
}>({
  waitForModule: async ({ page }, use) => {
    await use(async (heading: string) => {
      await expect(
        page.getByRole('heading', { name: heading }).or(page.getByText(heading).first())
      ).toBeVisible({ timeout: 10_000 });
    });
  },
});

export { expect };
