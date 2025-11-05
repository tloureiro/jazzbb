import { editorStore } from '../state/editor';
import { workspaceStore } from '../state/workspace';
import { vaultStore } from '../state/vault';
import { closeSingleFile } from '../platform/open-file';
import { setBrowserVaultSelection } from '../platform/browser-vault';

export type CloseDocumentResult =
  | { status: 'noop' }
  | { status: 'closed'; context: 'single' | 'browser' | 'vault' | 'scratch' };

export async function closeActiveDocument(): Promise<CloseDocumentResult> {
  const mode = workspaceStore.mode();

  if (mode === 'single') {
    closeSingleFile();
    return { status: 'closed', context: 'single' };
  }

  if (mode === 'browser') {
    if (!editorStore.activePath()) {
      return { status: 'noop' };
    }
    vaultStore.select(undefined);
    editorStore.reset();
    await setBrowserVaultSelection(undefined);
    return { status: 'closed', context: 'browser' };
  }

  if (mode === 'vault') {
    if (!editorStore.activePath()) {
      return { status: 'noop' };
    }
    vaultStore.select(undefined);
    editorStore.reset();
    return { status: 'closed', context: 'vault' };
  }

  if (mode === 'scratch') {
    if (!editorStore.activePath()) {
      return { status: 'noop' };
    }
    editorStore.reset();
    return { status: 'closed', context: 'scratch' };
  }

  return { status: 'noop' };
}

