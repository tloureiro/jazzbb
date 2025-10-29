/* eslint-disable solid/reactivity */
import { onCleanup, onMount, createEffect } from 'solid-js';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { lowlight } from '../lib/syntax';
import { editorStore } from '../state/editor';
import EmojiSuggestionExtension from '../extensions/emojiSuggestion';

type CodeEditorProps = {
  value: () => string;
  onChange: (value: string) => void;
};

type MarkdownStorage = {
  markdown?: {
    getMarkdown: () => string;
  };
};

function readMarkdown(instance: Editor): string {
  const storage = instance.storage as MarkdownStorage;
  const value = storage.markdown?.getMarkdown();
  if (typeof value === 'string') {
    return value;
  }
  return instance.getText({ blockSeparator: '\n\n' });
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
          transformCopiedText: true,
          breaks: true,
          tightLists: true,
        }),
        EmojiSuggestionExtension,
      ],
      editorProps: {
        attributes: {
          class: 'tiptap-editor',
          spellcheck: 'true',
          'aria-label': 'Markdown editor',
        },
      },
      content: props.value(),
      onUpdate: ({ editor: instance }) => {
        props.onChange(readMarkdown(instance));
        editorStore.updateSelectionHeading();
      },
    });

    queueMicrotask(() => {
      editor?.commands.focus('end');
      editorStore.updateSelectionHeading();
    });

    if (editor) {
      const instance = editor;
      editorStore.registerEditor(instance);
      const handleSelectionUpdate = () => editorStore.updateSelectionHeading();
      instance.on('selectionUpdate', handleSelectionUpdate);
      instance.on('transaction', handleSelectionUpdate);
      onCleanup(() => {
        instance.off('selectionUpdate', handleSelectionUpdate);
        instance.off('transaction', handleSelectionUpdate);
      });
    }
  });

  createEffect(() => {
    if (!editor) return;
    const incoming = props.value();
    const current = readMarkdown(editor);
    if (incoming !== current) {
      editor.commands.setContent(incoming, { emitUpdate: false, parseOptions: { preserveWhitespace: 'full' } });
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
