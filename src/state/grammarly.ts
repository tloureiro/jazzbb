import { createSignal } from 'solid-js';

const SUPPRESSION_RULES = `
.tiptap-editor [data-grammarly-part],
.tiptap-editor [class*='grammarly-'],
.tiptap-editor .heading-is-collapsed [data-grammarly-part],
.tiptap-editor .heading-collapsed-content [data-grammarly-part],
.tiptap-editor .heading-collapsed-content + [data-grammarly-part],
.tiptap-editor .heading-is-collapsed [class*='grammarly-'],
.tiptap-editor .heading-collapsed-content [class*='grammarly-'],
.tiptap-editor .heading-collapsed-content + [class*='grammarly-'],
.tiptap-editor .heading-is-collapsed grammarly-extension,
.tiptap-editor .heading-collapsed-content grammarly-extension,
.tiptap-editor .heading-collapsed-content + grammarly-extension,
.tiptap-editor .heading-collapsed-content ~ grammarly-extension,
[contenteditable] ~ grammarly-extension,
input ~ grammarly-extension,
textarea ~ grammarly-extension,
[contenteditable] ~ [class*='grammarly-'],
input ~ [class*='grammarly-'],
textarea ~ [class*='grammarly-'] {
  display: none !important;
}
`;

let styleElement: HTMLStyleElement | null = null;

function injectSuppression() {
  if (typeof document === 'undefined') return;
  if (styleElement) return;
  styleElement = document.createElement('style');
  styleElement.id = 'jazzbb-grammarly-suppression';
  styleElement.textContent = SUPPRESSION_RULES;
  document.head.appendChild(styleElement);
}

function removeSuppression() {
  if (!styleElement) return;
  styleElement.remove();
  styleElement = null;
}

function detectGrammarly(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector(
      'grammarly-extension, [data-grammarly-part], [class*="grammarly-"], grammarly-editor-plugin, #grammarly-extension',
    ),
  );
}

const [isSuppressed, setSuppressedSignal] = createSignal(false);
let collapseSuppressed = false;

export const grammarlyStore = {
  isSuppressed,
  isCollapseSuppressed() {
    return collapseSuppressed;
  },
  initialize() {
    if (detectGrammarly()) {
      collapseSuppressed = false;
      this.setSuppressed(true);
    }
  },
  setSuppressed(value: boolean) {
    setSuppressedSignal(value);
    if (value) {
      injectSuppression();
    } else {
      removeSuppression();
      collapseSuppressed = false;
    }
  },
  suppressForCollapse() {
    if (collapseSuppressed) return;
    if (isSuppressed()) return;
    collapseSuppressed = true;
    this.setSuppressed(true);
  },
  releaseCollapseSuppression() {
    if (!collapseSuppressed) return;
    collapseSuppressed = false;
    this.setSuppressed(false);
  },
  toggle() {
    collapseSuppressed = false;
    this.setSuppressed(!isSuppressed());
  },
};
