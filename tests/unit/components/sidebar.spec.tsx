import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import Sidebar from '../../../src/components/Sidebar';
import { workspaceStore } from '../../../src/state/workspace';
import { vaultStore } from '../../../src/state/vault';
import { setSidebarCollapsed } from '../../../src/state/ui';
import { deleteNote, renameNote } from '../../../src/platform/note-manager';

vi.mock('../../../src/platform/note-manager', () => ({
  createNote: vi.fn(),
  deleteNote: vi.fn().mockResolvedValue(undefined),
  renameNote: vi.fn(),
}));

describe('Sidebar', () => {
  beforeEach(() => {
    workspaceStore.setMode('browser');
    setSidebarCollapsed(false);
    vaultStore.reset();
    vi.mocked(renameNote).mockResolvedValue({ status: 'renamed', path: 'note-a.md' });
  });

  afterEach(() => {
    vaultStore.reset();
    workspaceStore.reset();
    setSidebarCollapsed(false);
    vi.clearAllMocks();
  });

  it('collapses when the control is activated', () => {
    render(() => <Sidebar />);

    const collapseButton = screen.getByRole('button', { name: /Collapse vault sidebar/i });
    fireEvent.click(collapseButton);

    expect(document.documentElement.dataset.sidebarCollapsed).toBe('true');
  });

  it('shows a delete control only for the selected note', () => {
    const now = Date.now();
    vaultStore.setNotes([
      { path: 'note-a.md', title: 'Note A', lastModified: now },
      { path: 'note-b.md', title: 'Note B', lastModified: now },
    ]);
    vaultStore.select('note-a.md');

    render(() => <Sidebar />);

    expect(screen.getByLabelText('Delete Note A')).toBeInTheDocument();
    expect(screen.queryByLabelText('Delete Note B')).not.toBeInTheDocument();
  });

  it('confirms before deleting the active note', async () => {
    const now = Date.now();
    vaultStore.setNotes([{ path: 'note-a.md', title: 'Note A', lastModified: now }]);
    vaultStore.select('note-a.md');

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(() => <Sidebar />);

    const deleteButton = screen.getByLabelText('Delete Note A');
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Delete "Note A"?');
    await Promise.resolve();
    expect(deleteNote).toHaveBeenCalledWith('note-a.md');

    confirmSpy.mockRestore();
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const now = Date.now();
    vaultStore.setNotes([{ path: 'note-a.md', title: 'Note A', lastModified: now }]);
    vaultStore.select('note-a.md');

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(() => <Sidebar />);

    const deleteButton = screen.getByLabelText('Delete Note A');
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    await Promise.resolve();
    expect(deleteNote).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('renders nested folders collapsed by default', () => {
    const now = Date.now();
    vaultStore.setNotes([{ path: 'projects/atlas/spec.md', title: 'Spec', lastModified: now }]);

    render(() => <Sidebar />);

    expect(screen.getByRole('button', { name: 'Toggle folder projects' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle folder atlas' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle folder projects' }));
    expect(screen.getByRole('button', { name: 'Toggle folder atlas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Spec' })).not.toBeInTheDocument();
  });

  it('expands folders when toggled', () => {
    const now = Date.now();
    vaultStore.setNotes([{ path: 'projects/atlas/spec.md', title: 'Spec', lastModified: now }]);

    render(() => <Sidebar />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle folder projects' }));
    const atlasFolder = screen.getByRole('button', { name: 'Toggle folder atlas' });
    fireEvent.click(atlasFolder);

    expect(screen.getByRole('button', { name: 'Spec' })).toBeInTheDocument();

    fireEvent.click(atlasFolder);
    expect(screen.queryByRole('button', { name: 'Spec' })).not.toBeInTheDocument();
  });
});

describe('Sidebar inline rename', () => {
  const setupNotes = () => {
    const now = Date.now();
    vaultStore.setNotes([{ path: 'note-a.md', title: 'Note A', lastModified: now }]);
    vaultStore.select('note-a.md');
  };

  beforeEach(() => {
    workspaceStore.setMode('browser');
    setSidebarCollapsed(false);
    vaultStore.reset();
    setupNotes();
    vi.mocked(renameNote).mockResolvedValue({ status: 'renamed', path: 'note-a.md' });
  });

  afterEach(() => {
    vaultStore.reset();
    workspaceStore.reset();
    setSidebarCollapsed(false);
    vi.clearAllMocks();
  });

  it('enters inline rename on double click', () => {
    render(() => <Sidebar />);

    const noteButton = screen.getByRole('button', { name: 'Note A' });
    fireEvent.dblClick(noteButton);

    expect(screen.getByLabelText('Rename Note A')).toBeInTheDocument();
  });

  it('commits inline rename on Enter', async () => {
    render(() => <Sidebar />);

    const noteButton = screen.getByRole('button', { name: 'Note A' });
    fireEvent.dblClick(noteButton);

    const renameInput = screen.getByLabelText('Rename Note A');
    fireEvent.input(renameInput, { target: { value: 'Renamed Title' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    await waitFor(() => {
      expect(renameNote).toHaveBeenCalledWith('note-a.md', 'Renamed Title');
    });

    await waitFor(() => {
      expect(screen.queryByLabelText('Rename Note A')).not.toBeInTheDocument();
    });
  });

  it('cancels inline rename on Escape', async () => {
    render(() => <Sidebar />);

    const noteButton = screen.getByRole('button', { name: 'Note A' });
    fireEvent.dblClick(noteButton);

    const renameInput = screen.getByLabelText('Rename Note A');
    fireEvent.keyDown(renameInput, { key: 'Escape' });

    await Promise.resolve();

    expect(renameNote).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Rename Note A')).not.toBeInTheDocument();
  });
});
