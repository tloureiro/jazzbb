import { load } from 'js-yaml';

const FRONTMATTER_PATTERN =
  /^(?<open>\ufeff?---\s*(?:\r?\n))(?<content>[\s\S]*?)(?<close>(?:\r?\n)---\s*(?:\r?\n|$))/;

export type FrontmatterSection = {
  raw: string;
  open: string;
  close: string;
  content: string;
  body: string;
};

export type FrontmatterMetadata = {
  value: unknown;
  error?: string;
};

export function extractFrontmatter(markdown: string): FrontmatterSection | undefined {
  const match = FRONTMATTER_PATTERN.exec(markdown);
  if (!match || !match.groups) {
    return undefined;
  }

  const { open = '', content = '', close = '' } = match.groups;
  const raw = match[0];
  const body = markdown.slice(raw.length);

  return { raw, open, close, content, body };
}

export function parseFrontmatter(content: string): FrontmatterMetadata {
  const trimmed = content.trim();
  if (!trimmed) {
    return { value: undefined };
  }

  try {
    const parsed = load(content);
    return { value: parsed ?? undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse frontmatter';
    return { value: undefined, error: message };
  }
}

export function normalizeFrontmatterContent(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}
