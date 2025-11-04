import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import type { Browser, Page } from 'puppeteer';
import JSZip from 'jszip';
import { startTestServer, stopTestServer } from './utils/server';
import { focusEditor, resetEditor, waitForEditor, pasteAsPlainText } from './utils/editor';

type DebugStatus = {
  mode: 'scratch' | 'browser' | 'vault';
  selection?: string;
  notes: { path: string; title: string; lastModified: number }[];
  settings: { theme: string; typographyPreset: string; fontScale: number; measureScale: number };
};

type BrowserVaultDebugApi = {
  status(): DebugStatus;
  read(path: string): Promise<string>;
  export(): Promise<number[]>;
  import(data: Uint8Array | number[]): Promise<void>;
  clear(): Promise<void>;
  resetConfigs(): Promise<void>;
  setMockEstimate(payload: { usage: number; quota: number }): void;
};

const require = createRequire(import.meta.url);

async function status(page: Page): Promise<DebugStatus> {
  const snapshot = await page.evaluate(() => {
    const runtime = window as typeof window & { __browserVault?: BrowserVaultDebugApi };
    return runtime.__browserVault?.status();
  });
  if (!snapshot) {
    throw new Error('Browser vault debug API unavailable');
  }
  return snapshot;
}

async function readContent(page: Page, path: string): Promise<string> {
  return page.evaluate((input) => {
    const runtime = window as typeof window & { __browserVault?: BrowserVaultDebugApi };
    if (!runtime.__browserVault) throw new Error('Browser vault debug API unavailable');
    return runtime.__browserVault.read(input.path);
  }, { path });
}

async function exportZip(page: Page): Promise<Uint8Array | number[]> {
  return page.evaluate(() => {
    const runtime = window as typeof window & { __browserVault?: BrowserVaultDebugApi };
    if (!runtime.__browserVault) throw new Error('Browser vault debug API unavailable');
    return runtime.__browserVault.export();
  });
}

async function importZip(page: Page, data: Uint8Array): Promise<void> {
  await page.evaluate((payload) => {
    const runtime = window as typeof window & { __browserVault?: BrowserVaultDebugApi };
    if (!runtime.__browserVault) throw new Error('Browser vault debug API unavailable');
    return runtime.__browserVault.import(payload.bytes);
  }, { bytes: Array.from(data) });
}

async function clearVault(page: Page): Promise<void> {
  await page.evaluate(() => {
    const runtime = window as typeof window & { __browserVault?: BrowserVaultDebugApi };
    if (!runtime.__browserVault) throw new Error('Browser vault debug API unavailable');
    return runtime.__browserVault.clear();
  });
}

async function setQuotaEstimate(page: Page, usage: number, quota: number): Promise<void> {
  await page.evaluate((payload) => {
    const runtime = window as typeof window & { __browserVault?: BrowserVaultDebugApi };
    if (!runtime.__browserVault) throw new Error('Browser vault debug API unavailable');
    runtime.__browserVault.setMockEstimate(payload);
  }, { usage, quota });
}

export async function runBrowserVaultSuite(): Promise<void> {
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

  console.log('▶ Running browser vault scenarios in Puppeteer');
  const { origin } = await startTestServer();
  let browser: Browser | undefined;
  let page: Page | undefined;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.goto(`${origin}/?empty`);
    await waitForEditor(page);

    console.log('  • saves scratch note into browser vault via header control');
    await focusEditor(page);
    await pasteAsPlainText(page, '# Scratch Save\n\nSaved through header action.');
    await page.waitForSelector('[data-test="header-save-file"]');
    const saveFileDisabled = await page.$eval(
      '[data-test="header-save-file"]',
      (element) => element.getAttribute('disabled'),
    );
    assert.equal(saveFileDisabled, null, 'Save to file button should be enabled in scratch mode');
    await page.click('[data-test="header-save-browser"]');
    await page.waitForFunction(() => {
      const runtime = window as typeof window & { __browserVault?: BrowserVaultDebugApi };
      const snapshot = runtime.__browserVault?.status();
      return snapshot?.mode === 'browser';
    });
    let snapshot = await status(page);
    assert.equal(snapshot.mode, 'browser');
    const savedPathViaButton = snapshot.selection ?? snapshot.notes[0]?.path;
    assert.ok(savedPathViaButton, 'Expected browser vault selection after saving via header');
    const savedViaButton = await readContent(page, savedPathViaButton);
    assert.ok(savedViaButton.includes('Saved through header action.'), 'Expected scratch note content to persist');

    console.log('  • saves browser vault note copy to file');
    await page.evaluate(() => {
      const runtime = window as typeof window & {
        __exportedNote?: string;
      };
      const writable = {
        chunks: [] as string[],
        async write(payload: unknown) {
          if (typeof payload === 'string') {
            this.chunks.push(payload);
          } else if (payload instanceof Uint8Array) {
            this.chunks.push(new TextDecoder().decode(payload));
          }
        },
        async close() {
          runtime.__exportedNote = this.chunks.join('');
        },
      };
      (window as typeof window & { showSaveFilePicker?: () => Promise<unknown> }).showSaveFilePicker = async () => ({
        name: 'exported.md',
        async createWritable() {
          return writable;
        },
      });
    });
    await page.click('[data-test="header-export-note"]');
    await page.waitForFunction(() => {
      const runtime = window as typeof window & { __exportedNote?: string };
      return typeof runtime.__exportedNote === 'string';
    });
    const exportedContent = await page.evaluate(() => {
      const runtime = window as typeof window & { __exportedNote?: string };
      const value = runtime.__exportedNote ?? '';
      delete runtime.__exportedNote;
      delete (window as typeof window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
      return value;
    });
    assert.ok(exportedContent.includes('Saved through header action.'), 'Expected exported note to contain content');

    console.log('  • collapses and expands the vault sidebar');
    const collapseAlignment = await page.evaluate(() => {
      const collapseButton = document.querySelector('[data-test="sidebar-collapse"]');
      const sidebarHeader = document.querySelector('.sidebar-header');
      if (!(collapseButton instanceof HTMLElement) || !(sidebarHeader instanceof HTMLElement)) {
        throw new Error('Sidebar collapse alignment targets missing');
      }
      const collapseRect = collapseButton.getBoundingClientRect();
      const headerRect = sidebarHeader.getBoundingClientRect();
      return {
        collapseTop: collapseRect.top,
        headerTop: headerRect.top,
        headerBottom: headerRect.bottom,
      };
    });
    assert.ok(
      Math.abs(collapseAlignment.collapseTop - collapseAlignment.headerTop) <= 24,
      `Collapse button vertical misalignment: expected within 24px of header top, got ${collapseAlignment.collapseTop - collapseAlignment.headerTop}px`,
    );
    await page.click('[data-test="sidebar-collapse"]');
    await page.waitForFunction(() => document.documentElement.dataset.sidebarCollapsed === 'true');
    await page.waitForSelector('[data-test="sidebar-expand"]');
    await page.mouse.move(10, 220);
    const expandAlignment = await page.evaluate(() => {
      const expandButton = document.querySelector('[data-test="sidebar-expand"]');
      const editorHeader = document.querySelector('.editor-pane .pane-header');
      if (!(expandButton instanceof HTMLElement) || !(editorHeader instanceof HTMLElement)) {
        throw new Error('Sidebar expand alignment targets missing');
      }
      const expandRect = expandButton.getBoundingClientRect();
      const editorRect = editorHeader.getBoundingClientRect();
      return {
        expandTop: expandRect.top,
        editorTop: editorRect.top,
      };
    });
    assert.ok(
      Math.abs(expandAlignment.expandTop - collapseAlignment.collapseTop) <= 24,
      `Expand button vertical misalignment: expected within 24px of collapse toggle, got ${expandAlignment.expandTop - collapseAlignment.collapseTop}px`,
    );
    await page.evaluate(() => {
      const runtime = window as typeof window & { __setSidebarCollapsed?: (value: boolean) => void };
      runtime.__setSidebarCollapsed?.(false);
    });
    await page.waitForSelector('.sidebar', { state: 'attached' });

    await clearVault(page);
    await page.goto(`${origin}/?empty`);
    await waitForEditor(page);

    console.log('  • converts scratch session into browser vault on new note');
    await focusEditor(page);
    await pasteAsPlainText(page, '# Scratch\n\nThis note should persist.');
    await page.click('[data-test="header-new-note"]');
    await page.waitForFunction(() => {
      const runtime = window as typeof window & { __browserVault?: BrowserVaultDebugApi };
      const snapshot = runtime.__browserVault?.status();
      return Boolean(snapshot && snapshot.notes.length > 0);
    });

    snapshot = await status(page);
    assert.equal(snapshot.mode, 'browser');
    assert.ok(snapshot.notes.length >= 1, 'Expected at least one note after conversion');

    console.log('  • restores browser vault after reload');
    await page.goto(`${origin}/`, { waitUntil: 'networkidle0' });
    await waitForEditor(page);
    snapshot = await status(page);
    assert.equal(snapshot.mode, 'browser');
    const scratchPath = await (async () => {
      for (const note of snapshot.notes) {
        if (!note?.path) continue;
        const noteContent = await readContent(page, note.path);
        if (noteContent.includes('This note should persist.')) {
          return note.path;
        }
      }
      return undefined;
    })();
    assert.ok(scratchPath, 'Expected browser vault to retain the converted scratch note');

    console.log('  • respects ?empty query parameter');
    await page.goto(`${origin}/?empty`);
    await waitForEditor(page);
    snapshot = await status(page);
    assert.equal(snapshot.mode, 'scratch');

    console.log('  • export and import cycle preserves notes');
    await focusEditor(page);
    await pasteAsPlainText(page, '# Export Source\n\nContent before export.');
    await page.click('[data-test="header-new-note"]');
    await page.waitForFunction(() => {
      const runtime = window as typeof window & { __browserVault?: BrowserVaultDebugApi };
      const snapshot = runtime.__browserVault?.status();
      return Boolean(snapshot && snapshot.notes.length >= 2);
    });
    await resetEditor(page);
    await pasteAsPlainText(page, '# Secondary\n\nAnother note.');

    snapshot = await status(page);
    assert.ok(snapshot.notes.length >= 2);
    const exported = await exportZip(page);
    const exportedBuffer = exported instanceof Uint8Array ? exported : Uint8Array.from(exported as number[]);
    const zip = await JSZip.loadAsync(exportedBuffer);
    const archivedPaths = Object.keys(zip.files);
    assert.ok(archivedPaths.length >= 2, 'Expected multiple files in exported zip');

    await clearVault(page);
    snapshot = await status(page);
    assert.equal(snapshot.mode, 'scratch');

    await importZip(page, exportedBuffer);
    snapshot = await status(page);
    assert.equal(snapshot.mode, 'browser');
    assert.ok(snapshot.notes.length >= 2);
    const restoredEntry = await (async () => {
      for (const note of snapshot.notes) {
        if (!note?.path) continue;
        const candidate = await readContent(page, note.path);
        if (candidate.includes('# Export Source')) {
          return { path: note.path, content: candidate };
        }
      }
      return undefined;
    })();
    assert.ok(restoredEntry, 'Expected to find exported note in restored vault');
    assert.ok(restoredEntry?.content.includes('# Export Source'));

    console.log('  • quota warning banner can be dismissed');
    await setQuotaEstimate(page, 800, 1000);
    await page.waitForSelector('[data-test="storage-quota-warning"]');
    await page.click('[data-test="storage-quota-warning-dismiss"]');
    const warningVisible = await page.$('[data-test="storage-quota-warning"]');
    assert.equal(warningVisible, null);

    console.log('  • delete browser vault from help panel');
    await page.click('[data-test="header-help-toggle"]');
    await page.waitForSelector('[data-test="browser-vault-delete"]');
    const deleteDialog = new Promise<void>((resolve) => {
      page?.once('dialog', (dialog) => {
        dialog.accept();
        resolve();
      });
    });
    await page.click('[data-test="browser-vault-delete"]');
    await deleteDialog;
    await page.waitForSelector('[data-test="help-close"]');
    await page.click('[data-test="help-close"]');
    snapshot = await status(page);
    assert.equal(snapshot.mode, 'scratch');

    console.log('  • reset configurations via help panel');
    await focusEditor(page);
    await pasteAsPlainText(page, '# Reset Configs\n\nBrowser vault settings should persist.');
    await page.click('[data-test="header-new-note"]');
    await page.click('[data-test="theme-toggle"]');
    await page.click('[data-test="header-help-toggle"]');
    await page.waitForSelector('[data-test="browser-config-reset"]');
    const resetDialog = new Promise<void>((resolve) => {
      page?.once('dialog', (dialog) => {
        dialog.accept();
        resolve();
      });
    });
    await page.click('[data-test="browser-config-reset"]');
    await resetDialog;
    await page.click('[data-test="help-close"]');
    snapshot = await status(page);
    assert.equal(snapshot.settings.theme, 'dark');
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
    await stopTestServer();
  }
}
