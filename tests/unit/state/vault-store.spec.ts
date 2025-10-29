import { describe, expect, beforeEach, it } from 'vitest';
import { vaultStore } from '../../../src/state/vault';

beforeEach(() => {
  vaultStore.reset();
});

describe('vaultStore', () => {
  it('updates notes and selection', () => {
    const notes = [
      { path: 'note-a.md', title: 'Note A', lastModified: 1 },
      { path: 'note-b.md', title: 'Note B', lastModified: 2 },
    ];

    vaultStore.setNotes(notes);
    vaultStore.select('note-b.md');

    expect(vaultStore.state.notes).toEqual(notes);
    expect(vaultStore.state.selectedPath).toBe('note-b.md');
  });

  it('stores handles and active vault handle', () => {
    const mockHandle = { directoryHandle: {} as FileSystemDirectoryHandle };
    const fileHandle = {} as FileSystemFileHandle;

    vaultStore.setHandle(mockHandle);
    vaultStore.setHandles({ 'note.md': fileHandle });

    expect(vaultStore.state.handle).toEqual(mockHandle);
    expect(vaultStore.state.handles).toHaveProperty('note.md');
  });

  it('tracks loading and error state', () => {
    vaultStore.setLoading(true);
    vaultStore.setError('Boom');

    expect(vaultStore.isLoading()).toBe(true);
    expect(vaultStore.error()).toBe('Boom');

    vaultStore.reset();

    expect(vaultStore.isLoading()).toBe(false);
    expect(vaultStore.error()).toBeNull();
    expect(vaultStore.state.notes).toEqual([]);
    expect(vaultStore.state.handles).toEqual({});
  });
});
