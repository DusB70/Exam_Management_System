import { test, expect } from '@playwright/test';
import { mockGuestUser } from './fixtures/auth.fixture';

test.describe('Authentication & Access', () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestUser(page);
  });

  test('should render login page with branding, form inputs, and quick bypass cards', async ({
    page,
  }) => {
    await page.goto('/login');

    // Page title and branding
    await expect(page).toHaveTitle(/University Exam Management System/);
    await expect(page.getByRole('heading', { name: 'Account Sign In' })).toBeVisible();

    // Form inputs
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[placeholder="••••••••"]');
    const submitButton = page.getByRole('button', { name: /Sign In to Portal/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // Developer Quick Bypass cards
    await expect(page.getByText('Developer Quick Bypass')).toBeVisible();
    await expect(page.getByText('Demo Student')).toBeVisible();
    await expect(page.getByText('Demo Lecturer')).toBeVisible();
    await expect(page.getByText('Exam Staff')).toBeVisible();
    await expect(page.getByText('Administrator')).toBeVisible();
  });

  test('should toggle password field visibility between text and password', async ({ page }) => {
    await page.goto('/login');

    const passwordInput = page.locator('input[placeholder="••••••••"]');
    const toggleButton = page.getByRole('button', { name: /Show password|Hide password/i });

    await passwordInput.fill('SecretPassword123');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click to show password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click to hide password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should show error banner when login API returns invalid credentials', async ({ page }) => {
    // Intercept login API call to return 401 error
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Invalid credentials provided.',
        }),
      });
    });

    await page.goto('/login');

    await page.locator('input[type="email"]').fill('wrong@ems.com');
    await page.locator('input[placeholder="••••••••"]').fill('WrongPassword123');
    await page.getByRole('button', { name: /Sign In to Portal/i }).click();

    // Verify error message banner
    await expect(page.getByText('Invalid credentials provided.')).toBeVisible();
  });

  test('should render password recovery form on forgot-password page', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page).toHaveURL(/.*forgot-password/);
    await expect(page.getByRole('heading', { name: 'Recover Password' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send Reset Link/i })).toBeVisible();
  });

  test('should show error message when accessing reset-password without token', async ({
    page,
  }) => {
    await page.goto('/reset-password');

    await expect(page.getByText('Password reset token is missing from the URL link')).toBeVisible();
  });
});
