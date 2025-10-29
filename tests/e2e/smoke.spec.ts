import { test, expect } from '@playwright/test';

test.describe('App shell', () => {
  test('loads landing shell offline', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'jazzbb' })).toBeVisible();
  });

  test('keeps front matter compact on paste', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('.tiptap-editor');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');

    const snippet = "+++\ndate = '2025-10-29T00:01:01-04:00'\ndraft = true\ntitle = 'First'\n+++\n\n### This is going to be the first";
    await page.keyboard.insertText(snippet);
    await page.keyboard.press('Control+A');

    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toMatch(/<p>\+\+\+<br>/);
    expect(html).toMatch(/title = 'First'<br>\+\+\+<\/p>/);
    expect(html).not.toMatch(/<p>date[^<]*<\/p><p>/);

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: page.url() });
    await page.keyboard.press('Control+C');
    const clipboard = await page.evaluate(async () => navigator.clipboard.readText());
    expect(clipboard).toBe(snippet);
  });

  test('pastes markdown heading as heading', async ({ page }) => {
    await page.goto('/');
    page.on('console', (message) => {
      // eslint-disable-next-line no-console
      console.log('[browser]', message.type(), message.text());
    });
    const editor = page.locator('.tiptap-editor');
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');

    await page.keyboard.insertText('### This is going to be the first');

    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<h3>');
    expect(html).not.toContain('###');
  });
});
