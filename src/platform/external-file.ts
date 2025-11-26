import { sanitizeHtml } from '../lib/markdown';
import { parseNote } from './parser-service';
import { editorStore } from '../state/editor';
import { workspaceStore } from '../state/workspace';
import { vaultStore } from '../state/vault';

type ExternalFilePayload = {
  path: string;
  content: string;
  lastModified: number;
  exists: boolean;
};

type DesktopPayload = {
  fileData?: ExternalFilePayload;
  payload?: DesktopPayload;
  mode?: string;
  path?: string;
};

export function registerExternalFileBridge(): (() => void) | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ExternalFilePayload>).detail;
    const queue = window.__jazzbbPendingFiles;
    if (queue) {
      const index = queue.findIndex((item) => item === detail);
      if (index >= 0) {
        queue.splice(index, 1);
      }
    }
    void handleExternalFile(detail);
  };

  window.addEventListener('jazzbb:open-file', listener as EventListener);

  const cleanupCallbacks: Array<() => void> = [];

  const handleDesktopPayload = (payload: unknown) => {
    const detail = extractExternalFilePayload(payload);
    if (detail) {
      void handleExternalFile(detail);
    }
  };

  const wrapper = window.jazzbbWrapper;
  if (wrapper?.onPayload) {
    const detach = wrapper.onPayload((payload) => handleDesktopPayload(payload));
    if (typeof detach === 'function') {
      cleanupCallbacks.push(detach);
    }
  }
  if (wrapper?.getInitialState) {
    void wrapper
      .getInitialState()
      .then((state: unknown) => {
        const payload = (state as { payload?: unknown })?.payload ?? state;
        handleDesktopPayload(payload);
      })
      .catch((error) => {
        console.error('Failed to read initial desktop payload', error);
      });
  }

  const pendingFiles = window.__jazzbbPendingFiles;
  if (pendingFiles && pendingFiles.length > 0) {
    const snapshot = pendingFiles.splice(0, pendingFiles.length);
    snapshot.forEach((detail) => {
      void handleExternalFile(detail);
    });
  }

  return () => {
    window.removeEventListener('jazzbb:open-file', listener as EventListener);
    cleanupCallbacks.forEach((fn) => fn());
  };
}

function extractExternalFilePayload(payload: unknown): ExternalFilePayload | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const desktop = payload as DesktopPayload;
  if (desktop.fileData) {
    return desktop.fileData;
  }
  if (desktop.payload) {
    return extractExternalFilePayload(desktop.payload);
  }
  if (desktop.mode === 'file' && typeof desktop.path === 'string') {
    const pending = window.__jazzbbPendingFiles?.find((entry) => entry.path === desktop.path);
    if (pending) {
      return pending;
    }
  }
  return undefined;
}

async function handleExternalFile(detail?: ExternalFilePayload) {
  if (!detail || !detail.path) {
    return;
  }
  const content = detail.content ?? '';
  const lastModified = typeof detail.lastModified === 'number' ? detail.lastModified : Date.now();

  try {
    const parsed = await parseNote(content, { path: detail.path, lastModified });
    const sanitized = sanitizeHtml(parsed.html);

    vaultStore.reset();
    const handle = createExternalHandle(detail);

    workspaceStore.setMode('single');
    workspaceStore.setSingleFile({ handle, path: detail.path });
    editorStore.setDocument(
      detail.path,
      content,
      sanitized,
      parsed.links,
      parsed.headings ?? [],
      parsed.lastModified,
    );
  } catch (error) {
    console.error('Failed to open external file payload', error);
  }
}

function createExternalHandle(detail: ExternalFilePayload): FileSystemFileHandle {
  const name = detail.path.split(/[\\/]/).pop() ?? detail.path;
  let cachedContent = detail.content ?? '';
  let cachedLastModified = typeof detail.lastModified === 'number' ? detail.lastModified : Date.now();

  const toFile = () => new File([cachedContent], name, {
    type: 'text/markdown',
    lastModified: cachedLastModified,
  });

  const readFromBridge = async () => {
    if (window.jazzbbWrapper?.readFile) {
      const response = await window.jazzbbWrapper.readFile({ path: detail.path });
      if (response?.ok !== false && typeof response?.content === 'string') {
        cachedContent = response.content;
        cachedLastModified = response.lastModified ?? Date.now();
      }
    }
  };

  const normalizeChunk = async (chunk: unknown): Promise<string> => {
    if (typeof chunk === 'string') return chunk;
    if (chunk instanceof Blob) return await chunk.text();
    if (chunk instanceof ArrayBuffer) return new TextDecoder().decode(chunk);
    if (ArrayBuffer.isView(chunk)) {
      return new TextDecoder().decode(chunk.buffer);
    }
    if (chunk && typeof chunk === 'object' && 'type' in chunk && chunk.type === 'write') {
      const data = (chunk as { data?: unknown }).data;
      return typeof data === 'string' ? data : '';
    }
    return '';
  };

  const handle = {
    kind: 'file',
    name,
    async getFile() {
      await readFromBridge();
      return toFile();
    },
    async createWritable() {
      let buffer = '';
      const flush = async () => {
        cachedContent = buffer;
        if (window.jazzbbWrapper?.writeFile) {
          const result = await window.jazzbbWrapper.writeFile({ path: detail.path, content: buffer });
          cachedLastModified = result?.lastModified ?? Date.now();
        } else {
          cachedLastModified = Date.now();
        }
      };

      const stream: Partial<FileSystemWritableFileStream> = {
        write: async (data: unknown) => {
          buffer += await normalizeChunk(data);
        },
        close: async () => {
          await flush();
        },
        abort: async () => {
          buffer = '';
        },
        seek: async () => {},
        truncate: async () => {},
        getWriter: () => ({
          write: async (data: unknown) => {
            buffer += await normalizeChunk(data);
          },
          close: async () => {
            await flush();
          },
          abort: async () => {
            buffer = '';
          },
          releaseLock: () => {},
          closed: Promise.resolve(undefined),
          ready: Promise.resolve(undefined),
          desiredSize: null,
        }),
        get locked() {
          return false;
        },
      };

      return stream as FileSystemWritableFileStream;
    },
    async isSameEntry(other: FileSystemHandle) {
      return other?.name === name;
    },
    async queryPermission() {
      return 'granted';
    },
    async requestPermission() {
      return 'granted';
    },
  } as FileSystemFileHandle;

  (handle as unknown as { path?: string }).path = detail.path;
  return handle;
}
