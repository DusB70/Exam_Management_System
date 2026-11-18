import { test, expect } from '@playwright/test';
import { mockAuthenticatedUser, MOCK_USERS } from './fixtures/auth.fixture';

test.describe('Role-based Dashboard Navigation', () => {
  test('should render student sidebar navigation items and user info', async ({ page }) => {
    await mockAuthenticatedUser(page, MOCK_USERS.student);
    await page.goto('/');

    // User profile widget in sidebar
    const sidebar = page.locator('aside').first();
    await expect(sidebar.getByText(MOCK_USERS.student.fullName)).toBeVisible();
    await expect(sidebar.getByText(MOCK_USERS.student.role, { exact: true })).toBeVisible();

    // Student navigation items
    await expect(page.getByRole('link', { name: /Course Registration/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Exam Registration/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Exam Timetable/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /My Academic Results/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Forms & Requests/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /My Profile/i })).toBeVisible();

    // Student should NOT have access to Admin links
    await expect(page.getByRole('link', { name: /User Management/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /System Backup/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /System Logs/i })).not.toBeVisible();
  });

  test('should render lecturer sidebar navigation items', async ({ page }) => {
    await mockAuthenticatedUser(page, MOCK_USERS.lecturer);
    await page.goto('/');

    const sidebar = page.locator('aside').first();
    await expect(sidebar.getByText(MOCK_USERS.lecturer.fullName)).toBeVisible();
    await expect(sidebar.getByText(MOCK_USERS.lecturer.role, { exact: true })).toBeVisible();

    // Lecturer navigation items
    await expect(page.getByRole('link', { name: /Student Directory/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Marks Registry/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Reports Panel/i })).toBeVisible();

    // Lecturer should NOT see Admin management items
    await expect(page.getByRole('link', { name: /User Management/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /System Backup/i })).not.toBeVisible();
  });

  test('should render administrator sidebar navigation with full management options', async ({
    page,
  }) => {
    await mockAuthenticatedUser(page, MOCK_USERS.admin);
    // Mock system stats API called on admin dashboard
    await page.route('**/api/system/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalUsers: 120,
            totalStudents: 100,
            totalCourses: 24,
            activeExams: 3,
          },
        }),
      });
    });

    await page.goto('/');

    const sidebar = page.locator('aside').first();
    await expect(sidebar.getByText(MOCK_USERS.admin.fullName)).toBeVisible();
    await expect(sidebar.getByText(MOCK_USERS.admin.role, { exact: true })).toBeVisible();

    // Administrator links
    await expect(page.getByRole('link', { name: /User Management/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Student Directory/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Academic Structure/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Courses & Batches/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Exam Console/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Marks Registry/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /System Backup/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /System Logs/i })).toBeVisible();
  });
});
