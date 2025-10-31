import { render, screen, fireEvent } from '@solidjs/testing-library';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import Header from '../../../src/components/Header';
import { workspaceStore } from '../../../src/state/workspace';

describe('Header browser support notice', () => {
  beforeEach(() => {
    workspaceStore.reset();
  });

  afterEach(() => {
    // Ensure test mutations of the File System Access API flag do not leak across tests.
    delete (window as typeof window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
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
});
