import createDOMPurify from 'dompurify';
import { renderUnsafeMarkdown as renderUnsafe, extractTitle, extractLinks, extractHeadings } from './markdown-engine';

const DOMPurify = createDOMPurify(
  (typeof window !== 'undefined' ? window : globalThis) as unknown as Window & typeof globalThis,
);

export { renderUnsafeMarkdown } from './markdown-engine';
export { extractTitle, extractLinks, extractHeadings };

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function renderMarkdown(markdown: string): string {
  return sanitizeHtml(renderUnsafe(markdown));
}
