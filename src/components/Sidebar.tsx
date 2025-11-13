import { Component, For, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { vaultStore } from '../state/vault';
import { openNote } from '../platform/note-reader';
import { createNote, deleteNote, renameNote } from '../platform/note-manager';
import { isVaultMode } from '../state/workspace';
import { setSidebarCollapsed } from '../state/ui';
import { getShortcutLabel, subscribeToShortcutChanges } from '../lib/shortcuts';

const Sidebar: Component = () => {
  const notes = () => vaultStore.state.notes;
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

  const formatShortcutTitle = (label: string, id: Parameters<typeof getShortcutLabel>[0]) => {
    shortcutsVersion();
    const keys = getShortcutLabel(id);
    return keys ? `${label} (${keys})` : label;
  };

  const selectedPath = () => vaultStore.state.selectedPath;

  const displayNameFor = (path: string, title?: string) => {
    if (title?.trim()) return title;
    const base = path.split('/').pop() ?? path;
    return base.replace(/\.md$/i, '');
  };

  const startInlineRename = (note: { path: string; title: string }) => {
    if (!isVaultMode()) return;
    setEditingValue(displayNameFor(note.path, note.title));
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
      setEditingValue(displayNameFor(note.path, note.title));
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

  return (
    <Show when={isVaultMode()} fallback={null}>
      <aside class="sidebar" aria-label="Vault navigator">
        <header class="sidebar-header">
          <div class="sidebar-title">
            <Show when={vaultStore.state.notes.length > 0}>
              <span class="sidebar-badge" data-variant="browser">Browser vault</span>
            </Show>
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
          <ul class="note-list">
            <For each={notes()}>
              {(note) => (
                <li class="note-list-item">
                  <Show
                    when={editingPath() === note.path}
                    fallback={
                      <>
                        <button
                          class="note-button"
                          type="button"
                          onClick={() => openNote(note.path)}
                          onDblClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            startInlineRename(note);
                          }}
                          data-active={vaultStore.state.selectedPath === note.path}
                        >
                          {displayNameFor(note.path, note.title)}
                        </button>
                        <Show when={vaultStore.state.selectedPath === note.path}>
                          <button
                            type="button"
                            class="note-delete-button"
                            aria-label={`Delete ${note.title || note.path}`}
                            onClick={() => handleDeleteNote(note.path, note.title)}
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
                      aria-label={`Rename ${note.title || note.path}`}
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
              )}
            </For>
          </ul>
        </Show>
      </aside>
    </Show>
  );
};

export default Sidebar;
