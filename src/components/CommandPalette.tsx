import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount, type Accessor, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getShortcutLabel, isShortcutEvent, subscribeToShortcutChanges } from '../lib/shortcuts';

export type CommandPaletteCommand = {
  id: string;
  label: string;
  subtitle?: string;
  keywords?: string;
  shortcut?: string;
  badge?: string;
  disabled?: boolean;
  run: () => void | Promise<void>;
};

export type CommandPaletteProps = {
  commands: Accessor<ReadonlyArray<CommandPaletteCommand>>;
  onClose: () => void;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

const CommandPalette: Component<CommandPaletteProps> = (props) => {
  const [query, setQuery] = createSignal('');
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  const [shortcutsVersion, setShortcutsVersion] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  onCleanup(
    subscribeToShortcutChanges(() => {
      setShortcutsVersion((value) => value + 1);
    }),
  );

  const filteredCommands = createMemo(() => {
    const value = normalize(query());
    const items = props.commands();
    if (!value.trim()) {
      return items;
    }
    return items.filter((command) => {
      const haystack = [command.label, command.subtitle ?? '', command.keywords ?? '']
        .map((part) => normalize(part))
        .join(' ');
      return haystack.includes(value);
    });
  });

  createEffect(() => {
    const list = filteredCommands();
    if (list.length === 0) {
      setHighlightedIndex(0);
      return;
    }
    setHighlightedIndex((current) => Math.min(current, Math.max(list.length - 1, 0)));
  });

  createEffect(() => {
    void query();
    setHighlightedIndex(0);
  });

  const handleRun = async (command: CommandPaletteCommand) => {
    if (command.disabled) {
      return;
    }
    await command.run();
    props.onClose();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (isShortcutEvent(event, 'escape')) {
      event.preventDefault();
      props.onClose();
      return;
    }

    if (isShortcutEvent(event, 'open-command-palette')) {
      event.preventDefault();
      props.onClose();
      return;
    }

    const commands = filteredCommands();
    if (commands.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, Math.max(commands.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      const command = commands[highlightedIndex()];
      if (command) {
        event.preventDefault();
        void handleRun(command);
      }
    }
  };

  const handleOverlayClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      props.onClose();
    }
  };

  onMount(() => {
    inputRef?.focus();
    window.addEventListener('keydown', handleKeydown);
  });

  const escapeLabel = createMemo(() => {
    shortcutsVersion();
    return getShortcutLabel('escape') || 'Esc';
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  return (
    <Portal>
      <div class="command-palette-backdrop" role="presentation" onClick={handleOverlayClick}>
        <div class="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
          <div class="command-palette__input">
            <input
              type="text"
              placeholder="Type a command..."
              value={query()}
              ref={(ref) => (inputRef = ref)}
              onInput={(event) => setQuery(event.currentTarget.value)}
              aria-label="Command palette input"
            />
            <button type="button" onClick={() => props.onClose()} aria-label="Close command palette">
              {escapeLabel()}
            </button>
          </div>
          <Show
            when={filteredCommands().length > 0}
            fallback={
              <p class="command-palette__empty" role="status">
                No matching commands
              </p>
            }
          >
            <ul class="command-palette__list" role="listbox">
              <For each={filteredCommands()}>
                {(command, index) => (
                  <li>
                    <button
                      type="button"
                      class="command-palette__item"
                      data-active={highlightedIndex() === index()}
                      data-disabled={command.disabled ? 'true' : 'false'}
                      onMouseEnter={() => setHighlightedIndex(index())}
                      onClick={() => void handleRun(command)}
                      role="option"
                      aria-selected={highlightedIndex() === index()}
                      disabled={command.disabled}
                    >
                      <span class="command-palette__label">{command.label}</span>
                      <Show when={command.subtitle}>
                        {(subtitle) => <span class="command-palette__subtitle">{subtitle()}</span>}
                      </Show>
                      <div class="command-palette__meta">
                        <Show when={command.badge}>
                          {(badge) => <span class="command-palette__badge">{badge()}</span>}
                        </Show>
                        <Show when={command.shortcut}>
                          {(shortcut) => <span class="command-palette__shortcut">{shortcut()}</span>}
                        </Show>
                      </div>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </Portal>
  );
};

export default CommandPalette;
