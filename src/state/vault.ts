import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { VaultHandle } from '../platform/fs';
import type { HeadingInfo } from '../lib/markdown-engine';

export type NoteMeta = {
  path: string;
  title: string;
  lastModified: number;
};

type NoteCache = { html: string; links: string[]; headings: HeadingInfo[]; content: string; lastModified: number };

export type VaultState = {
  notes: NoteMeta[];
  handles: Record<string, FileSystemFileHandle | null>;
  cache: Record<string, NoteCache>;
  selectedPath?: string;
  handle?: VaultHandle;
  sortMode: 'name' | 'modified';
};

const initialVaultState: VaultState = {
  notes: [],
  handles: {},
  cache: {},
  selectedPath: undefined,
  handle: undefined,
  sortMode: 'name',
};

const [vault, setVault] = createStore<VaultState>({ ...initialVaultState });
const [isLoading, setIsLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

function sortNotes(notes: NoteMeta[], mode: 'name' | 'modified'): NoteMeta[] {
  if (mode === 'modified') {
    return notes.sort((a, b) => b.lastModified - a.lastModified || a.path.localeCompare(b.path));
  }
  return notes.sort((a, b) => a.path.localeCompare(b.path));
}

function reorderNotes(mode: 'name' | 'modified'): void {
  setVault('notes', (notes) => sortNotes([...notes], mode));
}

export const vaultStore = {
  state: vault,
  isLoading,
  error,
  sortMode() {
    return vault.sortMode;
  },
  setNotes(notes: NoteMeta[]) {
    setVault('notes', () => sortNotes([...notes], vault.sortMode));
  },
  setHandle(handle: VaultHandle | undefined) {
    setVault('handle', () => handle);
  },
  setSortMode(mode: 'name' | 'modified') {
    setVault('sortMode', () => mode);
    reorderNotes(mode);
  },
  setHandles(handles: Record<string, FileSystemFileHandle | null>) {
    setVault('handles', () => handles);
  },
  setCache(path: string, value: NoteCache) {
    setVault('cache', path, () => value);
  },
  updateNote(meta: NoteMeta) {
    const index = vault.notes.findIndex((note) => note.path === meta.path);
    if (index !== -1) {
      setVault('notes', () => sortNotes(
        vault.notes.map((note) => (note.path === meta.path ? meta : note)),
        vault.sortMode,
      ));
    }
  },
  addNote(meta: NoteMeta, handle: FileSystemFileHandle | null, cache: NoteCache) {
    setVault('notes', (notes) => sortNotes([...notes, meta], vault.sortMode));
    setVault('handles', (handles) => ({ ...handles, [meta.path]: handle }));
    setVault('cache', (cacheMap) => ({ ...cacheMap, [meta.path]: cache }));
    setVault('selectedPath', meta.path);
  },
  removeNote(path: string) {
    setVault('notes', (notes) => notes.filter((note) => note.path !== path));
    setVault('handles', (handles) => {
      const next = { ...handles };
      delete next[path];
      return next;
    });
    setVault('cache', (cacheMap) => {
      const next = { ...cacheMap };
      delete next[path];
      return next;
    });
    if (vault.selectedPath === path) {
      setVault('selectedPath', undefined);
    }
  },
  select(path: string | undefined) {
    setVault('selectedPath', path);
  },
  setLoading(loading: boolean) {
    setIsLoading(loading);
  },
  setError(message: string | null) {
    setError(message);
  },
  reset() {
    setVault('notes', () => []);
    setVault('handles', (current) => {
      Object.keys(current).forEach((key) => delete current[key]);
      return current;
    });
    setVault('cache', (current) => {
      Object.keys(current).forEach((key) => delete current[key]);
      return current;
    });
    setVault('selectedPath', () => undefined);
    setVault('handle', () => undefined);
    setVault('sortMode', () => 'name');
    setIsLoading(false);
    setError(null);
  }
};
