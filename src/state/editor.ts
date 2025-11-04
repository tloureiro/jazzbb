import { createSignal } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';
import type { HeadingInfo } from '../lib/markdown-engine';
import { mapHeadingsToText } from '../lib/markdown-engine';

const DEFAULT_SCRATCH_TITLE = 'Untitled';
export const SCRATCH_TITLE = DEFAULT_SCRATCH_TITLE;

const [activePath, setActivePath] = createSignal<string | undefined>(undefined);
const [content, setContent] = createSignal<string>('');
const [draft, setDraftValue] = createSignal<string>('');
const [html, setHtml] = createSignal<string>('');
const [links, setLinks] = createSignal<string[]>([]);
const [lastLoaded, setLastLoaded] = createSignal<number>(0);
const [headings, setHeadingsSignal] = createSignal<HeadingInfo[]>([]);
const [activeHeadingId, setActiveHeadingId] = createSignal<string | undefined>(undefined);
const [editorInstance, setEditorInstance] = createSignal<Editor | undefined>(undefined);
const [displayName, setDisplayNameSignal] = createSignal<string>(DEFAULT_SCRATCH_TITLE);
let pendingFocus: 'start' | 'end' | undefined;

function normalizeDisplayName(path: string | undefined, fallback: string): string {
  if (path) {
    const base = path.split('/').pop() ?? path;
    return base.replace(/\.md$/i, '') || fallback;
  }
  return fallback;
}

function applyHeadings(list: HeadingInfo[]): void {
  setHeadingsSignal(list);
  if (!list.some((heading) => heading.id === activeHeadingId())) {
    setActiveHeadingId(list[0]?.id);
  }
}

function updateActiveHeadingFromEditor(): void {
  const editor = editorInstance();
  if (!editor) return;
  const headingsList = headings();
  if (headingsList.length === 0) {
    setActiveHeadingId(undefined);
    return;
  }

  const selectionPos = editor.state.selection.from;
  const positioned = mapHeadingsToText(editor.state.doc, headingsList);
  let currentId: string | undefined;
  for (const entry of positioned) {
    if (entry.pos <= selectionPos) {
      currentId = entry.id;
    } else {
      break;
    }
  }

  if (!currentId) {
    currentId = headingsList[0]?.id;
  }

  setActiveHeadingId(currentId);
}

export const editorStore = {
  activePath,
  content,
  html,
  links,
  draft,
  lastLoaded,
  headings,
  activeHeadingId,
  displayName,
  registerEditor(editor: Editor) {
    setEditorInstance(editor);
    if (pendingFocus) {
      editor.chain().focus(pendingFocus).run();
      pendingFocus = undefined;
    }
    updateActiveHeadingFromEditor();
  },
  unregisterEditor() {
    setEditorInstance(undefined);
  },
  focus(at: 'start' | 'end' = 'end') {
    const instance = editorInstance();
    if (!instance) {
      pendingFocus = at;
      return false;
    }
    instance.chain().focus(at).run();
    pendingFocus = undefined;
    return true;
  },
  updateSelectionHeading() {
    updateActiveHeadingFromEditor();
  },
  setDocument(
    path: string | undefined,
    raw: string,
    sanitized: string,
    linkTargets: string[],
    headingTargets: HeadingInfo[],
    timestamp: number,
  ) {
    setActivePath(path);
    setContent(raw);
    setDraftValue(raw);
    setHtml(sanitized);
    setLinks(linkTargets);
    applyHeadings(headingTargets);
    setDisplayNameSignal(normalizeDisplayName(path, DEFAULT_SCRATCH_TITLE));
    setLastLoaded(timestamp);
    updateActiveHeadingFromEditor();
  },
  setDraft(value: string) {
    setDraftValue(value);
  },
  setPreview(markup: string, linkTargets: string[], headingTargets: HeadingInfo[]) {
    setHtml(markup);
    setLinks(linkTargets);
    applyHeadings(headingTargets);
    updateActiveHeadingFromEditor();
  },
  setActiveHeading(id: string | undefined) {
    setActiveHeadingId(id);
  },
  setDisplayName(value: string) {
    setDisplayNameSignal(value);
  },
  scrollToHeading(id: string) {
    const editor = editorInstance();
    if (!editor) return;
    const headingsList = headings();
    if (headingsList.length === 0) return;
    const positioned = mapHeadingsToText(editor.state.doc, headingsList);
    const target = positioned.find((entry) => entry.id === id);
    if (!target) return;
    const doc = editor.state.doc;
    const pos = Math.min(target.pos + 1, doc.content.size);
    const selection = TextSelection.create(doc, pos);
    editor.view.dispatch(editor.state.tr.setSelection(selection));
    editor.commands.focus();
    editor.commands.scrollIntoView();
    setActiveHeadingId(id);
  },
  reset() {
    setActivePath(undefined);
    setContent('');
    setDraftValue('');
    setHtml('');
    setLinks([]);
    setHeadingsSignal([]);
    setActiveHeadingId(undefined);
    setEditorInstance(undefined);
    setDisplayNameSignal(DEFAULT_SCRATCH_TITLE);
    setLastLoaded(0);
  }
};
