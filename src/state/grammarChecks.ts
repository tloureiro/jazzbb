import { createSignal } from 'solid-js';

const SUPPRESSION_STYLE_ID = 'jazzbb-grammar-suppression';
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
  styleElement.id = SUPPRESSION_STYLE_ID;
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
const [browserSpellcheckEnabled, setBrowserSpellcheckEnabled] = createSignal(true);
let collapseSuppressed = false;
let userSuppressed = false;

function updateSuppression() {
  const shouldSuppress = userSuppressed || collapseSuppressed;
  setSuppressedSignal(shouldSuppress);
  if (shouldSuppress) {
    injectSuppression();
  } else {
    removeSuppression();
  }
}

function setGrammarChecksEnabled(enabled: boolean) {
  userSuppressed = !enabled;
  collapseSuppressed = false;
  setBrowserSpellcheckEnabled(enabled);
  updateSuppression();
}

function toggleGrammarChecks() {
  setGrammarChecksEnabled(!browserSpellcheckEnabled());
}

export const grammarChecksStore = {
  isSuppressed,
  isGrammarChecksEnabled() {
    return browserSpellcheckEnabled();
  },
  isCollapseSuppressed() {
    return collapseSuppressed;
  },
  initialize() {
    setGrammarChecksEnabled(!detectGrammarly());
  },
  toggleGrammarChecks,
  toggle: toggleGrammarChecks,
  suppressForCollapse() {
    if (collapseSuppressed) return;
    if (userSuppressed) return;
    collapseSuppressed = true;
    updateSuppression();
  },
  releaseCollapseSuppression() {
    if (!collapseSuppressed) return;
    collapseSuppressed = false;
    updateSuppression();
  },
};
