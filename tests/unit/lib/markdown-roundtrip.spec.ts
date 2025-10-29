import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { normalizeSerializedMarkdown } from '../../../src/lib/markdown';

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

  it('roundtrips front matter and headings via normalization', () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          link: false,
          heading: { levels: [1, 2, 3, 4, 5, 6] },
        }),
        Markdown.configure({
          html: true,
          transformPastedText: true,
          transformCopiedText: true,
          breaks: true,
          tightLists: true,
        }),
      ],
      content: '',
    });

    const sample = "+++\ndate = '2025-10-29T00:01:01-04:00'\ndraft = true\ntitle = 'First'\n+++\n\n### This is going to be the first";

    editor.commands.setContent(sample, {
      emitUpdate: false,
      parseOptions: { preserveWhitespace: 'full' },
    });

    const value = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ?? '';
    expect(normalizeSerializedMarkdown(value)).toBe(sample);
    editor.destroy();
  });
});
