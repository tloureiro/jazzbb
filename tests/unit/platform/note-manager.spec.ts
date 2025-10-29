import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNote, deleteNote, renameNote } from '../../../src/platform/note-manager';
import { vaultStore } from '../../../src/state/vault';
import { editorStore } from '../../../src/state/editor';

vi.mock('../../../src/platform/parser-service', () => ({
  parseNote: vi.fn(),
}));

vi.mock('../../../src/platform/search-service', () => ({
  upsertDocument: vi.fn(),
  removeDocument: vi.fn(),
}));

vi.mock('../../../src/platform/note-reader', () => ({
  openNote: vi.fn(),
}));

import { parseNote } from '../../../src/platform/parser-service';
import { upsertDocument, removeDocument } from '../../../src/platform/search-service';
import { openNote } from '../../../src/platform/note-reader';

class FakeFileHandle implements FileSystemFileHandle {
  kind: FileSystemHandleKind = 'file';
  name: string;
  private _content = '';

  constructor(name: string) {
    this.name = name;
  }

  async getFile(): Promise<File> {
    return new File([this._content], this.name, { type: 'text/markdown' });
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    return {
      write: async (data: string) => {
        this._content = data;
      },
      close: async () => {},
      abort: async () => {},
      seek: async () => {},
      truncate: async () => {},
    } as unknown as FileSystemWritableFileStream;
  }

  isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return Promise.resolve(other instanceof FakeFileHandle && other.name === this.name);
  }

  queryPermission(): Promise<PermissionState> {
    return Promise.resolve('granted');
  }

  requestPermission(): Promise<PermissionState> {
    return Promise.resolve('granted');
  }
}

class FakeDirectoryHandle implements FileSystemDirectoryHandle {
  kind: FileSystemHandleKind = 'directory';
  name = 'root';
  private files = new Map<string, FakeFileHandle>();

  async getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle> {
    const existing = this.files.get(name);
    if (existing && !options?.create) {
      return existing;
    }
    if (!existing && !options?.create) {
      throw new DOMException('Not found', 'NotFoundError');
    }
    if (!existing) {
      const handle = new FakeFileHandle(name);
      this.files.set(name, handle);
      return handle;
    }
    return existing;
  }

  async getDirectoryHandle(): Promise<FileSystemDirectoryHandle> {
    throw new Error('Not implemented');
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name)) {
      throw new DOMException('Not found', 'NotFoundError');
    }
  }

  async resolve(): Promise<string[] | null> {
    return null;
  }

  async *keys() {
    yield* this.files.keys();
  }

  async *values() {
    yield* this.files.values();
  }

  async *entries() {
    yield* this.files.entries();
  }

  isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return Promise.resolve(other instanceof FakeDirectoryHandle);
  }

  queryPermission(): Promise<PermissionState> {
    return Promise.resolve('granted');
  }

  requestPermission(): Promise<PermissionState> {
    return Promise.resolve('granted');
  }
}

const fakeDir = new FakeDirectoryHandle();

beforeEach(() => {
  vaultStore.reset();
  editorStore.reset();
  vi.mocked(parseNote).mockReset();
  vi.mocked(upsertDocument).mockReset();
  vi.mocked(removeDocument).mockReset();
  vi.mocked(openNote).mockReset();
  vaultStore.setHandle({ directoryHandle: fakeDir });
});

describe('note-manager', () => {
  it('creates a new note and updates state', async () => {
    vi.mocked(parseNote).mockResolvedValue({ html: '<p>Note</p>', title: 'Note', links: [], headings: [], lastModified: 10 });

    const result = await createNote('Hello');

    expect(result.status).toBe('created');
    expect(vaultStore.state.notes).toHaveLength(1);
    expect(editorStore.draft()).toBe('Hello');
    expect(upsertDocument).toHaveBeenCalledWith({ path: 'untitled.md', title: 'Note', text: 'Hello' });
  });

  it('deletes a note and selects the next one', async () => {
    vi.mocked(parseNote).mockResolvedValue({ html: '<p>A</p>', title: 'A', links: [], headings: [], lastModified: 1 });
    await createNote('A');
    vi.mocked(parseNote).mockResolvedValue({ html: '<p>B</p>', title: 'B', links: [], headings: [], lastModified: 2 });
    await createNote('B');

    const firstPath = vaultStore.state.notes[0].path;
    const secondPath = vaultStore.state.notes[1].path;

    const result = await deleteNote(firstPath);

    expect(result.status).toBe('deleted');
    expect(openNote).toHaveBeenCalledWith(secondPath);
    expect(vaultStore.state.notes.map((n) => n.path)).not.toContain(firstPath);
    expect(removeDocument).toHaveBeenCalledWith(firstPath);
  });

  it('renames a note and updates caches', async () => {
    vi.mocked(parseNote).mockResolvedValueOnce({ html: '<p>Original</p>', title: 'Original', links: [], headings: [], lastModified: 1 });
    await createNote('Content');
    const existing = vaultStore.state.notes[0].path;

    vi.mocked(parseNote).mockResolvedValueOnce({ html: '<p>Renamed</p>', title: 'Renamed', links: [], headings: [], lastModified: 2 });

    const result = await renameNote(existing, 'renamed.md');

    expect(result.status).toBe('renamed');
    expect(vaultStore.state.notes.some((n) => n.path === 'renamed.md')).toBe(true);
    expect(editorStore.activePath()).toBe('renamed.md');
    expect(removeDocument).toHaveBeenCalledWith(existing);
    expect(upsertDocument).toHaveBeenCalledWith({ path: 'renamed.md', title: 'Renamed', text: 'Content' });
  });
});
