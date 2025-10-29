import { wrap, type Remote } from 'comlink';
import type { IndexApi, DocumentRecord, SearchHit } from '../workers/index.worker';

let worker: Worker | null = null;
let api: Remote<IndexApi> | null = null;

function ensureWorker(): Remote<IndexApi> {
  if (!api) {
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers are not supported in this environment.');
    }
    worker = new Worker(new URL('../workers/index.worker.ts', import.meta.url), {
      type: 'module',
    });
    api = wrap<IndexApi>(worker);
  }
  return api;
}

export async function upsertDocument(doc: DocumentRecord): Promise<void> {
  const remote = ensureWorker();
  await remote.upsert(doc);
}

export async function removeDocument(path: string): Promise<void> {
  const remote = ensureWorker();
  await remote.remove(path);
}

export async function searchDocuments(query: string): Promise<SearchHit[]> {
  const remote = ensureWorker();
  return remote.search(query);
}

export function disposeSearchWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    api = null;
  }
}
