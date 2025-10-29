import { describe, expect, it } from 'vitest';
import { analyzeMarkdownStats, hasUnsavedChanges } from '../../../src/lib/note-stats';

describe('analyzeMarkdownStats', () => {
  it('returns zero metrics for empty content', () => {
    const stats = analyzeMarkdownStats('');
    expect(stats).toEqual({
      words: 0,
      characters: 0,
      lines: 0,
      headings: 0,
      tasks: {
        total: 0,
        completed: 0,
      },
    });
  });

  it('counts basic markdown elements', () => {
    const stats = analyzeMarkdownStats(`# Title\n\n### Section\nContent here.\n- [x] task done\n- [ ] task todo`);

    expect(stats.words).toBe(8);
    expect(stats.characters).toBeGreaterThan(0);
    expect(stats.lines).toBe(5);
    expect(stats.headings).toBe(2);
    expect(stats.tasks.total).toBe(2);
    expect(stats.tasks.completed).toBe(1);
  });
});

describe('hasUnsavedChanges', () => {
  it('detects when draft differs from persisted content', () => {
    expect(hasUnsavedChanges('Hello', 'Hello')).toBe(false);
    expect(hasUnsavedChanges('Hello', 'Hello!')).toBe(true);
  });
});
