import { render } from '@solidjs/testing-library';
import { describe, expect, beforeEach, it, vi, afterAll } from 'vitest';
import InspectorPane from '../../../src/components/InspectorPane';
import { vaultStore } from '../../../src/state/vault';
import { editorStore } from '../../../src/state/editor';

const toLocaleStringMock = vi.spyOn(Date.prototype, 'toLocaleString');

afterAll(() => {
  toLocaleStringMock.mockRestore();
});

describe('InspectorPane', () => {
  beforeEach(() => {
    vaultStore.reset();
    editorStore.reset();
    toLocaleStringMock.mockReturnValue('2024-07-04 10:00');
  });

  it('shows metadata about the selected note', () => {
    const lastModified = Date.UTC(2024, 6, 4, 10, 0, 0);
    vaultStore.setNotes([
      { path: 'docs/note.md', title: 'Note title', lastModified },
    ]);
    vaultStore.setCache('docs/note.md', {
      html: '<h1>Note title</h1>',
      links: ['refs/other.md'],
      headings: [{ id: 'note-title', text: 'Note title', level: 1, line: 1 }],
      content: '# Note title',
      lastModified,
    });
    vaultStore.select('docs/note.md');

    editorStore.setDocument(
      'docs/note.md',
      '# Note title\n\n- [x] done\n- [ ] todo',
      '<h1>Note title</h1>',
      ['link.md'],
      [{ id: 'note-title', text: 'Note title', level: 1, line: 1 }],
      lastModified,
    );

    editorStore.setDraft('# Note title\n\n- [x] done\n- [ ] todo\nExtra line');

    const { getByText } = render(() => <InspectorPane />);

    expect(getByText('Title').nextElementSibling?.textContent).toBe('Note title');
    expect(getByText('Unsaved changes').nextElementSibling?.textContent).toBe('Yes');
    expect(getByText('Words').nextElementSibling?.textContent).toBe('6');
    expect(getByText('Headings').nextElementSibling?.textContent).toBe('1');
    expect(getByText('Tasks').nextElementSibling?.textContent).toBe('1 / 2');
    expect(getByText('Outgoing links').nextElementSibling?.textContent).toBe('1');
    expect(getByText('Last modified').nextElementSibling?.textContent).toBe('2024-07-04 10:00');
  });

  it('shows empty state when nothing is selected', () => {
    const { getByText } = render(() => <InspectorPane />);
    expect(getByText('Select a note to inspect metadata.')).toBeInTheDocument();
  });
});
