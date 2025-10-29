import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { VaultHandle } from '../platform/fs';
import type { HeadingInfo } from '../lib/markdown-engine';

export type NoteMeta = {
  path: string;
  title: string;
  lastModified: number;
};

export type VaultState = {
  notes: NoteMeta[];
  handles: Record<string, FileSystemFileHandle>;
  cache: Record<string, { html: string; links: string[]; headings: HeadingInfo[]; content: string; lastModified: number }>;
  selectedPath?: string;
  handle?: VaultHandle;
};

const initialVaultState: VaultState = {
  notes: [],
  handles: {},
  cache: {},
  selectedPath: undefined,
  handle: undefined,
};

const [vault, setVault] = createStore<VaultState>({ ...initialVaultState });
const [isLoading, setIsLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

export const vaultStore = {
  state: vault,
  isLoading,
  error,
  setNotes(notes: NoteMeta[]) {
    setVault('notes', () => notes);
  },
  setHandle(handle: VaultHandle | undefined) {
    setVault('handle', () => handle);
  },
  setHandles(handles: Record<string, FileSystemFileHandle>) {
    setVault('handles', () => handles);
  },
  setCache(path: string, value: { html: string; links: string[]; headings: HeadingInfo[]; content: string; lastModified: number }) {
    setVault('cache', path, () => value);
  },
  updateNote(meta: NoteMeta) {
    const index = vault.notes.findIndex((note) => note.path === meta.path);
    if (index !== -1) {
      setVault('notes', index, () => meta);
    }
  },
  addNote(
    meta: NoteMeta,
    handle: FileSystemFileHandle,
    cache: { html: string; links: string[]; headings: HeadingInfo[]; content: string; lastModified: number },
  ) {
    setVault('notes', (notes) => [...notes, meta].sort((a, b) => a.path.localeCompare(b.path)));
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
    setIsLoading(false);
    setError(null);
  }
};
