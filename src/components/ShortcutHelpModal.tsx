import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { Component, JSX } from 'solid-js';
import { APP_VERSION } from '../version';
import {
  getActiveShortcutPlatform,
  getPlatformDisplayName,
  getShortcutGroups,
  type ShortcutGroup,
  type ShortcutId,
  setShortcutOverride,
  resetShortcutOverride,
  resetAllShortcuts,
  bindingFromEvent,
  findShortcutUsingBinding,
  getShortcutDefinition,
  subscribeToShortcutChanges,
} from '../lib/shortcuts';

type ShortcutHelpModalProps = {
  onClose: () => void;
  footer?: JSX.Element;
};

const ShortcutHelpModal: Component<ShortcutHelpModalProps> = (props) => {
  let closeButtonRef: HTMLButtonElement | undefined;
  let captureListener: ((event: KeyboardEvent) => void) | null = null;
  const [editingId, setEditingId] = createSignal<ShortcutId | null>(null);
  const [captureError, setCaptureError] = createSignal<string | null>(null);
  const [shortcutsVersion, setShortcutsVersion] = createSignal(0);

  const stopCapture = () => {
    if (captureListener) {
      document.removeEventListener('keydown', captureListener, true);
      captureListener = null;
    }
    setEditingId(null);
    setCaptureError(null);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      stopCapture();
      props.onClose();
    }
  };

  const handleOverlayClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      stopCapture();
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    queueMicrotask(() => closeButtonRef?.focus());
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeydown);
    stopCapture();
  });

  const platform = getActiveShortcutPlatform();
  const platformName = getPlatformDisplayName(platform);
  onCleanup(
    subscribeToShortcutChanges(() => {
      setShortcutsVersion((value) => value + 1);
    }),
  );
  const shortcutGroups = createMemo<ShortcutGroup[]>(() => {
    shortcutsVersion();
    return getShortcutGroups(platform);
  });

  const handleStartCapture = (id: ShortcutId) => {
    if (editingId() === id) {
      return;
    }
    stopCapture();
    setEditingId(id);
    setCaptureError(null);
    captureListener = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.key === 'Escape' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        stopCapture();
        return;
      }
      const binding = bindingFromEvent(event);
      if (!binding) {
        setCaptureError('Press a non-modifier key to finish.');
        return;
      }
      const conflict = findShortcutUsingBinding(binding, platform, id);
      if (conflict) {
        const conflictDefinition = getShortcutDefinition(conflict);
        setCaptureError(`Already assigned to “${conflictDefinition?.description ?? conflict}”.`);
        return;
      }
      try {
        setShortcutOverride(id, binding, platform);
        stopCapture();
      } catch (error) {
        setCaptureError(error instanceof Error ? error.message : 'Failed to record shortcut.');
      }
    };
    document.addEventListener('keydown', captureListener, { capture: true });
  };

  const handleResetShortcut = (id: ShortcutId) => {
    resetShortcutOverride(id, platform);
    if (editingId() === id) {
      stopCapture();
    }
  };

  const handleResetAll = () => {
    stopCapture();
    resetAllShortcuts(platform);
  };

  const isListening = (id: ShortcutId) => editingId() === id;

  return (
    <Portal>
      <div class="modal-backdrop" role="presentation" onClick={handleOverlayClick}>
        <div class="shortcut-modal" role="dialog" aria-modal="true" aria-labelledby="shortcut-modal-title">
          <header class="shortcut-modal__header">
            <h2 id="shortcut-modal-title">Keyboard shortcuts</h2>
            <span class="shortcut-modal__version" aria-label="Application version">
              v{APP_VERSION}
            </span>
            <button
              type="button"
              class="icon-button shortcut-modal__close"
              onClick={() => {
                stopCapture();
                props.onClose();
              }}
              aria-label="Close shortcuts panel"
              data-test="help-close"
              ref={closeButtonRef}
            >
              ×
            </button>
          </header>
          <p class="shortcut-modal__intro">
            Shortcuts below are tailored for {platformName}. Click any shortcut chip to record your own binding—saved
            only in this browser.
          </p>
          <div class="shortcut-modal__controls">
            <button type="button" class="secondary" onClick={handleResetAll}>
              Reset all to defaults
            </button>
          </div>
          <For each={shortcutGroups()}>
            {(group) => (
              <section class="shortcut-modal__group">
                <h3>{group.title}</h3>
                <ul class="shortcut-modal__list">
                  <For each={group.items}>
                    {(item) => (
                      <li
                        class="shortcut-modal__item"
                        data-custom={item.custom ? 'true' : 'false'}
                        data-editing={isListening(item.id) ? 'true' : 'false'}
                      >
                        <button
                          type="button"
                          class="shortcut-modal__keys-button"
                          onClick={() => handleStartCapture(item.id)}
                          disabled={isListening(item.id)}
                          aria-live="polite"
                        >
                          {isListening(item.id) ? 'Press new shortcut…' : item.keys || 'Set custom shortcut'}
                        </button>
                        <div class="shortcut-modal__details">
                          <span class="shortcut-modal__description">{item.description}</span>
                          {item.note && <span class="shortcut-modal__note">{item.note}</span>}
                          <Show when={item.custom && !isListening(item.id)}>
                            <button
                              type="button"
                              class="shortcut-modal__reset-button"
                              onClick={() => handleResetShortcut(item.id)}
                            >
                              Reset
                            </button>
                          </Show>
                          <Show when={isListening(item.id) && captureError()}>
                            {(message) => <p class="shortcut-modal__error">{message()}</p>}
                          </Show>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            )}
          </For>
          {props.footer && <div class="shortcut-modal__footer">{props.footer}</div>}
        </div>
      </div>
    </Portal>
  );
};

export default ShortcutHelpModal;
