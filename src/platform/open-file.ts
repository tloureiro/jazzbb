import { parseNote } from './parser-service';
import { sanitizeHtml } from '../lib/markdown';
import { editorStore } from '../state/editor';
import { vaultStore } from '../state/vault';
import { workspaceStore } from '../state/workspace';

export type OpenFileResult =
  | { status: 'success' }
  | { status: 'unsupported' }
  | { status: 'cancelled' };

export async function openSingleFile(): Promise<OpenFileResult> {
  const picker = (window as typeof window & {
    showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle[]>;
  }).showOpenFilePicker;

  if (!picker) {
    return { status: 'unsupported' };
  }

  try {
    const handles = await picker({
      multiple: false,
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

    const handle = handles?.[0];
    if (!handle) {
      return { status: 'cancelled' };
    }

    const file = await handle.getFile();
    const rawContent = await file.text();
    const path = handle.name;
    const parsed = await parseNote(rawContent, { path, lastModified: file.lastModified });
    const sanitized = sanitizeHtml(parsed.html);

    vaultStore.reset();
    workspaceStore.setMode('single');
    workspaceStore.setSingleFile({ handle, path });
    editorStore.setDocument(path, rawContent, sanitized, parsed.links, parsed.headings, parsed.lastModified);
    return { status: 'success' };
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    console.error('Failed to open file', error);
    return { status: 'cancelled' };
  }
}

export function closeSingleFile(): void {
  workspaceStore.reset();
  editorStore.reset();
}

type FilePickerOptions = {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
};
