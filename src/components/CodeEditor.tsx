/* eslint-disable solid/reactivity */
import { onCleanup, onMount, createEffect } from 'solid-js';
import { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DOMParser as ProseMirrorDOMParser, DOMSerializer, Slice } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Extension } from '@tiptap/core';
import { lowlight } from '../lib/syntax';
import { normalizeSerializedMarkdown, renderMarkdown } from '../lib/markdown';
import { editorStore } from '../state/editor';
import { grammarChecksStore } from '../state/grammarChecks';
import EmojiSuggestionExtension from '../extensions/emojiSuggestion';
import { CollapsibleHeading } from '../extensions/collapsibleHeading';
import { deleteCurrentLine } from '../lib/editorShortcuts';
import type { EditorView } from '@tiptap/pm/view';
import type { ResolvedPos } from '@tiptap/pm/model';

type CodeEditorProps = {
  value: () => string;
  onChange: (value: string) => void;
};

type MarkdownStorage = {
  markdown?: {
    getMarkdown: () => string;
    serializer?: {
      serialize: (content: unknown) => string;
    };
  };
};

function readMarkdown(instance: Editor): string {
  const storage = instance.storage as MarkdownStorage;
  const value = storage.markdown?.getMarkdown();
  if (typeof value === 'string') {
    return value;
  }
  return instance.getText({ blockSeparator: '\n' });
}

const BLOCK_MARKDOWN_PATTERN =
  /(^|\n)\s*(#{1,6}\s|\d+\.\s|[-+*]\s+|>\s|```|~~~| {0,3}(?:\*\s*\*\s*\*|-{3,}|_{3,}))/;
const MULTI_PARAGRAPH_PATTERN = /\n{2,}/;
const CLIPBOARD_PARAGRAPH_SPLIT = /(?:\r\n?|\n)+/;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function looksLikeBlockMarkdown(value: string): boolean {
  const normalized = normalizeLineEndings(value);
  if (!normalized.includes('\n')) {
    return false;
  }
  return BLOCK_MARKDOWN_PATTERN.test(normalized) || MULTI_PARAGRAPH_PATTERN.test(normalized);
}

type PasteMode = 'markdown' | 'plain-fallback' | 'single-heading' | 'html' | 'plain';

function recordPasteMode(mode: PasteMode): void {
  if (typeof window === 'undefined') return;
  (window as typeof window & { __jazzbbLastPasteMode?: PasteMode }).__jazzbbLastPasteMode = mode;
}

function bumpPasteCount(): void {
  if (typeof window === 'undefined') return;
  const globalWindow = window as typeof window & { __jazzbbPasteCount?: number };
  globalWindow.__jazzbbPasteCount = (globalWindow.__jazzbbPasteCount ?? 0) + 1;
}

const markdownPastePluginKey = new PluginKey('markdownPasteHandler');

function parsePlainTextWithDefaults(view: EditorView, context: ResolvedPos, text: string): Slice {
  const normalized = text ?? '';
  if (!normalized) {
    return Slice.empty;
  }

  const { schema } = view.state;
  const parser =
    view.someProp('clipboardParser') || view.someProp('domParser') || ProseMirrorDOMParser.fromSchema(schema);
  const serializer = DOMSerializer.fromSchema(schema);
  const dom = document.createElement('div');
  const marks = context.marks();

  normalized.split(CLIPBOARD_PARAGRAPH_SPLIT).forEach((block) => {
    const paragraph = dom.appendChild(document.createElement('p'));
    if (!block) return;
    const textNode = schema.text(block, marks);
    paragraph.appendChild(serializer.serializeNode(textNode));
  });

  return parser.parseSlice(dom, {
    preserveWhitespace: true,
    context,
  });
}

const MarkdownPasteHandler = Extension.create({
  name: 'markdownPasteHandler',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: markdownPastePluginKey,
        props: {
          clipboardTextParser(text, context, plainText, view) {
            bumpPasteCount();

            const normalized = normalizeLineEndings(text ?? '');
            const fallback = () => parsePlainTextWithDefaults(view, context, normalized);

            if (!normalized) {
              recordPasteMode('plain');
              return fallback();
            }

            const isFrontMatter = normalized.startsWith('+++') || normalized.startsWith('---');
            if (isFrontMatter) {
              const lines = normalized.split('\n').map(escapeHtml);
              const html = `<p>${lines.join('<br>')}</p>`;
              const template = document.createElement('template');
              template.innerHTML = html;
              recordPasteMode('markdown');
              return ProseMirrorDOMParser.fromSchema(editor.schema).parseSlice(template.content, {
                preserveWhitespace: true,
                context,
              });
            }

            let rendered: string;
            try {
              rendered = renderMarkdown(normalized);
            } catch (error) {
              console.error('Failed to render pasted markdown', error);
              recordPasteMode('plain-fallback');
              return fallback();
            }

            const template = document.createElement('template');
            template.innerHTML = rendered;

            const slice = ProseMirrorDOMParser.fromSchema(editor.schema).parseSlice(template.content, {
              preserveWhitespace: true,
              context,
            });

            const blockLike = looksLikeBlockMarkdown(normalized);
            recordPasteMode(blockLike ? 'markdown' : 'plain');
            return slice;
          },
        },
      }),
    ];
  },
});

export function CodeEditor(props: CodeEditorProps) {
  let containerRef!: HTMLDivElement;
  let editor: Editor | undefined;

  onMount(() => {
    editor = new Editor({
      element: containerRef,
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          link: false,
          heading: false,
          hardBreak: false,
        }),
        CollapsibleHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
        CodeBlockLowlight.configure({
          lowlight,
          HTMLAttributes: { class: 'tiptap-code-block hljs' },
        }),
        Placeholder.configure({ placeholder: 'Start typing...' }),
        Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
        TaskList.configure({ HTMLAttributes: { class: 'tiptap-task-list' } }),
        TaskItem.configure({ nested: true, HTMLAttributes: { class: 'tiptap-task-item' } }),
        MarkdownPasteHandler,
        Markdown.configure({
          html: true,
          transformPastedText: true,
          transformCopiedText: false,
          breaks: true,
          tightLists: true,
        }),
        EmojiSuggestionExtension,
        Extension.create({
          name: 'deleteLineShortcut',
          addKeyboardShortcuts() {
            return {
              'Mod-d': () => deleteCurrentLine(this.editor),
            };
          },
        }),
      ],
      editorProps: {
        attributes: {
          class: 'tiptap-editor',
          spellcheck: 'true',
          'aria-label': 'Markdown editor',
          'data-grammarly': 'false',
        },
      },
      content: normalizeSerializedMarkdown(props.value()),
      onUpdate: ({ editor: instance }) => {
        const currentRaw = readMarkdown(instance);
        const normalized = normalizeSerializedMarkdown(currentRaw);
        props.onChange(normalized);
        editorStore.updateSelectionHeading();
      },
    });

    createEffect(() => {
      const enabled = grammarChecksStore.isGrammarChecksEnabled();
      if (editor && editor.view?.dom) {
        editor.view.dom.setAttribute('spellcheck', enabled ? 'true' : 'false');
      }
    });

    queueMicrotask(() => {
      editor?.commands.focus('end');
      editorStore.updateSelectionHeading();
    });

    if (editor) {
      const instance = editor;
      const storage = (instance.storage as MarkdownStorage).markdown;
      const handleCopy = (event: ClipboardEvent) => {
        const clipboard = event.clipboardData;
        const serializer = storage?.serializer;
        if (!clipboard || !serializer) return;

        const slice = instance.state.selection.content();
        if (slice.size === 0) return;

        const raw = serializer.serialize(slice.content);
        const normalized = normalizeSerializedMarkdown(raw);
        event.preventDefault();
        clipboard.setData('text/plain', normalized);
        clipboard.setData('text/markdown', normalized);
      };

      instance.view.dom.addEventListener('copy', handleCopy);
      if (typeof window !== 'undefined') {
        (window as typeof window & { __tiptapEditor?: Editor }).__tiptapEditor = instance;
      }
      editorStore.registerEditor(instance);
      const handleSelectionUpdate = () => editorStore.updateSelectionHeading();
      instance.on('selectionUpdate', handleSelectionUpdate);
      onCleanup(() => {
        instance.off('selectionUpdate', handleSelectionUpdate);
        instance.view.dom.removeEventListener('copy', handleCopy);
      });
    }
  });

  createEffect(() => {
    if (!editor) return;
    const normalizedIncoming = normalizeSerializedMarkdown(props.value());
    const currentRaw = readMarkdown(editor);
    const normalizedCurrent = normalizeSerializedMarkdown(currentRaw);
    if (normalizedIncoming !== normalizedCurrent) {
      editor.commands.setContent(normalizedIncoming, {
        emitUpdate: false,
        parseOptions: { preserveWhitespace: 'full' },
      });
      editorStore.updateSelectionHeading();
    }
  });

  onCleanup(() => {
    editorStore.unregisterEditor();
    editor?.destroy();
  });

  return <div class="code-editor" ref={containerRef} />;
}

export default CodeEditor;
