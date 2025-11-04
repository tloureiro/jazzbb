import { editorStore } from '../state/editor';
import { vaultStore } from '../state/vault';
import { parseNote } from './parser-service';
import { sanitizeHtml } from '../lib/markdown';
import { upsertDocument } from './search-service';
import { isBrowserVaultMode } from '../state/workspace';
import { openBrowserVaultNote } from './browser-vault-session';

export async function openNote(path: string): Promise<void> {
  if (isBrowserVaultMode()) {
    await openBrowserVaultNote(path);
    return;
  }

  const handle = vaultStore.state.handles[path];
  if (!handle) {
    console.warn('No file handle available for note', path);
    vaultStore.setError(`Failed to open note: ${path}`);
    return;
  }

  try {
    const file = await handle.getFile();
    const rawContent = await file.text();
    const parsed = await parseNote(rawContent, { path, lastModified: file.lastModified });
    const sanitizedHtml = sanitizeHtml(parsed.html);

    vaultStore.select(path);
    const meta = { path, title: parsed.title, lastModified: parsed.lastModified };
    vaultStore.setCache(path, {
      html: sanitizedHtml,
      links: parsed.links,
      headings: parsed.headings,
      content: rawContent,
      lastModified: parsed.lastModified,
    });
    vaultStore.updateNote(meta);
    editorStore.setDocument(path, rawContent, sanitizedHtml, parsed.links, parsed.headings, parsed.lastModified);
    await upsertDocument({ path, title: parsed.title, text: rawContent });
  } catch (error) {
    console.error('Failed to open note', path, error);
    vaultStore.setError(`Failed to open note: ${path}`);
  }
}
