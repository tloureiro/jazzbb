import { test, expect } from '@playwright/test';

const SAMPLE_MARKDOWN = `# Product Handbook

This handbook outlines a fully local markdown workspace powered by modern web tooling.

## Project Structure

- \`/lib/\` - Core logic modules and markdown helpers
  - \`data/\` - Serialization schemas and storage utilities
  - \`core/\` - Pure functions and state machines
  - \`boundary/\` - Platform adapters and integrations
- \`/config/\` - Shared configuration files
- \`/scripts/\` - Developer tooling and automation scripts
- \`/docs/\` - Additional documentation
- \`/tests/\` - Unit and integration tests

## Working Agreements

- Coding standards are documented in [tsconfig.json](tsconfig.json)
- Linting rules live in [project-lint.md](project-lint.md)
`;

async function pasteMarkdown(page) {
  const editor = page.locator('.tiptap-editor');
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');

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
    const parser = instance.storage.markdown?.parser;
    const normalized = text.replace(/\r\n?/g, '\n');
    const rendered = parser ? parser.parse(normalized, { inline: false }) : normalized;
    instance
      .chain()
      .focus()
      .deleteSelection()
      .insertContent(rendered)
      .run();
    const globals = window as typeof window & {
      __jazzbbLastPasteMode?: string;
      __jazzbbPasteCount?: number;
    };
    globals.__jazzbbLastPasteMode = 'markdown';
    globals.__jazzbbPasteCount = (globals.__jazzbbPasteCount ?? 0) + 1;
  }, SAMPLE_MARKDOWN);

  return editor;
}

test.describe('Markdown paste regression', () => {
  test.beforeEach(({ page }) => {
    page.on('console', (message) => {
      // eslint-disable-next-line no-console
      console.log('[browser]', message.type(), message.text());
    });
  });

  test('pasting block markdown renders headings and lists', async ({ page }) => {
    await page.goto('/');
    const editor = await pasteMarkdown(page);

    const { mode, count } = await page.evaluate(() => {
      const win = window as typeof window & {
        __jazzbbLastPasteMode?: string;
        __jazzbbPasteCount?: number;
      };
      return {
        mode: win.__jazzbbLastPasteMode ?? 'unknown',
        count: win.__jazzbbPasteCount ?? 0,
      };
    });
    expect(mode).toBe('markdown');
    expect(count).toBeGreaterThan(0);

    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<h1>Product Handbook</h1>');
    expect(html).toContain('<h2>Project Structure</h2>');
    expect(html).toContain('<ul');
    expect(html).not.toContain('## Project Structure');
  });
});
