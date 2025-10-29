import { Component, For, Show } from 'solid-js';
import { vaultStore } from '../state/vault';
import { editorStore } from '../state/editor';
import { openNote } from '../platform/note-reader';
import { createNote, deleteNote, renameNote } from '../platform/note-manager';
import { workspaceStore } from '../state/workspace';

const Sidebar: Component = () => {
  const notes = () => vaultStore.state.notes;

  const handleCreate = async () => {
    if (workspaceStore.mode() !== 'vault') return;
    await createNote();
  };

  const handleDelete = async () => {
    if (workspaceStore.mode() !== 'vault') return;
    const path = editorStore.activePath();
    if (!path) return;
    const confirmed = window.confirm(`Delete ${path}?`);
    if (!confirmed) return;
    await deleteNote(path);
  };

  const handleRename = async () => {
    if (workspaceStore.mode() !== 'vault') return;
    const path = editorStore.activePath();
    if (!path) return;
    const current = path.replace(/\.md$/i, '');
    const next = window.prompt('Rename note', current);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    const result = await renameNote(path, trimmed);
    if (result.status === 'duplicate') {
      window.alert('A note with that name already exists.');
    }
  };

  const mode = workspaceStore.mode;

  return (
    <Show when={mode() === 'vault'} fallback={null}>
      <aside class="sidebar" aria-label="Vault navigator">
        <header class="sidebar-header">
          <h2>Vault</h2>
          <div class="sidebar-actions">
            <button type="button" onClick={handleCreate}>
              + New
            </button>
            <button type="button" onClick={handleRename} disabled={!editorStore.activePath()}>
              Rename
            </button>
            <button type="button" onClick={handleDelete} disabled={!editorStore.activePath()}>
              Delete
            </button>
          </div>
        </header>
        <Show
          when={!vaultStore.isLoading() && notes().length > 0}
          fallback={
            <p class="empty-state">{vaultStore.isLoading() ? 'Loading vault...' : 'Open a vault to see your notes.'}</p>
          }
        >
          <ul class="note-list">
            <For each={notes()}>
              {(note) => (
                <li>
                  <button
                    class="note-button"
                    type="button"
                    onClick={() => openNote(note.path)}
                    data-active={vaultStore.state.selectedPath === note.path}
                  >
                    {note.title || note.path}
                  </button>
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
