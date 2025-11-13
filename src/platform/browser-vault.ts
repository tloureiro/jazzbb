import JSZip from 'jszip';
import { deriveTitle } from './vault-loader';
import { COLOR_SCHEME_VERSION, DEFAULT_COLOR_SCHEME_ID } from '../state/ui';

export type BrowserVaultNote = {
  path: string;
  title: string;
  content: string;
  lastModified: number;
};

export type BrowserVaultSnapshot = {
  notes: Array<{ path: string; title: string; lastModified: number }>;
  content: Record<string, { content: string; lastModified: number }>;
  selection?: string;
  settings: BrowserVaultSettings;
};

export type BrowserVaultSettings = {
  theme: string;
  typographyPreset: string;
  fontScale: number;
  measureScale: number;
  colorScheme: string;
  colorSchemeVersion?: number;
};

const DB_NAME = 'jazzbb-browser-vault';
const DB_VERSION = 1;
const NOTE_STORE = 'notes';
const META_STORE = 'meta';
const META_SELECTION_KEY = 'selection';
const META_SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS: BrowserVaultSettings = {
  theme: 'dark',
  typographyPreset: 'editorial-classic',
  fontScale: 1.40625,
  measureScale: 1,
  colorScheme: DEFAULT_COLOR_SCHEME_ID,
  colorSchemeVersion: COLOR_SCHEME_VERSION,
};

type MetaRecord<T = unknown> = { key: string; value: T };

let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment.');
  }
  return indexedDB;
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = getIndexedDB().open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(NOTE_STORE)) {
          db.createObjectStore(NOTE_STORE, { keyPath: 'path' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open browser vault database'));
    });
  }
  return dbPromise;
}

async function runTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  handler: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let resultValue: T | undefined;
    let handlerSettled = false;

    tx.oncomplete = () => {
      resolve(resultValue as T);
    };
    tx.onerror = () => {
      if (!handlerSettled) {
        reject(tx.error ?? new Error('Transaction failed'));
      }
    };
    tx.onabort = () => {
      reject(tx.error ?? new Error('Transaction aborted'));
    };

    try {
      Promise.resolve(handler(tx))
        .then((value) => {
          handlerSettled = true;
          resultValue = value;
        })
        .catch((error) => {
          handlerSettled = true;
          reject(error);
          try {
            tx.abort();
          } catch {
            // ignore abort errors
          }
        });
    } catch (error) {
      handlerSettled = true;
      reject(error);
      try {
        tx.abort();
      } catch {
        // ignore abort errors
      }
    }
  });
}

export async function putBrowserNote(note: BrowserVaultNote): Promise<void> {
  await runTransaction([NOTE_STORE], 'readwrite', async (tx) => {
    const store = tx.objectStore(NOTE_STORE);
    store.put(note);
  });
}

export async function removeBrowserNote(path: string): Promise<void> {
  await runTransaction([NOTE_STORE], 'readwrite', async (tx) => {
    const store = tx.objectStore(NOTE_STORE);
    store.delete(path);
  });
}

async function readSettings(store: IDBObjectStore): Promise<BrowserVaultSettings> {
  try {
    const record = (await requestAsPromise(store.get(META_SETTINGS_KEY))) as MetaRecord<BrowserVaultSettings> | undefined;
    if (record?.value) {
      const stored = record.value;
      const version =
        typeof stored.colorSchemeVersion === 'number' && Number.isFinite(stored.colorSchemeVersion)
          ? stored.colorSchemeVersion
          : 0;
      return { ...DEFAULT_SETTINGS, ...stored, colorSchemeVersion: version };
    }
  } catch (error) {
    console.error('Failed to read browser vault settings', error);
  }
  return { ...DEFAULT_SETTINGS };
}

export async function setBrowserVaultSettings(settings: Partial<BrowserVaultSettings>): Promise<void> {
  await runTransaction([META_STORE], 'readwrite', async (tx) => {
    const store = tx.objectStore(META_STORE);
    const existing = await readSettings(store);
    const next = { ...existing, ...settings };
    store.put({ key: META_SETTINGS_KEY, value: next } satisfies MetaRecord<BrowserVaultSettings>);
  });
}

export async function resetBrowserVaultSettings(): Promise<void> {
  await runTransaction([META_STORE], 'readwrite', async (tx) => {
    const store = tx.objectStore(META_STORE);
    store.put({ key: META_SETTINGS_KEY, value: { ...DEFAULT_SETTINGS } } satisfies MetaRecord<BrowserVaultSettings>);
  });
}

export async function setBrowserVaultSelection(path: string | undefined): Promise<void> {
  await runTransaction([META_STORE], 'readwrite', async (tx) => {
    const store = tx.objectStore(META_STORE);
    if (path) {
      store.put({ key: META_SELECTION_KEY, value: path } satisfies MetaRecord<string>);
    } else {
      store.delete(META_SELECTION_KEY);
    }
  });
}

export async function getBrowserVaultSnapshot(): Promise<BrowserVaultSnapshot> {
  return runTransaction([NOTE_STORE, META_STORE], 'readonly', async (tx) => {
    const noteStore = tx.objectStore(NOTE_STORE);
    const metaStore = tx.objectStore(META_STORE);

    const [noteRecords, selectionRecord, settings] = await Promise.all([
      requestAsPromise(noteStore.getAll()) as Promise<BrowserVaultNote[]>,
      requestAsPromise(metaStore.get(META_SELECTION_KEY)) as Promise<MetaRecord<string> | undefined>,
      readSettings(metaStore),
    ]);

    const notes = [...noteRecords]
      .map((note) => ({ path: note.path, title: note.title, lastModified: note.lastModified }))
      .sort((a, b) => a.path.localeCompare(b.path));

    const content = noteRecords.reduce<Record<string, { content: string; lastModified: number }>>((acc, note) => {
      acc[note.path] = { content: note.content, lastModified: note.lastModified };
      return acc;
    }, {});

    return {
      notes,
      content,
      selection: selectionRecord?.value,
      settings,
    };
  });
}

export async function clearBrowserVault(): Promise<void> {
  await runTransaction([NOTE_STORE, META_STORE], 'readwrite', async (tx) => {
    tx.objectStore(NOTE_STORE).clear();
    const meta = tx.objectStore(META_STORE);
    meta.delete(META_SELECTION_KEY);
  });
}

export async function exportBrowserVaultZip(): Promise<Uint8Array> {
  const snapshot = await getBrowserVaultSnapshot();
  const zip = new JSZip();

  snapshot.notes.forEach((note) => {
    const entry = snapshot.content[note.path];
    const body = entry?.content ?? '';
    zip.file(note.path, body);
  });

  const metadata = {
    version: 1,
    selection: snapshot.selection ?? null,
    notes: snapshot.notes,
    settings: snapshot.settings,
  };

  zip.file('.jazzbb/meta.json', JSON.stringify(metadata, null, 2));
  return zip.generateAsync({ type: 'uint8array' });
}

export async function importBrowserVaultZip(data: Uint8Array): Promise<void> {
  const zip = await JSZip.loadAsync(data);
  const metaEntry = zip.file('.jazzbb/meta.json');
  let metadata: {
    selection: string | null;
    notes: Array<{ path: string; title?: string; lastModified?: number }>;
    settings?: BrowserVaultSettings;
  } = { selection: null, notes: [] };

  if (metaEntry) {
    try {
      const raw = await metaEntry.async('string');
      metadata = JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse browser vault metadata; continuing without it.', error);
    }
  }

  const notes: BrowserVaultNote[] = [];

  const fileEntries = Object.values(zip.files).filter((file) => !file.dir && file.name !== '.jazzbb/meta.json');
  for (const entry of fileEntries) {
    const content = await entry.async('string');
    const meta = metadata.notes.find((note) => note.path === entry.name);
    const note: BrowserVaultNote = {
      path: entry.name,
      title: meta?.title ?? deriveTitle(content, entry.name),
      content,
      lastModified: meta?.lastModified ?? Date.now(),
    };
    notes.push(note);
  }

  await clearBrowserVault();

  await runTransaction([NOTE_STORE, META_STORE], 'readwrite', async (tx) => {
    const noteStore = tx.objectStore(NOTE_STORE);
    const metaStore = tx.objectStore(META_STORE);

    notes.forEach((note) => {
      noteStore.put(note);
    });

    if (metadata.selection) {
      metaStore.put({ key: META_SELECTION_KEY, value: metadata.selection } satisfies MetaRecord<string>);
    } else {
      metaStore.delete(META_SELECTION_KEY);
    }

    const settings = metadata.settings ?? { ...DEFAULT_SETTINGS };
    metaStore.put({ key: META_SETTINGS_KEY, value: settings } satisfies MetaRecord<BrowserVaultSettings>);
  });
}

export async function listBrowserNotePaths(): Promise<string[]> {
  const snapshot = await getBrowserVaultSnapshot();
  return snapshot.notes.map((note) => note.path);
}

export function getDefaultBrowserVaultSettings(): BrowserVaultSettings {
  return { ...DEFAULT_SETTINGS };
}
