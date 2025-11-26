import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';
import { vaultStore, type NoteMeta } from '../state/vault';
import { openNote } from '../platform/note-reader';
import { createNote, deleteNote, renameNote } from '../platform/note-manager';
import { isVaultMode, isBrowserVaultMode } from '../state/workspace';
import { setSidebarCollapsed } from '../state/ui';
import { getShortcutLabel, subscribeToShortcutChanges } from '../lib/shortcuts';
import { buildNoteTree, getNoteDisplayName, type NoteTreeFile, type NoteTreeFolder, type NoteTreeNode } from '../lib/note-tree';

const Sidebar: Component = () => {
  const notes = () => vaultStore.state.notes;
  const currentSortMode = () => vaultStore.sortMode();
  const [editingPath, setEditingPath] = createSignal<string | undefined>();
  const [editingValue, setEditingValue] = createSignal('');
  const [shortcutsVersion, setShortcutsVersion] = createSignal(0);
  onCleanup(
    subscribeToShortcutChanges(() => {
      setShortcutsVersion((value) => value + 1);
    }),
  );
  let renameInputRef: HTMLInputElement | undefined;
  let suppressBlurCommit = false;

  const handleCreate = async () => {
    if (!isVaultMode()) return;
    await createNote();
  };

  const handleSortChange = (mode: 'name' | 'modified') => {
    if (currentSortMode() === mode) return;
    vaultStore.setSortMode(mode);
  };

  const formatShortcutTitle = (label: string, id: Parameters<typeof getShortcutLabel>[0]) => {
    shortcutsVersion();
    const keys = getShortcutLabel(id);
    return keys ? `${label} (${keys})` : label;
  };

  const selectedPath = () => vaultStore.state.selectedPath;

  const displayNameFor = (meta: Pick<NoteMeta, 'path' | 'title'>) => getNoteDisplayName(meta);

  const startInlineRename = (note: Pick<NoteMeta, 'path' | 'title'>) => {
    if (!isVaultMode()) return;
    setEditingValue(displayNameFor(note));
    setEditingPath(note.path);
  };

  const resetInlineRename = () => {
    setEditingPath(undefined);
    setEditingValue('');
    renameInputRef = undefined;
  };

  const commitInlineRename = async () => {
    const path = editingPath();
    if (!path) return;
    const note = notes().find((entry) => entry.path === path);
    if (!note) {
      resetInlineRename();
      return;
    }
    const trimmed = editingValue().trim();
    if (!trimmed) {
      setEditingValue(displayNameFor(note));
      return;
    }
    const result = await renameNote(path, trimmed);
    if (result.status === 'renamed') {
      resetInlineRename();
    } else if (result.status === 'duplicate') {
      window.alert('A note with that title already exists.');
    } else {
      window.alert('Failed to rename note.');
    }
  };

  const cancelInlineRename = () => {
    suppressBlurCommit = true;
    resetInlineRename();
    queueMicrotask(() => {
      suppressBlurCommit = false;
    });
  };

  createEffect(() => {
    const path = editingPath();
    if (!path) return;
    queueMicrotask(() => {
      renameInputRef?.focus();
      renameInputRef?.select();
    });
  });

  const handleDeleteNote = async (path: string, title: string | undefined) => {
    if (!isVaultMode()) return;
    if (selectedPath() !== path) return;
    const label = title?.trim() ? title : path;
    const confirmed = window.confirm(`Delete "${label}"?`);
    if (!confirmed) return;
    await deleteNote(path);
  };

  const [collapsedFolders, setCollapsedFolders] = createSignal<Record<string, boolean>>({});

  const noteTree = createMemo(() => buildNoteTree(notes(), currentSortMode()));

  createEffect(() => {
    const tree = noteTree();
    const current = collapsedFolders();
    const next = { ...current };
    let changed = false;
    const ensureDefaults = (folder: NoteTreeFolder) => {
      if (folder.path && !(folder.path in next)) {
        next[folder.path] = true;
        changed = true;
      }
      for (const child of folder.children) {
        if (child.type === 'folder') {
          ensureDefaults(child);
        }
      }
    };
    ensureDefaults(tree);
    if (changed) {
      setCollapsedFolders(() => next);
    }
  });

  const isFolderCollapsed = (path: string) => collapsedFolders()[path] ?? false;
  const toggleFolder = (path: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const indentPadding = (depth: number) => `${1.25 + depth * 1.1}rem`;

  const renderFolder = (folder: NoteTreeFolder, depth: number): JSX.Element => {
    const collapsed = () => isFolderCollapsed(folder.path);
    return (
      <li class="note-list-item note-folder" data-depth={depth} data-collapsed={collapsed() ? 'true' : 'false'}>
        <button
          type="button"
          class="folder-button"
          onClick={() => toggleFolder(folder.path)}
          style={{ 'padding-left': indentPadding(depth) }}
          aria-label={`Toggle folder ${folder.name}`}
        >
          <span class="folder-caret" data-collapsed={collapsed() ? 'true' : 'false'} aria-hidden="true" />
          <span class="folder-label">{folder.name}</span>
        </button>
        <Show when={!collapsed()}>
          <ul class="note-list note-children">{renderTree(folder.children, depth + 1)}</ul>
        </Show>
      </li>
    );
  };

  const renderNote = (node: NoteTreeFile, depth: number): JSX.Element => {
    const meta = node.meta;
    const indentStyle = { 'padding-left': indentPadding(depth) };
    return (
      <li class="note-list-item" data-depth={depth}>
        <Show
          when={editingPath() === meta.path}
          fallback={
            <>
              <button
                class="note-button"
                type="button"
                style={indentStyle}
                onClick={() => openNote(meta.path)}
                onDblClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  startInlineRename(meta);
                }}
                data-active={vaultStore.state.selectedPath === meta.path}
              >
                {displayNameFor(meta)}
              </button>
              <Show when={vaultStore.state.selectedPath === meta.path}>
                <button
                  type="button"
                  class="note-delete-button"
                  aria-label={`Delete ${meta.title || meta.path}`}
                  onClick={() => handleDeleteNote(meta.path, meta.title)}
                >
                  <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
                    <path
                      d="M3 1h8l1 2h2v1H0V3h2l1-2Zm1 5h1v7H4V6Zm3 0h1v7H7V6Zm4 0h1v7h-1V6ZM2 4h10l-.8 11H2.8L2 4Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </Show>
            </>
          }
        >
          <input
            ref={(element) => {
              renameInputRef = element ?? undefined;
              if (element) {
                queueMicrotask(() => element.select());
              }
            }}
            class="note-rename-input"
            type="text"
            aria-label={`Rename ${meta.title || meta.path}`}
            style={indentStyle}
            value={editingValue()}
            onInput={(event) => setEditingValue(event.currentTarget.value)}
            onBlur={() => {
              if (suppressBlurCommit) {
                suppressBlurCommit = false;
                return;
              }
              void commitInlineRename();
            }}
            onKeyDown={async (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                await commitInlineRename();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelInlineRename();
              }
            }}
          />
        </Show>
      </li>
    );
  };

  const renderTree = (items: NoteTreeNode[], depth = 0): JSX.Element => (
    <For each={items}>
      {(node) => (node.type === 'folder' ? renderFolder(node, depth) : renderNote(node, depth))}
    </For>
  );

  return (
    <Show when={isVaultMode()} fallback={null}>
      <aside class="sidebar" aria-label="Vault navigator">
        <header class="sidebar-header">
          <div class="sidebar-title">
            <div class="sidebar-heading">
              <p class="sidebar-label">{isBrowserVaultMode() ? 'Browser vault' : 'File vault'}</p>
              <button
                type="button"
                class="icon-button sidebar-new-button"
                onClick={handleCreate}
                aria-label="Create new note"
                title={formatShortcutTitle('Create new note', 'new-note')}
                data-test="sidebar-new-note"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M14 2H8a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8Z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M14 2v5a1 1 0 0 0 1 1h5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
            <Show when={!isBrowserVaultMode()}>
              <label class="sidebar-sort-select">
                <span>Sort</span>
                <select
                  aria-label="Sort notes"
                  value={currentSortMode()}
                  onChange={(event) =>
                    handleSortChange(event.currentTarget.value as 'name' | 'modified')
                  }
                >
                  <option value="name">Name</option>
                  <option value="modified">Modification</option>
                </select>
              </label>
            </Show>
          </div>
        </header>
        <button
          type="button"
          class="sidebar-collapse-handle"
          onClick={() => setSidebarCollapsed(true)}
          aria-label="Collapse vault sidebar"
          title={formatShortcutTitle('Collapse vault sidebar', 'toggle-sidebar')}
          data-test="sidebar-collapse"
        >
          ◀
        </button>
        <Show
          when={!vaultStore.isLoading() && notes().length > 0}
          fallback={
            <p class="empty-state">{vaultStore.isLoading() ? 'Loading vault...' : 'Open a vault to see your notes.'}</p>
          }
        >
          <ul class="note-list note-tree">{renderTree(noteTree().children)}</ul>
        </Show>
      </aside>
    </Show>
  );
};

export default Sidebar;
