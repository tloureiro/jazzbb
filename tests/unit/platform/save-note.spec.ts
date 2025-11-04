import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveActiveNote } from '../../../src/platform/save-note';
import { vaultStore } from '../../../src/state/vault';
import { editorStore } from '../../../src/state/editor';
import { workspaceStore } from '../../../src/state/workspace';

vi.mock('../../../src/platform/parser-service', () => ({
  parseNote: vi.fn(),
}));

vi.mock('../../../src/platform/search-service', () => ({
  upsertDocument: vi.fn(),
}));

import { parseNote } from '../../../src/platform/parser-service';
import { upsertDocument } from '../../../src/platform/search-service';

type Writable = {
  write: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

function createFileHandle(spy: Writable) {
  return {
    async createWritable() {
      return {
        write: spy.write,
        close: spy.close,
      };
    },
  } as unknown as FileSystemFileHandle;
}

beforeEach(() => {
  vaultStore.reset();
  editorStore.reset();
  vi.mocked(parseNote).mockReset();
  vi.mocked(upsertDocument).mockReset();
  workspaceStore.setMode('vault');
});

describe('saveActiveNote', () => {
  it('writes draft content and refreshes caches', async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const handle = createFileHandle({ write, close });

    vaultStore.setHandles({ 'note.md': handle });
    editorStore.setDocument('note.md', 'Original', '<p>Original</p>', [], [], 1);
    editorStore.setDraft('Updated');

    vi.mocked(parseNote).mockResolvedValue({
      html: '<p>Updated</p>',
      title: 'Updated',
      links: ['link'],
      headings: [],
      lastModified: 10,
    });

    const result = await saveActiveNote();

    expect(result.status).toBe('saved');
    expect(write).toHaveBeenCalledWith('Updated');
    expect(close).toHaveBeenCalled();
    expect(vaultStore.state.cache['note.md'].content).toBe('Updated');
    expect(vaultStore.state.cache['note.md'].links).toEqual(['link']);
    expect(editorStore.content()).toBe('Updated');
    expect(editorStore.draft()).toBe('Updated');
    expect(editorStore.html()).toBe('<p>Updated</p>');
    expect(upsertDocument).toHaveBeenCalledWith({ path: 'note.md', title: 'Updated', text: 'Updated' });
  });

  it('returns no-active when no note focused', async () => {
    const result = await saveActiveNote();
    expect(result.status).toBe('no-active');
  });

  it('skips saving when draft matches persisted content', async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const handle = createFileHandle({ write, close });

    vaultStore.setHandles({ 'note.md': handle });
    editorStore.setDocument('note.md', 'Same', '<p>Same</p>', [], [], 1);
    editorStore.setDraft('Same');

    const result = await saveActiveNote();

    expect(result.status).toBe('not-changed');
    expect(write).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('sets error when handle missing', async () => {
    editorStore.setDocument('ghost.md', 'Content', '<p>c</p>', [], [], 1);

    const result = await saveActiveNote();

    expect(result.status).toBe('no-handle');
    expect(vaultStore.error()).toContain('Failed to save note');
  });

  it('records error on write failure', async () => {
    const handle = {
      async createWritable() {
        return {
          write: vi.fn(async () => {
            throw new Error('write');
          }),
          close: vi.fn(async () => {}),
        };
      },
    } as unknown as FileSystemFileHandle;

    vaultStore.setHandles({ 'bad.md': handle });
    editorStore.setDocument('bad.md', 'Content', '<p>c</p>', [], [], 1);
    editorStore.setDraft('Broken');
    vi.mocked(parseNote).mockResolvedValue({ html: '<p>Broken</p>', title: 'Broken', links: [], headings: [], lastModified: 2 });

    const result = await saveActiveNote();

    expect(result.status).toBe('error');
    expect(vaultStore.error()).toContain('Failed to save note: bad.md');
  });

  it('saves scratch note via save-as flow', async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});

    const handle = {
      name: 'scratch.md',
      async createWritable() {
        return { write, close };
      },
    } as unknown as FileSystemFileHandle;

    const picker = vi.fn().mockResolvedValue(handle);
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: picker,
    });

    workspaceStore.setMode('scratch');
    vaultStore.reset();
    editorStore.reset();
    editorStore.setDraft('Untitled');

    vi.mocked(parseNote).mockResolvedValue({ html: '<p>Scratch</p>', title: 'Scratch', links: [], headings: [], lastModified: 5 });

    const result = await saveActiveNote();

    expect(result.status).toBe('saved');
    expect(picker).toHaveBeenCalled();
    expect(editorStore.activePath()).toBe('scratch.md');
    expect(workspaceStore.singleFile()?.path).toBe('scratch.md');

    delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });

  it('saves a single file without touching vault state', async () => {
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const handle = createFileHandle({ write, close });

    workspaceStore.setMode('single');
    workspaceStore.setSingleFile({ handle, path: 'single.md' });

    editorStore.setDocument('single.md', 'Original', '<p>Original</p>', [], [], 1);
    editorStore.setDraft('Edited');

    vi.mocked(parseNote).mockResolvedValue({
      html: '<p>Edited</p>',
      title: 'Edited',
      links: [],
      headings: [],
      lastModified: 2,
    });

    const result = await saveActiveNote();

    expect(result.status).toBe('saved');
    expect(write).toHaveBeenCalledWith('Edited');
    expect(vaultStore.state.cache['single.md']).toBeUndefined();
    expect(editorStore.content()).toBe('Edited');
    expect(upsertDocument).not.toHaveBeenCalled();
  });
});
