import { Component, Show, createMemo } from 'solid-js';
import { vaultStore } from '../state/vault';
import { editorStore } from '../state/editor';
import { analyzeMarkdownStats, hasUnsavedChanges } from '../lib/note-stats';

const InspectorPane: Component = () => {
  const selectedNote = () =>
    vaultStore.state.notes.find((note) => note.path === vaultStore.state.selectedPath);

  const stats = createMemo(() => analyzeMarkdownStats(editorStore.draft()));
  const unsaved = createMemo(() => hasUnsavedChanges(editorStore.draft(), editorStore.content()));
  const linkCount = createMemo(() => editorStore.links().length);
  return (
    <aside class="inspector-pane" aria-label="Metadata">
      <header class="pane-header">
        <h2>Inspector</h2>
      </header>
      <Show
        when={selectedNote()}
        fallback={<p class="empty-state">Select a note to inspect metadata.</p>}
      >
        {(note) => {
          const value = note();
          return (
            <dl class="inspector-list">
              <div>
                <dt>Title</dt>
                <dd>{value.title}</dd>
              </div>
              <div>
                <dt>Path</dt>
                <dd>{value.path}</dd>
              </div>
              <div>
                <dt>Last modified</dt>
                <dd>{new Date(value.lastModified).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Unsaved changes</dt>
                <dd>{unsaved() ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt>Words</dt>
                <dd>{stats().words}</dd>
              </div>
              <div>
                <dt>Characters</dt>
                <dd>{stats().characters}</dd>
              </div>
              <div>
                <dt>Lines</dt>
                <dd>{stats().lines}</dd>
              </div>
              <div>
                <dt>Headings</dt>
                <dd>{stats().headings}</dd>
              </div>
              <div>
                <dt>Tasks</dt>
                <dd>
                  {stats().tasks.completed} / {stats().tasks.total}
                </dd>
              </div>
              <div>
                <dt>Outgoing links</dt>
                <dd>{linkCount()}</dd>
              </div>
            </dl>
          );
        }}
      </Show>
    </aside>
  );
};

export default InspectorPane;
