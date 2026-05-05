import { test as base, expect } from '@playwright/test';

export const test = base.extend<{
  waitForModule: (heading: string) => Promise<void>;
}>({
  waitForModule: async ({ page }, use) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(async (heading: string) => {
      await expect(
        page.getByRole('heading', { name: heading }).or(page.getByText(heading).first())
      ).toBeVisible({ timeout: 10_000 });
    });
  },
});

export { expect };
