import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

describe('tiptap markdown roundtrip', () => {
  it('serializes headings as markdown', () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ link: false }),
        Markdown.configure({ html: false }),
      ],
      content: '',
    });

    editor.commands.setContent('### Title', { emitUpdate: false });

    const value = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown();

    expect(value).toBe('### Title');
    editor.destroy();
  });
});
