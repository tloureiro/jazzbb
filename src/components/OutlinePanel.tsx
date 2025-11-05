import { Component, For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import { editorStore } from '../state/editor';
import { toggleOutlineVisibility } from '../state/ui';

type OutlineNode = {
  id: string;
  text: string;
  level: number;
  children: OutlineNode[];
};

type FlatNode = {
  id: string;
  text: string;
  level: number;
  hasChildren: boolean;
  parentId: string | undefined;
};

const OutlinePanel: Component = () => {
  const headings = editorStore.headings;
  const activeId = editorStore.activeHeadingId;
  const [collapsedIds, setCollapsedIds] = createSignal<Set<string>>(new Set());
  const [focusedId, setFocusedId] = createSignal<string | undefined>(undefined);
  let itemRefs: HTMLButtonElement[] = [];

  const buildTree = (list: ReturnType<typeof headings>): OutlineNode[] => {
    const root: OutlineNode[] = [];
    const stack: OutlineNode[] = [];

    for (const heading of list) {
      const node: OutlineNode = { ...heading, children: [] };
      while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
        stack.pop();
      }
      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      stack.push(node);
    }

    return root;
  };

  const tree = createMemo(() => buildTree(headings()));

  const visibleItems = createMemo<FlatNode[]>(() => {
    const result: FlatNode[] = [];
    const collapsed = collapsedIds();
    itemRefs = [];
    const walk = (nodes: OutlineNode[], parentId?: string) => {
      for (const node of nodes) {
        const hasChildren = node.children.length > 0;
        result.push({
          id: node.id,
          text: node.text,
          level: node.level,
          hasChildren,
          parentId,
        });
        if (hasChildren && !collapsed.has(node.id)) {
          walk(node.children, node.id);
        }
      }
    };
    walk(tree());
    itemRefs = new Array(result.length);
    return result;
  });

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const focusItem = (index: number) => {
    const items = visibleItems();
    const target = itemRefs[index];
    if (target) {
      target.focus();
    }
    const item = items[index];
    if (item) {
      setFocusedId(item.id);
    }
  };

  const handleKeyDown = (event: KeyboardEvent, index: number, node: FlatNode) => {
    const items = visibleItems();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(Math.min(index + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(Math.max(index - 1, 0));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const collapsed = collapsedIds();
      if (node.hasChildren && !collapsed.has(node.id)) {
        toggleCollapsed(node.id);
        setFocusedId(node.id);
      } else if (node.parentId) {
        const parentIndex = items.findIndex((item) => item.id === node.parentId);
        if (parentIndex >= 0) {
          focusItem(parentIndex);
        }
      }
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const collapsed = collapsedIds();
      if (node.hasChildren) {
        if (collapsed.has(node.id)) {
          toggleCollapsed(node.id);
        } else {
          const nextIndex = items.findIndex(
            (item, idx) => idx > index && item.parentId === node.id,
          );
          if (nextIndex >= 0) {
            focusItem(nextIndex);
          }
        }
      }
    }
  };

  const handleNavigate = (id: string) => {
    editorStore.scrollToHeading(id, { focusEditor: false });
    setFocusedId(id);
  };

  createEffect(() => {
    const currentId = focusedId();
    const visible = visibleItems();
    if (!currentId || visible.length === 0) return;
    queueMicrotask(() => {
      if (typeof document === 'undefined') return;
      const button = document.querySelector<HTMLButtonElement>(`.outline-item[data-id="${currentId}"]`);
      if (button && document.activeElement !== button) {
        button.focus();
      }
    });
  });

  return (
    <aside class="outline-panel" aria-label="Outline navigator">
      <header class="pane-header">
        <h2>Outline</h2>
        <button type="button" class="panel-close" onClick={toggleOutlineVisibility} aria-label="Close outline">
          ×
        </button>
      </header>
      <Show when={visibleItems().length > 0} fallback={<p class="empty-state">Headings will appear here.</p>}>
        <ol class="outline-list">
          <For each={visibleItems()}>
            {(node, index) => (
              <li>
                <button
                  ref={(el) => {
                    if (el) itemRefs[index()] = el;
                  }}
                  type="button"
                  class="outline-item"
                  style={{ '--outline-level': String(node.level - 1) }}
                  data-active={activeId() === node.id ? 'true' : 'false'}
                  data-id={node.id}
                  data-collapsed={node.hasChildren ? (collapsedIds().has(node.id) ? 'true' : 'false') : undefined}
                  aria-expanded={node.hasChildren ? (collapsedIds().has(node.id) ? 'false' : 'true') : undefined}
                  onClick={() => handleNavigate(node.id)}
                  onFocus={() => setFocusedId(node.id)}
                  onKeyDown={(event) => handleKeyDown(event, index(), node)}
                >
                  <span class="outline-bullet">
                    {node.hasChildren ? (
                      <span
                        role="button"
                        tabIndex={-1}
                        class="outline-collapse"
                        aria-label={collapsedIds().has(node.id) ? 'Expand section' : 'Collapse section'}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          toggleCollapsed(node.id);
                        }}
                      >
                        {collapsedIds().has(node.id) ? '▸' : '▾'}
                      </span>
                    ) : (
                      <span class="outline-spacer" />
                    )}
                  </span>
                  <span class="outline-text">{node.text}</span>
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
