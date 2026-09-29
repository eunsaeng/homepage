import { expect, test } from '@playwright/test';

test('public homepage responds successfully', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.locator('body')).not.toBeEmpty();
});
