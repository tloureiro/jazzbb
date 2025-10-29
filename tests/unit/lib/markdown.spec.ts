import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../../src/lib/markdown';

describe('renderMarkdown', () => {
  it('converts markdown to sanitized html', () => {
    const html = renderMarkdown('**bold** _italic_');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('supports task lists and footnotes', () => {
    const source = '- [x] done\n\nHere is a note[^1]\n\n[^1]: Footnote text';
    const html = renderMarkdown(source);
    expect(html).toContain('class="task-list-item"');
    expect(html).toContain('footnote-ref');
  });

  it('wraps math expressions', () => {
    const source = '$$a^2 + b^2$$ and also $c$';
    const html = renderMarkdown(source);
    expect(html).toContain('class="math-display"');
    expect(html).toContain('class="math-inline"');
  });

  it('strips unsafe html', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
