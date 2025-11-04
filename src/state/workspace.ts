import { createSignal } from 'solid-js';

type WorkspaceMode = 'scratch' | 'single' | 'vault' | 'browser';

type SingleFileState = {
  handle: FileSystemFileHandle;
  path: string;
};

const [mode, setMode] = createSignal<WorkspaceMode>('scratch');
const [singleFile, setSingleFileState] = createSignal<SingleFileState | undefined>(undefined);

export const workspaceStore = {
  mode,
  setMode(value: WorkspaceMode) {
    setMode(value);
    if (value !== 'single') {
      setSingleFileState(undefined);
    }
  },
  singleFile,
  setSingleFile(value: SingleFileState | undefined) {
    setSingleFileState(value);
  },
  reset() {
    setMode('scratch');
    setSingleFileState(undefined);
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
