import { test, expect, type Page } from '@playwright/test';

const IS_MAC = process.platform === 'darwin';
const MOD_KEY = IS_MAC ? 'Meta' : 'Control';
const PALETTE_SHORTCUT = `${MOD_KEY}+KeyK`;

async function seedFrontmatterNote(page: Page, options?: { yaml?: string; body?: string }) {
  await page.goto('/');
  const editor = page.locator('.tiptap-editor');
  await editor.waitFor();
  await editor.click();
  const yaml = options?.yaml ?? 'title: Visual Note\nstatus: draft';
  const body = options?.body ?? 'Body text';
  const content = `---\n${yaml}\n---\n\n${body}`;
  await togglePlainMode(page);
  const plain = page.locator('.plain-markdown-editor');
  await plain.waitFor();
  await plain.fill(content);
  await togglePlainMode(page);
  await page.waitForSelector('.frontmatter-indicator');
  return { editor };
}

async function openPalette(page: Page) {
  const opened = await page.evaluate(() => {
    const runtime = window as typeof window & { __openCommandPalette?: () => void };
    if (runtime.__openCommandPalette) {
      runtime.__openCommandPalette();
      return true;
    }
    return false;
  });
  if (!opened) {
    await page.keyboard.press(PALETTE_SHORTCUT);
  }
  const palette = page.locator('.command-palette');
  await palette.waitFor();
  return palette;
}

async function triggerFrontmatterShortcut(page: Page) {
  await page.evaluate(() => {
    const runtime = window as typeof window & { __toggleFrontmatterVisibility?: () => boolean };
    runtime.__toggleFrontmatterVisibility?.();
  });
}

async function togglePlainMode(page: Page) {
  await page.evaluate(() => {
    const runtime = window as typeof window & { __togglePlainMode?: () => void };
    runtime.__togglePlainMode?.();
  });
}

async function ensureOutlinePanelVisible(page: Page) {
  const toggled = await page.evaluate(() => {
    const runtime = window as typeof window & { __toggleOutlinePanel?: (next?: boolean) => boolean };
    if (runtime.__toggleOutlinePanel) {
      runtime.__toggleOutlinePanel(true);
      return true;
    }
    return false;
  });
  if (!toggled) {
    await page.locator('[data-test="header-outline-toggle"]').click();
  }
  await page.locator('.outline-panel').waitFor();
}

async function resolveCssColor(page: Page, cssValue: string): Promise<string> {
  return page.evaluate((value) => {
    const swatch = document.createElement('div');
    swatch.style.color = value;
    document.body.appendChild(swatch);
    const color = getComputedStyle(swatch).color;
    swatch.remove();
    return color;
  }, cssValue);
}

async function expectTokenColor(page: Page, selector: string, text: string | RegExp, cssValue: string) {
  const locator = page.locator(selector, { hasText: text }).first();
  await expect(locator).toBeVisible();
  const color = await locator.evaluate((el) => getComputedStyle(el).color);
  expect(color, `Token "${text}" should exist in the frontmatter editor`).not.toBeNull();
  const expected = await resolveCssColor(page, cssValue);
  expect(color).toBe(expected);
}

async function replaceFrontmatterContent(page: Page, value: string) {
  const editor = page.locator('.frontmatter-editor .cm-content');
  await editor.click();
  await page.keyboard.press(`${MOD_KEY}+KeyA`);
  await page.keyboard.type(value);
}

test.describe('Frontmatter visuals', () => {
  test('frontmatter stays hidden in the rich editor', async ({ page }) => {
    const { editor } = await seedFrontmatterNote(page, { body: 'Visible prose' });
    await expect(page.locator('.frontmatter-indicator')).toBeVisible();
    await expect(editor).toContainText('Visible prose');
    await expect(editor).not.toContainText('title: Visual Note');
    await expect(editor).not.toContainText('status: draft');
  });

  test('frontmatter indicator toggles yaml editor block', async ({ page }) => {
    await seedFrontmatterNote(page);
    const indicator = page.locator('.frontmatter-indicator');
    await expect(page.locator('[data-test="frontmatter-editor"]')).toHaveCount(0);
    await indicator.click();
    await expect(page.locator('.frontmatter-editor .cm-content')).toContainText('title: Visual Note');
    await indicator.click();
    await expect(page.locator('[data-test="frontmatter-editor"]')).toHaveCount(0);
  });

  test('hotkey toggles yaml editor and panel visibility', async ({ page }) => {
    await seedFrontmatterNote(page);
    const editorArea = page.locator('.tiptap-editor');
    await editorArea.click();
    await triggerFrontmatterShortcut(page);
    await expect(page.locator('.frontmatter-editor .cm-content')).toBeVisible();
    await expect(page.locator('.frontmatter-panel')).toBeVisible();
    await triggerFrontmatterShortcut(page);
    await expect(page.locator('[data-test="frontmatter-editor"]')).toHaveCount(0);
    await expect(page.locator('.frontmatter-panel')).toHaveCount(0);
  });

  test('command palette disables frontmatter toggle without metadata', async ({ page }) => {
    await page.goto('/');
    await page.locator('.tiptap-editor').click();
    await openPalette(page);
    const command = page.locator('.command-palette__item', { hasText: 'Frontmatter' });
    await expect(command).toBeDisabled();
    await page.keyboard.press('Escape');
  });

  test('command palette toggles frontmatter when metadata exists', async ({ page }) => {
    await seedFrontmatterNote(page);
    await openPalette(page);
    const command = page.locator('.command-palette__item', { hasText: 'Frontmatter' });
    await expect(command).toBeEnabled();
    await command.click();
    await expect(page.locator('.frontmatter-editor .cm-content')).toContainText('title: Visual Note');
    await openPalette(page);
    const updated = page.locator('.command-palette__item', { hasText: 'Hide frontmatter' });
    await expect(updated).toBeEnabled();
    await page.keyboard.press('Escape');
  });

  test('frontmatter panel renders nested metadata', async ({ page }) => {
    await seedFrontmatterNote(page, {
      yaml: ['title: Visual', 'links:', '  - one', '  - two', 'author:', '  name: Ada'].join('\n'),
    });
    await page.locator('.frontmatter-indicator').click();
    const panel = page.locator('.frontmatter-panel');
    await expect(panel).toContainText('links');
    await expect(panel).toContainText('#1');
    await expect(panel).toContainText('one');
    await expect(panel).toContainText('author');
    await expect(panel).toContainText('Ada');
  });

  test('editing frontmatter updates the panel and markdown', async ({ page }) => {
    await seedFrontmatterNote(page);
    await page.locator('.frontmatter-indicator').click();
    await replaceFrontmatterContent(page, 'title: Updated\nstatus: review');
    await expect(page.locator('.frontmatter-panel')).toContainText('review');
    await togglePlainMode(page);
    const plain = page.locator('.plain-markdown-editor');
    await plain.waitFor();
    await expect(plain).toHaveValue(/title: Updated/);
    await togglePlainMode(page);
  });

  test('invalid yaml surfaces an error state', async ({ page }) => {
    await seedFrontmatterNote(page);
    await page.locator('.frontmatter-indicator').click();
    await replaceFrontmatterContent(page, 'title: [broken');
    await expect(page.locator('.panel-alert')).toContainText('Could not parse frontmatter');
  });

  test('removing frontmatter clears the indicator and command', async ({ page }) => {
    await seedFrontmatterNote(page);
    await page.locator('.frontmatter-indicator').click();
    await replaceFrontmatterContent(page, '');
    await triggerFrontmatterShortcut(page);
    await togglePlainMode(page);
    const plain = page.locator('.plain-markdown-editor');
    await plain.waitFor();
    await plain.fill('No metadata\n\nParagraph only');
    await expect(plain).toHaveValue(/No metadata/);
    await togglePlainMode(page);
    await expect(page.locator('.frontmatter-indicator')).toHaveCount(0);
    await openPalette(page);
    const command = page.locator('.command-palette__item', { hasText: 'Frontmatter' });
    await expect(command).toBeDisabled();
    await page.keyboard.press('Escape');
  });

  test('outline and frontmatter panels stack together', async ({ page }) => {
    await seedFrontmatterNote(page, {
      body: '# Heading\n\n## Details\n\nParagraph',
    });
    await page.locator('.tiptap-editor').click();
    await ensureOutlinePanelVisible(page);
    await page.locator('.frontmatter-indicator').click();
    const editor = page.locator('.tiptap-editor');
    await expect(editor).toContainText('Heading');
    await expect(editor).toContainText('Details');
    await expect(editor).toContainText('Paragraph');
    const stack = page.locator('.panel-stack');
    await expect(stack.locator('.outline-panel')).toBeVisible();
    await expect(stack.locator('.frontmatter-panel')).toBeVisible();
  });

  test('frontmatter editor accepts typed input', async ({ page }) => {
    await seedFrontmatterNote(page);
    await page.locator('.frontmatter-indicator').click();
    const editor = page.locator('.frontmatter-editor .cm-content');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type('\naliases: jazz');
    await expect(editor).toContainText('aliases: jazz');
  });

  test('frontmatter editor retains text when toggled', async ({ page }) => {
    await seedFrontmatterNote(page);
    const indicator = page.locator('.frontmatter-indicator');
    await indicator.click();
    const editor = page.locator('.frontmatter-editor .cm-content');
    await editor.click();
    await page.keyboard.type('\ncategory: notes');
    await indicator.click();
    await indicator.click();
    await expect(page.locator('.frontmatter-editor .cm-content')).toContainText('category: notes');
  });

  test('frontmatter editor renders highlighted yaml', async ({ page }) => {
    await seedFrontmatterNote(page);
    await page.locator('.frontmatter-indicator').click();
    const editor = page.locator('.frontmatter-editor .cm-content');
    await editor.click();
    await page.keyboard.type('\nvisibility: private');
    await expect(editor).toContainText('visibility: private');
  });

  test('yaml keys use accent color', async ({ page }) => {
    await seedFrontmatterNote(page, {
      yaml: ['title: Visual', 'status: draft', 'meta: true'].join('\n'),
    });
    await page.locator('.frontmatter-indicator').click();
    await expectTokenColor(page, '.cm-yaml-key', 'title', 'var(--color-accent)');
    await expectTokenColor(page, '.cm-yaml-key', 'status', 'var(--color-accent)');
  });

  test('string values honor success color', async ({ page }) => {
    await seedFrontmatterNote(page, {
      yaml: ['title: Midnight', 'author: Jazzbb'].join('\n'),
    });
    await page.locator('.frontmatter-indicator').click();
    await expectTokenColor(page, '.cm-yaml-string', 'Midnight', 'var(--color-success, #7ed1c2)');
    await expectTokenColor(page, '.cm-yaml-string', 'Jazzbb', 'var(--color-success, #7ed1c2)');
  });

  test('numeric values use warning color', async ({ page }) => {
    await seedFrontmatterNote(page, {
      yaml: ['count: 42', 'score: 3.14'].join('\n'),
    });
    await page.locator('.frontmatter-indicator').click();
    await expectTokenColor(page, '.cm-yaml-number', '42', 'var(--color-warning, #f6c064)');
    await expectTokenColor(page, '.cm-yaml-number', '3.14', 'var(--color-warning, #f6c064)');
  });

  test('boolean literals share warning palette', async ({ page }) => {
    await seedFrontmatterNote(page, {
      yaml: ['published: true', 'archived: false'].join('\n'),
    });
    await page.locator('.frontmatter-indicator').click();
    await expectTokenColor(page, '.cm-yaml-number', 'true', 'var(--color-warning, #f6c064)');
    await expectTokenColor(page, '.cm-yaml-number', 'false', 'var(--color-warning, #f6c064)');
  });

  test('comments/meta tokens use muted color', async ({ page }) => {
    await seedFrontmatterNote(page, {
      yaml: ['# metadata note', 'title: Highlight', 'meta: !tag anchor'].join('\n'),
    });
    await page.locator('.frontmatter-indicator').click();
    await expectTokenColor(page, '.cm-yaml-comment', '# metadata note', 'var(--color-text-muted)');
    await expectTokenColor(page, '.cm-yaml-meta', '!tag', 'var(--color-text-muted)');
  });

  test('adding nested yaml updates the panel summary', async ({ page }) => {
    await seedFrontmatterNote(page);
    await page.locator('.frontmatter-indicator').click();
    const editor = page.locator('.frontmatter-editor .cm-content');
    await editor.click();
    await page.keyboard.type('\nmeta:\n  summary: Visual test');
    await expect(page.locator('.frontmatter-panel')).toContainText('summary');
    await expect(page.locator('.frontmatter-panel')).toContainText('Visual test');
  });

  test('editing frontmatter leaves body content untouched', async ({ page }) => {
    await seedFrontmatterNote(page, { body: 'Original prose' });
    await page.locator('.frontmatter-indicator').click();
    const editor = page.locator('.frontmatter-editor .cm-content');
    await editor.click();
    await page.keyboard.type('\nreviewed: true');
    await page.locator('.frontmatter-indicator').click();
    await expect(page.locator('.tiptap-editor')).toContainText('Original prose');
  });
});
