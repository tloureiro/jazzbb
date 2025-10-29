import type { VaultHandle } from './fs';
import { enumerateMarkdownFiles } from './fs';
import { openNote } from './note-reader';
import { vaultStore, type NoteMeta } from '../state/vault';
import { editorStore } from '../state/editor';
import { parseNote } from './parser-service';
import { sanitizeHtml } from '../lib/markdown';
import { upsertDocument } from './search-service';
import { workspaceStore } from '../state/workspace';

export function deriveTitle(markdown: string, path: string): string {
  const headingMatch = markdown.match(/^\s*#\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  const basename = path.split('/').pop() ?? path;
  return basename.replace(/\.md$/i, '').replace(/[-_]/g, ' ').trim() || basename;
}

export async function loadVaultContents(handle: VaultHandle): Promise<void> {
  try {
    workspaceStore.setMode('vault');
    workspaceStore.setSingleFile(undefined);
    const files = await enumerateMarkdownFiles(handle);
    const notes: NoteMeta[] = [];
    const handles: Record<string, FileSystemFileHandle> = {};

    for (const entry of files) {
      const file = await entry.fileHandle.getFile();
      const rawContent = await file.text();
      const parsed = await parseNote(rawContent, { path: entry.path, lastModified: file.lastModified });
      const sanitizedHtml = sanitizeHtml(parsed.html);

      const meta: NoteMeta = {
        path: entry.path,
        title: parsed.title,
        lastModified: parsed.lastModified,
      };
      notes.push(meta);
      handles[entry.path] = entry.fileHandle;
      vaultStore.setCache(entry.path, {
        html: sanitizedHtml,
        links: parsed.links,
        headings: parsed.headings,
        content: rawContent,
        lastModified: parsed.lastModified,
      });
      await upsertDocument({ path: entry.path, title: parsed.title, text: rawContent });
    }

    vaultStore.setHandle(handle);
    vaultStore.setNotes(notes);
    vaultStore.setHandles(handles);

    if (notes.length > 0) {
      const first = notes[0];
      const cached = vaultStore.state.cache[first.path];
      if (cached) {
        vaultStore.select(first.path);
        editorStore.setDocument(first.path, cached.content, cached.html, cached.links, cached.headings ?? [], cached.lastModified);
      } else {
        await openNote(first.path);
      }
    } else {
      vaultStore.select(undefined);
    }
  } catch (error) {
    console.error('Failed to load vault', error);
    vaultStore.setError('Unable to read vault contents.');
  }
}
