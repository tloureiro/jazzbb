import { render } from '@solidjs/testing-library';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import EditorPane from '../../../src/components/EditorPane';
import { editorStore } from '../../../src/state/editor';
import { vaultStore } from '../../../src/state/vault';
import { workspaceStore } from '../../../src/state/workspace';

vi.mock('../../../src/components/CodeEditor', () => ({
  __esModule: true,
  default: (props: { value: () => string; onChange: (value: string) => void }) => (
    <textarea
      data-testid="code-editor"
      value={props.value()}
      onInput={(event) => props.onChange(event.currentTarget.value)}
    />
  ),
}));

vi.mock('../../../src/platform/parser-service', () => ({
  parseNote: vi.fn().mockResolvedValue({ html: '<p>draft</p>', title: 'Draft', links: [], headings: [], lastModified: Date.now() }),
}));

vi.mock('../../../src/platform/save-note', () => ({
  saveActiveNote: vi.fn().mockResolvedValue({ status: 'saved' }),
}));

vi.mock('../../../src/platform/note-manager', () => ({
  renameNote: vi.fn().mockResolvedValue({ status: 'renamed', path: 'note.md' }),
}));

import { parseNote } from '../../../src/platform/parser-service';
import { saveActiveNote } from '../../../src/platform/save-note';
import { renameNote } from '../../../src/platform/note-manager';

describe('EditorPane', () => {
  beforeEach(() => {
    editorStore.reset();
    vaultStore.reset();
    workspaceStore.reset();
    vi.mocked(parseNote).mockClear();
    vi.mocked(saveActiveNote).mockClear();
    vi.mocked(renameNote).mockClear();
  });

  it('shows scratch state when no note is selected', () => {
    const { getByDisplayValue, getByTestId } = render(() => <EditorPane />);
    expect(getByDisplayValue('Scratch note')).toBeInTheDocument();
    expect(getByTestId('code-editor')).toBeInTheDocument();
  });

  it('renders markdown output even without an active note', async () => {
    vi.useFakeTimers();

    const { getByTestId } = render(() => <EditorPane />);
    const editor = getByTestId('code-editor') as HTMLTextAreaElement;

    editor.value = '### A';
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    await vi.advanceTimersByTimeAsync(200);

    expect(parseNote).not.toHaveBeenCalled();
    expect(editorStore.html()).toContain('<h3>A</h3>');

    vi.useRealTimers();
  });

  it('renders sanitized markdown content', () => {
    vaultStore.select('note.md');
    editorStore.setDocument('note.md', '**bold** <script>alert(1)</script>', '<p><strong>bold</strong></p>', [], [], Date.now());

    render(() => <EditorPane />);

    expect(editorStore.html()).toBe('<p><strong>bold</strong></p>');
  });

  it('shows rendered markdown in the live preview as the user types', async () => {
    vi.useFakeTimers();

    const now = Date.now();
    vaultStore.select('note.md');
    editorStore.setDocument('note.md', '', '', [], [], now);

    vi.mocked(parseNote).mockResolvedValueOnce({
      html: '<h3>Test</h3>',
      title: 'Test',
      links: [],
      headings: [{ id: 'test', text: 'Test', level: 3, line: 1 }],
      lastModified: now,
    });

    const { getByTestId } = render(() => <EditorPane />);
    const editor = getByTestId('code-editor') as HTMLTextAreaElement;

    editor.value = '### Test';
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    await vi.advanceTimersByTimeAsync(200);
    await Promise.resolve();

    expect(vi.mocked(parseNote)).toHaveBeenCalledWith('### Test', expect.objectContaining({ path: 'note.md' }));
    expect(editorStore.html()).toContain('<h3>Test</h3>');

    vi.useRealTimers();
  });

  it('autosaves after inactivity when changes exist', async () => {
    vi.useFakeTimers();

    workspaceStore.setMode('vault');
    vaultStore.select('note.md');
    editorStore.setDocument('note.md', 'Initial', '<p>Initial</p>', [], [], Date.now());

    const { getByTestId } = render(() => <EditorPane />);
    const editor = getByTestId('code-editor') as HTMLTextAreaElement;

    editor.value = 'Updated note';
    editor.dispatchEvent(new Event('input', { bubbles: true }));

    await vi.advanceTimersByTimeAsync(2100);

    expect(saveActiveNote).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
