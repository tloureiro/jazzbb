import { editorStore } from '../state/editor';
import { vaultStore, type NoteMeta } from '../state/vault';
import { parseNote } from './parser-service';
import { sanitizeHtml } from '../lib/markdown';
import { upsertDocument, removeDocument } from './search-service';
import { openNote } from './note-reader';
import { workspaceStore, isBrowserVaultMode } from '../state/workspace';
import {
  convertScratchToBrowserVault,
  createBrowserVaultNote,
  deleteBrowserVaultNote,
  renameBrowserVaultNote,
} from './browser-vault-session';

const DEFAULT_CONTENT = '';

async function ensureUniqueName(dir: FileSystemDirectoryHandle, base: string): Promise<string> {
  const dot = base.lastIndexOf('.');
  const name = dot >= 0 ? base.slice(0, dot) : base;
  const ext = dot >= 0 ? base.slice(dot) : '';

  for (let counter = 0; counter < 10000; counter += 1) {
    const candidate = counter === 0 ? base : `${name}-${counter}${ext}`;
    try {
      await dir.getFileHandle(candidate);
    } catch (error) {
      if ((error as DOMException)?.name === 'NotFoundError') {
        return candidate;
      }
      throw error;
    }
  }

  throw new Error('Unable to generate unique filename');
}

export type CreateNoteResult =
  | { status: 'created'; path: string }
  | { status: 'no-vault' }
  | { status: 'error'; error: unknown };

export async function createNote(initialContent: string = DEFAULT_CONTENT): Promise<CreateNoteResult> {
  if (workspaceStore.mode() === 'scratch') {
    const path = await convertScratchToBrowserVault(initialContent);
    return { status: 'created', path };
  }

  if (isBrowserVaultMode()) {
    const path = await createBrowserVaultNote(initialContent);
    return { status: 'created', path };
  }

  const vaultHandle = vaultStore.state.handle?.directoryHandle;
  if (!vaultHandle) {
    return { status: 'no-vault' };
  }

  try {
    const filename = await ensureUniqueName(vaultHandle, 'untitled.md');
    const fileHandle = await vaultHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(initialContent);
    await writable.close();

    const parsed = await parseNote(initialContent, { path: filename, lastModified: Date.now() });
    const sanitized = sanitizeHtml(parsed.html);

    const meta: NoteMeta = {
      path: filename,
      title: parsed.title,
      lastModified: parsed.lastModified,
    };

    vaultStore.addNote(meta, fileHandle, {
      html: sanitized,
      links: parsed.links,
      headings: parsed.headings,
      content: initialContent,
      lastModified: parsed.lastModified,
    });

    editorStore.setDocument(filename, initialContent, sanitized, parsed.links, parsed.headings, parsed.lastModified);
    await upsertDocument({ path: filename, title: parsed.title, text: initialContent });

    return { status: 'created', path: filename };
  } catch (error) {
    console.error('Failed to create note', error);
    vaultStore.setError('Failed to create note.');
    return { status: 'error', error };
  }
}

export type RenameNoteResult =
  | { status: 'renamed'; path: string }
  | { status: 'no-vault' }
  | { status: 'no-path' }
  | { status: 'duplicate' }
  | { status: 'error'; error: unknown };

export async function renameNote(path: string | undefined, desiredName: string): Promise<RenameNoteResult> {
  if (!path) {
    return { status: 'no-path' };
  }

  if (isBrowserVaultMode()) {
    const result = await renameBrowserVaultNote(path, desiredName);
    if (result.status === 'duplicate') {
      return { status: 'duplicate' };
    }
    if (result.status === 'renamed') {
      return { status: 'renamed', path: result.path ?? path };
    }
    return { status: 'error', error: new Error('Failed to rename browser vault note') };
  }

  const dir = vaultStore.state.handle?.directoryHandle;
  if (!dir) {
    return { status: 'no-vault' };
  }

  const trimmed = desiredName.trim();
  if (!trimmed) {
    return { status: 'no-path' };
  }

  const nextName = trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`;
  if (nextName === path) {
    return { status: 'renamed', path };
  }

  try {
    await dir.getFileHandle(nextName);
    return { status: 'duplicate' };
  } catch (error) {
    if ((error as DOMException)?.name !== 'NotFoundError') {
      console.error('Failed checking note name', error);
      return { status: 'error', error };
    }
  }

  const existingHandle = vaultStore.state.handles[path];
  if (!existingHandle) {
    return { status: 'error', error: new Error('Missing file handle') };
  }

  try {
    const cached = vaultStore.state.cache[path];
    const rawContent = cached?.content ?? (await (await existingHandle.getFile()).text());
    const parsed = await parseNote(rawContent, { path: nextName, lastModified: Date.now() });
    const sanitized = sanitizeHtml(parsed.html);

    const newHandle = await dir.getFileHandle(nextName, { create: true });
    const writable = await newHandle.createWritable();
    await writable.write(rawContent);
    await writable.close();

    await dir.removeEntry(path);

    vaultStore.removeNote(path);
    await removeDocument(path);

    const meta: NoteMeta = {
      path: nextName,
      title: parsed.title,
      lastModified: parsed.lastModified,
    };

    vaultStore.addNote(meta, newHandle, {
      html: sanitized,
      links: parsed.links,
      headings: parsed.headings,
      content: rawContent,
      lastModified: parsed.lastModified,
    });

    editorStore.setDocument(nextName, rawContent, sanitized, parsed.links, parsed.headings, parsed.lastModified);
    vaultStore.select(nextName);
    await upsertDocument({ path: nextName, title: parsed.title, text: rawContent });

    return { status: 'renamed', path: nextName };
  } catch (error) {
    console.error('Failed to rename note', error);
    vaultStore.setError(`Failed to rename note: ${desiredName}`);
    return { status: 'error', error };
  }
}

export type DeleteNoteResult =
  | { status: 'deleted'; nextSelection?: string }
  | { status: 'no-vault' }
  | { status: 'no-path' }
  | { status: 'error'; error: unknown };

export async function deleteNote(path: string | undefined): Promise<DeleteNoteResult> {
  if (!path) {
    return { status: 'no-path' };
  }

  if (isBrowserVaultMode()) {
    const next = await deleteBrowserVaultNote(path);
    if (next) {
      return { status: 'deleted', nextSelection: next };
    }
    return { status: 'deleted' };
  }

  const dir = vaultStore.state.handle?.directoryHandle;
  if (!dir) {
    return { status: 'no-vault' };
  }

  try {
    await dir.removeEntry(path);
  } catch (error) {
    console.error('Failed to delete note', error);
    vaultStore.setError(`Failed to delete note: ${path}`);
    return { status: 'error', error };
  }

  vaultStore.removeNote(path);
  await removeDocument(path);

  const remaining = vaultStore.state.notes;
  const next = remaining[0]?.path;

  if (next) {
    await openNote(next);
    return { status: 'deleted', nextSelection: next };
  }

  editorStore.reset();
  vaultStore.select(undefined);
  return { status: 'deleted' };
}
