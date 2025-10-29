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

const FRONTMATTER_OPENERS = ['+++', '---'] as const;
const HEADING_ESCAPE_PATTERN = /(^|\n)\\(#{1,6}\s)/g;

export function normalizeSerializedMarkdown(markdown: string): string {
  const normalizedFrontMatter = normalizeFrontMatter(markdown);
  return normalizedFrontMatter.replace(HEADING_ESCAPE_PATTERN, '$1$2');
}

function normalizeFrontMatter(markdown: string): string {
  let opener: (typeof FRONTMATTER_OPENERS)[number] | undefined;
  let searchFrom = 0;

  for (const marker of FRONTMATTER_OPENERS) {
    if (!markdown.startsWith(marker)) continue;
    const next = markdown.charAt(marker.length);
    if (next === '\n') {
      opener = marker;
      searchFrom = marker.length + 1;
      break;
    }
    if (next === '\\' && markdown.charAt(marker.length + 1) === '\n') {
      opener = marker;
      searchFrom = marker.length + 2;
      break;
    }
  }

  if (!opener) return markdown;

  const closingSequence = `\n${opener}`;
  const closingIndex = markdown.indexOf(closingSequence, searchFrom);
  if (closingIndex === -1) return markdown;

  let frontMatterEnd = closingIndex + closingSequence.length;
  const afterClosing = markdown.charAt(frontMatterEnd);
  if (afterClosing === '\\' && markdown.charAt(frontMatterEnd + 1) === '\n') {
    frontMatterEnd += 2;
  } else if (afterClosing === '\n') {
    frontMatterEnd += 1;
  } else if (afterClosing === '\\') {
    frontMatterEnd += 1;
  }

  const frontMatterRaw = markdown.slice(0, frontMatterEnd).replace(/\\\n/g, '\n');
  const rest = markdown.slice(frontMatterEnd);

  const lines = frontMatterRaw.split('\n');
  const closingLineIndex = lines.lastIndexOf(opener);
  if (closingLineIndex === -1) {
    return frontMatterRaw + rest;
  }

  const cleaned: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (index === 0 || index === closingLineIndex) {
      cleaned.push(line.trimEnd());
      continue;
    }
    if (line.trim() === '') {
      continue;
    }
    cleaned.push(line.trim());
  }
  const frontMatter = cleaned.join('\n') + (frontMatterRaw.endsWith('\n') ? '\n' : '');
  return frontMatter + rest;
}
