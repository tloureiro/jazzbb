import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const TABLE_SAMPLE = readFileSync(new URL('../../samples/markdown-table-examples.md', import.meta.url), 'utf8');

async function insertMarkdown(page: Page, markdown: string) {
  await page.goto('/');
  const editorRoot = page.locator('.tiptap-editor');
  await editorRoot.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => Boolean(window.__tiptapEditor));
  await page.evaluate((text) => {
    const instance = window.__tiptapEditor;
    if (!instance) throw new Error('Editor instance missing');
    const normalized = text.replace(/\r\n?/g, '\n');
    const rendered = instance.storage.markdown?.parser?.parse(normalized, { inline: false }) ?? normalized;
    instance.chain().focus().deleteSelection().insertContent(rendered).run();
  }, markdown);
  await page.waitForTimeout(50);
  return editorRoot;
}

async function renderTableExamples(page: Page) {
  const editor = await insertMarkdown(page, TABLE_SAMPLE);
  const tables = page.locator('.tiptap-editor table');
  await expect(tables).toHaveCount(3);
  return { editor, tables };
}

test.describe('Markdown table visuals', () => {
  test('renders all sample tables', async ({ page }) => {
    const { tables } = await renderTableExamples(page);
    await expect(tables).toHaveCount(3);
  });

  test('basic schedule table exposes expected headers', async ({ page }) => {
    await renderTableExamples(page);
    const headerRow = page.locator('.tiptap-editor table').first().locator('tbody tr').first().locator('th');
    await expect(headerRow).toHaveText(['Time', 'Session', 'Host']);
  });

  test('basic schedule table shows lunch session row', async ({ page }) => {
    await renderTableExamples(page);
    const lunchRowCells = page
      .locator('.tiptap-editor table')
      .first()
      .locator('tbody tr')
      .nth(4)
      .locator('td');
    await expect(lunchRowCells).toHaveText(['12:00', 'Lunch + Open Notes', 'Everyone']);
  });

  test('alignment table renders column scaffolding', async ({ page }) => {
    await renderTableExamples(page);
    const secondTable = page.locator('.tiptap-editor table').nth(1);
    await expect(secondTable.locator('colgroup col')).toHaveCount(3);
  });

  test('alignment table keeps inline code formatting', async ({ page }) => {
    await renderTableExamples(page);
    const secondTable = page.locator('.tiptap-editor table').nth(1);
    const codeCell = secondTable.locator('tbody tr').nth(3).locator('code').first();
    await expect(codeCell).toHaveText('toggleTheme()');
  });

  test('release checklist table lists four areas', async ({ page }) => {
    await renderTableExamples(page);
    const dataRows = page
      .locator('.tiptap-editor table')
      .nth(2)
      .locator('tbody tr')
      .filter({ has: page.locator('td') });
    await expect(dataRows).toHaveCount(4);
  });

  test('release checklist table shows status labels', async ({ page }) => {
    await renderTableExamples(page);
    const statusCells = page.locator('.tiptap-editor table').nth(2).locator('tbody tr td:nth-child(3)');
    await expect(statusCells).toHaveText(['Done', 'Needs Review', 'In Flight', 'Pending']);
  });

  test('release checklist references command snippets inline', async ({ page }) => {
    await renderTableExamples(page);
    const lastRowCodes = page
      .locator('.tiptap-editor table')
      .nth(2)
      .locator('tbody tr')
      .nth(4)
      .locator('code');
    await expect(lastRowCodes).toHaveText(['npm run lint', 'npm run test -- --run', 'npm run test:e2e']);
  });

  test('headings render for each table section', async ({ page }) => {
    await renderTableExamples(page);
    const headings = page.locator('.tiptap-editor h2');
    await expect(headings).toHaveText(['1. Basic Schedule Table', '2. Alignment + Formatting', '3. Complex Release Checklist']);
  });

  test('callout reminder renders as blockquote after tables', async ({ page }) => {
    await renderTableExamples(page);
    const blockquote = page.locator('.tiptap-editor blockquote');
    await expect(blockquote).toContainText('Copy any of the sections above into your scratch note or vault to try the layouts in the live editor.');
  });
});
