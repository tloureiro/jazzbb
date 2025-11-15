import { For, Show, createMemo, type Component, type JSXElement } from 'solid-js';
import { editorStore } from '../state/editor';
import { setFrontmatterPanelVisible } from '../state/ui';

function renderValue(value: unknown): JSXElement {
  if (Array.isArray(value)) {
    return (
      <ol class="frontmatter-list">
        <For each={value}>
          {(item, index) => (
            <li>
              <span class="frontmatter-list-index">#{index() + 1}</span>
              <div class="frontmatter-nested">{renderValue(item)}</div>
            </li>
          )}
        </For>
      </ol>
    );
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span class="frontmatter-empty">Empty object</span>;
    }
    return (
      <div class="frontmatter-object">
        <For each={entries}>
          {([key, child]) => (
            <div class="frontmatter-field">
              <span class="frontmatter-key">{key}</span>
              <div class="frontmatter-value">{renderValue(child)}</div>
            </div>
          )}
        </For>
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return <span class="frontmatter-primitive">{value ? 'true' : 'false'}</span>;
  }

  if (value === null) {
    return <span class="frontmatter-primitive">null</span>;
  }

  if (value === undefined || value === '') {
    return <span class="frontmatter-primitive">—</span>;
  }

  return <span class="frontmatter-primitive">{String(value)}</span>;
}

const FrontmatterPanel: Component = () => {
  const info = editorStore.frontmatter;
  const metadata = editorStore.frontmatterMetadata;

  const hasFields = createMemo(() => {
    const parsed = metadata();
    if (!parsed || parsed.error) {
      return false;
    }
    return parsed.value !== undefined;
  });

  return (
    <aside class="frontmatter-panel" aria-label="Frontmatter details">
        <header class="pane-header">
          <h2>Frontmatter</h2>
          <button type="button" class="panel-close" onClick={() => setFrontmatterPanelVisible(false)} aria-label="Hide frontmatter panel">
            ×
          </button>
        </header>
      <Show when={info()} fallback={<p class="empty-state">This note does not include frontmatter.</p>}>
        <div class="frontmatter-panel__body">
          <Show when={metadata()?.error}>
            {(error) => <p class="panel-alert">Could not parse frontmatter: {error()}</p>}
          </Show>
          <Show when={!metadata()?.error} fallback={null}>
            <Show when={hasFields()} fallback={<p class="empty-state">No fields defined in frontmatter.</p>}>
              <div class="frontmatter-fields">{renderValue(metadata()?.value)}</div>
            </Show>
          </Show>
        </div>
      </Show>
    </aside>
  );
};

export default FrontmatterPanel;
