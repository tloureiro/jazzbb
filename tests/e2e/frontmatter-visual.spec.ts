import { test, expect, type Page } from '@playwright/test';

const IS_MAC = process.platform === 'darwin';
const MOD_KEY = IS_MAC ? 'Meta' : 'Control';
const ALT_KEY = 'Alt';
const FRONTMATTER_SHORTCUT = `${ALT_KEY}+${MOD_KEY}+KeyF`;
const PLAIN_SHORTCUT = `${ALT_KEY}+${MOD_KEY}+KeyM`;
const PALETTE_SHORTCUT = `${MOD_KEY}+KeyK`;
const OUTLINE_SHORTCUT = `${MOD_KEY}+Shift+KeyO`;

async function seedFrontmatterNote(page: Page, options?: { yaml?: string; body?: string }) {
  await page.goto('/');
  const editor = page.locator('.tiptap-editor');
  await editor.waitFor();
  await editor.click();
  const yaml = options?.yaml ?? 'title: Visual Note\nstatus: draft';
  const body = options?.body ?? 'Body text';
  const content = `---\n${yaml}\n---\n\n${body}`;
  await page.keyboard.press(PLAIN_SHORTCUT);
  const plain = page.locator('.plain-markdown-editor');
  await plain.waitFor();
  await plain.fill(content);
  await page.keyboard.press(PLAIN_SHORTCUT);
  await editor.waitFor();
  await page.waitForSelector('.frontmatter-indicator');
  return { editor };
}

async function openPalette(page: Page) {
  await page.keyboard.press(PALETTE_SHORTCUT);
  const palette = page.locator('.command-palette');
  await palette.waitFor();
  return palette;
}

test.describe('Frontmatter visuals', () => {
  test('frontmatter stays hidden in the rich editor', async ({ page }) => {
    const { editor } = await seedFrontmatterNote(page, { body: 'Visible prose' });
    await expect(page.locator('.frontmatter-indicator')).toBeVisible();
    await expect(editor).toContainText('Visible prose');
    await expect(editor).not.toContainText('title: Visual Note');
    await expect(editor).not.toContainText('status: draft');
  });

  test('frontmatter indicator toggles the editor overlay', async ({ page }) => {
    await seedFrontmatterNote(page);
    const indicator = page.locator('.frontmatter-indicator');
    await expect(page.locator('.frontmatter-editor')).toHaveCount(0);
    await indicator.click();
    const editorOverlay = page.locator('.frontmatter-editor textarea');
    await expect(editorOverlay).toBeVisible();
    await expect(editorOverlay).toHaveValue(/title: Visual Note/);
    await indicator.click();
    await expect(page.locator('.frontmatter-editor')).toHaveCount(0);
  });

  test('hotkey toggles editor + panel visibility', async ({ page }) => {
    await seedFrontmatterNote(page);
    const editorArea = page.locator('.tiptap-editor');
    await editorArea.click();
    await page.keyboard.press(FRONTMATTER_SHORTCUT);
    await expect(page.locator('.frontmatter-editor')).toBeVisible();
    await expect(page.locator('.frontmatter-panel')).toBeVisible();
    await page.keyboard.press(FRONTMATTER_SHORTCUT);
    await expect(page.locator('.frontmatter-editor')).toHaveCount(0);
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
    await expect(page.locator('.frontmatter-editor')).toBeVisible();
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
    const overlay = page.locator('.frontmatter-editor textarea');
    await overlay.fill('title: Updated\nstatus: review');
    await expect(page.locator('.frontmatter-panel')).toContainText('Updated');
    await expect(page.locator('.frontmatter-panel')).toContainText('review');
    await page.keyboard.press(PLAIN_SHORTCUT);
    const plain = page.locator('.plain-markdown-editor');
    await expect(plain).toHaveValue(/title: Updated/);
    await page.keyboard.press(PLAIN_SHORTCUT);
  });

  test('invalid yaml surfaces an error state', async ({ page }) => {
    await seedFrontmatterNote(page);
    await page.locator('.frontmatter-indicator').click();
    const overlay = page.locator('.frontmatter-editor textarea');
    await overlay.fill('title: [broken');
    await expect(page.locator('.panel-alert')).toContainText('Could not parse frontmatter');
  });

  test('removing frontmatter clears the indicator and command', async ({ page }) => {
    await seedFrontmatterNote(page);
    await page.keyboard.press(PLAIN_SHORTCUT);
    const plain = page.locator('.plain-markdown-editor');
    await plain.waitFor();
    await plain.fill('No metadata\n\nParagraph only');
    await page.keyboard.press(PLAIN_SHORTCUT);
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
    await page.keyboard.press(OUTLINE_SHORTCUT);
    await page.locator('.outline-panel').waitFor();
    await page.locator('.frontmatter-indicator').click();
    const stack = page.locator('.panel-stack');
    await expect(stack.locator('.outline-panel')).toBeVisible();
    await expect(stack.locator('.frontmatter-panel')).toBeVisible();
  });
});
