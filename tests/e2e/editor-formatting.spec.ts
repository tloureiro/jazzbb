import { test, expect } from '@playwright/test';

async function insertMarkdown(page, markdown) {
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

test.describe('Markdown formatting scenarios', () => {
  test('renders bold text', async ({ page }) => {
    const editor = await insertMarkdown(page, '**Bold** example');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<strong>Bold</strong>');
  });

  test('renders italic text', async ({ page }) => {
    const editor = await insertMarkdown(page, '*Italic* emphasis');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<em>Italic</em>');
  });

  test('renders strikethrough text', async ({ page }) => {
    const editor = await insertMarkdown(page, 'Updates ~~old~~ new');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<s>old</s>');
  });

  test('renders inline code', async ({ page }) => {
    const editor = await insertMarkdown(page, 'Use `npm run dev` to start');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<code>npm run dev</code>');
  });

  test('renders fenced code block', async ({ page }) => {
    const snippet = ['```js', 'const answer = 42;', 'console.log(answer);', '```'].join('\n');
    const editor = await insertMarkdown(page, snippet);
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<pre');
    expect(html).toContain('hljs');
  });

  test('renders blockquote', async ({ page }) => {
    const editor = await insertMarkdown(page, '> Inspiration arrives during work.');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<blockquote');
  });

  test('renders unordered list', async ({ page }) => {
    const editor = await insertMarkdown(page, '- Alpha\n- Beta\n- Gamma');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<ul');
    expect(html).toContain('<li><p>Alpha</p></li>');
  });

  test('renders ordered list', async ({ page }) => {
    const editor = await insertMarkdown(page, '1. First\n2. Second\n3. Third');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<ol');
    expect(html).toContain('<li><p>First</p></li>');
  });

  test('renders nested lists', async ({ page }) => {
    const editor = await insertMarkdown(page, '- Item\n  - Nested\n  - Detail');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toMatch(/<ul[\s\S]*<ul/);
    expect(html).toContain('<p>Nested</p>');
  });

  test('renders task list', async ({ page }) => {
    const editor = await insertMarkdown(page, '- [x] Done\n- [ ] Pending');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('tiptap-task-list');
    expect(html).toContain('type="checkbox"');
  });

  test('renders horizontal rule', async ({ page }) => {
    const editor = await insertMarkdown(page, 'Intro\n\n---\n\nAfter');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<hr');
  });

  test('renders hyperlink', async ({ page }) => {
    const editor = await insertMarkdown(page, '[Website](https://example.com)');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('href="https://example.com"');
  });

  test('renders image', async ({ page }) => {
    const editor = await insertMarkdown(page, '![Diagram](https://example.com/diagram.png)');
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('&lt;img');
    expect(html).toContain('diagram.png');
  });

  test('renders heading level three', async ({ page }) => {
    const editor = await insertMarkdown(page, '### Section Title');
    const headingText = await editor.evaluate(
      (node) => node.querySelector('h3')?.textContent?.trim() ?? '',
    );
    expect(headingText).toBe('Section Title');
  });

  test('renders mixed formatting paragraph', async ({ page }) => {
    const content = '**Bold** _italic_ and `inline` text.';
    const editor = await insertMarkdown(page, content);
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>inline</code>');
  });

  test('renders blockquote with nested list', async ({ page }) => {
    const markdown = '> Agenda\n> - Item A\n> - Item B';
    const editor = await insertMarkdown(page, markdown);
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('<blockquote');
    expect(html).toContain('<ul');
  });

  test('renders fenced code block with language hint', async ({ page }) => {
    const snippet = ['```python', 'def greet():', "    print('hello')", '```'].join('\n');
    const editor = await insertMarkdown(page, snippet);
    const html = await editor.evaluate((node) => node.innerHTML);
    expect(html).toContain('language-python');
  });
});
