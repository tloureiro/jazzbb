import { describe, it, expect, afterEach } from 'vitest';
import {
  getShortcutLabel,
  setShortcutOverride,
  resetAllShortcuts,
  isShortcutEvent,
  bindingFromEvent,
  findShortcutUsingBinding,
} from '../../../src/lib/shortcuts';

describe('shortcuts', () => {
  afterEach(() => {
    resetAllShortcuts();
  });

  it('formats default bindings per platform', () => {
    expect(getShortcutLabel('open-file', 'mac')).toBe('Cmd + Option + O');
    expect(getShortcutLabel('open-file', 'windows')).toBe('Ctrl + Alt + O');
  });

  it('applies overrides only to the specified platform', () => {
    setShortcutOverride('save-note', { key: 'l', meta: true }, 'mac');
    expect(getShortcutLabel('save-note', 'mac')).toBe('Cmd + L');
    expect(getShortcutLabel('save-note', 'windows')).toBe('Ctrl + S');
  });

  it('matches events against custom bindings', () => {
    setShortcutOverride('toggle-top-bar', { key: 'arrowup', ctrl: true }, 'windows');
    const event = new KeyboardEvent('keydown', { key: 'ArrowUp', ctrlKey: true });
    expect(isShortcutEvent(event, 'toggle-top-bar', 'windows')).toBe(true);
  });

  it('reports conflicts for occupied bindings', () => {
    const event = new KeyboardEvent('keydown', { key: 'n', metaKey: true });
    const binding = bindingFromEvent(event);
    expect(binding).not.toBeNull();
    if (binding) {
      expect(findShortcutUsingBinding(binding, 'mac')).toBe('new-note');
    }
  });
});
