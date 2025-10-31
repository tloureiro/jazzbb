import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import type { Browser, Page } from 'puppeteer';
import { startTestServer, stopTestServer } from './utils/server';
import { editorHTML, editorText, getLastPasteMode, pasteAsPlainText, resetEditor, waitForEditor } from './utils/editor';

type FormattingScenario = {
  name: string;
  markdown: string;
  expectedMode: string;
  assert: (page: Page) => Promise<void>;
};

const require = createRequire(import.meta.url);

const FORMATTING_SCENARIOS: FormattingScenario[] = [
  {
    name: 'renders heading hierarchy',
    markdown: ['# Atlas Guide', '## Navigation Basics', '### Deep Dive'].join('\n\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const headingTags = await page.$$eval('.tiptap-editor h1, .tiptap-editor h2, .tiptap-editor h3', (nodes) =>
        nodes.map((node) => node.tagName),
      );
      assert.deepStrictEqual(headingTags, ['H1', 'H2', 'H3']);
    },
  },
  {
    name: 'preserves nested unordered lists',
    markdown: ['- Parent item', '  - Child item', '    - Grandchild item', '- Second parent'].join('\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const nestedExists = await page.$eval('.tiptap-editor ul ul', () => true).catch(() => false);
      assert.ok(nestedExists, 'Expected nested unordered list to render');
      const items = await page.$$eval('.tiptap-editor li', (nodes) => nodes.map((node) => node.textContent?.trim())) as Array<string | undefined>;
      assert.ok(items.includes('Grandchild item'), 'Grandchild item should be present');
    },
  },
  {
    name: 'maintains ordered list numbering',
    markdown: ['1. Draft charter', '2. Collect feedback', '10. Launch pilot'].join('\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const items = await page.$$eval('.tiptap-editor ol li', (nodes) =>
        nodes.map((node) => node.textContent?.trim()),
      );
      assert.deepStrictEqual(items, ['Draft charter', 'Collect feedback', 'Launch pilot']);
    },
  },
  {
    name: 'renders blockquotes',
    markdown: ['> Great ideas require iteration.', '> Keep refining the draft.'].join('\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const quoteText = await page.$eval('.tiptap-editor blockquote p', (node) => node.textContent ?? '');
      assert.ok(quoteText.includes('Great ideas require iteration.'), 'Blockquote text missing');
    },
  },
  {
    name: 'highlights fenced code blocks',
    markdown: ['```js', "console.log('launch');", '```', '', 'Follow up with telemetry.'].join('\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const hasCodeBlock = await page.$eval('.tiptap-editor pre code', (node) => ({
        className: node.className,
        text: node.textContent ?? '',
      }));
      assert.ok(hasCodeBlock.text.includes("console.log('launch');"), 'Code block content missing');
      assert.ok(hasCodeBlock.className.includes('language-js'), 'Code block missing language class');
    },
  },
  {
    name: 'keeps inline code and emphasis intact',
    markdown: 'This paragraph has `inline snippets` and *italic emphasis* together.',
    expectedMode: 'plain',
    assert: async (page) => {
      const inline = await page.$eval('.tiptap-editor p', (node) => node.innerHTML);
      assert.ok(inline.includes('<code>'), 'Inline code missing');
      assert.ok(inline.includes('<em>'), 'Emphasis missing');
    },
  },
  {
    name: 'applies strong emphasis',
    markdown: 'Ensure **critical** steps stand out in the handbook.',
    expectedMode: 'plain',
    assert: async (page) => {
      const strongCount = await page.$$eval('.tiptap-editor strong', (nodes) => nodes.length);
      assert.ok(strongCount > 0, 'Expected strong emphasis elements');
    },
  },
  {
    name: 'retains inline and reference links',
    markdown: [
      '[Metrics](https://example.com/metrics) deserve a bookmark and [Reference][ref].',
      '',
      '[ref]: https://example.com/ref',
    ].join('\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const hrefs = await page.$$eval('.tiptap-editor a', (nodes) => nodes.map((node) => node.getAttribute('href')));
      assert.ok(hrefs.includes('https://example.com/metrics'), 'Inline link missing');
      assert.ok(hrefs.includes('https://example.com/ref'), 'Reference link missing');
    },
  },
  {
    name: 'creates horizontal rules',
    markdown: ['Above the rule', '', '---', '', 'Below the divider'].join('\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const hrCount = await page.$$eval('.tiptap-editor hr', (nodes) => nodes.length);
      assert.equal(hrCount, 1, 'Expected a single horizontal rule');
    },
  },
  {
    name: 'renders markdown tables',
    markdown: ['| Feature | Status |', '| --- | --- |', '| Editing | Enabled |', '| Sync | Planned |'].join('\n'),
    expectedMode: 'plain',
    assert: async (page) => {
      const text = await editorText(page);
      assert.ok(text.includes('Feature Status'), 'Table header text should be preserved');
      assert.ok(text.includes('Editing Enabled'));
      assert.ok(text.includes('Sync Planned'));
    },
  },
  {
    name: 'supports footnotes',
    markdown: ['Reference with note.[^1]', '', '[^1]: Footnote body content.'].join('\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const text = await editorText(page);
      assert.ok(text.includes('Footnote body content.'), 'Footnote definition missing');
    },
  },
  {
    name: 'renders task list items',
    markdown: ['- [ ] backlog triage', '- [x] publish changelog'].join('\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const text = await editorText(page);
      assert.ok(text.includes('backlog triage'), 'Open task item missing');
      assert.ok(text.includes('publish changelog'), 'Completed task item missing');
    },
  },
  {
    name: 'shows front matter as literal text blocks',
    markdown: ['---', 'title: Roadmap', 'owner: Core Team', '---', '', 'Kickoff content.'].join('\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const text = await editorText(page);
      assert.ok(text.includes('title: Roadmap'), 'Front matter title missing');
      assert.ok(text.includes('owner: Core Team'), 'Front matter owner missing');
    },
  },
  {
    name: 'normalizes extra blank paragraphs',
    markdown: ['# Release Notes', '', '', 'Paragraph after spacing.', '', '', '- Key item'].join('\n'),
    expectedMode: 'markdown',
    assert: async (page) => {
      const html = await editorHTML(page);
      assert.ok(!html.includes('<p><br></p>'), 'Unexpected empty paragraphs remain');
      const paragraphCount = await page.$$eval('.tiptap-editor p', (nodes) => nodes.length);
      assert.ok(paragraphCount > 1, 'Paragraph count too low after normalization');
    },
  },
  {
    name: 'preserves inline HTML',
    markdown: 'Ensure <mark>important</mark> findings remain highlighted.',
    expectedMode: 'plain',
    assert: async (page) => {
      const text = await editorText(page);
      assert.ok(text.includes('important'), 'Inline highlight text missing');
    },
  },
];

export async function runFormattingSuite(): Promise<void> {
  const moduleModule = require('module') as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const wsPath = require.resolve('ws');
  const originalLoad = moduleModule._load.bind(moduleModule);
  moduleModule._load = (request, parent, isMain) => {
    if (request === 'ws') {
      return originalLoad(wsPath, parent, isMain);
    }
    return originalLoad(request, parent, isMain);
  };

  const puppeteer = require('puppeteer') as typeof import('puppeteer');
  moduleModule._load = originalLoad;

  console.log('▶ Running formatting scenarios in Puppeteer');
  const { origin } = await startTestServer();
  let browser: Browser | undefined;
  let page: Page | undefined;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.goto(origin);
    await waitForEditor(page);

    for (const scenario of FORMATTING_SCENARIOS) {
      console.log(`  • ${scenario.name}`);
      await page.goto(origin);
      await waitForEditor(page);
      await resetEditor(page);
      await pasteAsPlainText(page, scenario.markdown);
      await scenario.assert(page);
      const mode = await getLastPasteMode(page);
      console.log(`    ↳ mode=${mode}`);
      assert.equal(mode, scenario.expectedMode, `Unexpected paste mode for scenario "${scenario.name}"`);
    }
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
    await stopTestServer();
  }

  console.log('✔ Formatting scenarios passed');
}
