import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { searchDocuments } from '../platform/search-service';
import { openNote } from '../platform/note-reader';
import { isShortcutEvent } from '../lib/shortcuts';

export type SearchPanelProps = {
  onClose: () => void;
};

function highlight(text: string, query: string): string {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return safe.replace(regex, (match) => `<mark>${match}</mark>`);
}

const SearchPanel: Component<SearchPanelProps> = (props) => {
  const [query, setQuery] = createSignal('');
  const [results, setResults] = createSignal<Array<{ path: string; title: string; snippet: string }>>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  onMount(() => {
    inputRef?.focus();
    window.addEventListener('keydown', handleKeydown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  createEffect(() => {
    const value = query();
    if (!value.trim()) {
      setResults([]);
      setError(null);
      setLoading(false);
      setSelectedIndex(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    searchDocuments(value)
      .then((hits) => {
        if (cancelled) return;
        setResults(hits);
        setError(null);
        setSelectedIndex(0);
      })
      .catch((err) => {
        console.error('Search failed', err);
        if (!cancelled) {
          setError('Search failed.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  });

  createEffect(() => {
    const list = results();
    const current = selectedIndex();
    if (current >= list.length) {
      setSelectedIndex(list.length > 0 ? list.length - 1 : 0);
    }
  });

  const handleOpen = async (path: string) => {
    await openNote(path);
    props.onClose();
  };

  const handleKeydown = async (event: KeyboardEvent) => {
    if (isShortcutEvent(event, 'escape')) {
      event.preventDefault();
      props.onClose();
      return;
    }

    if (isShortcutEvent(event, 'search-notes')) {
      event.preventDefault();
      inputRef?.focus();
      return;
    }

    const list = results();
    if (!list.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(list.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      const item = list[selectedIndex()];
      if (item) {
        event.preventDefault();
        await handleOpen(item.path);
      }
    }
  };

  const handleMouseEnter = (index: number) => {
    setSelectedIndex(index);
  };

  const highlightedResults = createMemo(() => {
    const currentQuery = query();
    return results().map((item) => ({
      ...item,
      highlightedTitle: highlight(item.title, currentQuery),
      highlightedSnippet: highlight(item.snippet, currentQuery),
    }));
  });

  return (
    <div class="search-panel">
      <header class="search-header">
        <input
          type="text"
          value={query()}
          ref={(ref) => (inputRef = ref)}
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search notes..."
        />
        <button type="button" class="secondary" onClick={() => props.onClose()}>
          Close
        </button>
      </header>
      <Show when={error()}>{(message) => <p class="banner banner-error">{message()}</p>}</Show>
      <Show when={loading()}>
        <p class="search-status">Searching...</p>
      </Show>
      <Show when={!loading() && results().length === 0 && query().trim().length > 0 && !error()}>
        <p class="search-status">No results</p>
      </Show>
      <Show when={results().length > 0}>
        <ul class="search-results">
          <For each={highlightedResults()}>
            {(item, index) => (
              <li>
                <button
                  type="button"
                  data-active={selectedIndex() === index()}
                  onMouseEnter={() => handleMouseEnter(index())}
                  onClick={() => handleOpen(item.path)}
                >
                  {/* eslint-disable-next-line solid/no-innerhtml */}
                  <div class="search-title" innerHTML={item.highlightedTitle} />
                  <div class="search-path">{item.path}</div>
                  {/* eslint-disable-next-line solid/no-innerhtml */}
                  <div class="search-snippet" innerHTML={item.highlightedSnippet} />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
};

export default SearchPanel;
