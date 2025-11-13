import { editorStore } from '../state/editor';
import { vaultStore, type NoteMeta } from '../state/vault';
import { workspaceStore } from '../state/workspace';
import { parseNote } from './parser-service';
import { sanitizeHtml } from '../lib/markdown';
import {
  BrowserVaultNote,
  BrowserVaultSettings,
  BrowserVaultSnapshot,
  clearBrowserVault,
  exportBrowserVaultZip,
  getBrowserVaultSnapshot,
  getDefaultBrowserVaultSettings,
  importBrowserVaultZip,
  putBrowserNote,
  removeBrowserNote,
  resetBrowserVaultSettings,
  setBrowserVaultSelection,
  setBrowserVaultSettings,
} from './browser-vault';
import { upsertDocument, removeDocument } from './search-service';
import {
  setThemeMode,
  setTypographyPreset,
  setEditorFontScale,
  setEditorMeasureScale,
  setColorScheme,
  DEFAULT_EDITOR_FONT_SCALE,
  DEFAULT_EDITOR_MEASURE_SCALE,
  DEFAULT_COLOR_SCHEME_ID,
  COLOR_SCHEME_VERSION,
  normalizeColorSchemeId,
  type ThemeMode,
  type TypographyPreset,
  type ColorSchemeId,
} from '../state/ui';
import { refreshBrowserVaultEstimate } from './browser-vault-storage';

const DEFAULT_CONTENT = '';
const RESERVED_META_FILE = '.jazzbb/meta.json';

function sanitizeTheme(value: string): ThemeMode {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'dark';
}

function sanitizeTypography(value: string): TypographyPreset {
  const presets: TypographyPreset[] = [
    'editorial-classic',
    'humanist-tech',
    'swiss-modern',
    'bookish-oldstyle',
    'inclusive-readability',
  ];
  if (presets.includes(value as TypographyPreset)) {
    return value as TypographyPreset;
  }
  return 'editorial-classic';
}

function sanitizeColorScheme(value: string | undefined): ColorSchemeId {
  return normalizeColorSchemeId(value);
}

function applySettings(settings: BrowserVaultSettings): void {
  const themeMode = sanitizeTheme(settings.theme);
  setThemeMode(themeMode);

  const preset = sanitizeTypography(settings.typographyPreset);
  setTypographyPreset(preset);

  let scheme = sanitizeColorScheme(settings.colorScheme);
  const version = typeof settings.colorSchemeVersion === 'number' ? settings.colorSchemeVersion : 0;
  if (version < COLOR_SCHEME_VERSION && scheme === 'midnight-jazz') {
    scheme = DEFAULT_COLOR_SCHEME_ID;
    setBrowserVaultSettings({ colorScheme: scheme, colorSchemeVersion: COLOR_SCHEME_VERSION }).catch((error) => {
      console.warn('Failed to migrate color scheme settings', error);
    });
  }
  setColorScheme(scheme);

  const desiredFontScale = Number.isFinite(settings.fontScale)
    ? settings.fontScale
    : DEFAULT_EDITOR_FONT_SCALE;
  setEditorFontScale(desiredFontScale);

  const desiredMeasureScale = Number.isFinite(settings.measureScale)
    ? settings.measureScale
    : DEFAULT_EDITOR_MEASURE_SCALE;
  setEditorMeasureScale(desiredMeasureScale);
}

export function normalizeBrowserNoteName(name: string): string {
  const trimmed = name.trim().replace(/\.(md|markdown)$/i, '');
  if (!trimmed) return 'Untitled';
  const sanitized = trimmed
    .replace(/[/\\]+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[<>:"|?*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || 'Untitled';
}

function ensureExtension(path: string): string {
  if (path.toLowerCase().endsWith('.md')) {
    return path;
  }
  return `${path}.md`;
}

function uniquePath(base: string, taken: Set<string>): string {
  const candidate = ensureExtension(base);
  if (!taken.has(candidate) && candidate !== RESERVED_META_FILE) {
    taken.add(candidate);
    return candidate;
  }

  const dot = candidate.lastIndexOf('.');
  const stem = dot >= 0 ? candidate.slice(0, dot) : candidate;
  const ext = dot >= 0 ? candidate.slice(dot) : '';
  for (let index = 1; index < 10000; index += 1) {
    const next = `${stem} (${index})${ext}`;
    if (!taken.has(next) && next !== RESERVED_META_FILE) {
      taken.add(next);
      return next;
    }
  }
  throw new Error('Unable to allocate unique note path');
}

type PersistOptions = {
  select?: boolean;
  replace?: boolean;
};

async function persistNote(note: BrowserVaultNote, options: PersistOptions = {}): Promise<void> {
  const parsed = await parseNote(note.content, { path: note.path, lastModified: note.lastModified });
  const sanitized = sanitizeHtml(parsed.html);

  const meta: NoteMeta = {
    path: note.path,
    title: parsed.title,
    lastModified: parsed.lastModified,
  };

  const cache = {
    html: sanitized,
    links: parsed.links,
    headings: parsed.headings,
    content: note.content,
    lastModified: parsed.lastModified,
  };

  const exists = vaultStore.state.notes.some((entry) => entry.path === note.path);
  const shouldReplace = options.replace ?? exists;

  note.title = meta.title;
  note.lastModified = meta.lastModified;
  await putBrowserNote(note);

  if (shouldReplace) {
    vaultStore.updateNote(meta);
    vaultStore.setCache(note.path, cache);
  } else {
    vaultStore.addNote(meta, null, cache);
  }

  await upsertDocument({ path: meta.path, title: meta.title, text: note.content });
  await refreshBrowserVaultEstimate();

  if (options.select) {
    vaultStore.select(note.path);
    editorStore.setDocument(note.path, note.content, cache.html, cache.links, cache.headings, cache.lastModified);
    await setBrowserVaultSelection(note.path);
  }
}

async function hydrateSnapshot(snapshot: BrowserVaultSnapshot): Promise<void> {
  applySettings(snapshot.settings ?? getDefaultBrowserVaultSettings());

  if (snapshot.notes.length === 0) {
    workspaceStore.reset();
    vaultStore.reset();
    editorStore.reset();
    return;
  }

  const handles = snapshot.notes.reduce<Record<string, FileSystemFileHandle | null>>((acc, note) => {
    acc[note.path] = null;
    return acc;
  }, {});

  vaultStore.setHandle(undefined);
  vaultStore.setHandles(handles);
  vaultStore.setNotes(snapshot.notes);

  for (const note of snapshot.notes) {
    const entry = snapshot.content[note.path];
    const rawContent = entry?.content ?? '';
    const noteRecord: BrowserVaultNote = {
      path: note.path,
      title: note.title,
      content: rawContent,
      lastModified: entry?.lastModified ?? note.lastModified ?? Date.now(),
    };
    await persistNote(noteRecord, { select: false, replace: true });
  }

  workspaceStore.setMode('browser');
  workspaceStore.setSingleFile(undefined);

  const selection = snapshot.selection && snapshot.notes.some((note) => note.path === snapshot.selection)
    ? snapshot.selection
    : snapshot.notes[0]?.path;

  if (selection) {
    const cached = vaultStore.state.cache[selection];
    if (cached) {
      vaultStore.select(selection);
      editorStore.setDocument(
        selection,
        cached.content,
        cached.html,
        cached.links,
        cached.headings,
        cached.lastModified,
      );
      await setBrowserVaultSelection(selection);
    }
  }
}

export async function restoreBrowserVaultSession(options: { skip?: boolean } = {}): Promise<void> {
  if (options.skip) {
    workspaceStore.reset();
    vaultStore.reset();
    editorStore.reset();
    applySettings(getDefaultBrowserVaultSettings());
    await refreshBrowserVaultEstimate();
    return;
  }

  const snapshot = await getBrowserVaultSnapshot();
  await hydrateSnapshot(snapshot);
}

export async function createBrowserVaultNote(initialContent: string = DEFAULT_CONTENT, desiredName?: string): Promise<string> {
  const existingPaths = new Set(vaultStore.state.notes.map((note) => note.path));
  const path = uniquePath(desiredName ? ensureExtension(desiredName) : 'untitled.md', existingPaths);
  const note: BrowserVaultNote = {
    path,
    title: '',
    content: initialContent,
    lastModified: Date.now(),
  };

  await persistNote(note, { select: true, replace: false });
  return path;
}

export async function saveScratchToBrowserVault(): Promise<{ status: 'saved'; path: string } | { status: 'error'; error: unknown }> {
  if (workspaceStore.mode() !== 'scratch') {
    return { status: 'error', error: new Error('Not in scratch mode') };
  }

  try {
    const snapshot = await getBrowserVaultSnapshot();
    const existingPaths = new Set(snapshot.notes.map((note) => note.path));
    const scratchName = ensureExtension(normalizeBrowserNoteName(editorStore.displayName()));
    const scratchPath = uniquePath(scratchName, existingPaths);
    const scratchNote: BrowserVaultNote = {
      path: scratchPath,
      title: scratchName,
      content: editorStore.draft(),
      lastModified: Date.now(),
    };

    await putBrowserNote(scratchNote);
    await setBrowserVaultSelection(scratchPath);
    await restoreBrowserVaultSession();
    return { status: 'saved', path: scratchPath };
  } catch (error) {
    console.error('Failed to save scratch note to browser vault', error);
    return { status: 'error', error };
  }
}

export async function convertScratchToBrowserVault(initialContent: string = DEFAULT_CONTENT): Promise<string> {
  const snapshot = await getBrowserVaultSnapshot();
  const existingPaths = new Set(snapshot.notes.map((note) => note.path));

  workspaceStore.setMode('browser');
  workspaceStore.setSingleFile(undefined);
  vaultStore.reset();

  const scratchName = ensureExtension(normalizeBrowserNoteName(editorStore.displayName()));
  const scratchPath = uniquePath(scratchName, existingPaths);
  const scratchNote: BrowserVaultNote = {
    path: scratchPath,
    title: scratchName,
    content: editorStore.draft(),
    lastModified: Date.now(),
  };
  await persistNote(scratchNote, { select: false, replace: false });
  await setBrowserVaultSelection(scratchPath);

  return createBrowserVaultNote(initialContent);
}

export async function openBrowserVaultNote(path: string): Promise<void> {
  const snapshot = await getBrowserVaultSnapshot();
  const target = snapshot.notes.find((note) => note.path === path);
  const entry = snapshot.content[path];

  if (!target || !entry) {
    console.warn('Browser vault note missing', path);
    return;
  }

  const note: BrowserVaultNote = {
    path,
    title: target.title,
    content: entry.content,
    lastModified: entry.lastModified,
  };

  await persistNote(note, { select: true, replace: true });
}

export async function saveBrowserVaultNote(path: string, content: string): Promise<void> {
  const note: BrowserVaultNote = {
    path,
    title: '',
    content,
    lastModified: Date.now(),
  };
  await persistNote(note, { select: true, replace: true });
}

export async function deleteBrowserVaultNote(path: string): Promise<string | undefined> {
  const remaining = vaultStore.state.notes.filter((note) => note.path !== path);
  await removeBrowserNote(path);
  await removeDocument(path);
  vaultStore.removeNote(path);

  if (remaining.length === 0) {
    await clearBrowserVault();
    workspaceStore.reset();
    vaultStore.reset();
    editorStore.reset();
    await refreshBrowserVaultEstimate();
    return undefined;
  }

  const nextSelection = remaining[0].path;
  await openBrowserVaultNote(nextSelection);
  await refreshBrowserVaultEstimate();
  return nextSelection;
}

export async function renameBrowserVaultNote(path: string, desiredName: string): Promise<{ status: 'renamed' | 'duplicate' | 'error'; path?: string }> {
  const trimmed = desiredName.trim();
  if (!trimmed) {
    return { status: 'error' };
  }

  const newPath = ensureExtension(normalizeBrowserNoteName(trimmed));
  if (newPath === path) {
    return { status: 'renamed', path };
  }

  const snapshot = await getBrowserVaultSnapshot();
  if (snapshot.notes.some((note) => note.path === newPath)) {
    return { status: 'duplicate' };
  }

  const original = snapshot.notes.find((note) => note.path === path);
  const entry = snapshot.content[path];
  if (!original || !entry) {
    return { status: 'error' };
  }

  await removeBrowserNote(path);
  await removeDocument(path);
  vaultStore.removeNote(path);

  const renamed: BrowserVaultNote = {
    path: newPath,
    title: trimmed,
    content: entry.content,
    lastModified: Date.now(),
  };

  await persistNote(renamed, { select: true, replace: false });
  await setBrowserVaultSelection(newPath);
  return { status: 'renamed', path: newPath };
}

export async function exportBrowserVault(): Promise<Uint8Array> {
  return exportBrowserVaultZip();
}

export async function importBrowserVault(data: Uint8Array): Promise<void> {
  await importBrowserVaultZip(data);
  await restoreBrowserVaultSession();
}

export async function deleteBrowserVault(): Promise<void> {
  await clearBrowserVault();
  workspaceStore.reset();
  vaultStore.reset();
  editorStore.reset();
  await refreshBrowserVaultEstimate();
}

export async function resetBrowserVaultConfig(): Promise<void> {
  await resetBrowserVaultSettings();
  applySettings(getDefaultBrowserVaultSettings());
}

export async function updateBrowserVaultSettings(settings: Partial<BrowserVaultSettings>): Promise<void> {
  await setBrowserVaultSettings(settings);
  const snapshot = await getBrowserVaultSnapshot();
  applySettings(snapshot.settings);
}
