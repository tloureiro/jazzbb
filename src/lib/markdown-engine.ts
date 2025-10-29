import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import { highlightCode } from './syntax';

export type HeadingInfo = {
  id: string;
  text: string;
  level: number;
  line: number;
};

function createMarkdownEngine() {
  return new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight(code, language) {
      const { html, detectedLanguage } = highlightCode(code, language);
      const rawLanguage = detectedLanguage ?? language ?? 'auto';
      const languageClass = rawLanguage.replace(/[^\w+-]+/g, '');
      return `<pre class="hljs"><code class="language-${languageClass}">${html}</code></pre>`;
    },
  })
    .use(footnote)
    .use(taskLists, { label: true, labelAfter: true });
}

const engine = createMarkdownEngine();

type MarkdownItInstance = ReturnType<typeof createMarkdownEngine>;
type MarkdownToken = ReturnType<MarkdownItInstance['parse']>[number];

function slugBase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+={}[\]|\\:;"'<>,.?/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateHeadingId(text: string, slugCounts: Map<string, number>): string {
  const base = slugBase(text) || 'section';
  const count = slugCounts.get(base) ?? 0;
  slugCounts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeMath(html: string): string {
  /* eslint-disable-next-line no-useless-escape */
  const blockMath = html.replace(/\$\$([^$]+?)\$\$/gs, (_, expression: string | number) => {
    const safe = typeof expression === 'string' ? expression.trim() : String(expression ?? '');
    return `<div class="math-display">${escapeHtml(safe)}</div>`;
  });

  /* eslint-disable-next-line no-useless-escape */
  return blockMath.replace(/(^|[^\])\$(?!\$)([^$]+?)\$/g, (_, prefix: string, expression: string | number) => {
    const safe = typeof expression === 'string' ? expression.trim() : String(expression ?? '');
    return `${prefix}<span class="math-inline">${escapeHtml(safe)}</span>`;
  });
}

export function renderUnsafeMarkdown(markdown: string): string {
  const rendered = engine.render(markdown);
  return normalizeMath(rendered);
}

export function extractHeadings(markdown: string): HeadingInfo[] {
  const tokens = engine.parse(markdown, {});
  const slugs = new Map<string, number>();
  const headings: HeadingInfo[] = [];

  const getLevel = (token: MarkdownToken): number | null => {
    if (!token.tag || !token.tag.startsWith('h')) return null;
    const level = Number.parseInt(token.tag.slice(1), 10);
    return Number.isNaN(level) ? null : level;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'heading_open') continue;
    const inline = tokens[index + 1];
    if (!inline || inline.type !== 'inline') continue;
    const text = inline.content.trim();
    if (!text) continue;
    const level = getLevel(token);
    if (!level) continue;
    const id = generateHeadingId(text, slugs);
    const line = token.map ? token.map[0] + 1 : headings.length + 1;
    headings.push({ id, text, level, line });
  }

  return headings;
}

export function mapHeadingsToText(
  doc: import('@tiptap/pm/model').Node,
  headings: HeadingInfo[],
): Array<{ id: string; pos: number }> {
  const positions: Array<{ id: string; pos: number }> = [];
  if (headings.length === 0) return positions;

  let headingIndex = 0;
  doc.descendants((node, pos) => {
    if (node.type?.name === 'heading') {
      const heading = headings[headingIndex];
      if (heading) {
        positions.push({ id: heading.id, pos });
      }
      headingIndex += 1;
      return false;
    }
    return undefined;
  });
  return positions;
}

export function extractTitle(markdown: string, fallback: string): string {
  const match = markdown.match(/^\s*#{1,6}\s+(.+)$/m);
  if (match?.[1]) {
    return match[1].replace(/\s+#+\s*$/, '').trim();
  }

  const basename = fallback.split('/').pop() ?? fallback;
  return basename.replace(/\.md$/i, '').replace(/[-_]/g, ' ').trim() || basename;
}

export function extractLinks(markdown: string): string[] {
  const wikiLinks = [...markdown.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1]);
  const mdLinks = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  return [...new Set([...wikiLinks, ...mdLinks])];
}
