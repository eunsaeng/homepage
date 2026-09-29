import { expect, test } from '@playwright/test';
import { adminURL, apiURL } from '../support/urls';

test('admin page can call the API with credentials across origins', async ({ page }) => {
  const response = await page.goto(adminURL);
  expect(response?.status()).toBe(200);

  // A CORS rejection makes fetch throw; any HTTP status means the API accepted the admin origin.
  const status = await page.evaluate(async (url) => {
    const result = await fetch(`${url}/api/admin/auth/session`, { credentials: 'include' });
    return result.status;
  }, apiURL);
  expect(status).toBe(401);
});
