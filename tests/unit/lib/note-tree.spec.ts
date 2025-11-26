import { describe, it, expect } from 'vitest';
import type { NoteMeta } from '../../../src/state/vault';
import { buildNoteTree, getNoteDisplayName } from '../../../src/lib/note-tree';

const sampleNotes: NoteMeta[] = [
  { path: 'alpha.md', title: 'Alpha', lastModified: 100 },
  { path: 'projects/atlas/spec.md', title: 'Atlas Spec', lastModified: 200 },
  { path: 'projects/atlas/todos.md', title: 'Todos', lastModified: 150 },
  { path: 'projects/zenith/README.md', title: '', lastModified: 50 },
];

describe('note-tree', () => {
  it('builds nested folders for notes', () => {
    const tree = buildNoteTree(sampleNotes, 'name');
    const rootChildren = tree.children;
    const folder = rootChildren.find((node) => node.type === 'folder' && node.name === 'projects');
    expect(folder?.children).toHaveLength(2);
    if (folder?.type !== 'folder') throw new Error('Missing projects folder');
    const atlas = folder.children.find((child) => child.type === 'folder' && child.name === 'atlas');
    expect(atlas?.type).toBe('folder');
    if (atlas?.type !== 'folder') throw new Error('Missing atlas folder');
    expect(atlas.children.filter((child) => child.type === 'note')).toHaveLength(2);
  });

  it('sorts folders alphabetically when sorted by name', () => {
    const tree = buildNoteTree(sampleNotes, 'name');
    const rootChildren = tree.children;
    const folderNames = rootChildren.filter((child) => child.type === 'folder').map((child) => child.name);
    expect(folderNames).toEqual(['projects']);
    const noteNames = rootChildren.filter((child) => child.type === 'note').map((child) => child.name);
    expect(noteNames).toEqual(['alpha.md']);
  });

  it('sorts by last modified when requested', () => {
    const tree = buildNoteTree(sampleNotes, 'modified');
    const rootChildren = tree.children;
    const projectFolder = rootChildren[0];
    expect(projectFolder.path).toBe('projects');
    if (projectFolder.type !== 'folder') throw new Error('projects should be folder');
    expect(projectFolder.lastModified).toBe(200);
    const atlas = projectFolder.children[0];
    expect(atlas.type).toBe('folder');
    if (atlas.type !== 'folder') throw new Error('atlas missing');
    const firstNote = atlas.children[0];
    expect(firstNote.type).toBe('note');
    if (firstNote.type === 'note') {
      expect(firstNote.meta.path).toBe('projects/atlas/spec.md');
    }
  });

  it('derives display names from metadata', () => {
    expect(getNoteDisplayName({ path: 'alpha.md', title: 'Alpha' })).toBe('Alpha');
    expect(getNoteDisplayName({ path: 'folder/sample.md', title: '' })).toBe('sample');
  });
});
