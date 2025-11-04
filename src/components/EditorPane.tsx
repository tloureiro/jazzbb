import { Component, createEffect, onCleanup, onMount } from 'solid-js';
import { editorStore } from '../state/editor';
import CodeEditor from './CodeEditor';
import { parseNote } from '../platform/parser-service';
import { sanitizeHtml, renderMarkdown, extractHeadings } from '../lib/markdown';
import { saveActiveNote } from '../platform/save-note';
import { hasUnsavedChanges } from '../lib/note-stats';
import { showToast } from '../state/ui';
import { workspaceStore, isVaultMode } from '../state/workspace';
import { renameNote } from '../platform/note-manager';
import { SCRATCH_TITLE } from '../state/editor';

const EditorPane: Component = () => {
  let parseTimer: number | undefined;
  let requestId = 0;
  let autosaveTimer: number | undefined;
  let autosaveInFlight = false;
  let titleInputRef: HTMLInputElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const handleChange = (value: string) => {
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

  const handleKeydown = async (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      await saveActiveNote();
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
    containerRef?.addEventListener('pointerdown', handleContainerMouseDownCapture, { capture: true });
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeydown);
    containerRef?.removeEventListener('pointerdown', handleContainerMouseDownCapture, { capture: true });
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

    event.preventDefault();
    window.requestAnimationFrame(() => focusEditorFromContainer());
  };

  return (
    <section class="editor-pane" aria-label="Editor">
      <header class="pane-header">
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
      </header>
      <div class="editor-container" ref={containerRef}>
        <CodeEditor value={editorStore.draft} onChange={handleChange} />
      </div>
    </section>
  );
};

export default EditorPane;
