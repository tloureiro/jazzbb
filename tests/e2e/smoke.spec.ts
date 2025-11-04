import { test, expect, type Page } from '@playwright/test';

async function simulatePlainPaste(page: Page, text: string) {
  await page.waitForFunction(() => Boolean(document.querySelector('.tiptap-editor')));
  await page.evaluate((value) => {
    const editor = document.querySelector('.tiptap-editor');
    if (!(editor instanceof HTMLElement)) {
      throw new Error('Editor element not found');
    }
    const data = new DataTransfer();
    data.setData('text/plain', value);
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: data,
    });
    editor.dispatchEvent(event);
  }, text);
}

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
    await simulatePlainPaste(page, snippet);
    await page.keyboard.press('Control+A');

    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toMatch(/<p>\+\+\+[\s\S]*title = 'First'[\s\S]*\+\+\+<\/p>/);
    expect(html).not.toMatch(/<p>date[^<]*<\/p><p>/);

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

    await simulatePlainPaste(page, '### This is going to be the first');

    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<h3>');
    expect(html).not.toContain('###');
  });
});
