import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EditorPane from '../../../src/components/EditorPane';
import { editorStore } from '../../../src/state/editor';
import { vaultStore } from '../../../src/state/vault';
import { workspaceStore } from '../../../src/state/workspace';
import { normalizeSerializedMarkdown } from '../../../src/lib/markdown';
import { deleteCurrentLine } from '../../../src/lib/editorShortcuts';

vi.mock('../../../src/platform/parser-service', () => ({
  parseNote: vi.fn().mockImplementation(async (markdown: string, options: { path?: string; lastModified?: number }) => ({
    html: `<p>${markdown}</p>`,
    title: options.path ?? 'note.md',
    links: [],
    headings: [],
    lastModified: options.lastModified ?? Date.now(),
  })),
}));

vi.mock('../../../src/platform/save-note', () => ({
  saveActiveNote: vi.fn().mockResolvedValue({ status: 'saved' }),
}));

import { saveActiveNote } from '../../../src/platform/save-note';

const FIXTURE_DIR = join(process.cwd(), 'tests/fixtures/dirty-on-open');
const FIXTURE_FILES = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith('.md') && !name.startsWith('11-'))
  .sort();
const NORMALIZATION_FIXTURE = '11-readme-normalization.md';
const AUTOSAVE_WAIT_MS = 2300;

function loadFixture(name: string): string {
  const raw = readFileSync(join(FIXTURE_DIR, name), 'utf8');
  return raw.replace(/\r\n?/g, '\n');
}

function setupVaultDocument(content: string, lastModified = Date.now()): void {
  workspaceStore.setMode('vault');
  vaultStore.select('note.md');
  editorStore.setDocument('note.md', content, '<p>preview</p>', [], [], lastModified);
}

describe('dirty-on-open autosave regression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    editorStore.reset();
    vaultStore.reset();
    workspaceStore.reset();
    vi.mocked(saveActiveNote).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(FIXTURE_FILES)('does not autosave on open before user interaction (%s)', async (fixtureName) => {
    setupVaultDocument(loadFixture(fixtureName));

    render(() => <EditorPane />);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS);

    expect(saveActiveNote).not.toHaveBeenCalled();
  });

  it('allows normalization but blocks save until a user edit happens', async () => {
    const fixture = loadFixture(NORMALIZATION_FIXTURE);
    expect(normalizeSerializedMarkdown(fixture)).not.toBe(fixture);

    setupVaultDocument(fixture);
    render(() => <EditorPane />);
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS);
    expect(saveActiveNote).not.toHaveBeenCalled();

    const editor = (window as typeof window & { __tiptapEditor?: { view: { dom: HTMLElement }; commands: { insertContent: (value: string) => boolean } } }).__tiptapEditor;
    expect(editor).toBeDefined();
    if (!editor) {
      throw new Error('Editor is not available');
    }

    editor.view.dom.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true }));
    editor.commands.insertContent(' user edit');

    await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS);
    expect(saveActiveNote).toHaveBeenCalledTimes(1);
  });

  it('autosaves after real user typing intent', async () => {
    setupVaultDocument('# Title\n\nBody');
    render(() => <EditorPane />);
    await Promise.resolve();

    const editor = (window as typeof window & { __tiptapEditor?: { view: { dom: HTMLElement }; commands: { insertContent: (value: string) => boolean } } }).__tiptapEditor;
    expect(editor).toBeDefined();
    if (!editor) {
      throw new Error('Editor is not available');
    }

    editor.view.dom.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true }));
    editor.commands.insertContent('!');

    await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS);
    expect(saveActiveNote).toHaveBeenCalledTimes(1);
  });

  it('does not autosave for a programmatic remote document replacement', async () => {
    setupVaultDocument('# Original\n\nBody', 1000);
    render(() => <EditorPane />);
    await Promise.resolve();

    vi.mocked(saveActiveNote).mockClear();

    const remotePayload = loadFixture(NORMALIZATION_FIXTURE);
    setupVaultDocument(remotePayload, 2000);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS);
    expect(saveActiveNote).not.toHaveBeenCalled();
  });

  it('still autosaves command-driven mutations', async () => {
    setupVaultDocument('Line one\nLine two');
    render(() => <EditorPane />);
    await Promise.resolve();

    const editor = (window as typeof window & { __tiptapEditor?: Parameters<typeof deleteCurrentLine>[0] }).__tiptapEditor;
    expect(editor).toBeDefined();
    if (!editor) {
      throw new Error('Editor is not available');
    }

    editorStore.signalUserEditIntent('test-delete-line-command');
    deleteCurrentLine(editor);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS);
    expect(saveActiveNote).toHaveBeenCalledTimes(1);
  });
});
