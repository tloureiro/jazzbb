import { parseNote } from './parser-service';
import { sanitizeHtml } from '../lib/markdown';
import { editorStore } from '../state/editor';
import { showToast } from '../state/ui';
import { hasUnsavedChanges } from '../lib/note-stats';

type SingleFileTarget = {
  handle: FileSystemFileHandle;
  path: string;
};

const POLL_INTERVAL_MS = 2000;

let pollTimer: number | undefined;
let activeTarget: SingleFileTarget | undefined;
let pendingReload:
  | {
      content: string;
      lastModified: number;
      warned: boolean;
    }
  | undefined;

function clearTimer(): void {
  if (pollTimer !== undefined && typeof window !== 'undefined') {
    window.clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

async function applyReload(content: string, lastModified: number, path: string): Promise<void> {
  const parsed = await parseNote(content, { path, lastModified });
  const sanitized = sanitizeHtml(parsed.html);
  editorStore.setDocument(path, content, sanitized, parsed.links, parsed.headings, parsed.lastModified);
  showToast('Reloaded latest file changes', 'info');
}

async function checkForUpdates(): Promise<void> {
  if (!activeTarget || typeof window === 'undefined') {
    return;
  }

  try {
    const { handle, path } = activeTarget;
    const file = await handle.getFile();
    const fileModified = file.lastModified;
    const lastLoaded = editorStore.lastLoaded();

    if (pendingReload && pendingReload.lastModified > lastLoaded && !hasUnsavedChanges(editorStore.draft(), editorStore.content())) {
      const payload = pendingReload;
      pendingReload = undefined;
      await applyReload(payload.content, payload.lastModified, path);
      return;
    }

    if (fileModified <= lastLoaded) {
      return;
    }

    const text = await file.text();
    const hasDraftChanges = hasUnsavedChanges(editorStore.draft(), editorStore.content());
    if (hasDraftChanges) {
      if (!pendingReload || pendingReload.lastModified !== fileModified) {
        pendingReload = {
          content: text,
          lastModified: fileModified,
          warned: false,
        };
      } else {
        pendingReload.content = text;
        pendingReload.lastModified = fileModified;
      }

      if (pendingReload && !pendingReload.warned) {
        showToast('File changed on disk. Save or discard edits to reload.', 'info');
        pendingReload.warned = true;
      }
      return;
    }

    await applyReload(text, fileModified, path);
  } catch (error) {
    console.error('Failed to poll file updates', error);
  }
}

export function watchSingleFile(target: SingleFileTarget | undefined): void {
  if (typeof window === 'undefined') {
    return;
  }

  clearTimer();
  pendingReload = undefined;
  activeTarget = target;

  if (!target) {
    return;
  }

  pollTimer = window.setInterval(() => {
    void checkForUpdates();
  }, POLL_INTERVAL_MS);
}

export function stopSingleFileWatcher(): void {
  pendingReload = undefined;
  activeTarget = undefined;
  clearTimer();
}
