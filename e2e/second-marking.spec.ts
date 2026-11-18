import { test, expect } from '@playwright/test';

test.describe('Second Marking Magic Link Portal', () => {
  test('should show access restricted when visited without a magic token', async ({ page }) => {
    await page.goto('/second-marking-portal');

    // Access Restricted card should appear
    await expect(page.getByRole('heading', { name: 'Access Restricted' })).toBeVisible();
    await expect(page.getByText('No magic token provided in the URL.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Return to.*Login/i })).toBeVisible();
  });

  test('should show error banner when magic token is invalid or rejected by backend', async ({
    page,
  }) => {
    // Intercept second marking verification API call to return error
    await page.route('**/api/marks/second-marking/verify', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'The evaluation magic link has expired or is invalid.',
        }),
      });
    });

    await page.goto('/second-marking-portal?token=expired-mock-token-xyz');

    await expect(page.getByRole('heading', { name: 'Access Restricted' })).toBeVisible();
  });
});
