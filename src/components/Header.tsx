import { Component, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { supportsFileSystemAccess, requestVault } from '../platform/fs';
import { loadVaultContents } from '../platform/vault-loader';
import { saveActiveNote, exportActiveNoteToFile } from '../platform/save-note';
import { editorStore } from '../state/editor';
import { vaultStore } from '../state/vault';
import SearchPanel from './SearchPanel';
import { createNote } from '../platform/note-manager';
import {
  showToast,
  typographyPreset,
  setTypographyPreset,
  type TypographyPreset,
  isInspectorVisible,
  toggleInspectorVisibility,
  isOutlineVisible,
  toggleOutlineVisibility,
  theme,
  toggleTheme,
  editorFontScale,
  setEditorFontScale,
  editorMeasureScale,
  setEditorMeasureScale,
  DEFAULT_EDITOR_FONT_SCALE,
  DEFAULT_EDITOR_MEASURE_SCALE,
  isHeaderCollapsed,
  setHeaderCollapsed,
  toggleHeaderCollapsed,
  toggleSidebarCollapsed,
} from '../state/ui';
import { openSingleFile } from '../platform/open-file';
import { workspaceStore, isVaultMode, isBrowserVaultMode } from '../state/workspace';
import ShortcutHelpModal from './ShortcutHelpModal';
import {
  exportBrowserVault,
  importBrowserVault,
  deleteBrowserVault,
  resetBrowserVaultConfig,
  updateBrowserVaultSettings,
  saveScratchToBrowserVault,
} from '../platform/browser-vault-session';
import {
  subscribeBrowserVaultEstimate,
  refreshBrowserVaultEstimate,
  type StorageEstimate,
} from '../platform/browser-vault-storage';

const Header: Component = () => {
  const [showSearch, setShowSearch] = createSignal(false);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const outlineVisible = isOutlineVisible;
  const currentTheme = theme;
  const headerCollapsed = isHeaderCollapsed;
  const fileSystemSupported = supportsFileSystemAccess();
  const [showUnsupportedNotice, setShowUnsupportedNotice] = createSignal(!fileSystemSupported);
  const [storageEstimate, setStorageEstimate] = createSignal<StorageEstimate | null>(null);
  const [storageDismissed, setStorageDismissed] = createSignal(false);
  const isScratchMode = createMemo(() => workspaceStore.mode() === 'scratch');
  const isBrowserMode = createMemo(() => workspaceStore.mode() === 'browser');
  const canSave = createMemo(() => {
    const mode = workspaceStore.mode();
    if (mode === 'scratch') {
      return true;
    }
    if (!editorStore.activePath()) {
      return false;
    }
    if (mode === 'vault' && vaultStore.isLoading()) {
      return false;
    }
    return true;
  });
  const saveButtonLabel = createMemo(() => {
    if (isScratchMode()) return 'Save to file';
    if (isBrowserMode()) return 'Save to browser';
    return 'Save';
  });
  let importInputRef: HTMLInputElement | undefined;

  const persistBrowserSettings = () => {
    if (!isBrowserVaultMode()) return;
    updateBrowserVaultSettings({
      theme: currentTheme(),
      typographyPreset: typographyPreset(),
      fontScale: editorFontScale(),
      measureScale: editorMeasureScale(),
    }).catch((error) => {
      console.error('Failed to persist browser vault settings', error);
    });
  };

  const showQuotaWarning = createMemo(() => {
    const estimate = storageEstimate();
    if (!estimate || storageDismissed()) {
      return false;
    }
    if (estimate.quota <= 0) {
      return false;
    }
    return estimate.usage / estimate.quota >= 0.75;
  });

  const quotaUsagePercent = createMemo(() => {
    const estimate = storageEstimate();
    if (!estimate || estimate.quota <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((estimate.usage / estimate.quota) * 100));
  });

  const handleFontScaleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    const value = Number.parseFloat(target.value);
    if (!Number.isNaN(value)) {
      setEditorFontScale(value * DEFAULT_EDITOR_FONT_SCALE);
      persistBrowserSettings();
    }
  };

  const handleMeasureScaleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    const value = Number.parseFloat(target.value);
    if (!Number.isNaN(value)) {
      setEditorMeasureScale(value);
      persistBrowserSettings();
    }
  };

  const fontScaleFactor = () => editorFontScale() / DEFAULT_EDITOR_FONT_SCALE;
  const fontScalePercent = () => Math.round(fontScaleFactor() * 100);
  const measurePercent = () => Math.round((editorMeasureScale() / DEFAULT_EDITOR_MEASURE_SCALE) * 100);

  const handleOpenVault = async () => {
    if (!supportsFileSystemAccess()) {
      vaultStore.setError('File System Access API is not supported in this browser.');
      return;
    }

    vaultStore.setLoading(true);
    vaultStore.setError(null);

    try {
      const result = await requestVault();
      if (result.status === 'success') {
        await loadVaultContents(result.handle);
      } else if (result.status === 'unsupported') {
        vaultStore.setError('File System Access API is not supported in this browser.');
      }
    } finally {
      vaultStore.setLoading(false);
    }
  };

  const handlePresetChange = (event: Event) => {
    const target = event.currentTarget as HTMLSelectElement;
    setTypographyPreset(target.value as TypographyPreset);
    persistBrowserSettings();
  };

  const handleToggleTheme = () => {
    toggleTheme();
    persistBrowserSettings();
  };

  const handleOpenFile = async () => {
    const result = await openSingleFile();
    if (result.status === 'unsupported') {
      showToast('File picker not supported in this browser.', 'error');
    } else if (result.status === 'success') {
      showToast('Opened file', 'success');
    }
  };

  const handleExportVault = async () => {
    if (!isBrowserVaultMode()) {
      showToast('Export is available only in browser vault mode.', 'info');
      return;
    }
    try {
      const data = await exportBrowserVault();
      const arrayBuffer =
        data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
          ? (data.buffer as ArrayBuffer)
          : (data.slice().buffer as ArrayBuffer);
      const blob = new Blob([arrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'jazzbb-browser-vault.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Vault exported', 'success');
    } catch (error) {
      console.error('Failed to export browser vault', error);
      showToast('Failed to export vault', 'error');
    }
  };

  const handleImportVault = () => {
    if (!isBrowserVaultMode()) {
      showToast('Import is available only in browser vault mode.', 'info');
      return;
    }
    importInputRef?.click();
  };

  const handleImportFileSelection = async (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (target) {
      target.value = '';
    }
    if (!file) return;
    const confirmed = window.confirm('Importing a vault replaces the current browser vault. Continue?');
    if (!confirmed) return;

    try {
      const buffer = await file.arrayBuffer();
      await importBrowserVault(new Uint8Array(buffer));
      showToast('Vault imported', 'success');
    } catch (error) {
      console.error('Failed to import browser vault', error);
      showToast('Failed to import vault', 'error');
    }
  };

  const handleDeleteBrowserVault = async () => {
    if (!isBrowserVaultMode()) return;
    const confirmed = window.confirm('Delete the current browser vault? This cannot be undone.');
    if (!confirmed) return;
    try {
      await deleteBrowserVault();
      showToast('Browser vault deleted', 'success');
    } catch (error) {
      console.error('Failed to delete browser vault', error);
      showToast('Failed to delete browser vault', 'error');
    }
  };

  const handleResetBrowserConfig = async () => {
    if (!isBrowserVaultMode()) return;
    const confirmed = window.confirm('Reset browser vault settings to defaults?');
    if (!confirmed) return;
    try {
      await resetBrowserVaultConfig();
      persistBrowserSettings();
      showToast('Browser settings reset', 'success');
    } catch (error) {
      console.error('Failed to reset browser vault settings', error);
      showToast('Failed to reset settings', 'error');
    }
  };

  const dismissQuotaWarning = () => {
    setStorageDismissed(true);
  };

  const handleSave = async () => {
    const result = await saveActiveNote();
    if (result.status === 'saved') {
      showToast('Note saved', 'success');
    } else if (result.status === 'not-changed') {
      showToast('No changes to save', 'info');
    } else if (result.status === 'no-active') {
      showToast('Select a note to save', 'info');
    } else if (result.status === 'no-handle' || result.status === 'error') {
      showToast('Failed to save note', 'error');
    } else if (result.status === 'unsupported') {
      showToast('File picker not supported in this browser.', 'error');
    } else if (result.status === 'cancelled') {
      showToast('Save cancelled', 'info');
    }
  };

  const handleSaveToBrowserVault = async () => {
    if (workspaceStore.mode() !== 'scratch') {
      await handleSave();
      return;
    }
    const result = await saveScratchToBrowserVault();
    if (result.status === 'saved') {
      showToast('Saved to browser vault', 'success');
      persistBrowserSettings();
    } else {
      showToast('Failed to save note to browser vault', 'error');
    }
  };

  const handleExportNoteToFile = async () => {
    const result = await exportActiveNoteToFile();
    if (result.status === 'exported') {
      showToast('Saved note to file', 'success');
    } else if (result.status === 'no-active') {
      showToast('Select a note to export', 'info');
    } else if (result.status === 'unsupported') {
      showToast('File picker not supported in this browser.', 'error');
    } else if (result.status === 'cancelled') {
      showToast('Export cancelled', 'info');
    } else if (result.status === 'error') {
      showToast('Failed to save note to file', 'error');
    }
  };

  const toggleSearch = () => {
    setShowSearch((prev) => !prev);
  };

  const handleKeydown = async (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'h') {
      event.preventDefault();
      toggleHeaderCollapsed();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'b') {
      if (!isVaultMode()) return;
      event.preventDefault();
      toggleSidebarCollapsed();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      await handleSave();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') {
      if (!isVaultMode()) return;
      event.preventDefault();
      setShowSearch(true);
    } else if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      toggleOutlineVisibility();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
      if (!isVaultMode()) return;
      event.preventDefault();
      await createNote();
    } else if ((event.metaKey || event.ctrlKey) && (event.key === '/' || event.key === '?')) {
      event.preventDefault();
      setShowShortcuts((prev) => !prev);
    } else if (event.key === 'Escape') {
      setShowSearch(false);
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    const unsubscribe = subscribeBrowserVaultEstimate((estimate) => {
      if (!estimate) {
        setStorageEstimate(null);
        setStorageDismissed(false);
        return;
      }
      setStorageEstimate(estimate);
      if (estimate.quota > 0 && estimate.usage / estimate.quota < 0.75) {
        setStorageDismissed(false);
      }
    });
    void refreshBrowserVaultEstimate();
    onCleanup(() => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeydown);
    });
  });

  createEffect(() => {
    if (headerCollapsed()) {
      setShowSearch(false);
    }
  });

  const helpFooter = () => (
    <Show when={isBrowserVaultMode()}>
      <div class="help-actions">
        <p class="help-actions__title">Browser vault</p>
        <div class="help-actions__row">
          <button type="button" onClick={handleExportVault} data-test="browser-vault-export">
            Export (.zip)
          </button>
          <button type="button" onClick={handleImportVault} data-test="browser-vault-import">
            Import (.zip)
          </button>
        </div>
        <div class="help-actions__row">
          <button type="button" class="danger" onClick={handleDeleteBrowserVault} data-test="browser-vault-delete">
            Delete browser vault
          </button>
          <button type="button" class="danger" onClick={handleResetBrowserConfig} data-test="browser-config-reset">
            Reset settings
          </button>
        </div>
      </div>
    </Show>
  );

  return (
    <>
      <input
        type="file"
        accept=".zip"
        style={{ display: 'none' }}
        ref={(element) => {
          importInputRef = element ?? undefined;
        }}
        onChange={handleImportFileSelection}
      />
      <header
        class="app-header"
        style={{ display: headerCollapsed() ? 'none' : undefined }}
        aria-hidden={headerCollapsed() ? 'true' : 'false'}
      >
        <div class="header-row header-row-top">
          <div class="header-left">
            <h1>jazzbb</h1>
            <p class="tagline">markdown editor / hub</p>
          </div>
          <div class="header-actions">
          <button
            type="button"
            class="secondary"
            onClick={async () => createNote()}
            disabled={workspaceStore.mode() === 'single' || vaultStore.isLoading()}
            data-test="header-new-note"
          >
            New
          </button>
          <Show when={isScratchMode()}>
            <button type="button" class="secondary" onClick={handleSaveToBrowserVault} data-test="header-save-browser">
              Save to browser
            </button>
          </Show>
          <button
            type="button"
            class="secondary"
            onClick={handleSave}
            disabled={!canSave()}
            data-test="header-save-file"
          >
            {saveButtonLabel()}
          </button>
          <Show when={isBrowserMode()}>
            <button
              type="button"
              class="secondary"
              onClick={handleExportNoteToFile}
              disabled={!editorStore.activePath() || vaultStore.isLoading()}
              data-test="header-export-note"
            >
              Save to file
            </button>
          </Show>
          <button type="button" class="secondary" onClick={toggleSearch} disabled={!isVaultMode()}>
            Search
          </button>
          <button
            type="button"
            class="secondary"
            data-active={isInspectorVisible() ? 'true' : 'false'}
            aria-pressed={isInspectorVisible() ? 'true' : 'false'}
            onClick={toggleInspectorVisibility}
          >
            Inspector
          </button>
          <button
            type="button"
            class="secondary"
            data-active={outlineVisible() ? 'true' : 'false'}
            aria-pressed={outlineVisible() ? 'true' : 'false'}
            onClick={toggleOutlineVisibility}
          >
            Outline
          </button>
          <label class="typography-select">
            <span class="sr-only">Typography preset</span>
            <select value={typographyPreset()} onInput={handlePresetChange}>
              <option value="editorial-classic">Editorial Classic</option>
              <option value="humanist-tech">Humanist Tech</option>
              <option value="swiss-modern">Swiss Modern + Display</option>
              <option value="bookish-oldstyle">Bookish Oldstyle</option>
              <option value="inclusive-readability">Inclusive Readability</option>
            </select>
          </label>

          <button type="button" class="secondary" onClick={handleOpenFile} disabled={vaultStore.isLoading()}>
            Open file
          </button>
          <button
            type="button"
            class="primary"
            onClick={handleOpenVault}
            disabled={vaultStore.isLoading()}
          >
            Open vault
          </button>
          <a
            class="icon-button github-link"
            href="https://github.com/tloureiro/jazzbb"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open project on GitHub"
            title="GitHub"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M8 .198a8 8 0 0 0-2.53 15.6c.4.074.547-.174.547-.386 0-.19-.007-.693-.01-1.36-2.226.483-2.695-1.073-2.695-1.073-.364-.924-.89-1.17-.89-1.17-.727-.497.055-.487.055-.487.803.056 1.225.824 1.225.824.715 1.225 1.874.871 2.33.666.072-.518.28-.872.508-1.073-1.777-.202-3.644-.888-3.644-3.953 0-.873.312-1.588.824-2.148-.083-.202-.357-1.016.078-2.12 0 0 .67-.215 2.198.82a7.65 7.65 0 0 1 2.004-.27 7.66 7.66 0 0 1 2.004.27c1.527-1.035 2.196-.82 2.196-.82.437 1.104.163 1.918.08 2.12.513.56.823 1.275.823 2.148 0 3.073-1.87 3.748-3.65 3.947.288.247.543.735.543 1.482 0 1.07-.01 1.933-.01 2.196 0 .214.145.463.55.384A8.001 8.001 0 0 0 8 .198"
              />
            </svg>
          </a>
          <button
            type="button"
            class="icon-button help-toggle"
            onClick={() => setShowShortcuts(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (Cmd/Ctrl + /)"
            data-test="header-help-toggle"
          >
            ?
          </button>
          <button
            type="button"
            class="icon-button theme-toggle"
            onClick={handleToggleTheme}
            aria-label="Toggle theme"
            title="Toggle theme"
            data-test="theme-toggle"
          >
            {currentTheme() === 'light' ? '☀️' : '🌙'}
          </button>
        </div>
        </div>
        <Show when={showUnsupportedNotice()}>
          <div class="banner banner-warning banner-dismissible" role="status">
            <span>
              Saving notes requires a Chromium-based browser. Open jazzbb in Chrome, Edge, or Brave to write files.
            </span>
            <button
              type="button"
              class="banner-dismiss"
              onClick={() => setShowUnsupportedNotice(false)}
              aria-label="Dismiss save warning"
            >
              Dismiss
            </button>
          </div>
        </Show>
        <Show when={showQuotaWarning()}>
          <div class="banner banner-warning banner-dismissible" data-test="storage-quota-warning" role="status">
            <span>
              Browser vault storage is at {quotaUsagePercent()}% of available space. Export or prune notes to avoid data loss.
            </span>
            <button
              type="button"
              class="banner-dismiss"
              data-test="storage-quota-warning-dismiss"
              onClick={dismissQuotaWarning}
              aria-label="Dismiss storage warning"
            >
              Dismiss
            </button>
          </div>
        </Show>
        <div class="header-row header-row-bottom">
          <div class="editor-controls header-controls">
            <div class="editor-control">
              <label class="editor-slider-label" for="editor-font-scale">
                Font
              </label>
              <input
                id="editor-font-scale"
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={fontScaleFactor().toString()}
                onInput={handleFontScaleInput}
                aria-label="Editor font size"
              />
              <span class="editor-slider-value" aria-hidden="true">
                {fontScalePercent()}%
              </span>
            </div>
            <div class="editor-control">
              <label class="editor-slider-label" for="editor-measure-scale">
                Margins
              </label>
              <input
                id="editor-measure-scale"
                type="range"
                min="0.6"
                max="1.4"
                step="0.05"
                value={editorMeasureScale().toString()}
                onInput={handleMeasureScaleInput}
                aria-label="Editor margins"
              />
              <span class="editor-slider-value" aria-hidden="true">
                {measurePercent()}%
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="header-collapse-handle"
          onClick={() => setHeaderCollapsed(true)}
          aria-label="Collapse top bar"
          title="Collapse top bar (Cmd/Ctrl + Shift + H)"
        >
          ▲
        </button>
        <Show when={vaultStore.error()}>
          {(message) => <p class="banner banner-error">{message()}</p>}
        </Show>
        <Show when={showSearch() && isVaultMode()}>
          <SearchPanel onClose={() => setShowSearch(false)} />
        </Show>
      </header>
      <Show when={showShortcuts()}>
        <ShortcutHelpModal onClose={() => setShowShortcuts(false)} footer={helpFooter()} />
      </Show>
    </>
  );
};

export default Header;
