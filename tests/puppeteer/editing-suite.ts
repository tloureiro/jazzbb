import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import type { Browser, Page } from 'puppeteer';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core';
import { startTestServer, stopTestServer } from './utils/server';
import { editorHTML, editorText, resetEditor, waitForEditor } from './utils/editor';

type EditorGlobal = typeof window & { __tiptapEditor?: TiptapEditor };

type EditingScenario = {
  name: string;
  setup: (page: Page) => Promise<void>;
  run: (page: Page) => Promise<void>;
  assert: (page: Page) => Promise<void>;
};

const require = createRequire(import.meta.url);

async function setEditorDoc(page: Page, doc: JSONContent): Promise<void> {
  await page.evaluate((payload) => {
    const runtime = window as EditorGlobal;
    const editor = runtime.__tiptapEditor;
    if (!editor) throw new Error('Editor instance unavailable');
    editor.commands.setContent(payload.doc, {
      parseOptions: { preserveWhitespace: 'full' },
      emitUpdate: true,
    });
    editor.chain().focus('end').run();
  }, { doc });
}

const EDITING_SCENARIOS: EditingScenario[] = [
  {
    name: 'removes the trailing character from a paragraph',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sample body text' }] }],
      });
    },
    run: async (page) => {
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        const editor = runtime.__tiptapEditor;
        if (!editor) throw new Error('Editor instance unavailable');
        const { state, dispatch } = editor.view;
        const from = state.doc.content.size - 2;
        const to = state.doc.content.size - 1;
        dispatch(state.tr.delete(from, to));
      });
    },
    assert: async (page) => {
      const text = (await editorText(page)).trim();
      assert.equal(text, 'Sample body tex');
    },
  },
  {
    name: 'inserts an additional paragraph at the end',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Existing content' }] }],
      });
    },
    run: async (page) => {
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        const editor = runtime.__tiptapEditor;
        if (!editor) throw new Error('Editor instance unavailable');
        editor.commands.insertContent({ type: 'paragraph', content: [{ type: 'text', text: 'Additional line' }] });
      });
    },
    assert: async (page) => {
      const text = (await editorText(page)).trim();
      assert.ok(text.includes('Existing content'));
      assert.ok(text.includes('Additional line'));
    },
  },
  {
    name: 'wraps the active paragraph in a blockquote',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted insight' }] }],
      });
    },
    run: async (page) => {
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        const editor = runtime.__tiptapEditor;
        if (!editor) throw new Error('Editor instance unavailable');
        editor.commands.toggleBlockquote();
      });
    },
    assert: async (page) => {
      const html = await editorHTML(page);
      assert.ok(html.includes('<blockquote>'));
      assert.ok(html.includes('Quoted insight'));
    },
  },
  {
    name: 'converts paragraphs into an ordered list',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'First step' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Second step' }] },
        ],
      });
    },
    run: async (page) => {
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        const editor = runtime.__tiptapEditor;
        if (!editor) throw new Error('Editor instance unavailable');
        editor.commands.toggleOrderedList();
      });
    },
    assert: async (page) => {
      const html = await editorHTML(page);
      assert.ok(html.includes('<ol'));
      assert.ok(html.includes('First step'));
      assert.ok(html.includes('Second step'));
    },
  },
  {
    name: 'replaces the entire document content',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original content block' }] }],
      });
    },
    run: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Replacement paragraph' }] }],
      });
    },
    assert: async (page) => {
      const text = (await editorText(page)).trim();
      assert.equal(text, 'Replacement paragraph');
    },
  },
  {
    name: 'splits a heading into heading and paragraph',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section Heading' }] }],
      });
    },
    run: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Heading' }] },
        ],
      });
    },
    assert: async (page) => {
      const html = await editorHTML(page);
      assert.ok(html.includes('<h2>Section</h2>'));
      assert.ok(html.includes('<p>Heading</p>'));
    },
  },
  {
    name: 'marks the first task item as complete',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Backlog review' }] }],
              },
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Publish release' }] }],
              },
            ],
          },
        ],
      });
    },
    run: async (page) => {
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        const editor = runtime.__tiptapEditor;
        if (!editor) throw new Error('Editor instance unavailable');
        const { state, dispatch } = editor.view;
        let targetPos: number | null = null;
        state.doc.descendants((node, pos) => {
          if (targetPos === null && node.type.name === 'taskItem') {
            targetPos = pos;
            return false;
          }
          return true;
        });
        if (targetPos === null) throw new Error('Task item not found');
        const node = state.doc.nodeAt(targetPos);
        if (!node) throw new Error('Task node unavailable');
        const tr = state.tr.setNodeMarkup(targetPos, node.type, { ...node.attrs, checked: true });
        dispatch(tr);
      });
    },
    assert: async (page) => {
      const states = await page.$$eval('.tiptap-editor input[type="checkbox"]', (inputs) =>
        inputs.map((input) => input.checked),
      );
      assert.deepStrictEqual(states, [true, true]);
    },
  },
  {
    name: 'indents the second list item',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item alpha' }] }],
              },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item beta' }] }],
              },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item gamma' }] }],
              },
            ],
          },
        ],
      });
    },
    run: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Item alpha' }] },
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item beta' }] }],
                      },
                      {
                        type: 'listItem',
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item gamma' }] }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
    },
    assert: async (page) => {
      const html = await editorHTML(page);
      assert.ok(html.includes('<li><p>Item alpha</p><ul'), 'Second item did not become nested');
      assert.ok(html.includes('<li><p>Item beta</p></li>'));
    },
  },
  {
    name: 'applies bold formatting to a selection',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Toggle me' }] }],
      });
    },
    run: async (page) => {
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        const editor = runtime.__tiptapEditor;
        if (!editor) throw new Error('Editor instance unavailable');
        const end = editor.view.state.doc.content.size - 1;
        editor.commands.setTextSelection({ from: 1, to: end });
        editor.commands.toggleBold();
      });
    },
    assert: async (page) => {
      const html = await editorHTML(page);
      assert.ok(html.includes('<strong>Toggle me</strong>'));
    },
  },
  {
    name: 'converts a heading back into a paragraph',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title Line' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Trailing copy' }] },
        ],
      });
    },
    run: async (page) => {
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        const editor = runtime.__tiptapEditor;
        if (!editor) throw new Error('Editor instance unavailable');
        editor.commands.setTextSelection({ from: 1, to: 1 });
        editor.commands.toggleHeading({ level: 1 });
      });
    },
    assert: async (page) => {
      const html = await editorHTML(page);
      assert.ok(!html.includes('<h1>'));
      const firstParagraph = await editorText(page);
      assert.ok(firstParagraph.includes('Title Line'));
    },
  },
];

export async function runEditingSuite(): Promise<void> {
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

  console.log('▶ Running editing scenarios in Puppeteer');
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

    for (const scenario of EDITING_SCENARIOS) {
      console.log(`  • ${scenario.name}`);
      await page.goto(origin);
      await waitForEditor(page);
      await resetEditor(page);
      await scenario.setup(page);
      await scenario.run(page);
      await scenario.assert(page);
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

  console.log('✔ Editing scenarios passed');
}
