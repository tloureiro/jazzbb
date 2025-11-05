import { createSignal } from 'solid-js';
import { watchSingleFile } from '../platform/file-watcher';

export type WorkspaceMode = 'scratch' | 'single' | 'vault' | 'browser';

type SingleFileState = {
  handle: FileSystemFileHandle;
  path: string;
};

const [mode, setWorkspaceMode] = createSignal<WorkspaceMode>('scratch');
const [singleFile, setSingleFileState] = createSignal<SingleFileState | undefined>(undefined);

export const workspaceStore = {
  mode,
  setMode(value: WorkspaceMode) {
    setWorkspaceMode(value);
    if (value !== 'single') {
      setSingleFileState(undefined);
      watchSingleFile(undefined);
    }
  },
  singleFile,
  setSingleFile(value: SingleFileState | undefined) {
    setSingleFileState(value);
    watchSingleFile(value);
  },
  reset() {
    setWorkspaceMode('scratch');
    setSingleFileState(undefined);
    watchSingleFile(undefined);
  },
};

export function isVaultMode(): boolean {
  const mode = workspaceStore.mode();
  return mode === 'vault' || mode === 'browser';
}

export function isBrowserVaultMode(): boolean {
  return workspaceStore.mode() === 'browser';
}

export function isFileSystemVaultMode(): boolean {
  return workspaceStore.mode() === 'vault';
}

export function isSingleFileMode(): boolean {
  return workspaceStore.mode() === 'single';
}
