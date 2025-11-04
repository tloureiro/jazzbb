import { workspaceStore } from '../state/workspace';
import { vaultStore } from '../state/vault';
import { clearBrowserVaultEstimateOverride, setBrowserVaultEstimateOverride } from '../platform/browser-vault-storage';
import {
  exportBrowserVault,
  importBrowserVault,
  deleteBrowserVault,
  resetBrowserVaultConfig,
  restoreBrowserVaultSession,
} from '../platform/browser-vault-session';
import { getBrowserVaultSnapshot } from '../platform/browser-vault';
import { theme, typographyPreset, editorFontScale, editorMeasureScale } from '../state/ui';

type DebugStatus = {
  mode: string;
  selection?: string;
  notes: { path: string; title: string; lastModified: number }[];
  settings: { theme: string; typographyPreset: string; fontScale: number; measureScale: number };
};

type EstimatePayload = { usage: number; quota: number };

type BrowserVaultDebugApi = {
  status(): DebugStatus;
  read(path: string): Promise<string>;
  export(): Promise<number[]>;
  import(data: Uint8Array | number[]): Promise<void>;
  clear(): Promise<void>;
  resetConfigs(): Promise<void>;
  setMockEstimate(payload: EstimatePayload): void;
  clearMockEstimate(): void;
};

declare global {
  interface Window {
    __browserVault?: BrowserVaultDebugApi;
  }
}

function ensureDebugApi(): void {
  const runtime = window as typeof window & { __browserVault?: BrowserVaultDebugApi };
  if (runtime.__browserVault) return;

  runtime.__browserVault = {
    status(): DebugStatus {
      return {
        mode: workspaceStore.mode(),
        selection: vaultStore.state.selectedPath,
        notes: vaultStore.state.notes.map((note) => ({
          path: note.path,
          title: note.title,
          lastModified: note.lastModified,
        })),
        settings: {
          theme: theme(),
          typographyPreset: typographyPreset(),
          fontScale: editorFontScale(),
          measureScale: editorMeasureScale(),
        },
      };
    },
    async read(path: string): Promise<string> {
      const snapshot = await getBrowserVaultSnapshot();
      return snapshot.content[path]?.content ?? '';
    },
    async export(): Promise<number[]> {
      const data = await exportBrowserVault();
      return Array.from(data);
    },
    async import(data: Uint8Array | number[]): Promise<void> {
      const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
      await importBrowserVault(buffer);
      await restoreBrowserVaultSession();
    },
    async clear(): Promise<void> {
      await deleteBrowserVault();
      await restoreBrowserVaultSession({ skip: true });
    },
    async resetConfigs(): Promise<void> {
      await resetBrowserVaultConfig();
    },
    setMockEstimate(payload: EstimatePayload): void {
      setBrowserVaultEstimateOverride(payload);
    },
    clearMockEstimate(): void {
      clearBrowserVaultEstimateOverride();
    },
  };
}

if (typeof window !== 'undefined') {
  ensureDebugApi();
}
