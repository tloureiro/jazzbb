import { Component, Show, For, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { supportsFileSystemAccess, requestVault } from '../platform/fs';
import { loadVaultContents } from '../platform/vault-loader';
import { saveActiveNote, exportActiveNoteToFile } from '../platform/save-note';
import { editorStore } from '../state/editor';
import { vaultStore } from '../state/vault';
import SearchPanel from './SearchPanel';
import CommandPalette, { type CommandPaletteCommand } from './CommandPalette';
import { createNote } from '../platform/note-manager';
import {
  showToast,
  typographyPreset,
  setTypographyPreset,
  type TypographyPreset,
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
  isSidebarCollapsed,
  toggleSidebarCollapsed,
  isPlainMarkdownMode,
  togglePlainMarkdownMode,
  isFrontmatterEditorVisible,
  toggleFrontmatterEditorVisibility,
  isFrontmatterPanelVisible,
  toggleFrontmatterPanelVisibility,
  lastCommandId,
  setLastCommandId,
  colorScheme,
  setColorScheme,
  colorSchemeOptions,
  COLOR_SCHEME_VERSION,
  type ColorSchemeId,
} from '../state/ui';
import { openSingleFile } from '../platform/open-file';
import { workspaceStore, isVaultMode, isBrowserVaultMode } from '../state/workspace';
import { grammarChecksStore } from '../state/grammarChecks';
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
import { getShortcutLabel, isShortcutEvent, subscribeToShortcutChanges } from '../lib/shortcuts';
import { closeActiveDocument } from '../lib/documents';

const Header: Component = () => {
  const [showSearch, setShowSearch] = createSignal(false);
  const [showCommandPalette, setShowCommandPalette] = createSignal(false);
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const outlineVisible = isOutlineVisible;
  const frontmatterEditorVisible = isFrontmatterEditorVisible;
  const frontmatterPanelVisible = isFrontmatterPanelVisible;
  const currentTheme = theme;
  const headerCollapsed = isHeaderCollapsed;
  const fileSystemSupported = supportsFileSystemAccess();
  const [showUnsupportedNotice, setShowUnsupportedNotice] = createSignal(!fileSystemSupported);
  const [storageEstimate, setStorageEstimate] = createSignal<StorageEstimate | null>(null);
  const [storageDismissed, setStorageDismissed] = createSignal(false);
  const [shortcutsVersion, setShortcutsVersion] = createSignal(0);
  onCleanup(
    subscribeToShortcutChanges(() => {
      setShortcutsVersion((value) => value + 1);
    }),
  );
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

  const formatShortcutTitle = (label: string, id: Parameters<typeof getShortcutLabel>[0]) => {
    shortcutsVersion();
    const keys = getShortcutLabel(id);
    return keys ? `${label} (${keys})` : label;
  };

  let importInputRef: HTMLInputElement | undefined;

  const persistBrowserSettings = () => {
    updateBrowserVaultSettings({
      theme: currentTheme(),
      typographyPreset: typographyPreset(),
      fontScale: editorFontScale(),
      measureScale: editorMeasureScale(),
      colorScheme: colorScheme(),
      colorSchemeVersion: COLOR_SCHEME_VERSION,
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

  const handleColorSchemeChange = (event: Event) => {
    const target = event.currentTarget as HTMLSelectElement;
    setColorScheme(target.value as ColorSchemeId);
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

  const handleCloseDocument = async () => {
    const result = await closeActiveDocument();
    if (result.status === 'closed') {
      const message = result.context === 'single' ? 'Closed file' : 'Closed note';
      showToast(message, 'info');
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

  const toggleGrammarChecks = () => {
    grammarChecksStore.toggleGrammarChecks();
    showToast(
      grammarChecksStore.isGrammarChecksEnabled() ? 'Grammar checks enabled' : 'Grammar checks disabled',
      'info',
    );
  };

  const ensureFrontmatterAvailable = (): boolean => {
    if (!editorStore.frontmatter()) {
      showToast('This note has no frontmatter yet.', 'info');
      return false;
    }
    return true;
  };

  const handleToggleFrontmatterEditor = () => {
    if (!ensureFrontmatterAvailable()) return;
    toggleFrontmatterEditorVisibility();
  };

  const handleToggleFrontmatterPanel = () => {
    if (!ensureFrontmatterAvailable()) return;
    toggleFrontmatterPanelVisibility();
  };

  const commandItems = createMemo<ReadonlyArray<CommandPaletteCommand>>(() => {
    shortcutsVersion();
    const themeMode = currentTheme();
    const outlineActive = outlineVisible();
    const headerIsCollapsed = headerCollapsed();
    const sidebarCollapsed = isSidebarCollapsed();
    const plainMarkdown = isPlainMarkdownMode();
    const vaultLoading = vaultStore.isLoading();
    const vaultActive = isVaultMode();
    const hasActivePath = Boolean(editorStore.activePath());
    const mode = workspaceStore.mode();

    const items: CommandPaletteCommand[] = [
      {
        id: 'search-notes',
        label: 'Search notes',
        subtitle: 'Find notes across the vault',
        shortcut: getShortcutLabel('search-notes'),
        badge: vaultActive ? undefined : 'Vault only',
        disabled: !vaultActive || vaultLoading,
        keywords: 'find locate global search vault',
        run: () => {
          if (!isVaultMode()) return;
          setShowSearch(true);
        },
      },
      {
        id: 'create-note',
        label: 'Create new note',
        shortcut: getShortcutLabel('new-note'),
        badge: vaultActive ? undefined : 'Vault only',
        disabled: !vaultActive || vaultLoading,
        keywords: 'add note new document vault',
        run: async () => {
          if (!isVaultMode()) return;
          await createNote();
        },
      },
      {
        id: 'save-note',
        label: 'Save note',
        shortcut: getShortcutLabel('save-note'),
        disabled: !canSave(),
        keywords: 'save write persist',
        run: async () => {
          await handleSave();
        },
      },
      {
        id: 'open-file',
        label: 'Open file',
        subtitle: 'Select a Markdown file',
        shortcut: getShortcutLabel('open-file'),
        disabled: vaultLoading,
        keywords: 'open file import single',
        run: async () => {
          await handleOpenFile();
        },
      },
      {
        id: 'close-document',
        label: 'Close document',
        shortcut: getShortcutLabel('close-document'),
        subtitle: 'Return to start view',
        keywords: 'close document exit note',
        disabled: mode === 'scratch' && !hasActivePath,
        run: async () => {
          await handleCloseDocument();
        },
      },
      {
        id: 'toggle-outline',
        label: outlineActive ? 'Hide outline panel' : 'Display outline panel',
        shortcut: getShortcutLabel('toggle-outline'),
        keywords: 'outline headings navigation display show',
        run: () => {
          toggleOutlineVisibility();
        },
      },
      {
        id: 'toggle-frontmatter-editor',
        label: frontmatterEditorVisible() ? 'Hide frontmatter editor' : 'Display frontmatter editor',
        shortcut: getShortcutLabel('toggle-frontmatter-editor'),
        keywords: 'frontmatter metadata yaml editor display show',
        disabled: !editorStore.frontmatter(),
        run: handleToggleFrontmatterEditor,
      },
      {
        id: 'toggle-frontmatter-panel',
        label: frontmatterPanelVisible() ? 'Hide frontmatter panel' : 'Display frontmatter panel',
        shortcut: getShortcutLabel('toggle-frontmatter-panel'),
        keywords: 'frontmatter metadata yaml panel display show',
        disabled: !editorStore.frontmatter(),
        run: handleToggleFrontmatterPanel,
      },
      {
        id: 'toggle-sidebar',
        label: sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
        shortcut: getShortcutLabel('toggle-sidebar'),
        badge: 'Vault only',
        disabled: !vaultActive,
        keywords: 'sidebar files navigation vault',
        run: () => {
          if (!isVaultMode()) return;
          toggleSidebarCollapsed();
        },
      },
      {
        id: 'toggle-top-bar',
        label: headerIsCollapsed ? 'Expand top bar' : 'Collapse top bar',
        shortcut: getShortcutLabel('toggle-top-bar'),
        keywords: 'header top bar ui',
        run: () => {
          setHeaderCollapsed(!headerIsCollapsed);
        },
      },
      {
        id: 'toggle-theme',
        label: themeMode === 'light' ? 'Switch to dark theme' : 'Switch to light theme',
        subtitle: `Current theme: ${themeMode}`,
        keywords: 'theme appearance light dark color',
        run: () => {
          handleToggleTheme();
        },
      },
      {
        id: 'toggle-plain-markdown',
        label: plainMarkdown ? 'Display formatted editor' : 'Display plain Markdown',
        shortcut: getShortcutLabel('toggle-plain-markdown'),
        keywords: 'markdown plain source editor display show',
        run: () => {
          togglePlainMarkdownMode();
        },
      },
      {
        id: 'toggle-grammar-checks',
        label: grammarChecksStore.isGrammarChecksEnabled() ? 'Disable grammar checks' : 'Enable grammar checks',
        shortcut: getShortcutLabel('toggle-grammar-checks'),
        keywords: 'grammar spellcheck suggestions toggle',
        run: () => {
          toggleGrammarChecks();
        },
      },
      {
        id: 'open-shortcuts',
        label: 'Open keyboard shortcuts',
        subtitle: 'Review available key bindings',
        shortcut: getShortcutLabel('open-shortcuts'),
        keywords: 'help shortcuts reference',
        run: () => {
          setShowShortcuts(true);
        },
      },
    ];

    return items;
  });

  const handleKeydown = async (event: KeyboardEvent) => {
    if (isShortcutEvent(event, 'open-command-palette')) {
      event.preventDefault();
      setShowSearch(false);
      setShowCommandPalette(true);
      return;
    }

    if (isShortcutEvent(event, 'toggle-top-bar')) {
      event.preventDefault();
      toggleHeaderCollapsed();
      return;
    }

    if (isShortcutEvent(event, 'toggle-sidebar')) {
      if (!isVaultMode()) return;
      event.preventDefault();
      toggleSidebarCollapsed();
      return;
    }

    if (isShortcutEvent(event, 'save-note')) {
      event.preventDefault();
      await handleSave();
      return;
    }

    if (isShortcutEvent(event, 'search-notes')) {
      if (!isVaultMode()) return;
      event.preventDefault();
      setShowSearch(true);
      return;
    }

    if (isShortcutEvent(event, 'open-file')) {
      event.preventDefault();
      await handleOpenFile();
      return;
    }

    if (isShortcutEvent(event, 'toggle-grammar-checks')) {
      event.preventDefault();
      toggleGrammarChecks();
      return;
    }

    if (isShortcutEvent(event, 'close-document')) {
      event.preventDefault();
      await handleCloseDocument();
      return;
    }

    if (isShortcutEvent(event, 'toggle-outline')) {
      event.preventDefault();
      toggleOutlineVisibility();
      return;
    }

    if (isShortcutEvent(event, 'toggle-frontmatter-panel')) {
      event.preventDefault();
      handleToggleFrontmatterPanel();
      return;
    }

    if (isShortcutEvent(event, 'new-note')) {
      if (!isVaultMode()) return;
      event.preventDefault();
      await createNote();
      return;
    }

    if (isShortcutEvent(event, 'open-shortcuts')) {
      event.preventDefault();
      setShowShortcuts((prev) => !prev);
      return;
    }

    if (isShortcutEvent(event, 'escape')) {
      event.preventDefault();
      if (showSearch()) {
        setShowSearch(false);
      }
      if (showCommandPalette()) {
        setShowCommandPalette(false);
      }
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    let runtime: (typeof window & { __openCommandPalette?: () => void }) | undefined;
    if (typeof window !== 'undefined') {
      runtime = window as typeof window & { __openCommandPalette?: () => void };
      runtime.__openCommandPalette = () => {
        setShowSearch(false);
        setShowCommandPalette(true);
      };
    }
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
      if (runtime) {
        delete runtime.__openCommandPalette;
      }
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
            title={formatShortcutTitle('New note', 'new-note')}
          >
            New
          </button>
          <Show when={isScratchMode()}>
            <button
              type="button"
              class="secondary"
              onClick={handleSaveToBrowserVault}
              data-test="header-save-browser"
              title={formatShortcutTitle('Save note', 'save-note')}
            >
              Save to browser
            </button>
          </Show>
          <button
            type="button"
            class="secondary"
            onClick={handleSave}
            disabled={!canSave()}
            data-test="header-save-file"
            title={formatShortcutTitle('Save note', 'save-note')}
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
          <button
            type="button"
            class="secondary"
            onClick={toggleSearch}
            disabled={!isVaultMode()}
            title={formatShortcutTitle('Search notes', 'search-notes')}
          >
            Search
          </button>
          <button
            type="button"
            class="secondary"
            data-active={outlineVisible() ? 'true' : 'false'}
            aria-pressed={outlineVisible() ? 'true' : 'false'}
            onClick={toggleOutlineVisibility}
            data-test="header-outline-toggle"
            title={formatShortcutTitle('Toggle outline', 'toggle-outline')}
          >
            Outline
          </button>
          <button
            type="button"
            class="secondary"
            data-active={frontmatterPanelVisible() ? 'true' : 'false'}
            aria-pressed={frontmatterPanelVisible() ? 'true' : 'false'}
            onClick={handleToggleFrontmatterPanel}
            disabled={!editorStore.frontmatter()}
            data-test="header-frontmatter-panel-toggle"
            title={formatShortcutTitle('Toggle frontmatter panel', 'toggle-frontmatter-panel')}
          >
            Frontmatter
          </button>
          <label class="select-field typography-select" data-placeholder="Typography style">
            <span class="sr-only">Typography preset</span>
            <select value={typographyPreset()} onInput={handlePresetChange}>
              <option value="editorial-classic">Editorial Classic</option>
              <option value="humanist-tech">Humanist Tech</option>
              <option value="swiss-modern">Swiss Modern + Display</option>
              <option value="bookish-oldstyle">Bookish Oldstyle</option>
              <option value="inclusive-readability">Inclusive Readability</option>
            </select>
          </label>
          <label class="select-field palette-select" data-placeholder="Color palette">
            <span class="sr-only">Color scheme</span>
            <select value={colorScheme()} onInput={handleColorSchemeChange}>
              <For each={colorSchemeOptions}>
                {(option) => (
                  <option value={option.id}>{option.label}</option>
                )}
              </For>
            </select>
          </label>

          <button
            type="button"
            class="secondary"
            onClick={handleOpenFile}
            disabled={vaultStore.isLoading()}
            data-test="header-open-file"
            title={formatShortcutTitle('Open file', 'open-file')}
          >
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
            title={formatShortcutTitle('Keyboard shortcuts', 'open-shortcuts')}
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
          title={formatShortcutTitle('Collapse top bar', 'toggle-top-bar')}
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
      <Show when={showCommandPalette()}>
        <CommandPalette
          commands={commandItems}
          initialCommandId={lastCommandId}
          onCommandRun={(id) => setLastCommandId(id)}
          onClose={() => setShowCommandPalette(false)}
        />
      </Show>
      <Show when={showShortcuts()}>
        <ShortcutHelpModal onClose={() => setShowShortcuts(false)} footer={helpFooter()} />
      </Show>
    </>
  );
};

export default Header;
