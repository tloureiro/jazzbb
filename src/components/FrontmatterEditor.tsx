import { createEffect, onCleanup, onMount, type Accessor, type Component } from 'solid-js';
import { EditorState, StateField, RangeSetBuilder } from '@codemirror/state';
import { EditorView, keymap, highlightSpecialChars, drawSelection, highlightActiveLine, Decoration, DecorationSet } from '@codemirror/view';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, syntaxTree } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { yaml } from '@codemirror/lang-yaml';
import { normalizeFrontmatterContent } from '../lib/frontmatter';

type FrontmatterEditorProps = {
  value: Accessor<string>;
  onChange: (value: string) => void;
};

const FrontmatterEditor: Component<FrontmatterEditorProps> = (props) => {
  let containerRef!: HTMLDivElement;
  let view: EditorView | undefined;
  // eslint-disable-next-line solid/reactivity
  const changeHandler = props.onChange;

const highlightStyle = HighlightStyle.define([
    { tag: tags.attributeName, class: 'cm-yaml-key' },
    { tag: tags.atom, class: 'cm-yaml-key' },
    { tag: tags.literal, class: 'cm-yaml-key' },
    { tag: tags.number, class: 'cm-yaml-number' },
    { tag: tags.bool, class: 'cm-yaml-number' },
    { tag: tags.string, class: 'cm-yaml-string' },
    { tag: tags.meta, class: 'cm-yaml-meta' },
    { tag: tags.comment, class: 'cm-yaml-comment' },
    { tag: tags.punctuation, class: 'cm-yaml-punctuation' },
]);

function buildYamlDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const text = line.text;
    const trimmed = text.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      builder.add(line.from, line.to, Decoration.mark({ class: 'cm-yaml-comment' }));
      continue;
    }
    const match = text.match(/^(\s*)([^:#]+)(:)(.*)$/);
    if (!match) continue;
    const [, indent, key, colon, rest] = match;
    const keyStart = line.from + indent.length;
    const keyEnd = keyStart + key.length;
    builder.add(keyStart, keyEnd, Decoration.mark({ class: 'cm-yaml-key' }));
    let valueSegment = rest;
    const commentIndex = rest.indexOf('#');
    if (commentIndex >= 0) {
      const commentStart = line.from + indent.length + key.length + colon.length + commentIndex;
      builder.add(commentStart, line.to, Decoration.mark({ class: 'cm-yaml-comment' }));
      valueSegment = rest.slice(0, commentIndex);
    }
    const value = valueSegment.trim();
    if (!value) {
      continue;
    }
    const valueOffset = valueSegment.length - valueSegment.trimStart().length;
    const valueStart = keyEnd + colon.length + valueOffset;
    const valueEnd = valueStart + value.length;
    const decoration = (() => {
      if (/^(true|false)$/i.test(value)) {
        return Decoration.mark({ class: 'cm-yaml-number' });
      }
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        return Decoration.mark({ class: 'cm-yaml-number' });
      }
      if (/^!/.test(value)) {
        return Decoration.mark({ class: 'cm-yaml-meta' });
      }
      return Decoration.mark({ class: 'cm-yaml-string' });
    })();
    builder.add(valueStart, valueEnd, decoration);
  }
  return builder.finish();
}

const yamlDecorations = StateField.define<DecorationSet>({
  create(state) {
    return buildYamlDecorations(state);
  },
  update(deco, tr) {
    if (!tr.docChanged) {
      return deco.map(tr.changes);
    }
    return buildYamlDecorations(tr.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const theme = EditorView.theme(
    {
      '&': {
        borderRadius: 'var(--radius-sm)',
        background: 'color-mix(in srgb, var(--color-surface-strong) 92%, transparent)',
      },
      '.cm-scroller': {
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
        fontSize: '0.95rem',
        lineHeight: '1.45',
        padding: '0.6rem 0.8rem',
        overflow: 'auto',
      },
      '.cm-content': {
        whiteSpace: 'pre-wrap',
        padding: '0',
      },
      '.cm-gutters': {
        display: 'none',
      },
      '.cm-lineNumbers': {
        display: 'none',
      },
      '&.cm-editor.cm-focused': {
        outline: '1px solid var(--color-accent)',
      },
      '.cm-activeLine': {
        backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground': {
        backgroundColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)',
      },
    },
    { dark: true },
  );

  const emitChange = (doc: string) => changeHandler(normalizeFrontmatterContent(doc));

  const extensions = [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    yaml(),
    syntaxHighlighting(highlightStyle),
    yamlDecorations,
    theme,
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        emitChange(update.state.doc.toString());
      }
    }),
  ];

  onMount(() => {
    const state = EditorState.create({
      doc: props.value(),
      extensions,
    });
    view = new EditorView({
      state,
      parent: containerRef,
    });
    if (typeof window !== 'undefined') {
      const runtime = window as typeof window & {
        __frontmatterEditorView?: EditorView;
        __frontmatterDebugNodes?: () => Array<{ name: string; text: string }>;
      };
      runtime.__frontmatterEditorView = view;
      runtime.__frontmatterDebugNodes = () => {
        const instance = view;
        if (!instance) return [];
        const nodes: Array<{ name: string; text: string }> = [];
        const tree = syntaxTree(instance.state);
        tree.iterate({
          enter(node) {
            if (node.type.isAnonymous) return undefined;
            nodes.push({
              name: node.type.name,
              text: instance.state.doc.sliceString(node.from, node.to),
            });
            return undefined;
          },
        });
        return nodes;
      };
    }
    queueMicrotask(() => view?.focus());
  });

  createEffect(() => {
    const next = props.value();
    if (!view) return;
    const current = view.state.doc.toString();
    if (next !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: next },
      });
    }
  });

  onCleanup(() => {
    if (typeof window !== 'undefined') {
      const runtime = window as typeof window & {
        __frontmatterEditorView?: EditorView;
        __frontmatterDebugNodes?: () => Array<{ name: string; text: string }>;
      };
      if (runtime.__frontmatterEditorView === view) {
        delete runtime.__frontmatterEditorView;
      }
      if (runtime.__frontmatterDebugNodes) {
        delete runtime.__frontmatterDebugNodes;
      }
    }
    view?.destroy();
    view = undefined;
  });

  return (
    <div class="frontmatter-editor" data-test="frontmatter-editor">
      <div class="frontmatter-editor__header">
        <p>Frontmatter</p>
        <span>YAML</span>
      </div>
      <div class="frontmatter-editor__cm" ref={(node) => (containerRef = node ?? containerRef)} />
    </div>
  );
};

export default FrontmatterEditor;
