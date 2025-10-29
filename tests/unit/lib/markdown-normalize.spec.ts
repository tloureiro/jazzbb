import { describe, expect, it } from 'vitest';
import { normalizeSerializedMarkdown } from '../../../src/lib/markdown';

describe('normalizeSerializedMarkdown', () => {
  it('removes trailing hard break escapes inside leading +++ front matter', () => {
    const exported = "+++\\\ndate = '2025-10-29T00:01:01-04:00'\\\ndraft = true\\\ntitle = 'First'\\\n+++\\\n\n### This is going to be the first";
    const normalized = normalizeSerializedMarkdown(exported);
    expect(normalized).toBe("+++\ndate = '2025-10-29T00:01:01-04:00'\ndraft = true\ntitle = 'First'\n+++\n\n### This is going to be the first");
  });

  it('handles YAML-style front matter delimiters', () => {
    const exported = '---\\\ntitle: Example\\\n---\\\n\nContent';
    const normalized = normalizeSerializedMarkdown(exported);
    expect(normalized).toBe('---\ntitle: Example\n---\n\nContent');
  });

  it('leaves escaped breaks outside front matter untouched', () => {
    const exported = 'Paragraph line\\\nContinues here';
    expect(normalizeSerializedMarkdown(exported)).toBe(exported);
  });

  it('unescapes heading markers added by serializer guards', () => {
    const exported = "+++\ndate = '2025-10-29T00:01:01-04:00'\ndraft = true\ntitle = 'First'\n+++\n\n\\### This is going to be the first";
    expect(normalizeSerializedMarkdown(exported)).toBe(
      "+++\ndate = '2025-10-29T00:01:01-04:00'\ndraft = true\ntitle = 'First'\n+++\n\n### This is going to be the first",
    );
  });

  it('removes blank lines introduced between front matter entries', () => {
    const exported = "+++\n\ndate = '2025-10-29T00:01:01-04:00'\n\n draft = true\n\ntitle = 'First'\n\n+++\n\nBody";
    expect(normalizeSerializedMarkdown(exported)).toBe(
      "+++\ndate = '2025-10-29T00:01:01-04:00'\ndraft = true\ntitle = 'First'\n+++\n\nBody",
    );
  });
});
