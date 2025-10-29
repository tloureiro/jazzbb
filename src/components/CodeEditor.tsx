/* eslint-disable solid/reactivity */
import { onCleanup, onMount, createEffect } from 'solid-js';
import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Extension } from '@tiptap/core';
import { lowlight } from '../lib/syntax';
import { normalizeSerializedMarkdown } from '../lib/markdown';
import { editorStore } from '../state/editor';
import EmojiSuggestionExtension from '../extensions/emojiSuggestion';
import { deleteCurrentLine } from '../lib/editorShortcuts';

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
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          hardBreak: false,
        }),
        CodeBlockLowlight.configure({
          lowlight,
          HTMLAttributes: { class: 'tiptap-code-block hljs' },
        }),
        Placeholder.configure({ placeholder: 'Start typing...' }),
        Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
        TaskList.configure({ HTMLAttributes: { class: 'tiptap-task-list' } }),
        TaskItem.configure({ nested: true, HTMLAttributes: { class: 'tiptap-task-item' } }),
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

      let applyingHeadingFix = false;
      const applyHeadingFix = () => {
        if (applyingHeadingFix) return;
        const { state, view } = instance;
        const { schema } = state;
        const replacements: Array<{ from: number; to: number; level: number; content: string }> = [];
        state.doc.descendants((node, pos) => {
          if (node.type !== schema.nodes.paragraph) return;
          const text = node.textContent ?? '';
          const match = text.match(/^(#{1,6})\s+(.*)$/);
          if (!match) return;
          replacements.push({
            from: pos,
            to: pos + node.nodeSize,
            level: Math.min(match[1].length, 6),
            content: match[2] ?? '',
          });
        });

        if (replacements.length === 0) return;

        let tr = state.tr;
        for (const replacement of replacements) {
          const headingNode = schema.nodes.heading.create(
            { level: replacement.level },
            replacement.content ? schema.text(replacement.content) : undefined,
          );
          tr = tr.replaceWith(replacement.from, replacement.to, headingNode);
        }

        const nextDoc = tr.doc;
        const pos = Math.min(state.selection.from, nextDoc.content.size);
        tr = tr.setSelection(TextSelection.create(nextDoc, pos));
        applyingHeadingFix = true;
        view.dispatch(tr);
        applyingHeadingFix = false;
      };

      const handlePaste = (event: ClipboardEvent) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return;
        const plain = clipboard.getData('text/plain');
        if (!plain) return;

        const trimmed = plain.trim();
        const lines = trimmed.split(/\r?\n/);
        if (lines.length === 1) {
          const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
          if (match) {
            event.preventDefault();
            const level = Math.min(match[1].length, 6);
            const content = match[2];
            instance
              .chain()
              .focus()
              .insertContent({
                type: 'heading',
                attrs: { level },
                content: content ? [{ type: 'text', text: content }] : [],
              })
              .run();
            return;
          }
        }
      };

      instance.view.dom.addEventListener('copy', handleCopy);
      instance.view.dom.addEventListener('paste', handlePaste);
      instance.view.dom.addEventListener('input', applyHeadingFix);
      if (typeof window !== 'undefined') {
        (window as typeof window & { __tiptapEditor?: Editor }).__tiptapEditor = instance;
      }
      editorStore.registerEditor(instance);
      const handleSelectionUpdate = () => editorStore.updateSelectionHeading();
      instance.on('selectionUpdate', handleSelectionUpdate);
      instance.on('transaction', () => {
        handleSelectionUpdate();
        applyHeadingFix();
      });
      onCleanup(() => {
        instance.off('selectionUpdate', handleSelectionUpdate);
        instance.off('transaction', handleSelectionUpdate);
        instance.view.dom.removeEventListener('copy', handleCopy);
        instance.view.dom.removeEventListener('paste', handlePaste);
        instance.view.dom.removeEventListener('input', applyHeadingFix);
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
