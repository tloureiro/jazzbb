import { describe, it, expect, beforeEach } from 'vitest';
import { workspaceStore } from '../../../src/state/workspace';

describe('workspaceStore', () => {
  beforeEach(() => {
    workspaceStore.reset();
  });

  it('defaults to scratch mode', () => {
    expect(workspaceStore.mode()).toBe('scratch');
  });

  it('tracks browser vault mode separately from file vault', () => {
    workspaceStore.setMode('browser');
    expect(workspaceStore.mode()).toBe('browser');

    workspaceStore.setMode('vault');
    expect(workspaceStore.mode()).toBe('vault');
  });

  it('clears single file state when switching away from single mode', () => {
    const fakeHandle = {} as unknown as FileSystemFileHandle;
    workspaceStore.setSingleFile({ handle: fakeHandle, path: '/tmp/example.md' });
    workspaceStore.setMode('single');
    expect(workspaceStore.singleFile()?.path).toBe('/tmp/example.md');

    workspaceStore.setMode('browser');
    expect(workspaceStore.singleFile()).toBeUndefined();
  });
});
