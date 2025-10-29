import { describe, expect, beforeEach, it } from 'vitest';
import { parseNote, disposeParserWorker } from '../../../src/platform/parser-service';

describe('parser service fallback', () => {
  beforeEach(() => {
    disposeParserWorker();
  });

  it('parses markdown even when workers are unavailable', async () => {
    const originalWorker = globalThis.Worker;
    // Ensure Worker is not defined to force the fallback path
    // @ts-expect-error - test environment override
    delete globalThis.Worker;

    const result = await parseNote('### Test', { path: 'note.md', lastModified: 123 });
    expect(result.html).toContain('<h3>Test</h3>');
    expect(result.title).toBe('Test');
    expect(result.links).toEqual([]);
    expect(result.headings).toEqual([
      {
        id: 'test',
        text: 'Test',
        level: 3,
        line: 1,
      },
    ]);

    if (originalWorker) {
      // @ts-expect-error - restore Worker stub
      globalThis.Worker = originalWorker;
    } else {
      // @ts-expect-error - restore to undefined when initially absent
      delete globalThis.Worker;
    }
  });
});
