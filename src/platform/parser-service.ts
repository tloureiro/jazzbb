import { wrap, type Remote } from 'comlink';
import type { ParserApi, ParseResult, ParseNoteRequest } from '../workers/parser.worker';
import { renderUnsafeMarkdown, extractLinks, extractTitle, extractHeadings } from '../lib/markdown-engine';

let worker: Worker | null = null;
let api: Remote<ParserApi> | null = null;
let workerFailed = false;

function getWorker(): Remote<ParserApi> {
  if (!api) {
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers are not supported in this environment.');
    }
    worker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), {
      type: 'module',
    });
    api = wrap<ParserApi>(worker);
  }
  return api;
}

function fallbackParse(content: string, meta: ParseNoteRequest): ParseResult {
  const html = renderUnsafeMarkdown(content);
  return {
    html,
    title: extractTitle(content, meta.path),
    links: extractLinks(content),
    headings: extractHeadings(content),
    lastModified: meta.lastModified,
  };
}

export async function parseNote(content: string, meta: ParseNoteRequest): Promise<ParseResult> {
  if (workerFailed) {
    return fallbackParse(content, meta);
  }

  try {
    const remote = getWorker();
    return await remote.parseNote(content, meta);
  } catch (error) {
    console.warn('Falling back to inline markdown parsing', error);
    workerFailed = true;
    if (worker) {
      worker.terminate();
      worker = null;
      api = null;
    }
    return fallbackParse(content, meta);
  }
}

export function disposeParserWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    api = null;
  }
  workerFailed = false;
}
