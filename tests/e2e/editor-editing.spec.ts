import { test, expect } from '@playwright/test';

const IS_MAC = process.platform === 'darwin';
const MOD_KEY = IS_MAC ? 'Meta' : 'Control';
const UNDO_SHORTCUT = `${MOD_KEY}+KeyZ`;
const REDO_SHORTCUT = IS_MAC ? 'Shift+Meta+KeyZ' : 'Control+KeyY';
const DELETE_LINE_SHORTCUT = `${MOD_KEY}+KeyD`;

async function focusEditor(page) {
  await page.goto('/');
  const editor = page.locator('.tiptap-editor');
  await editor.click();
  return editor;
}

async function editorHTML(editor) {
  return editor.evaluate((node) => node.innerHTML);
}

test.describe('Editing behaviour', () => {
  test('types plain paragraph', async ({ page }) => {
    const editor = await focusEditor(page);
    await page.keyboard.type('Hello world!');
    const html = await editorHTML(editor);
    expect(html).toContain('Hello world!');
  });

  test('backspace removes characters', async ({ page }) => {
    const editor = await focusEditor(page);
    await page.keyboard.type('Hello!');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    const html = await editorHTML(editor);
    expect(html).toContain('Hell');
    expect(html).not.toContain('!');
  });

  test('delete line shortcut removes current line', async ({ page }) => {
    const editor = await focusEditor(page);
    await page.keyboard.type('First line');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second line');
    await page.keyboard.press(DELETE_LINE_SHORTCUT);
    const html = await editorHTML(editor);
    expect(html).toContain('First line');
    expect(html).not.toContain('Second line');
  });

  test('undo reverts last change', async ({ page }) => {
    const editor = await focusEditor(page);
    await page.keyboard.type('Draft note');
    await page.keyboard.press(UNDO_SHORTCUT);
    const html = await editorHTML(editor);
    expect(html).not.toContain('Draft note');
  });

  test('redo restores undone change', async ({ page }) => {
    const editor = await focusEditor(page);
    await page.keyboard.type('Draft note');
    await page.keyboard.press(UNDO_SHORTCUT);
    await page.keyboard.press(REDO_SHORTCUT);
    const html = await editorHTML(editor);
    expect(html).toContain('Draft note');
  });

  test('select all then replace text', async ({ page }) => {
    const editor = await focusEditor(page);
    await page.keyboard.type('Old content');
    await page.keyboard.press(`${MOD_KEY}+KeyA`);
    await page.keyboard.type('New note');
    const html = await editorHTML(editor);
    expect(html).toContain('New note');
    expect(html).not.toContain('Old content');
  });

  test('hash heading converts to H1', async ({ page }) => {
    const editor = await focusEditor(page);
    await page.keyboard.type('# Title');
    const html = await editorHTML(editor);
    expect(html).toContain('<h1>Title</h1>');
  });

  test('bold shortcut wraps selection', async ({ page }) => {
    const editor = await focusEditor(page);
    await page.keyboard.press(`${MOD_KEY}+KeyB`);
    await page.keyboard.type('Bold');
    await page.keyboard.press(`${MOD_KEY}+KeyB`);
    const html = await editorHTML(editor);
    expect(html).toContain('<strong>Bold</strong>');
  });

  test('hyphen creates list items', async ({ page }) => {
    const editor = await focusEditor(page);
    await page.keyboard.type('- item');
    await page.keyboard.press('Enter');
    await page.keyboard.type('next');
    const html = await editorHTML(editor);
    expect(html).toContain('<ul');
    expect(html).toContain('<li><p>item</p></li>');
    expect(html).toContain('<li><p>next</p></li>');
  });

  test('enter splits paragraph', async ({ page }) => {
    const editor = await focusEditor(page);
    await page.keyboard.type('Line one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Line two');
    const html = await editorHTML(editor);
    expect(html).toContain('<p>Line one</p>');
    expect(html).toContain('<p>Line two</p>');
  });

  test('clicking container focuses editor', async ({ page }) => {
    await page.goto('/');
    const container = page.locator('.editor-container');
    await container.click({ position: { x: 12, y: 12 } });
    await page.waitForFunction(() => {
      const active = document.activeElement;
      return !!active && active.closest('.tiptap-editor');
    });
    const editor = page.locator('.tiptap-editor');
    await page.keyboard.type('Focused via container');
    const html = await editorHTML(editor);
    expect(html).toContain('Focused via container');
  });
});
