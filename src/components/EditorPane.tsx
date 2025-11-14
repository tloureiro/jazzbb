import { Component, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { editorStore } from '../state/editor';
import CodeEditor from './CodeEditor';
import FrontmatterEditor from './FrontmatterEditor';
import { parseNote } from '../platform/parser-service';
import { sanitizeHtml, renderMarkdown, extractHeadings } from '../lib/markdown';
import { saveActiveNote } from '../platform/save-note';
import { hasUnsavedChanges } from '../lib/note-stats';
import {
  showToast,
  isPlainMarkdownMode,
  togglePlainMarkdownMode,
  isFrontmatterVisible,
  toggleFrontmatterVisibility,
} from '../state/ui';
import { workspaceStore, isVaultMode } from '../state/workspace';
import { renameNote } from '../platform/note-manager';
import { SCRATCH_TITLE } from '../state/editor';
import { closeActiveDocument } from '../lib/documents';
import { getShortcutLabel, isShortcutEvent, subscribeToShortcutChanges } from '../lib/shortcuts';
import { deleteCurrentLine } from '../lib/editorShortcuts';
import type { CollapseCommandSet } from '../extensions/collapsibleHeading';

const EditorPane: Component = () => {
  let parseTimer: number | undefined;
  let requestId = 0;
  let autosaveTimer: number | undefined;
  let autosaveInFlight = false;
  let titleInputRef: HTMLInputElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let findModeActive = false;
  let plainEditorRef: HTMLTextAreaElement | undefined;
  const [shortcutsVersion, setShortcutsVersion] = createSignal(0);
  onCleanup(
    subscribeToShortcutChanges(() => {
      setShortcutsVersion((value) => value + 1);
    }),
  );

  const plainMode = isPlainMarkdownMode;
  const frontmatterVisible = isFrontmatterVisible;
  const frontmatterSection = editorStore.frontmatter;
  const formatShortcutTitle = (label: string, id: Parameters<typeof getShortcutLabel>[0]) => {
    shortcutsVersion();
    const keys = getShortcutLabel(id);
    return keys ? `${label} (${keys})` : label;
  };

  const editorValue = createMemo(() => {
    const current = editorStore.draft();
    if (plainMode()) {
      return current;
    }
    const frontmatter = frontmatterSection();
    if (!frontmatter) {
      return current;
    }
    return frontmatter.body;
  });

  const frontmatterContent = createMemo(() => frontmatterSection()?.content ?? '');

  const canCloseDocument = createMemo(() => {
    const mode = workspaceStore.mode();
    if (mode === 'single') return true;
    if ((mode === 'browser' || mode === 'vault') && editorStore.activePath()) return true;
    if (mode === 'scratch' && editorStore.activePath()) return true;
    return false;
  });

  const handleCloseDocument = async () => {
    const result = await closeActiveDocument();
    if (result.status === 'closed') {
      const message = result.context === 'single' ? 'Closed file' : 'Closed note';
      showToast(message, 'info');
    }
  };

  const applyDraftUpdate = (value: string) => {
    editorStore.setDraft(value);
    const path = editorStore.activePath();

    if (parseTimer !== undefined) {
      window.clearTimeout(parseTimer);
    }

    const currentRequest = ++requestId;
    parseTimer = window.setTimeout(async () => {
      if (!path) {
        if (requestId !== currentRequest || editorStore.draft() !== value) {
          return;
        }
        editorStore.setPreview(renderMarkdown(value), [], extractHeadings(value));
        return;
      }

      try {
        const parsed = await parseNote(value, { path, lastModified: Date.now() });
        if (requestId !== currentRequest || editorStore.draft() !== value) {
          return;
        }
        const sanitized = sanitizeHtml(parsed.html);
        editorStore.setPreview(sanitized, parsed.links, parsed.headings);
      } catch (error) {
        console.error('Failed to parse markdown', error);
      }
    }, 150);
  };

  const handleChange = (value: string) => {
    const frontmatter = frontmatterSection();
    const shouldAttachFrontmatter = !plainMode() && !frontmatterVisible();
    const nextValue = shouldAttachFrontmatter && frontmatter ? `${frontmatter.raw}${value}` : value;
    applyDraftUpdate(nextValue);
  };

  const handleFrontmatterChange = (content: string) => {
    const frontmatter = frontmatterSection();
    if (!frontmatter) {
      return;
    }
    const nextValue = `${frontmatter.open}${content}${frontmatter.close}${frontmatter.body}`;
    applyDraftUpdate(nextValue);
  };

  const requestFrontmatterToggle = (): boolean => {
    if (!frontmatterSection()) {
      showToast('This note has no frontmatter yet.', 'info');
      return false;
    }
    toggleFrontmatterVisibility();
    return true;
  };

  const handlePlainInput = (event: Event) => {
    const target = event.currentTarget as HTMLTextAreaElement;
    handleChange(target.value);
  };

  const deletePlaintextLine = (): boolean => {
    if (!plainEditorRef) {
      return false;
    }
    const target = plainEditorRef;
    const value = target.value ?? '';
    const selectionStart = target.selectionStart ?? 0;
    const selectionEnd = target.selectionEnd ?? selectionStart;

    if (selectionStart !== selectionEnd) {
      const next = value.slice(0, selectionStart) + value.slice(selectionEnd);
      target.value = next;
      target.setSelectionRange(selectionStart, selectionStart);
      handleChange(next);
      return true;
    }

    if (value.length === 0) {
      return false;
    }

    let lineStart = selectionStart;
    while (lineStart > 0 && value[lineStart - 1] !== '\n') {
      lineStart -= 1;
    }

    let lineEnd = selectionStart;
    while (lineEnd < value.length && value[lineEnd] !== '\n') {
      lineEnd += 1;
    }
    if (lineEnd < value.length) {
      lineEnd += 1;
    }

    const next = value.slice(0, lineStart) + value.slice(lineEnd);
    const cursor = Math.min(lineStart, next.length);
    target.value = next;
    target.setSelectionRange(cursor, cursor);
    handleChange(next);
    return true;
  };

  const deleteActiveLine = (): boolean => {
    if (plainMode()) {
      return deletePlaintextLine();
    }
    const editor = editorStore.getEditor();
    if (!editor) {
      return false;
    }
    return deleteCurrentLine(editor);
  };

  const toggleHeadingCollapseShortcut = (): boolean => {
    if (plainMode()) {
      return false;
    }
    const editor = editorStore.getEditor();
    if (!editor) {
      return false;
    }
    const commands = editor.commands as typeof editor.commands & Partial<CollapseCommandSet>;
    if (typeof commands.toggleHeadingCollapse !== 'function') {
      return false;
    }
    const result = commands.toggleHeadingCollapse();
    if (result) {
      editor.commands.focus();
    }
    return result;
  };

  const handleKeydown = async (event: KeyboardEvent) => {
    if (isShortcutEvent(event, 'close-document')) {
      event.preventDefault();
      await handleCloseDocument();
      return;
    }

    if (isShortcutEvent(event, 'toggle-plain-markdown')) {
      event.preventDefault();
      togglePlainMarkdownMode();
      queueMicrotask(() => {
        if (plainMode()) {
          plainEditorRef?.focus();
        } else {
          editorStore.focus();
        }
      });
      return;
    }

    if (isShortcutEvent(event, 'save-note')) {
      event.preventDefault();
      await saveActiveNote();
      return;
    }

    if (isShortcutEvent(event, 'toggle-heading-collapse')) {
      const handled = toggleHeadingCollapseShortcut();
      if (handled) {
        event.preventDefault();
      }
      return;
    }

    if (isShortcutEvent(event, 'toggle-frontmatter')) {
      const handled = requestFrontmatterToggle();
      if (handled) {
        event.preventDefault();
      }
      return;
    }

    if (isShortcutEvent(event, 'delete-line')) {
      const handled = deleteActiveLine();
      if (handled) {
        event.preventDefault();
      }
      return;
    }

    const modifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (modifier && key === 'f') {
      findModeActive = true;
      editorStore.requestAutoExpandOnNextSelection();
      return;
    }

    if (modifier && key === 'g') {
      findModeActive = true;
      editorStore.requestAutoExpandOnNextSelection();
      return;
    }

    if (event.key === 'F3') {
      findModeActive = true;
      editorStore.requestAutoExpandOnNextSelection();
      return;
    }

    if (event.key === 'Enter' && findModeActive && !modifier && !event.altKey && !event.shiftKey) {
      editorStore.requestAutoExpandOnNextSelection();
      return;
    }

    if (event.key === 'Escape') {
      findModeActive = false;
      return;
    }

    const editingKey =
      key === 'enter' ||
      key === 'backspace' ||
      key === 'delete' ||
      (!modifier && !event.altKey && event.key.length === 1);
    if (editingKey) {
      if (key === 'enter') {
        editorStore.ensureHeadingVisibleImmediately();
      } else {
        editorStore.requestAutoExpandOnNextSelection();
      }
    }
  };

  const clearAutosaveTimer = () => {
    if (autosaveTimer !== undefined) {
      window.clearTimeout(autosaveTimer);
      autosaveTimer = undefined;
    }
  };

  const triggerAutosave = () => {
    clearAutosaveTimer();
    const path = editorStore.activePath();
    if (!path) {
      return;
    }

    autosaveTimer = window.setTimeout(async () => {
      autosaveTimer = undefined;
      if (autosaveInFlight) {
        return;
      }

      if (!editorStore.activePath() || !hasUnsavedChanges(editorStore.draft(), editorStore.content())) {
        return;
      }

      autosaveInFlight = true;
      const result = await saveActiveNote();
      autosaveInFlight = false;

      if (result.status === 'saved') {
        showToast('Autosaved', 'success');
      } else if (result.status === 'error' || result.status === 'no-handle') {
        showToast('Autosave failed', 'error');
      }
    }, 2000);
  };

  createEffect(() => {
    const mode = workspaceStore.mode();
    if (mode !== 'vault') {
      clearAutosaveTimer();
      return;
    }

    const path = editorStore.activePath();
    const draft = editorStore.draft();
    const persisted = editorStore.content();

    if (!path) {
      clearAutosaveTimer();
      return;
    }

    if (hasUnsavedChanges(draft, persisted)) {
      triggerAutosave();
    } else {
      clearAutosaveTimer();
    }
  });

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    if (typeof window !== 'undefined') {
      const runtime = window as typeof window & { __requestAutoExpand?: () => void };
      runtime.__requestAutoExpand = () => editorStore.requestAutoExpandOnNextSelection();
    }
    containerRef?.addEventListener('pointerdown', handleContainerMouseDownCapture, { capture: true });
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeydown);
    containerRef?.removeEventListener('pointerdown', handleContainerMouseDownCapture, { capture: true });
    if (typeof window !== 'undefined') {
      const runtime = window as typeof window & { __requestAutoExpand?: () => void };
      if (runtime.__requestAutoExpand) {
        delete runtime.__requestAutoExpand;
      }
    }
    if (parseTimer !== undefined) {
      window.clearTimeout(parseTimer);
    }
    clearAutosaveTimer();
  });

  const baseFileName = () => {
    const path = editorStore.activePath();
    if (!path) return '';
    const base = path.split('/').pop() ?? path;
    return base.replace(/\.md$/i, '');
  };

  const handleTitleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    editorStore.setDisplayName(target.value);
  };

  const commitTitle = async () => {
    const raw = editorStore.displayName();
    const trimmed = raw.trim();
    const finalName = trimmed || SCRATCH_TITLE;
    if (!trimmed) {
      editorStore.setDisplayName(finalName);
    }

    const path = editorStore.activePath();
    if (!path) {
      return;
    }

    const currentBase = baseFileName();
    if (finalName === currentBase) {
      return;
    }

    if (!isVaultMode()) {
      showToast('Renaming is only supported in vault mode right now.', 'info');
      editorStore.setDisplayName(currentBase || SCRATCH_TITLE);
      return;
    }

    const result = await renameNote(path, finalName);
    if (result.status === 'duplicate') {
      showToast('A note with that title already exists.', 'error');
      editorStore.setDisplayName(currentBase || SCRATCH_TITLE);
    } else if (result.status !== 'renamed') {
      showToast('Failed to rename note.', 'error');
      editorStore.setDisplayName(currentBase || SCRATCH_TITLE);
    }
  };

  const handleTitleBlur = async () => {
    await commitTitle();
  };

  const handleTitleKeydown = async (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await commitTitle();
      titleInputRef?.blur();
    } else if (event.key === 'Escape') {
      editorStore.setDisplayName(baseFileName() || SCRATCH_TITLE);
      titleInputRef?.blur();
    }
  };

  const focusEditorFromContainer = (attemptsRemaining = 30) => {
    if (plainMode()) {
      plainEditorRef?.focus();
      return;
    }
    const focused = editorStore.focus();
    if (focused) {
      return;
    }

    const root = document.querySelector<HTMLElement>('.tiptap-editor');
    if (root) {
      root.focus();
      return;
    }

    if (attemptsRemaining <= 0) {
      return;
    }

    window.requestAnimationFrame(() => focusEditorFromContainer(attemptsRemaining - 1));
  };

  const handleContainerMouseDownCapture = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest('.tiptap-editor')) {
      return;
    }

    if (plainMode() && target.closest('[data-test="plain-markdown-editor"]')) {
      return;
    }

    event.preventDefault();
    window.requestAnimationFrame(() => focusEditorFromContainer());
  };

  return (
    <section class="editor-pane" aria-label="Editor">
      <header class="pane-header">
        <div class="editor-title-row">
          <div class="editor-title-group">
            <input
              ref={titleInputRef}
              type="text"
              class="editor-title-input"
              value={editorStore.displayName()}
              onInput={handleTitleInput}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeydown}
              aria-label="Note title"
            />
            {editorStore.activeHeadingLevel() > 0 && (
              <span
                class="heading-level-badge"
                aria-label={`Heading level ${editorStore.activeHeadingLevel()}`}
              >
                H{editorStore.activeHeadingLevel()}
              </span>
            )}
            <Show when={!plainMode() && frontmatterSection()}>
              <button
                type="button"
                class="frontmatter-indicator"
                aria-label={frontmatterVisible() ? 'Hide frontmatter' : 'Show frontmatter'}
                title={frontmatterVisible() ? 'Hide frontmatter' : 'Show frontmatter'}
                data-active={frontmatterVisible() ? 'true' : 'false'}
                onClick={() => {
                  requestFrontmatterToggle();
                }}
              >
                FM
              </button>
            </Show>
          </div>
          <Show when={canCloseDocument()}>
            <button
              type="button"
              class="editor-close-button"
              onClick={handleCloseDocument}
              aria-label="Close document"
              title={formatShortcutTitle('Close document', 'close-document')}
              data-test="editor-close-document"
            >
              ×
            </button>
          </Show>
        </div>
      </header>
      <div class="editor-container" ref={containerRef}>
        <Show when={!plainMode() && frontmatterVisible() && frontmatterSection()}>
          <FrontmatterEditor value={frontmatterContent} onChange={handleFrontmatterChange} />
        </Show>
        <div class="rich-editor-host" classList={{ 'is-hidden': plainMode() }}>
          <CodeEditor value={editorValue} onChange={handleChange} />
        </div>
        <Show when={plainMode()}>
          <textarea
            ref={(node) => {
              plainEditorRef = node ?? undefined;
            }}
            class="plain-markdown-editor"
            value={editorStore.draft()}
            onInput={handlePlainInput}
            spellcheck={false}
            aria-label="Plain markdown editor"
            data-test="plain-markdown-editor"
          />
        </Show>
      </div>
    </section>
  );
};

export default EditorPane;
