import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vaultStore } from '../../../src/state/vault';
import { editorStore } from '../../../src/state/editor';

vi.mock('../../../src/platform/parser-service', () => ({
  parseNote: vi.fn(),
}));

vi.mock('../../../src/platform/search-service', () => ({
  upsertDocument: vi.fn(),
}));

import { parseNote } from '../../../src/platform/parser-service';
import { upsertDocument } from '../../../src/platform/search-service';
import { openNote } from '../../../src/platform/note-reader';

function createHandle(content: string, lastModified: number) {
  return {
    async getFile() {
      return {
        async text() {
          return content;
        },
        lastModified,
      } as File;
    },
  } as unknown as FileSystemFileHandle;
}

beforeEach(() => {
  vaultStore.reset();
  editorStore.reset();
  vi.mocked(parseNote).mockReset();
  vi.mocked(upsertDocument).mockReset();
});

describe('openNote', () => {
  it('loads the note content and updates stores', async () => {
    const handle = createHandle('Hello world', 99);
    vaultStore.setHandles({ 'test.md': handle });
    vi.mocked(parseNote).mockResolvedValue({
      html: '<p>Hello world</p>',
      title: 'Hello world',
      links: [],
      headings: [],
      lastModified: 99,
    });

    await openNote('test.md');

    expect(vaultStore.state.selectedPath).toBe('test.md');
    expect(editorStore.activePath()).toBe('test.md');
    expect(editorStore.content()).toBe('Hello world');
    expect(editorStore.draft()).toBe('Hello world');
    expect(editorStore.html()).toBe('<p>Hello world</p>');
    expect(editorStore.lastLoaded()).toBe(99);
    expect(upsertDocument).toHaveBeenCalledWith({ path: 'test.md', title: 'Hello world', text: 'Hello world' });
  });

  it('raises error when handle missing', async () => {
    await openNote('missing.md');

    expect(vaultStore.error()).toBe('Failed to open note: missing.md');
  });
});
