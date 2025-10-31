import { render } from '@solidjs/testing-library';
import { describe, expect, it, beforeEach } from 'vitest';
import type { Editor as TiptapEditor } from '@tiptap/core';
import CodeEditor from '../../../src/components/CodeEditor';

function insertMarkdown(editor: TiptapEditor, markdown: string): void {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const rendered = editor.storage.markdown?.parser?.parse(normalized, { inline: false }) ?? normalized;
  editor.chain().focus().deleteSelection().insertContent(rendered).run();
}

describe('CodeEditor markdown paste', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders multi-line markdown into structured nodes', async () => {
    let current = '';
    const value = () => current;
    const handleChange = (next: string) => {
      current = next;
    };
    render(() => <CodeEditor value={value} onChange={handleChange} />);
    const editor = (window as typeof window & { __tiptapEditor?: TiptapEditor }).__tiptapEditor;
    expect(editor).toBeDefined();
    if (!editor) throw new Error('Editor not initialised');

    insertMarkdown(editor, '# Title\n\n- First\n- Second');

    await Promise.resolve();
    await Promise.resolve();

    expect(current).toContain('- First');
    const json = editor.getJSON();
    const nodeTypes = json.content?.map((node) => node.type) ?? [];
    expect(nodeTypes).toContain('heading');
    expect(nodeTypes).toContain('bulletList');
  });

  it('handles markdown with benign HTML wrappers', async () => {
    let current = '';
    const value = () => current;
    const handleChange = (next: string) => {
      current = next;
    };
    render(() => <CodeEditor value={value} onChange={handleChange} />);
    const editor = (window as typeof window & { __tiptapEditor?: TiptapEditor }).__tiptapEditor;
    expect(editor).toBeDefined();
    if (!editor) throw new Error('Editor not initialised');

    insertMarkdown(editor, '# Title\n\n- First\n- Second');

    await Promise.resolve();
    await Promise.resolve();

    expect(current).toContain('- First');
    const json = editor.getJSON();
    const nodeTypes = json.content?.map((node) => node.type) ?? [];
    expect(nodeTypes).toContain('heading');
    expect(nodeTypes).toContain('bulletList');
  });
});
