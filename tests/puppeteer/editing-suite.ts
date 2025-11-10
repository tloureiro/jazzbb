import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import type { Browser, Page } from 'puppeteer';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core';
import { startTestServer, stopTestServer } from './utils/server';
import { editorHTML, editorText, resetEditor, waitForEditor } from './utils/editor';
import { WAIT_TIMEOUT } from './utils/timeouts';

type EditorGlobal = typeof window & {
  __tiptapEditor?: TiptapEditor;
  __requestAutoExpand?: () => void;
  showOpenFilePicker?: () => Promise<unknown[]>;
  __restorePicker?: () => void;
  __setWorkspaceMode?: (mode: 'scratch' | 'single' | 'vault' | 'browser') => void;
};

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

async function firstHeadingPos(page: Page): Promise<number> {
  return page.evaluate(() => {
    const runtime = window as EditorGlobal;
    const editor = runtime.__tiptapEditor;
    if (!editor) throw new Error('Editor instance unavailable');
    const { state } = editor.view;
    let position: number | null = null;
    state.doc.descendants((node, pos) => {
      if (position === null && node.type.name === 'heading') {
        position = pos;
        return false;
      }
      return true;
    });
    if (position === null) {
      throw new Error('Heading position not found');
    }
    return position;
  });
}

async function firstParagraphPos(page: Page): Promise<number> {
  return page.evaluate(() => {
    const runtime = window as EditorGlobal;
    const editor = runtime.__tiptapEditor;
    if (!editor) throw new Error('Editor instance unavailable');
    const { state } = editor.view;
    let position: number | null = null;
    state.doc.descendants((node, pos) => {
      if (position === null && node.type.name === 'paragraph') {
        position = pos;
        return false;
      }
      return true;
    });
    if (position === null) {
      throw new Error('Paragraph position not found');
    }
    return position;
  });
}

async function toggleHeadingAt(page: Page, pos: number, collapsed?: boolean): Promise<void> {
  await page.evaluate(({ pos, collapsed }) => {
    const runtime = window as EditorGlobal;
    const editor = runtime.__tiptapEditor;
    if (!editor) throw new Error('Editor instance unavailable');
    const result =
      typeof collapsed === 'boolean'
        ? editor.commands.toggleHeadingCollapse({ pos, collapsed })
        : editor.commands.toggleHeadingCollapse({ pos });
    if (!result) {
      throw new Error('toggleHeadingCollapse command failed');
    }
  }, { pos, collapsed });
}

async function collapseHeadingAt(page: Page, pos: number): Promise<void> {
  await page.evaluate(({ pos }) => {
    const runtime = window as EditorGlobal;
    const editor = runtime.__tiptapEditor;
    if (!editor) throw new Error('Editor instance unavailable');
    const result = editor.commands.collapseHeadingAt(pos);
    if (!result) {
      throw new Error('collapseHeadingAt command failed');
    }
  }, { pos });
}

async function expandHeadingAt(page: Page, pos: number): Promise<void> {
  await page.evaluate(({ pos }) => {
    const runtime = window as EditorGlobal;
    const editor = runtime.__tiptapEditor;
    if (!editor) throw new Error('Editor instance unavailable');
    const result = editor.commands.expandHeadingAt(pos);
    if (!result) {
      throw new Error('expandHeadingAt command failed');
    }
  }, { pos });
}

async function headingCollapsedAt(page: Page, pos: number): Promise<boolean> {
  return page.evaluate(({ pos }) => {
    const runtime = window as EditorGlobal;
    const editor = runtime.__tiptapEditor;
    if (!editor) throw new Error('Editor instance unavailable');
    const node = editor.view.state.doc.nodeAt(pos);
    if (!node) {
      throw new Error(`Heading not found at position ${pos}`);
    }
    return Boolean(node.attrs.collapsed);
  }, { pos });
}

async function collapsedContentCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll('.heading-collapsed-content').length);
}

async function setCursorInsideNode(page: Page, pos: number): Promise<void> {
  await page.evaluate(({ pos }) => {
    const runtime = window as EditorGlobal;
    const editor = runtime.__tiptapEditor;
    if (!editor) throw new Error('Editor instance unavailable');
    const target = pos + 1;
    editor.commands.setTextSelection({ from: target, to: target });
  }, { pos });
}

async function readSidebarWidthPercent(page: Page): Promise<number> {
  return page.evaluate(() => {
    const layout = document.querySelector('.app-body');
    const sidebar = layout?.querySelector<HTMLElement>('.sidebar');
    if (!layout || !sidebar) return 0;
    const layoutWidth = layout.getBoundingClientRect().width;
    if (layoutWidth === 0) return 0;
    const panelWidth = sidebar.getBoundingClientRect().width;
    return (panelWidth / layoutWidth) * 100;
  });
}

async function readOutlineWidthPercent(page: Page): Promise<number> {
  return page.evaluate(() => {
    const layout = document.querySelector('.app-body');
    const outline = layout?.querySelector<HTMLElement>('.outline-panel');
    if (!layout || !outline) return 0;
    const layoutWidth = layout.getBoundingClientRect().width;
    if (layoutWidth === 0) return 0;
    const panelWidth = outline.getBoundingClientRect().width;
    return (panelWidth / layoutWidth) * 100;
  });
}

async function dragHandle(page: Page, selector: string, deltaX: number): Promise<void> {
  const handle = await page.waitForSelector(selector, { timeout: WAIT_TIMEOUT });
  const box = await handle?.boundingBox();
  if (!box) {
    throw new Error(`Resize handle bounding box unavailable for ${selector}`);
  }
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + deltaX, centerY, { steps: 8 });
  await page.mouse.up();
}

async function doubleClickHandle(page: Page, selector: string): Promise<void> {
  const handle = await page.waitForSelector(selector, { timeout: WAIT_TIMEOUT });
  const box = await handle?.boundingBox();
  if (!box) {
    throw new Error(`Resize handle bounding box unavailable for ${selector}`);
  }
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.click(centerX, centerY, { clickCount: 2, delay: 40 });
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
      const h2Text = await page.$eval('.tiptap-editor h2', (node) => node.textContent?.trim() ?? '');
      assert.equal(h2Text, 'Section');
      const paragraphText = await page.$eval('.tiptap-editor p:last-of-type', (node) => node.textContent?.trim() ?? '');
      assert.equal(paragraphText, 'Heading');
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
  {
    name: 'collapses the active heading and hides its content',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Heading One' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Second block' }] },
        ],
      });
    },
    run: async (page) => {
      const headingPos = await firstHeadingPos(page);
      await toggleHeadingAt(page, headingPos);
    },
    assert: async (page) => {
      await page.waitForFunction(
        () => document.querySelectorAll('.heading-collapsed-content').length >= 1,
        { timeout: WAIT_TIMEOUT },
      );
      const headingPos = await firstHeadingPos(page);
      const collapsed = await headingCollapsedAt(page, headingPos);
      assert.equal(collapsed, true);
      const hiddenCount = await collapsedContentCount(page);
      assert.ok(hiddenCount >= 2, 'Expected heading content to be hidden when collapsed');
    },
  },
  {
    name: 'forces collapse via collapseHeadingAt command',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Heading Direct Collapse' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Details under heading' }] },
        ],
      });
    },
    run: async (page) => {
      const headingPos = await firstHeadingPos(page);
      await collapseHeadingAt(page, headingPos);
    },
    assert: async (page) => {
      await page.waitForFunction(
        () => document.querySelectorAll('.heading-collapsed-content').length >= 1,
        { timeout: WAIT_TIMEOUT },
      );
      const headingPos = await firstHeadingPos(page);
      const collapsed = await headingCollapsedAt(page, headingPos);
      assert.equal(collapsed, true);
      const hiddenCount = await collapsedContentCount(page);
      assert.ok(hiddenCount >= 1, 'Collapsed heading should hide its following content');
    },
  },
  {
    name: 'expands a collapsed heading via expandHeadingAt command',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Heading Expansion' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph body' }] },
        ],
      });
    },
    run: async (page) => {
      const headingPos = await firstHeadingPos(page);
      await collapseHeadingAt(page, headingPos);
      await page.waitForFunction(
        () => document.querySelector('.heading-collapsed-content') !== null,
        { timeout: WAIT_TIMEOUT },
      );
      await expandHeadingAt(page, headingPos);
    },
    assert: async (page) => {
      await page.waitForFunction(
        () => document.querySelectorAll('.heading-collapsed-content').length === 0,
        { timeout: WAIT_TIMEOUT },
      );
      const headingPos = await firstHeadingPos(page);
      const collapsed = await headingCollapsedAt(page, headingPos);
      assert.equal(collapsed, false);
    },
  },
  {
    name: 'collapsing a parent heading hides nested headings',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Parent Section' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Overview text' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Nested Section' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Nested details' }] },
        ],
      });
    },
    run: async (page) => {
      const headingPos = await firstHeadingPos(page);
      await toggleHeadingAt(page, headingPos);
    },
    assert: async (page) => {
      await page.waitForFunction(
        () => document.querySelector('h2.heading-collapsed-content') !== null,
        { timeout: WAIT_TIMEOUT },
      );
      const hiddenCount = await collapsedContentCount(page);
      assert.ok(hiddenCount >= 2, 'Nested heading and content should be hidden');
    },
  },
  {
    name: 'moving the selection into collapsed content keeps it hidden',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Heading One' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Second block' }] },
        ],
      });
    },
    run: async (page) => {
      const headingPos = await firstHeadingPos(page);
      await toggleHeadingAt(page, headingPos);
      const paragraphPos = await firstParagraphPos(page);
      await setCursorInsideNode(page, paragraphPos);
    },
    assert: async (page) => {
      const headingPos = await firstHeadingPos(page);
      const collapsed = await headingCollapsedAt(page, headingPos);
      assert.equal(collapsed, true);
      const hiddenCount = await collapsedContentCount(page);
      assert.ok(hiddenCount >= 2, 'Collapsed heading should remain hidden after moving cursor');
    },
  },
  {
    name: 'selection inside a collapsed section expands when requested',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Auto Expand Heading' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Hidden paragraph content' }] },
        ],
      });
    },
    run: async (page) => {
      const headingPos = await firstHeadingPos(page);
      await toggleHeadingAt(page, headingPos);
      await page.waitForFunction(
        () => document.querySelector('.heading-collapsed-content') !== null,
        { timeout: WAIT_TIMEOUT },
      );
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        runtime.__requestAutoExpand?.();
      });
      const paragraphPos = await firstParagraphPos(page);
      await setCursorInsideNode(page, paragraphPos);
    },
    assert: async (page) => {
      await page.waitForFunction(
        () => document.querySelector('.heading-collapsed-content') === null,
        { timeout: WAIT_TIMEOUT },
      );
      const headingPos = await firstHeadingPos(page);
      const collapsed = await headingCollapsedAt(page, headingPos);
      assert.equal(collapsed, false);
    },
  },
  {
    name: 'pressing enter inside a collapsed heading expands it',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Editable heading' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Body copy' }] },
        ],
      });
    },
    run: async (page) => {
      const headingPos = await firstHeadingPos(page);
      await toggleHeadingAt(page, headingPos);
      await page.waitForFunction(
        () => document.querySelector('.heading-collapsed-content') !== null,
        { timeout: WAIT_TIMEOUT },
      );
      await setCursorInsideNode(page, headingPos);
      await page.keyboard.press('Enter');
    },
    assert: async (page) => {
      await page.waitForFunction(
        () => document.querySelector('.heading-collapsed-content') === null,
        { timeout: WAIT_TIMEOUT },
      );
      const headingPos = await firstHeadingPos(page);
      const collapsed = await headingCollapsedAt(page, headingPos);
      assert.equal(collapsed, false);
    },
  },
  {
    name: 'navigates the outline tree with keyboard',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Parent Section' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Child Section' }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sibling Section' }] },
        ],
      });
    },
    run: async (page) => {
      await page.click('[data-test="header-outline-toggle"]');
      await page.waitForSelector('.outline-item[data-id="parent-section"]', { timeout: WAIT_TIMEOUT });
      await page.waitForSelector('.outline-item[data-id="child-section"]', { timeout: WAIT_TIMEOUT });
      await page.click('.outline-item[data-id="parent-section"]');
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => !document.querySelector('.outline-item[data-id="child-section"]'), {
        timeout: WAIT_TIMEOUT,
      });
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => Boolean(document.querySelector('.outline-item[data-id="child-section"]')),
        { timeout: WAIT_TIMEOUT },
      );
      await page.keyboard.press('ArrowDown');
      const activeChild = await page.evaluate(() => document.activeElement?.getAttribute('data-id'));
      assert.equal(activeChild, 'child-section');
      await page.keyboard.press('ArrowLeft');
      const activeParent = await page.evaluate(() => document.activeElement?.getAttribute('data-id'));
      assert.equal(activeParent, 'parent-section');
    },
    assert: async (page) => {
      await page.keyboard.press('ArrowDown');
      const activeSibling = await page.evaluate(() => document.activeElement?.getAttribute('data-id'));
      assert.equal(activeSibling, 'child-section');
    },
  },
  {
    name: 'resizes the sidebar via drag handle and resets with double click',
    setup: async (page) => {
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        runtime.__setWorkspaceMode?.('browser');
      });
      await page.waitForSelector('.sidebar', { timeout: WAIT_TIMEOUT });
    },
    run: async (page) => {
      const initial = await readSidebarWidthPercent(page);
      await page.evaluate((baseline) => {
        (window as typeof window & { __sidebarBaseline?: number }).__sidebarBaseline = baseline;
      }, initial);
      await dragHandle(page, '.resize-handle[data-panel="sidebar"]', 120);
      await page.waitForFunction(
        (baseline) => {
          const layout = document.querySelector('.app-body');
          if (!layout) return false;
          const segments = getComputedStyle(layout).gridTemplateColumns.trim().split(/\s+/);
          const first = Number.parseFloat(segments[0] ?? '');
          return !Number.isNaN(first) && first > baseline + 0.5;
        },
        { timeout: WAIT_TIMEOUT },
        initial,
      );
      await doubleClickHandle(page, '.resize-handle[data-panel="sidebar"]');
    },
    assert: async (page) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const reset = await readSidebarWidthPercent(page);
      const baseline = await page.evaluate(() => {
        const runtime = window as typeof window & { __sidebarBaseline?: number };
        return runtime.__sidebarBaseline ?? 0;
      });
      assert.ok(Math.abs(reset - baseline) < 0.8, `Expected sidebar width near baseline ${baseline.toFixed(2)}%, received ${reset.toFixed(2)}%`);
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        runtime.__setWorkspaceMode?.('scratch');
        delete (window as typeof window & { __sidebarBaseline?: number }).__sidebarBaseline;
      });
    },
  },
  {
    name: 'resizes the outline via drag handle and resets with double click',
    setup: async (page) => {
      const headingDoc: JSONContent = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Outline Root' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Some content' }] },
        ],
      };
      await setEditorDoc(page, headingDoc);
      await page.click('[data-test="header-outline-toggle"]');
      await page.waitForSelector('.resize-handle[data-panel="outline"]', { timeout: WAIT_TIMEOUT });
    },
    run: async (page) => {
      const initial = await readOutlineWidthPercent(page);
      await page.evaluate((baseline) => {
        (window as typeof window & { __outlineBaseline?: number }).__outlineBaseline = baseline;
      }, initial);
      await dragHandle(page, '.resize-handle[data-panel="outline"]', -120);
      await page.waitForFunction(
        (baseline) => {
          const layout = document.querySelector('.app-body');
          if (!layout) return false;
          const segments = getComputedStyle(layout).gridTemplateColumns.trim().split(/\s+/);
          const last = Number.parseFloat(segments[segments.length - 1] ?? '');
          return !Number.isNaN(last) && last > baseline + 0.5;
        },
        { timeout: WAIT_TIMEOUT },
        initial,
      );
      await doubleClickHandle(page, '.resize-handle[data-panel="outline"]');
    },
    assert: async (page) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const reset = await readOutlineWidthPercent(page);
      const baseline = await page.evaluate(() => {
        const runtime = window as typeof window & { __outlineBaseline?: number };
        return runtime.__outlineBaseline ?? 0;
      });
      assert.ok(Math.abs(reset - baseline) < 0.8, `Expected outline width near baseline ${baseline.toFixed(2)}%, received ${reset.toFixed(2)}%`);
      await page.click('[data-test="header-outline-toggle"]');
      await page.waitForFunction(
        () => document.querySelector('.resize-handle[data-panel="outline"]') === null,
        { timeout: WAIT_TIMEOUT },
      );
      await page.evaluate(() => {
        delete (window as typeof window & { __outlineBaseline?: number }).__outlineBaseline;
      });
    },
  },
  {
    name: 'toggles plain markdown view with shortcut',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Plain Mode' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Plain markdown toggle scenario.' }] },
        ],
      });
    },
    run: async (page) => {
      await page.waitForSelector('.tiptap-editor', { timeout: WAIT_TIMEOUT });
      const platform: 'mac' | 'windows' = await page.evaluate(() => {
        const { platform = '', userAgent = '' } = navigator;
        const normalized = `${platform} ${userAgent}`.toLowerCase();
        return normalized.includes('mac') || normalized.includes('iphone') || normalized.includes('ipad') ? 'mac' : 'windows';
      });
      if (platform === 'mac') {
        await page.keyboard.down('Meta');
        await page.keyboard.down('Alt');
        await page.keyboard.press('KeyM');
        await page.keyboard.up('Alt');
        await page.keyboard.up('Meta');
      } else {
        await page.keyboard.down('Control');
        await page.keyboard.down('Alt');
        await page.keyboard.press('KeyM');
        await page.keyboard.up('Alt');
        await page.keyboard.up('Control');
      }
      await page.waitForSelector('[data-test="plain-markdown-editor"]', { timeout: WAIT_TIMEOUT });
      const afterFirst = await page.evaluate(() => {
        const plain = document.querySelector('[data-test="plain-markdown-editor"]') as HTMLElement | null;
        const rich = document.querySelector('.tiptap-editor') as HTMLElement | null;
        return {
          plainPresent: Boolean(plain),
          plainDisplay: plain ? window.getComputedStyle(plain).display : 'none',
          richDisplay: rich ? window.getComputedStyle(rich).display : 'none',
        };
      });
      if (platform === 'mac') {
        await page.keyboard.down('Meta');
        await page.keyboard.down('Alt');
        await page.keyboard.press('KeyM');
        await page.keyboard.up('Alt');
        await page.keyboard.up('Meta');
      } else {
        await page.keyboard.down('Control');
        await page.keyboard.down('Alt');
        await page.keyboard.press('KeyM');
        await page.keyboard.up('Alt');
        await page.keyboard.up('Control');
      }
      await page.waitForFunction(
        () => document.querySelector('[data-test="plain-markdown-editor"]') === null,
        { timeout: WAIT_TIMEOUT },
      );
      const afterSecond = await page.evaluate(() => {
        const plain = document.querySelector('[data-test="plain-markdown-editor"]') as HTMLElement | null;
        const rich = document.querySelector('.tiptap-editor') as HTMLElement | null;
        return {
          plainPresent: Boolean(plain),
          richDisplay: rich ? window.getComputedStyle(rich).display : 'none',
        };
      });
      await page.evaluate(
        ({ afterFirst, afterSecond }) => {
          (window as typeof window & {
            __plainToggleResult?: {
              afterFirst: typeof afterFirst;
              afterSecond: typeof afterSecond;
            };
          }).__plainToggleResult = { afterFirst, afterSecond };
        },
        { afterFirst, afterSecond },
      );
    },
    assert: async (page) => {
      const result = await page.evaluate(() => {
        const runtime = window as typeof window & {
          __plainToggleResult?: {
            afterFirst: { plainPresent: boolean; plainDisplay: string; richDisplay: string };
            afterSecond: { plainPresent: boolean; richDisplay: string };
          };
        };
        return runtime.__plainToggleResult;
      });
      assert.ok(result, 'Expected toggle result payload');
      assert.equal(result?.afterFirst.plainPresent, true, 'Plain textarea should appear after first toggle');
      assert.notEqual(result?.afterFirst.plainDisplay, 'none', 'Plain textarea should be visible after first toggle');
      assert.equal(result?.afterFirst.richDisplay, 'none', 'Rich editor should be hidden when plain view is active');
      assert.equal(result?.afterSecond.plainPresent, false, 'Plain textarea should be removed after second toggle');
      assert.notEqual(result?.afterSecond.richDisplay, 'none', 'Rich editor should be visible after toggling back');
      await page.evaluate(() => {
        const runtime = window as typeof window & { __plainToggleResult?: unknown };
        delete runtime.__plainToggleResult;
      });
    },
  },
  {
    name: 'suppresses grammarly overlays after collapsing a heading',
    setup: async (page) => {
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Collapse source' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Body before collapse.' }] },
        ],
      });
    },
    run: async (page) => {
      const pos = await firstHeadingPos(page);
      const existing = await page.evaluate(() => document.getElementById('jazzbb-grammarly-suppression') !== null);
      if (existing) {
        await page.evaluate(() => {
          document.getElementById('jazzbb-grammarly-suppression')?.remove();
        });
      }
      await collapseHeadingAt(page, pos);
      await page.waitForSelector('#jazzbb-grammarly-suppression', { timeout: WAIT_TIMEOUT });
    },
    assert: async (page) => {
      const exists = await page.evaluate(
        () => document.getElementById('jazzbb-grammarly-suppression') !== null,
      );
      assert.equal(exists, true, 'Expected Grammarly suppression style to be injected after collapsing');
    },
  },
  {
    name: 'keeps the editor header visible while scrolling',
    setup: async (page) => {
      const paragraphs: JSONContent['content'] = Array.from({ length: 80 }, (_, index) => ({
        type: 'paragraph',
        content: [{ type: 'text', text: `Paragraph ${index + 1} with content.` }],
      }));
      await setEditorDoc(page, {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sticky header check' }] },
          ...paragraphs,
        ],
      });
    },
    run: async (page) => {
      await page.evaluate(() => {
        const header = document.querySelector('.editor-pane .pane-header');
        const appHeader = document.querySelector('.app-header');
        if (!(header instanceof HTMLElement)) {
          throw new Error('Editor header missing');
        }
        const headerRect = header.getBoundingClientRect();
        const appRect = appHeader instanceof HTMLElement ? appHeader.getBoundingClientRect() : null;
        const gapBefore = headerRect.top - (appRect?.bottom ?? 0);
        window.scrollBy(0, 600);
        const afterRect = header.getBoundingClientRect();
        const appAfterRect = appHeader instanceof HTMLElement ? appHeader.getBoundingClientRect() : null;
        const gapAfter = afterRect.top - (appAfterRect?.bottom ?? 0);
        window.scrollBy(0, -600);
        (window as typeof window & {
          __headerStickResult?: { before: number; after: number };
        }).__headerStickResult = {
          before: gapBefore,
          after: gapAfter,
        };
      });
    },
    assert: async (page) => {
      const result = await page.evaluate(() => {
        const runtime = window as typeof window & {
          __headerStickResult?: { before: number; after: number };
        };
        return runtime.__headerStickResult ?? { before: Infinity, after: Infinity };
      });
      const delta = Math.abs(result.after - result.before);
      assert.ok(delta < 2, `Editor header should remain flush with top bar; gap delta ${delta.toFixed(2)}px`);
    },
  },
  {
    name: 'closes a single-file session and returns to scratch',
    setup: async (page) => {
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        const content = '# Single File\n\nTemporary content.';
        const file = {
          name: 'single.md',
          lastModified: Date.now(),
          async text() {
            return content;
          },
        };
        const handle = {
          name: 'single.md',
          async getFile() {
            return file;
          },
        };
        runtime.showOpenFilePicker = async () => [handle];
        runtime.__restorePicker = () => {
          delete runtime.showOpenFilePicker;
          delete runtime.__restorePicker;
        };
      });
    },
    run: async (page) => {
      await page.click('[data-test="header-open-file"]');
      await page.waitForSelector('[data-test="editor-close-document"]', { timeout: WAIT_TIMEOUT });
      await page.click('[data-test="editor-close-document"]');
    },
    assert: async (page) => {
      await page.waitForSelector('[data-test="header-save-browser"]', { timeout: WAIT_TIMEOUT });
      const closeButton = await page.$('[data-test="editor-close-document"]');
      assert.equal(closeButton, null);
      await page.evaluate(() => {
        const runtime = window as EditorGlobal;
        runtime.__restorePicker?.();
      });
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
