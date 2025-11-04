import { editorStore, SCRATCH_TITLE } from '../state/editor';
import { vaultStore } from '../state/vault';
import { parseNote } from './parser-service';
import { sanitizeHtml } from '../lib/markdown';
import { upsertDocument } from './search-service';
import { workspaceStore, isBrowserVaultMode } from '../state/workspace';
import { saveBrowserVaultNote } from './browser-vault-session';

type SaveFilePicker = (options?: FileSavePickerOptions) => Promise<FileSystemFileHandle>;


type FileSavePickerOptions = {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
};

function buildSuggestedFileName(label: string): string {
  const cleaned = (label || SCRATCH_TITLE)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
  const base = cleaned || 'untitled';
  return base.toLowerCase().endsWith('.md') ? base : `${base}.md`;
}

async function saveDraftAsNewFile(content: string): Promise<SaveResult> {
  const picker = (window as typeof window & {
    showSaveFilePicker?: SaveFilePicker;
  }).showSaveFilePicker;

  if (!picker) {
    return { status: 'unsupported' };
  }

  try {
    const handle = await picker({
      suggestedName: buildSuggestedFileName(editorStore.displayName()),
      excludeAcceptAllOption: true,
      types: [
        {
          description: 'Markdown files',
          accept: {
            'text/markdown': ['.md'],
            'text/plain': ['.md'],
          },
        },
      ],
    });

    if (!handle) {
      return { status: 'cancelled' };
    }

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();

    const path = handle.name;
    const parsed = await parseNote(content, { path, lastModified: Date.now() });
    const sanitized = sanitizeHtml(parsed.html);

    workspaceStore.setMode('single');
    workspaceStore.setSingleFile({ handle, path });
    vaultStore.reset();
    editorStore.setDocument(path, content, sanitized, parsed.links, parsed.headings, parsed.lastModified);

    return { status: 'saved' };
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    console.error('Failed to save note', error);
    return { status: 'error', error };
  }
}


export type SaveResult =
  | { status: 'saved' }
  | { status: 'not-changed' }
  | { status: 'no-active' }
  | { status: 'no-handle' }
  | { status: 'cancelled' }
  | { status: 'unsupported' }
  | { status: 'error'; error: unknown };

export type ExportResult =
  | { status: 'exported' }
  | { status: 'no-active' }
  | { status: 'unsupported' }
  | { status: 'cancelled' }
  | { status: 'error'; error: unknown };

export async function saveActiveNote(): Promise<SaveResult> {
  const path = editorStore.activePath();
  const draft = editorStore.draft();
  const mode = workspaceStore.mode();

  if (!path) {
    if (mode === 'scratch') {
      return saveDraftAsNewFile(draft);
    }
    return { status: 'no-active' };
  }

  if (isBrowserVaultMode()) {
    if (draft === editorStore.content()) {
      return { status: 'not-changed' };
    }
    await saveBrowserVaultNote(path, draft);
    return { status: 'saved' };
  }

  const single = workspaceStore.singleFile();
  let handle = vaultStore.state.handles[path];

  if (!handle && single && single.path === path) {
    handle = single.handle;
  }

  if (!handle) {
    if (workspaceStore.mode() === 'vault') {
      vaultStore.setError(`Failed to save note: ${path}`);
    }
    return { status: 'no-handle' };
  }

  if (draft === editorStore.content()) {
    return { status: 'not-changed' };
  }

  try {
    const writable = await handle.createWritable();
    await writable.write(draft);
    await writable.close();

    const parsed = await parseNote(draft, { path, lastModified: Date.now() });
    const sanitized = sanitizeHtml(parsed.html);

    if (mode === 'vault') {
      vaultStore.setCache(path, {
        html: sanitized,
        links: parsed.links,
        headings: parsed.headings,
        content: draft,
        lastModified: parsed.lastModified,
      });
      vaultStore.updateNote({ path, title: parsed.title, lastModified: parsed.lastModified });
      await upsertDocument({ path, title: parsed.title, text: draft });
    } else if (mode === 'single') {
      workspaceStore.setSingleFile({ handle, path });
    }

    editorStore.setDocument(path, draft, sanitized, parsed.links, parsed.headings, parsed.lastModified);

    return { status: 'saved' };
  } catch (error) {
    console.error('Failed to save note', error);
    if (mode === 'vault') {
      vaultStore.setError(`Failed to save note: ${path}`);
    }
    return { status: 'error', error };
  }
}

export async function exportActiveNoteToFile(): Promise<ExportResult> {
  if (!editorStore.activePath()) {
    return { status: 'no-active' };
  }

  const picker = (window as typeof window & {
    showSaveFilePicker?: SaveFilePicker;
  }).showSaveFilePicker;

  if (!picker) {
    return { status: 'unsupported' };
  }

  const draft = editorStore.draft();

  try {
    const handle = await picker({
      suggestedName: buildSuggestedFileName(editorStore.displayName()),
      excludeAcceptAllOption: true,
      types: [
        {
          description: 'Markdown files',
          accept: {
            'text/markdown': ['.md'],
            'text/plain': ['.md'],
          },
        },
      ],
    });

    if (!handle) {
      return { status: 'cancelled' };
    }

    const writable = await handle.createWritable();
    await writable.write(draft);
    await writable.close();

    return { status: 'exported' };
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    console.error('Failed to export note to file', error);
    return { status: 'error', error };
  }
}
