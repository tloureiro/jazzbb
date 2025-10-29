import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchPanel from '../../../src/components/SearchPanel';

vi.mock('../../../src/platform/search-service', () => ({
  searchDocuments: vi.fn(),
}));

vi.mock('../../../src/platform/note-reader', () => ({
  openNote: vi.fn(),
}));

import { searchDocuments } from '../../../src/platform/search-service';
import { openNote } from '../../../src/platform/note-reader';

describe('SearchPanel', () => {
beforeEach(() => {
  vi.mocked(searchDocuments).mockReset();
  vi.mocked(openNote).mockReset();
  vi.mocked(openNote).mockResolvedValue();
});

  it('shows results returned by the search service', async () => {
    vi.mocked(searchDocuments).mockResolvedValue([
      { path: 'note.md', title: 'Note', snippet: 'Snippet' },
    ]);

    const { getByPlaceholderText, findByRole } = render(() => <SearchPanel onClose={vi.fn()} />);

    const input = getByPlaceholderText('Search notes...') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'note' } });

    expect(await findByRole('button', { name: /Note/i })).toBeInTheDocument();
  });

  it('opens note and closes when a result is clicked', async () => {
    const onClose = vi.fn();
    vi.mocked(searchDocuments).mockResolvedValue([
      { path: 'note.md', title: 'Note', snippet: 'Snippet' },
    ]);

    const { getByPlaceholderText, findByRole } = render(() => <SearchPanel onClose={onClose} />);
    const input = getByPlaceholderText('Search notes...') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'note' } });

    const button = await findByRole('button', { name: /Note/i });
    await fireEvent.click(button);

    await waitFor(() => {
      expect(openNote).toHaveBeenCalledWith('note.md');
      expect(onClose).toHaveBeenCalled();
    });
  });
});
