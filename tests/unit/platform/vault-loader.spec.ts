import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vaultStore } from '../../../src/state/vault';
import { editorStore } from '../../../src/state/editor';

vi.mock('../../../src/platform/note-reader', () => ({
  openNote: vi.fn(),
}));

vi.mock('../../../src/platform/fs', () => ({
  enumerateMarkdownFiles: vi.fn(),
}));

vi.mock('../../../src/platform/parser-service', () => ({
  parseNote: vi.fn(),
}));

vi.mock('../../../src/platform/search-service', () => ({
  upsertDocument: vi.fn(),
}));

import { loadVaultContents, deriveTitle } from '../../../src/platform/vault-loader';
import { enumerateMarkdownFiles } from '../../../src/platform/fs';
import { openNote } from '../../../src/platform/note-reader';
import { parseNote } from '../../../src/platform/parser-service';
import { upsertDocument } from '../../../src/platform/search-service';

const vaultHandle = { directoryHandle: {} as FileSystemDirectoryHandle };

function createFileHandle(content: string, lastModified: number) {
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
  vi.mocked(enumerateMarkdownFiles).mockReset();
  vi.mocked(openNote).mockReset();
  vi.mocked(parseNote).mockReset();
  vi.mocked(upsertDocument).mockReset();
});

describe('deriveTitle', () => {
  it('prefers first markdown heading', () => {
    expect(deriveTitle('# Hello\nMore text', 'foo.md')).toBe('Hello');
  });

  it('falls back to filename when no heading', () => {
    expect(deriveTitle('No heading', 'my-note.md')).toBe('my note');
  });
});

describe('loadVaultContents', () => {
  it('populates vault, caches parsed html, and indexes files', async () => {
    vi.mocked(enumerateMarkdownFiles).mockResolvedValue([
      {
        path: 'alpha.md',
        fileHandle: createFileHandle('# Alpha', 111),
      },
      {
        path: 'beta.md',
        fileHandle: createFileHandle('## Heading\n', 222),
      },
    ]);

    vi.mocked(parseNote)
      .mockResolvedValueOnce({ html: '<h1>Alpha</h1>', title: 'Alpha', links: [], headings: [], lastModified: 111 })
      .mockResolvedValueOnce({ html: '<h2>Beta</h2>', title: 'Beta', links: ['alpha'], headings: [], lastModified: 222 });

    await loadVaultContents(vaultHandle);

    expect(vaultStore.state.notes).toHaveLength(2);
    expect(vaultStore.state.notes[0]).toMatchObject({
      path: 'alpha.md',
      title: 'Alpha',
      lastModified: 111,
    });
    expect(Object.keys(vaultStore.state.handles)).toEqual(['alpha.md', 'beta.md']);
    expect(editorStore.html()).toBe('<h1>Alpha</h1>');
    expect(upsertDocument).toHaveBeenCalledTimes(2);
    expect(openNote).not.toHaveBeenCalled();
  });

  it('handles empty vaults gracefully', async () => {
    vi.mocked(enumerateMarkdownFiles).mockResolvedValue([]);

    await loadVaultContents(vaultHandle);

    expect(vaultStore.state.notes).toEqual([]);
    expect(vaultStore.state.selectedPath).toBeUndefined();
    expect(openNote).not.toHaveBeenCalled();
    expect(editorStore.html()).toBe('');
  });

  it('records errors when enumeration fails', async () => {
    vi.mocked(enumerateMarkdownFiles).mockRejectedValue(new Error('fail'));

    await loadVaultContents(vaultHandle);

    expect(vaultStore.error()).toBe('Unable to read vault contents.');
  });
});
