import type { NoteMeta } from '../state/vault';

export type NoteTreeMode = 'name' | 'modified';

export type NoteTreeFolder = {
  type: 'folder';
  name: string;
  path: string;
  lastModified: number;
  children: NoteTreeNode[];
};

export type NoteTreeFile = {
  type: 'note';
  name: string;
  path: string;
  lastModified: number;
  meta: NoteMeta;
};

export type NoteTreeNode = NoteTreeFolder | NoteTreeFile;

const ROOT_PATH = '';

type FolderAccumulator = NoteTreeFolder & {
  segments: string[];
};

export function getNoteDisplayName(meta: Pick<NoteMeta, 'path' | 'title'>): string {
  if (meta.title?.trim()) return meta.title.trim();
  const base = meta.path.split('/').pop() ?? meta.path;
  return base.replace(/\.md$/i, '');
}

export function buildNoteTree(notes: NoteMeta[], mode: NoteTreeMode): NoteTreeFolder {
  const root: FolderAccumulator = {
    type: 'folder',
    name: '',
    path: ROOT_PATH,
    lastModified: 0,
    segments: [],
    children: [],
  };
  const folderMap = new Map<string, FolderAccumulator>([[ROOT_PATH, root]]);

  for (const note of notes) {
    const segments = note.path.split('/').filter(Boolean);
    const noteName = segments.pop() ?? note.path;
    const ancestors: FolderAccumulator[] = [root];
    let currentPath = ROOT_PATH;

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let folder = folderMap.get(currentPath);
      if (!folder) {
        folder = {
          type: 'folder',
          name: segment,
          path: currentPath,
          lastModified: 0,
          segments: [...ancestors[ancestors.length - 1].segments, segment],
          children: [],
        };
        folderMap.set(currentPath, folder);
        ancestors[ancestors.length - 1].children.push(folder);
      }
      ancestors.push(folder);
    }

    const noteNode: NoteTreeFile = {
      type: 'note',
      name: noteName,
      path: note.path,
      lastModified: note.lastModified,
      meta: note,
    };
    ancestors[ancestors.length - 1].children.push(noteNode);

    for (const ancestor of ancestors) {
      ancestor.lastModified = Math.max(ancestor.lastModified, note.lastModified);
    }
  }

  sortFolderChildren(root, mode);
  return {
    type: 'folder',
    name: '',
    path: ROOT_PATH,
    lastModified: root.lastModified,
    children: root.children,
  };
}

function sortFolderChildren(folder: FolderAccumulator, mode: NoteTreeMode): void {
  folder.children.sort((a, b) => compareNodes(a, b, mode));
  for (const child of folder.children) {
    if (child.type === 'folder') {
      sortFolderChildren(child as FolderAccumulator, mode);
    }
  }
}

function compareNodes(a: NoteTreeNode, b: NoteTreeNode, mode: NoteTreeMode): number {
  if (a.type === 'folder' && b.type === 'note') return -1;
  if (a.type === 'note' && b.type === 'folder') return 1;

  if (mode === 'modified') {
    const diff = b.lastModified - a.lastModified;
    if (diff !== 0) return diff;
  }

  const aName = a.type === 'folder' ? a.name : getNoteDisplayName(a.meta);
  const bName = b.type === 'folder' ? b.name : getNoteDisplayName(b.meta);
  const localeDiff = aName.localeCompare(bName, undefined, { sensitivity: 'base' });
  if (localeDiff !== 0) return localeDiff;

  return a.path.localeCompare(b.path);
}
