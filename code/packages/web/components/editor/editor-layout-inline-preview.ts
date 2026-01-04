import type { InlineEditOperation } from '@zadoox/shared';
import { applyInlineOperations, buildInlineBlocksAroundCursor } from './editor-layout-inline-edit';

type CursorPosition = { line: number; column: number } | null;
type Placement = 'before' | 'after';

export function previewInsertAtCursor(params: {
  cursorPosition: CursorPosition;
  editFormat: 'markdown' | 'latex';
  latexDraft: string;
  content: string;
  insertContent: string;
  placement: Placement;
}): { operations: InlineEditOperation[]; previewText: string; newContent: string } {
  const { cursorPosition, editFormat, latexDraft, content, insertContent, placement } = params;

  if (!cursorPosition) {
    return { operations: [], previewText: '', newContent: editFormat === 'latex' ? latexDraft : content };
  }

  if (editFormat === 'latex') {
    const src = latexDraft;
    const lines = src.split('\n');
    const lineIdx = Math.max(0, Math.min(cursorPosition.line - 1, Math.max(0, lines.length - 1)));
    let lineStart = 0;
    for (let i = 0; i < lineIdx; i++) lineStart += (lines[i]?.length ?? 0) + 1;
    const lineEnd = lineStart + (lines[lineIdx]?.length ?? 0);
    const lineEndWithNewline = lineEnd + (lineIdx < lines.length - 1 ? 1 : 0);
    const insertAt = placement === 'before' ? lineStart : lineEndWithNewline;
    const newLatex = src.slice(0, insertAt) + insertContent + src.slice(insertAt);
    return { operations: [], previewText: insertContent, newContent: newLatex };
  }

  const cursorLine = cursorPosition.line - 1; // Convert to 0-based
  const { blocks, cursorBlockId } = buildInlineBlocksAroundCursor(content, cursorLine);
  const anchorBlockId = cursorBlockId;
  if (!anchorBlockId) {
    return { operations: [], previewText: '', newContent: content };
  }

  const operations: InlineEditOperation[] = [
    placement === 'before'
      ? { type: 'insert_before', anchorBlockId, content: insertContent }
      : { type: 'insert_after', anchorBlockId, content: insertContent },
  ];

  const newContent = applyInlineOperations(content, blocks, operations);
  return { operations, previewText: insertContent, newContent };
}


