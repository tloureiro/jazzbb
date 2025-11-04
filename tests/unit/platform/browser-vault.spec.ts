import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { indexedDB as fakeIndexedDB, IDBKeyRange as fakeIDBKeyRange } from 'fake-indexeddb';
import JSZip from 'jszip';
import {
  clearBrowserVault,
  exportBrowserVaultZip,
  getBrowserVaultSnapshot,
  importBrowserVaultZip,
  putBrowserNote,
  removeBrowserNote,
  setBrowserVaultSelection,
} from '../../../src/platform/browser-vault';
import { normalizeBrowserNoteName } from '../../../src/platform/browser-vault-session';

declare global {
  // eslint-disable-next-line no-var
  var indexedDB: IDBFactory;
}

const NOTE_ALPHA = {
  path: 'alpha.md',
  title: 'Alpha',
  content: '# Alpha\n\nFirst document.',
  lastModified: 1_700_000_000_000,
};

const NOTE_BETA = {
  path: 'docs/beta.md',
  title: 'Beta',
  content: '# Beta\n\nSecond document.',
  lastModified: 1_700_000_000_500,
};

describe('browser vault name normalisation', () => {
  it('preserves spaces and casing when normalising note names', () => {
    expect(normalizeBrowserNoteName('My Draft Note')).toBe('My Draft Note');
  });

  it('removes markdown extensions but leaves internal spacing intact', () => {
    expect(normalizeBrowserNoteName('Meeting Notes.md')).toBe('Meeting Notes');
  });

  it('falls back to Untitled when the name is empty', () => {
    expect(normalizeBrowserNoteName('   ')).toBe('Untitled');
  });
});

describe('browser vault storage', () => {
  beforeEach(async () => {
    globalThis.indexedDB = fakeIndexedDB;
    globalThis.IDBKeyRange = fakeIDBKeyRange;
    await clearBrowserVault();
  });

  afterEach(async () => {
    await clearBrowserVault();
    delete (globalThis as typeof globalThis & { indexedDB?: IDBFactory; IDBKeyRange?: typeof fakeIDBKeyRange }).indexedDB;
    delete (globalThis as typeof globalThis & { indexedDB?: IDBFactory; IDBKeyRange?: typeof fakeIDBKeyRange }).IDBKeyRange;
  });

  it('stores and retrieves notes with metadata', async () => {
    await putBrowserNote(NOTE_ALPHA);
    await setBrowserVaultSelection(NOTE_ALPHA.path);

    const snapshot = await getBrowserVaultSnapshot();
    expect(snapshot.notes).toHaveLength(1);
    expect(snapshot.notes[0]).toMatchObject({
      path: NOTE_ALPHA.path,
      title: NOTE_ALPHA.title,
      lastModified: NOTE_ALPHA.lastModified,
    });
    expect(snapshot.selection).toBe(NOTE_ALPHA.path);
    expect(snapshot.content[NOTE_ALPHA.path].content).toBe(NOTE_ALPHA.content);
  });

  it('supports nested paths and note removal', async () => {
    await putBrowserNote(NOTE_ALPHA);
    await putBrowserNote(NOTE_BETA);

    let snapshot = await getBrowserVaultSnapshot();
    expect(snapshot.notes.map((note) => note.path).sort()).toEqual([NOTE_ALPHA.path, NOTE_BETA.path].sort());

    await removeBrowserNote(NOTE_ALPHA.path);
    snapshot = await getBrowserVaultSnapshot();
    expect(snapshot.notes.map((note) => note.path)).toEqual([NOTE_BETA.path]);
    expect(snapshot.content[NOTE_BETA.path].content).toBe(NOTE_BETA.content);
  });

  it('exports notes to a zip archive and imports them back', async () => {
    await putBrowserNote(NOTE_ALPHA);
    await putBrowserNote(NOTE_BETA);
    await setBrowserVaultSelection(NOTE_BETA.path);

    const exported = await exportBrowserVaultZip();
    const zip = await JSZip.loadAsync(exported);
    const paths = Object.keys(zip.files).sort();
    expect(paths).toContain(NOTE_ALPHA.path);
    expect(paths).toContain(NOTE_BETA.path);
    expect(await zip.file(NOTE_ALPHA.path)?.async('string')).toBe(NOTE_ALPHA.content);

    await clearBrowserVault();
    await importBrowserVaultZip(exported);

    const snapshot = await getBrowserVaultSnapshot();
    expect(snapshot.notes).toHaveLength(2);
    expect(snapshot.selection).toBe(NOTE_BETA.path);
    expect(snapshot.content[NOTE_BETA.path].content).toBe(NOTE_BETA.content);
  });
});
