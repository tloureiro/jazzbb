export type PlainPasteContext = 'rich' | 'plain';

export type PlainPasteRequestDetail = {
  context?: PlainPasteContext;
  source?: string;
};

export const PLAIN_PASTE_EVENT = 'jazzbb:paste-plain-text';

export function dispatchPlainPasteEvent(detail?: PlainPasteRequestDetail): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  window.dispatchEvent(new CustomEvent<PlainPasteRequestDetail>(PLAIN_PASTE_EVENT, { detail }));
  return true;
}
