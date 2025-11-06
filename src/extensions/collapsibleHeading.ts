import type { Editor } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { getShortcutLabel } from '../lib/shortcuts';
import { grammarlyStore } from '../state/grammarly';

type CollapsedRange = { from: number; to: number; headingPos: number };

type CollapseCommandSet = {
  toggleHeadingCollapse: (options?: ToggleOptions) => boolean;
  collapseHeadingAt: (pos?: number) => boolean;
  expandHeadingAt: (pos?: number) => boolean;
  ensureHeadingVisible: () => boolean;
};

type CollapsePluginState = {
  decorations: DecorationSet;
  collapsedRanges: CollapsedRange[];
};

const headingCollapsePluginKey = new PluginKey<CollapsePluginState>('headingCollapse');

type ToggleOptions = {
  pos?: number;
  collapsed?: boolean;
};

function findHeadingFromSelection(state: EditorState): { node: ProseMirrorNode; pos: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === 'heading') {
      const pos = $from.before(depth);
      return { node, pos };
    }
  }
  return null;
}

function findHeadingAtPos(state: EditorState, pos: number | undefined): { node: ProseMirrorNode; pos: number } | null {
  if (typeof pos !== 'number') {
    return null;
  }
  const node = state.doc.nodeAt(pos);
  if (!node || node.type.name !== 'heading') {
    return null;
  }
  return { node, pos };
}

function computeSections(doc: ProseMirrorNode) {
  const headings: Array<{ node: ProseMirrorNode; pos: number; level: number }> = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const level = Number(node.attrs.level ?? 1);
      headings.push({ node, pos, level });
      return false;
    }
    return undefined;
  });

  return headings.map((entry, index) => {
    const { node, pos, level } = entry;
    let nextPos = doc.content.size;
    for (let offset = index + 1; offset < headings.length; offset += 1) {
      const next = headings[offset];
      if (next.level <= level) {
        nextPos = next.pos;
        break;
      }
    }
    const contentFrom = pos + node.nodeSize;
    const contentTo = Math.max(contentFrom, nextPos);
    return { node, pos, level, contentFrom, contentTo };
  });
}

function buildCollapseDecorations(doc: ProseMirrorNode, editor: Editor) {
  const decorations: Decoration[] = [];
  const collapsedRanges: CollapsedRange[] = [];

  const sections = computeSections(doc);
  for (const section of sections) {
    const { node, pos, level, contentFrom, contentTo } = section;
    const collapsed = Boolean(node.attrs.collapsed);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `heading-collapse-toggle heading-toggle-level-${level}`;
    const actionLabel = collapsed ? 'Expand section' : 'Collapse section';
    toggle.setAttribute('aria-label', actionLabel);
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    const headingShortcut = getShortcutLabel('toggle-heading-collapse');
    toggle.title = headingShortcut ? `${actionLabel} (${headingShortcut})` : actionLabel;
    toggle.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      const commands = editor.commands as typeof editor.commands & CollapseCommandSet;
      commands.toggleHeadingCollapse({ pos });
      editor.commands.focus();
    });

    decorations.push(
      Decoration.widget(pos + 1, toggle, {
        side: -1,
        ignoreSelection: true,
      }),
    );

    if (collapsed) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'heading-is-collapsed',
        }),
      );

      if (contentFrom < contentTo) {
        collapsedRanges.push({ from: contentFrom, to: contentTo, headingPos: pos });
        doc.nodesBetween(contentFrom, contentTo, (child, childPos) => {
          decorations.push(
            Decoration.node(childPos, childPos + child.nodeSize, {
              class: 'heading-collapsed-content',
            }),
          );
          return false;
        });
      }
    }
  }

  return {
    decorations: DecorationSet.create(doc, decorations),
    collapsedRanges,
  };
}

function rebuildState(doc: ProseMirrorNode, editor: Editor): CollapsePluginState {
  return buildCollapseDecorations(doc, editor);
}

export const CollapsibleHeading = Heading.extend({
  addOptions() {
    return {
      ...this.parent?.(),
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes) => {
          if (!attributes.collapsed) {
            return {};
          }
          return { 'data-collapsed': 'true' };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      toggleHeadingCollapse:
        (options: ToggleOptions = {}) =>
        ({ state, dispatch }: { state: EditorState; dispatch?: (tr: Transaction) => void }) => {
          const target = findHeadingAtPos(state, options.pos) ?? findHeadingFromSelection(state);
          if (!target) {
            return false;
          }

          const { node, pos } = target;
          const currentCollapsed = Boolean(node.attrs.collapsed);
          const nextCollapsed =
            typeof options.collapsed === 'boolean' ? options.collapsed : !currentCollapsed;
          if (nextCollapsed === currentCollapsed) {
            return false;
          }

          if (!dispatch) {
            return true;
          }

          const tr = state.tr;
          if (typeof options.pos === 'number') {
            const selectionPos = Math.min(pos + 1, state.doc.content.size);
            tr.setSelection(TextSelection.create(state.doc, selectionPos));
          }
          tr.setNodeAttribute(pos, 'collapsed', nextCollapsed);
          dispatch(tr);
          if (nextCollapsed) {
            grammarlyStore.suppressForCollapse();
          }
          return true;
        },
      collapseHeadingAt:
        (pos?: number) =>
        ({ state, dispatch }: { state: EditorState; dispatch?: (tr: Transaction) => void }) => {
          const target = findHeadingAtPos(state, pos) ?? findHeadingFromSelection(state);
          if (!target) return false;
          if (target.node.attrs.collapsed) return false;
          if (!dispatch) return true;
          const tr = state.tr;
          if (typeof pos === 'number') {
            const selectionPos = Math.min(target.pos + 1, state.doc.content.size);
            tr.setSelection(TextSelection.create(state.doc, selectionPos));
          }
          tr.setNodeAttribute(target.pos, 'collapsed', true);
          dispatch(tr);
          grammarlyStore.suppressForCollapse();
          return true;
        },
      expandHeadingAt:
        (pos?: number) =>
        ({ state, dispatch }: { state: EditorState; dispatch?: (tr: Transaction) => void }) => {
          const target = findHeadingAtPos(state, pos) ?? findHeadingFromSelection(state);
          if (!target) return false;
          if (!target.node.attrs.collapsed) return false;
          if (!dispatch) return true;
          const tr = state.tr;
          if (typeof pos === 'number') {
            const selectionPos = Math.min(target.pos + 1, state.doc.content.size);
            tr.setSelection(TextSelection.create(state.doc, selectionPos));
          }
          tr.setNodeAttribute(target.pos, 'collapsed', false);
          dispatch(tr);
          return true;
        },
      ensureHeadingVisible:
        () =>
        ({ state, dispatch }: { state: EditorState; dispatch?: (tr: Transaction) => void }) => {
          const pluginState = headingCollapsePluginKey.getState(state);
          if (!pluginState) return false;
          const { from } = state.selection;
          const match = pluginState.collapsedRanges.find((range) => from >= range.from && from <= range.to);
          if (!match) return false;
          const node = state.doc.nodeAt(match.headingPos);
          if (!node || !node.attrs.collapsed) {
            return false;
          }
          if (!dispatch) return true;
          const tr = state.tr;
          tr.setNodeAttribute(match.headingPos, 'collapsed', false);
          dispatch(tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      'Mod-Alt-k': () => {
        const commands = this.editor.commands as typeof this.editor.commands & CollapseCommandSet;
        return commands.toggleHeadingCollapse();
      },
    };
  },

  addProseMirrorPlugins() {
    const parent = this.parent?.() ?? [];
    const editor = this.editor;
    const collapsePlugin = new Plugin<CollapsePluginState>({
      key: headingCollapsePluginKey,
      state: {
        init(_, state) {
          return rebuildState(state.doc, editor);
        },
        apply(tr: Transaction, value, oldState, newState) {
          let nextState: CollapsePluginState | null = null;
          if (tr.docChanged) {
            nextState = rebuildState(newState.doc, editor);
          } else if (!value) {
            nextState = rebuildState(newState.doc, editor);
          } else {
            nextState = {
              decorations: value.decorations.map(tr.mapping, tr.doc),
              collapsedRanges: value.collapsedRanges,
            };
          }
          if (value?.collapsedRanges.length && nextState?.collapsedRanges.length === 0) {
            grammarlyStore.releaseCollapseSuppression();
          }
          return nextState ?? rebuildState(newState.doc, editor);
        },
      },
      props: {
        decorations(state) {
          return headingCollapsePluginKey.getState(state)?.decorations ?? null;
        },
      },
    });

    return [...parent, collapsePlugin];
  },
});

export { headingCollapsePluginKey };
