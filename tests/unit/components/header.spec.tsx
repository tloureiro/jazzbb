import { render, screen, fireEvent } from '@solidjs/testing-library';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import Header from '../../../src/components/Header';
import { workspaceStore } from '../../../src/state/workspace';
import { setSidebarCollapsed } from '../../../src/state/ui';

describe('Header browser support notice', () => {
  beforeEach(() => {
    workspaceStore.reset();
    setSidebarCollapsed(false);
  });

  afterEach(() => {
    // Ensure test mutations of the File System Access API flag do not leak across tests.
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
    setSidebarCollapsed(false);
  });

  it('shows a warning when File System Access is unavailable', () => {
    render(() => <Header />);

    expect(screen.getByText(/Saving notes requires a Chromium-based browser/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss save warning/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Editor font size')).toBeInTheDocument();
  });

  it('hides the warning when File System Access is supported', () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    render(() => <Header />);

    expect(screen.queryByText(/Saving notes requires a Chromium-based browser/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Editor font size')).toBeInTheDocument();
  });

  it('allows dismissing the warning banner', () => {
    render(() => <Header />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss save warning/i }));

    expect(screen.queryByText(/Saving notes requires a Chromium-based browser/i)).not.toBeInTheDocument();
  });

  it('exposes save to browser and save to file controls in scratch mode', () => {
    render(() => <Header />);

    expect(screen.getByRole('button', { name: /Save to browser/i })).toBeInTheDocument();
    const saveFileButton = screen.getByRole('button', { name: /Save to file/i });
    expect(saveFileButton).toBeInTheDocument();
    expect(saveFileButton).not.toBeDisabled();
  });

  it('offers export control while in browser vault mode', () => {
    workspaceStore.setMode('browser');
    render(() => <Header />);

    expect(screen.getByRole('button', { name: /Save to browser/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save to file/i })).toBeInTheDocument();
  });

  it('toggles sidebar collapse via shortcut in browser mode', () => {
    workspaceStore.setMode('browser');
    render(() => <Header />);

    expect(document.documentElement.dataset.sidebarCollapsed).toBe('false');

    const event = new KeyboardEvent('keydown', { key: 'B', ctrlKey: true, shiftKey: true });
    window.dispatchEvent(event);

    expect(document.documentElement.dataset.sidebarCollapsed).toBe('true');
  });
});
