import type { InlineEditOperation } from '@zadoox/shared';
import { applyInlineOperations, buildInlineBlocksAroundCursor } from './editor-layout-inline-edit';
import { ensureLatexPreambleForLatexContent } from './latex-preamble';

type CursorPosition = { line: number; column: number } | null;
type Placement = 'before' | 'after';

export function previewInsertAtCursor(params: {
  cursorPosition: CursorPosition;
  editMode: 'markdown' | 'latex';
  latexDraft: string;
  content: string;
  insertContent: string;
  placement: Placement;
}): { operations: InlineEditOperation[]; previewText: string; newContent: string } {
  const { cursorPosition, editMode, latexDraft, content, insertContent, placement } = params;

  if (!cursorPosition) {
    return { operations: [], previewText: '', newContent: editMode === 'latex' ? latexDraft : content };
  }

  if (editMode === 'latex') {
    const src = latexDraft;
    // Avoid introducing accidental blank lines around inserted blocks.
    // (Wizards may include a trailing newline; we keep that, but drop leading newlines.)
    const normalizedInsert = String(insertContent ?? '').replace(/^\n+/, '');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'grid-insert',hypothesisId:'H2',location:'editor-layout-inline-preview.ts:previewInsertAtCursor',message:'LaTeX insert normalization',data:{placement,leadingNewlinesStripped:(String(insertContent??'').match(/^\n+/)?.[0]?.length||0),normalizedHead:String(normalizedInsert).slice(0,60)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    const lines = src.split('\n');
    const lineIdx = Math.max(0, Math.min(cursorPosition.line - 1, Math.max(0, lines.length - 1)));
    const lineText = String(lines[lineIdx] ?? '');
    const isBlankLine = lineText.trim().length === 0;
    let lineStart = 0;
    for (let i = 0; i < lineIdx; i++) lineStart += (lines[i]?.length ?? 0) + 1;
    const lineEnd = lineStart + (lines[lineIdx]?.length ?? 0);
    const lineEndWithNewline = lineEnd + (lineIdx < lines.length - 1 ? 1 : 0);
    const insertAt = placement === 'before' ? lineStart : lineEndWithNewline;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'grid-insert',hypothesisId:'H2',location:'editor-layout-inline-preview.ts:previewInsertAtCursor',message:'LaTeX insert position context',data:{lineIdx,lineTextHead:lineText.slice(0,80),isBlankLine,insertAt,prevChar:src[insertAt-1]||null,nextChar:src[insertAt]||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    let newLatex = src.slice(0, insertAt) + normalizedInsert + src.slice(insertAt);
    // Ensure required packages exist whenever we mutate LaTeX content.
    newLatex = ensureLatexPreambleForLatexContent(newLatex).latex;

    return { operations: [], previewText: normalizedInsert, newContent: newLatex };
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


