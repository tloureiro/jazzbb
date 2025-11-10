import 'tiptap-markdown';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleHeadingCollapse: (options?: { pos?: number; collapsed?: boolean }) => ReturnType;
    collapseHeadingAt: (pos?: number) => ReturnType;
    expandHeadingAt: (pos?: number) => ReturnType;
    ensureHeadingVisible: () => ReturnType;
  }
}
