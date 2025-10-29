import { Component, For, Show, createMemo } from 'solid-js';
import { editorStore } from '../state/editor';
import { toggleOutlineVisibility } from '../state/ui';

const OutlinePanel: Component = () => {
  const headings = editorStore.headings;
  const activeId = editorStore.activeHeadingId;

  const outlineItems = createMemo(() => headings().map((heading) => ({ ...heading })));

  const handleNavigate = (id: string) => {
    editorStore.scrollToHeading(id);
  };

  return (
    <aside class="outline-panel" aria-label="Outline navigator">
      <header class="pane-header">
        <h2>Outline</h2>
        <button type="button" class="panel-close" onClick={toggleOutlineVisibility} aria-label="Close outline">
          ×
        </button>
      </header>
      <Show
        when={outlineItems().length > 0}
        fallback={<p class="empty-state">Headings will appear here.</p>}
      >
        <ol class="outline-list">
          <For each={outlineItems()}>
            {(heading) => (
              <li>
                <button
                  type="button"
                  class="outline-item"
                  style={{ '--outline-level': String(heading.level - 1) }}
                  data-active={activeId() === heading.id ? 'true' : 'false'}
                  onClick={() => handleNavigate(heading.id)}
                >
                  <span class="outline-text">{heading.text}</span>
                </button>
              </li>
            )}
          </For>
        </ol>
      </Show>
    </aside>
  );
};

export default OutlinePanel;
