import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export function deleteCurrentLine(editor: Editor): boolean {
  const { state, commands } = editor;
  const { doc, selection } = state;
  const { from, to } = selection;

  if (from !== to) {
    commands.deleteSelection();
    return true;
  }

  const $pos = doc.resolve(from);
  const parent: ProseMirrorNode = $pos.node($pos.depth);

  let listItemDepth: number | null = null;
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const nodeAtDepth = $pos.node(depth);
    if (nodeAtDepth.type.name === 'listItem') {
      listItemDepth = depth;
      break;
    }
  }

  if (listItemDepth !== null) {
    const fromPos = $pos.before(listItemDepth);
    const toPos = $pos.after(listItemDepth);
    commands.deleteRange({ from: fromPos, to: toPos });
    return true;
  }

  if (parent.type.name === 'codeBlock') {
    const line = getCodeBlockLineRange(parent, from - $pos.start());
    if (!line) return false;
    const absoluteLineStart = $pos.start() + line.start;
    const absoluteLineEnd = $pos.start() + line.end;
    commands.deleteRange({ from: absoluteLineStart, to: absoluteLineEnd });
    return true;
  }

  const parentStart = $pos.start();
  const parentEnd = $pos.end();
  const isBlockEmpty = parent.textContent.length === 0;

  if (isBlockEmpty && parent.type.isBlock && $pos.depth > 0) {
    commands.deleteNode(parent.type.name);
    return true;
  }

  commands.deleteRange({ from: parentStart, to: parentEnd });
  return true;
}

function getCodeBlockLineRange(node: ProseMirrorNode, offset: number): { start: number; end: number } | null {
  const text = node.textContent ?? '';
  if (text.length === 0) {
    return { start: 0, end: node.nodeSize - 2 };
  }

  let start = offset;
  let end = offset;

  while (start > 0 && text[start - 1] !== '\n') {
    start -= 1;
  }

  while (end < text.length && text[end] !== '\n') {
    end += 1;
  }

  if (end < text.length) {
    end += 1;
  }

  return { start, end };
}
