import { test, expect } from '@playwright/test';
import { mockGuestUser, MOCK_USERS, CORS_HEADERS } from './fixtures/auth.fixture';

test.describe('Login Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestUser(page);
  });

  test('should display login page heading and subtext', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole('heading', { name: 'Account Sign In' })).toBeVisible();
    await expect(page.getByText('Welcome to EMS Portal')).toBeVisible();
  });

  test('should successfully log in via traditional form and redirect to dashboard', async ({
    page,
  }) => {
    // Intercept login request
    await page.route('**/api/auth/login', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: MOCK_USERS.admin,
        }),
      });
    });

    // Intercept subsequent /auth/me request after redirect
    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: MOCK_USERS.admin,
        }),
      });
    });

    await page.goto('/login');

    await page.locator('input[type="email"]').fill('admin@ems.com');
    await page.locator('input[placeholder="••••••••"]').fill('AdminPassword123');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click();

    // Verify successful redirection away from /login to dashboard root
    await expect(page).toHaveURL(/http:\/\/localhost:3000\/?$/);
  });

  test('should log in via Developer Quick Bypass card', async ({ page }) => {
    // Intercept login request
    await page.route('**/api/auth/login', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: MOCK_USERS.student,
        }),
      });
    });

    // Intercept subsequent /auth/me
    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: CORS_HEADERS });
      }
      await route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: MOCK_USERS.student,
        }),
      });
    });

    await page.goto('/login');

    // Click Demo Student quick bypass button
    await page.getByRole('button', { name: /Demo Student/i }).click();

    // Verify redirection to dashboard root
    await expect(page).toHaveURL(/http:\/\/localhost:3000\/?$/);
  });
});
