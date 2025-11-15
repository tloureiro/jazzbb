import { describe, it, expect } from 'vitest';
import { extractFrontmatter, normalizeFrontmatterContent, parseFrontmatter } from '../../../src/lib/frontmatter';

describe('frontmatter helpers', () => {
  it('extracts frontmatter sections with body', () => {
    const markdown = ['---', 'title: Demo', 'tags:', '  - notes', '---', '', '# Heading'].join('\n');
    const result = extractFrontmatter(markdown);
    expect(result).toBeTruthy();
    expect(result?.content.trim()).toBe('title: Demo\ntags:\n  - notes');
    expect(result?.body.trimStart()).toBe('# Heading');
  });

  it('detects windows newlines and preserves body spacing', () => {
    const markdown = '---\r\ntitle: Demo\r\n---\r\n\r\nParagraph';
    const result = extractFrontmatter(markdown);
    expect(result).toBeTruthy();
    expect(result?.open).toBe('---\r\n');
    expect(result?.close).toBe('\r\n---\r\n\r\n');
    expect(result?.body).toBe('Paragraph');
  });

  it('parses yaml when valid', () => {
    const parsed = parseFrontmatter('title: Demo\nnested:\n  done: true');
    expect(parsed.value).toEqual({ title: 'Demo', nested: { done: true } });
    expect(parsed.error).toBeUndefined();
  });

  it('returns an error for invalid yaml', () => {
    const parsed = parseFrontmatter('title: [unterminated');
    expect(parsed.value).toBeUndefined();
    expect(parsed.error).toBeTruthy();
  });

  it('normalizes line endings consistently', () => {
    expect(normalizeFrontmatterContent('a\r\nb\r\nc')).toBe('a\nb\nc');
  });
});
