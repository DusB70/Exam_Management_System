import { test, expect } from '@playwright/test';

test.describe('Theme Switcher', () => {
  test('should toggle between light and dark themes and persist in localStorage', async ({
    page,
  }) => {
    await page.goto('/login');

    const toggleButton = page.getByRole('button', { name: 'Toggle Theme' });
    await expect(toggleButton).toBeVisible();

    // Check initial state (default 'light')
    const htmlElement = page.locator('html');

    // Click to toggle to dark
    await toggleButton.click();
    await expect(htmlElement).toHaveClass(/dark/);

    // Verify localStorage persistence
    const savedThemeDark = await page.evaluate(() => window.localStorage.getItem('ems-theme'));
    expect(savedThemeDark).toBe('dark');

    // Click to toggle back to light
    await toggleButton.click();
    await expect(htmlElement).toHaveClass(/light/);

    const savedThemeLight = await page.evaluate(() => window.localStorage.getItem('ems-theme'));
    expect(savedThemeLight).toBe('light');
  });
});
