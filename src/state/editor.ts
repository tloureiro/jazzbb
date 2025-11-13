import { createSignal } from 'solid-js';
import type { Editor } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';
import type { HeadingInfo } from '../lib/markdown-engine';
import { mapHeadingsToText } from '../lib/markdown-engine';

type CollapseCommands = {
  ensureHeadingVisible: () => boolean;
  expandHeadingAt: (pos?: number) => boolean;
};

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
const [activeHeadingLevel, setActiveHeadingLevel] = createSignal<number>(0);
const [editorInstance, setEditorInstance] = createSignal<Editor | undefined>(undefined);
const [displayName, setDisplayNameSignal] = createSignal<string>(DEFAULT_SCRATCH_TITLE);
let pendingFocus: 'start' | 'end' | undefined;
let autoExpandNextSelection = false;

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
  const currentId = activeHeadingId();
  if (!currentId) {
    setActiveHeadingLevel(0);
    return;
  }
  const match = list.find((heading) => heading.id === currentId);
  setActiveHeadingLevel(match?.level ?? 0);
}

function updateActiveHeadingFromEditor(): void {
  const editor = editorInstance();
  if (!editor) return;
  const headingsList = headings();
  if (headingsList.length === 0) {
    setActiveHeadingId(undefined);
    setActiveHeadingLevel(0);
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
  const match = headingsList.find((heading) => heading.id === currentId);
  setActiveHeadingLevel(match?.level ?? 0);
}

function expandCollapsedHeadingAtSelection(editor: Editor): void {
  const { state } = editor;
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== 'heading') continue;
    const pos = $from.before(depth);
    if (node.attrs.collapsed) {
      editor.view.dispatch(state.tr.setNodeAttribute(pos, 'collapsed', false));
    }
    break;
  }
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
  activeHeadingLevel,
  displayName,
  getEditor() {
    return editorInstance();
  },
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
    setActiveHeadingId(undefined);
    setActiveHeadingLevel(0);
    autoExpandNextSelection = false;
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
    const editor = editorInstance();
    if (editor && autoExpandNextSelection) {
      const commands = editor.commands as typeof editor.commands & CollapseCommands;
      commands.ensureHeadingVisible();
      expandCollapsedHeadingAtSelection(editor);
      autoExpandNextSelection = false;
    }
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
    autoExpandNextSelection = false;
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
    const headingsList = headings();
    const match = headingsList.find((heading) => heading.id === id);
    setActiveHeadingLevel(match?.level ?? 0);
  },
  setDisplayName(value: string) {
    setDisplayNameSignal(value);
  },
  requestAutoExpandOnNextSelection() {
    autoExpandNextSelection = true;
  },
  ensureHeadingVisibleImmediately() {
    const editor = editorInstance();
    if (!editor) return;
    const commands = editor.commands as typeof editor.commands & CollapseCommands;
    commands.ensureHeadingVisible();
    expandCollapsedHeadingAtSelection(editor);
    autoExpandNextSelection = false;
  },
  scrollToHeading(id: string, options?: { focusEditor?: boolean }) {
    const editor = editorInstance();
    if (!editor) return;
    const headingsList = headings();
    if (headingsList.length === 0) return;
    const positioned = mapHeadingsToText(editor.state.doc, headingsList);
    const target = positioned.find((entry) => entry.id === id);
    if (!target) return;
    const commands = editor.commands as typeof editor.commands & CollapseCommands;
    commands.expandHeadingAt(target.pos);
    const doc = editor.state.doc;
    const pos = Math.min(target.pos + 1, doc.content.size);
    const selection = TextSelection.create(doc, pos);
    editor.view.dispatch(editor.state.tr.setSelection(selection));
    const shouldFocus = options?.focusEditor ?? true;
    if (shouldFocus) {
      editor.commands.focus();
    }
    editor.commands.scrollIntoView();
    const match = headingsList.find((heading) => heading.id === id);
    setActiveHeadingLevel(match?.level ?? 0);
    setActiveHeadingId(id);
  },
  reset() {
    autoExpandNextSelection = false;
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
