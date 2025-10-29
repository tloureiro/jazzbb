import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { EmojiSuggestion, defaultEmojiSuggestions, findEmojiSuggestions } from '../lib/emojiData';

type EmojiSuggestionOptions = {
  trigger: string;
  limit: number;
  suggestionClass: string;
};

type EmojiRenderProps = SuggestionProps<EmojiSuggestion>;

const createOptionElement = (
  item: EmojiSuggestion,
  isSelected: boolean,
  props: EmojiRenderProps,
  index: number,
  onHover: (index: number) => void,
): HTMLButtonElement => {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'emoji-suggestion__item';

  if (isSelected) {
    option.classList.add('is-selected');
  }

  option.innerHTML = `
    <span class="emoji-suggestion__emoji" aria-hidden="true">${item.emoji}</span>
    <span class="emoji-suggestion__content">
      <span class="emoji-suggestion__label">${item.label}</span>
      ${
        item.shortcodes.length
          ? `<span class="emoji-suggestion__shortcut">:${item.shortcodes[0].replace(/^:+|:+$/g, '')}:</span>`
          : ''
      }
    </span>
  `;

  option.addEventListener('mousedown', (event) => {
    event.preventDefault();
    props.command(item);
  });

  option.addEventListener('mouseenter', () => {
    onHover(index);
  });

  return option;
};

const renderEmptyState = (container: HTMLElement) => {
  const empty = document.createElement('div');
  empty.className = 'emoji-suggestion__empty';
  empty.textContent = 'No emoji found';
  container.appendChild(empty);
};

const updateSuggestionPosition = (element: HTMLElement, props: EmojiRenderProps) => {
  const rect = props.clientRect?.();
  if (!rect) {
    element.style.display = 'none';
    return;
  }

  element.style.display = 'flex';

  const margin = 6;
  element.style.left = `${rect.left + window.scrollX}px`;
  element.style.top = `${rect.bottom + window.scrollY + margin}px`;
};

export const EmojiSuggestionExtension = Extension.create<EmojiSuggestionOptions>({
  name: 'emojiSuggestion',

  addOptions() {
    return {
      trigger: ':',
      limit: 30,
      suggestionClass: 'emoji-suggestion',
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      Suggestion<EmojiSuggestion>({
        editor: this.editor,
        char: options.trigger,
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => {
          const trimmed = query.trim();
          if (!trimmed) {
            return defaultEmojiSuggestions.slice(0, options.limit);
          }
          return findEmojiSuggestions(query, options.limit);
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(props.emoji)
            .run();
        },
        render: () => {
          let element: HTMLElement | null = null;
          let currentProps: EmojiRenderProps | null = null;
          let selectedIndex = 0;

          const ensureElement = () => {
            if (!element) {
              element = document.createElement('div');
              element.className = options.suggestionClass;
            }
            return element;
          };

          const ensureSelectedVisible = () => {
            if (!element) return;
            const active = element.querySelector('.emoji-suggestion__item.is-selected');
            if (active instanceof HTMLElement) {
              active.scrollIntoView({ block: 'nearest' });
            }
          };

          const renderList = () => {
            if (!element || !currentProps) return;

            const el = element;
            const propsRef = currentProps;

            el.textContent = '';

            if (!propsRef.items.length) {
              renderEmptyState(el);
              return;
            }

            propsRef.items.forEach((item, index) => {
              const option = createOptionElement(item, index === selectedIndex, propsRef, index, (nextIndex) => {
                if (selectedIndex === nextIndex) return;
                selectedIndex = nextIndex;
                renderList();
              });
              el.appendChild(option);
            });

            ensureSelectedVisible();
          };

          return {
            onStart: (props) => {
              currentProps = props;
              selectedIndex = 0;
              const el = ensureElement();
              renderList();
              updateSuggestionPosition(el, props);
              if (!el.isConnected) {
                document.body.appendChild(el);
              }
            },
            onUpdate: (props) => {
              const el = element;
              if (!el) {
                return;
              }
              currentProps = props;
              if (!props.items.length) {
                selectedIndex = 0;
              } else if (selectedIndex >= props.items.length) {
                selectedIndex = props.items.length - 1;
              } else if (selectedIndex < 0) {
                selectedIndex = 0;
              }

              renderList();
              updateSuggestionPosition(el, props);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                if (element?.parentNode) {
                  element.parentNode.removeChild(element);
                }
                element = null;
                currentProps = null;
                selectedIndex = 0;
                return true;
              }

              if (!element || !currentProps || !currentProps.items.length) {
                return false;
              }

              if (props.event.key === 'ArrowDown') {
                props.event.preventDefault();
                selectedIndex = (selectedIndex + 1) % currentProps.items.length;
                renderList();
                return true;
              }

              if (props.event.key === 'ArrowUp') {
                props.event.preventDefault();
                selectedIndex = (selectedIndex - 1 + currentProps.items.length) % currentProps.items.length;
                renderList();
                return true;
              }

              if (props.event.key === 'Enter' || props.event.key === 'Tab') {
                props.event.preventDefault();
                const item = currentProps.items[selectedIndex];
                if (item) {
                  currentProps.command(item);
                  return true;
                }
              }

              return false;
            },
            onExit: () => {
              if (element?.parentNode) {
                element.parentNode.removeChild(element);
              }
              element = null;
              currentProps = null;
              selectedIndex = 0;
            },
          };
        },
      }),
    ];
  },
});

export default EmojiSuggestionExtension;
