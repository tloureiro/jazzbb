import { describe, expect, beforeEach, it } from 'vitest';
import { editorStore } from '../../../src/state/editor';

beforeEach(() => {
  editorStore.reset();
});

describe('editorStore', () => {
  it('updates active note metadata and content', () => {
    editorStore.setDocument('note.md', 'Hello', '<p>Hello</p>', ['link'], [], 42);
    editorStore.setDraft('Draft');
    editorStore.setPreview('<p>Preview</p>', ['another'], []);

    expect(editorStore.activePath()).toBe('note.md');
    expect(editorStore.content()).toBe('Hello');
    expect(editorStore.draft()).toBe('Draft');
    expect(editorStore.html()).toBe('<p>Preview</p>');
    expect(editorStore.links()).toEqual(['another']);
    expect(editorStore.displayName()).toBe('note');
    expect(editorStore.lastLoaded()).toBe(42);
  });

  it('resets back to initial state', () => {
    editorStore.setDocument('note.md', 'Hello', '<p>Hello</p>', ['link'], [], 42);
    editorStore.setDraft('Temp');

    editorStore.reset();

    expect(editorStore.activePath()).toBeUndefined();
    expect(editorStore.content()).toBe('');
    expect(editorStore.draft()).toBe('');
    expect(editorStore.html()).toBe('');
    expect(editorStore.links()).toEqual([]);
    expect(editorStore.displayName()).toBe('Scratch note');
    expect(editorStore.lastLoaded()).toBe(0);
  });
});
