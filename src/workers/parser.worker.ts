import { expose } from 'comlink';
import { renderUnsafeMarkdown, extractTitle, extractLinks, extractHeadings, type HeadingInfo } from '../lib/markdown-engine';

export type ParseNoteRequest = {
  path: string;
  lastModified: number;
};

export type ParseResult = {
  html: string;
  title: string;
  links: string[];
  headings: HeadingInfo[];
  lastModified: number;
};

async function parseNote(content: string, meta: ParseNoteRequest): Promise<ParseResult> {
  return {
    html: renderUnsafeMarkdown(content),
    title: extractTitle(content, meta.path),
    links: extractLinks(content),
    headings: extractHeadings(content),
    lastModified: meta.lastModified,
  };
}

const api = { parseNote };

export type ParserApi = typeof api;

expose(api);
