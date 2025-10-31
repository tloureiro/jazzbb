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
    await page.waitForFunction(() => Boolean((window as typeof window & { __tiptapEditor?: unknown }).__tiptapEditor));

    await page.evaluate((text) => {
      const runtimeWindow = window as typeof window & {
        __tiptapEditor?: {
          chain: () => {
            focus: () => {
              deleteSelection: () => {
                insertContent: (content: unknown) => { run: () => boolean };
              };
            };
          };
          storage: { markdown?: { parser?: { parse: (value: string, options?: { inline?: boolean }) => string } } };
        };
      };
      const instance = runtimeWindow.__tiptapEditor;
      if (!instance) {
        throw new Error('Editor instance not available');
      }
      const normalized = text.replace(/\r\n?/g, '\n');
      const rendered = instance.storage.markdown?.parser?.parse(normalized, { inline: false }) ?? normalized;
      instance
        .chain()
        .focus()
        .deleteSelection()
        .insertContent(rendered)
        .run();
    }, snippet);
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

    await page.keyboard.insertText('### This is going to be the first');

    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<h3>');
    expect(html).not.toContain('###');
  });
});
