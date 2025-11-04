import { For, onCleanup, onMount } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { Component, JSX } from 'solid-js';
import { APP_VERSION } from '../version';

type ShortcutItem = {
  keys: string;
  description: string;
  note?: string;
};

type ShortcutGroup = {
  title: string;
  items: ShortcutItem[];
};

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    items: [
      { keys: 'Cmd/Ctrl + S', description: 'Save the current note' },
      { keys: 'Cmd/Ctrl + /', description: 'Open this shortcuts panel' },
      { keys: 'Cmd/Ctrl + Shift + H', description: 'Toggle the top bar' },
      { keys: 'Cmd/Ctrl + Shift + O', description: 'Toggle the outline panel' },
      { keys: 'Cmd/Ctrl + D', description: 'Delete the current line' },
      { keys: 'Escape', description: 'Close search or dismiss dialogs' },
    ],
  },
  {
    title: 'Vault mode',
    items: [
      { keys: 'Cmd/Ctrl + P', description: 'Search notes', note: 'Vault only' },
      { keys: 'Cmd/Ctrl + N', description: 'Create a new note', note: 'Vault only' },
    ],
  },
];

type ShortcutHelpModalProps = {
  onClose: () => void;
  footer?: JSX.Element;
};

const ShortcutHelpModal: Component<ShortcutHelpModalProps> = (props) => {
  let closeButtonRef: HTMLButtonElement | undefined;

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      props.onClose();
    }
  };

  const handleOverlayClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    queueMicrotask(() => closeButtonRef?.focus());
  });

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeydown);
  });

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
              onClick={() => props.onClose()}
              aria-label="Close shortcuts panel"
              data-test="help-close"
              ref={closeButtonRef}
            >
              ×
            </button>
          </header>
          <p class="shortcut-modal__intro">
            Stay in the flow with quick keys. Cmd indicates the Command key on macOS; use Ctrl on Windows and Linux.
          </p>
          <For each={SHORTCUT_GROUPS}>
            {(group) => (
              <section class="shortcut-modal__group">
                <h3>{group.title}</h3>
                <ul class="shortcut-modal__list">
                  <For each={group.items}>
                    {(item) => (
                      <li class="shortcut-modal__item">
                        <span class="shortcut-modal__keys">{item.keys}</span>
                        <div class="shortcut-modal__details">
                          <span class="shortcut-modal__description">{item.description}</span>
                          {item.note && <span class="shortcut-modal__note">{item.note}</span>}
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
