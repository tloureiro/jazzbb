import type { Page } from 'puppeteer';
import type { ResolvedPos, Slice } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { WAIT_TIMEOUT } from './timeouts';

const IS_MAC = process.platform === 'darwin';
const MOD_KEY = IS_MAC ? 'Meta' : 'Control';

type RuntimeWindow = typeof window & {
  __tiptapEditor?: {
    chain: () => {
      focus: (position?: 'start' | 'end') => {
        run: () => void;
      };
      deleteSelection: () => {
        run: () => void;
      };
    };
    commands: {
      clearContent: (emitUpdate?: boolean) => void;
      setContent: (
        content: unknown,
        options?: {
          emitUpdate?: boolean;
          parseOptions?: { preserveWhitespace?: 'full' | boolean };
        },
      ) => void;
      setTextSelection: (position: { from: number; to?: number }) => void;
      toggleTaskList?: () => void;
    };
    view: {
      state: {
        selection: { $from: ResolvedPos; $to: ResolvedPos };
        tr: Transaction;
      };
      dispatch: (tr: unknown) => void;
      someProp: <T>(name: string, fn: (prop: unknown) => T) => T | undefined;
    };
  };
  __jazzbbLastPasteMode?: string;
  __jazzbbPasteCount?: number;
};

export async function waitForEditor(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as RuntimeWindow).__tiptapEditor), { timeout: WAIT_TIMEOUT });
}

export async function resetEditor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const runtime = window as RuntimeWindow;
    const editor = runtime.__tiptapEditor;
    if (!editor) return;
    editor.commands.clearContent(true);
    editor.commands.setContent('', { emitUpdate: false, parseOptions: { preserveWhitespace: 'full' } });
    editor.chain().focus('start').run();
    runtime.__jazzbbLastPasteMode = undefined;
  });
}

export async function focusEditor(page: Page, position: 'start' | 'end' = 'end'): Promise<void> {
  await page.evaluate(({ pos }) => {
    const runtime = window as RuntimeWindow;
    const editor = runtime.__tiptapEditor;
    if (!editor) return;
    editor.chain().focus(pos).run();
  }, { pos: position });
}

export async function pasteAsPlainText(page: Page, text: string): Promise<void> {
  await page.evaluate((payload) => {
    const runtime = window as RuntimeWindow;
    const editor = runtime.__tiptapEditor;
    if (!editor) {
      throw new Error('Editor instance unavailable');
    }

    editor.chain().focus('end').run();
    const view = editor.view;
    const { state } = view;
    const slice = view.someProp('clipboardTextParser', (parser) =>
      (parser as (text: string, pos: ResolvedPos, plain: boolean, view: EditorView) => Slice)(
        payload.text,
        state.selection.$from,
        true,
        view as EditorView,
      ),
    );
    if (!slice) {
      throw new Error('Clipboard parser returned no slice');
    }

    const tr = state.tr.replaceSelection(slice).scrollIntoView().setMeta('paste', true).setMeta('uiEvent', 'paste');
    view.dispatch(tr);
  }, { text });

}

export async function editorHTML(page: Page): Promise<string> {
  return page.$eval('.tiptap-editor', (node) => node.innerHTML);
}

export async function editorText(page: Page): Promise<string> {
  return page.$eval('.tiptap-editor', (node) => node.textContent ?? '');
}

export async function getLastPasteMode(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const runtime = window as RuntimeWindow;
    return runtime.__jazzbbLastPasteMode;
  });
}

export async function getDocSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    const runtime = window as RuntimeWindow;
    const editor = runtime.__tiptapEditor;
    if (!editor) return 0;
    return editor.view.state.doc.content.size;
  });
}

export async function setCursor(page: Page, position: number): Promise<void> {
  await page.evaluate(({ pos }) => {
    const runtime = window as RuntimeWindow;
    const editor = runtime.__tiptapEditor;
    if (!editor) {
      throw new Error('Editor instance unavailable');
    }
    editor.commands.setTextSelection({ from: pos, to: pos });
  }, { pos: position });
}

export async function setCursorToStart(page: Page): Promise<void> {
  await setCursor(page, 1);
}

export async function setCursorToEnd(page: Page): Promise<void> {
  await page.evaluate(() => {
    const runtime = window as RuntimeWindow;
    const editor = runtime.__tiptapEditor;
    if (!editor) return;
    const size = editor.view.state.doc.content.size;
    editor.commands.setTextSelection({ from: size, to: size });
  });
}

export async function selectAll(page: Page): Promise<void> {
  await page.keyboard.down(MOD_KEY);
  await page.keyboard.press('KeyA');
  await page.keyboard.up(MOD_KEY);
}

export async function typeText(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text, { delay: 1 });
}

export async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
}

export async function holdModifier(page: Page, key: 'Shift' | 'Alt' | 'Control' | 'Meta', run: () => Promise<void>): Promise<void> {
  await page.keyboard.down(key);
  try {
    await run();
  } finally {
    await page.keyboard.up(key);
  }
}

export const MODIFIER_KEY = MOD_KEY;
