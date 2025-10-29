import { test, expect } from '@playwright/test';

test.describe('App shell', () => {
  test('loads landing shell offline', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'jazzbb' })).toBeVisible();
  });
});
