import { test, expect } from '@playwright/test';
import { mockGuestUser } from './fixtures/auth.fixture';

test.describe('Route Protection & Guards', () => {
  test.beforeEach(async ({ page }) => {
    await mockGuestUser(page);
  });

  const protectedRoutes = ['/', '/students', '/courses', '/exams', '/profile', '/users'];

  for (const route of protectedRoutes) {
    test(`unauthenticated visit to ${route} should redirect to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/.*login/, { timeout: 15000 });
    });
  }
});
