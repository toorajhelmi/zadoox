import type { FormatType } from './floating-format-menu';
import { buildInlineBlocksAroundCursor } from './editor-layout-inline-edit';

export type EditorEditMode = 'markdown' | 'latex';

export function getActiveEditorText(params: {
  editMode: EditorEditMode;
  content: string;
  latexDraft: string;
}): string {
  return params.editMode === 'latex' ? params.latexDraft : params.content;
}

export function getSurfaceCapabilities(editMode: EditorEditMode) {
  return {
    editMode,
    supportsInlineAiEdits: editMode === 'markdown',
  };
}

export function pickUndoRedo<T extends { undo: () => void; redo: () => void }>(params: {
  editMode: EditorEditMode;
  markdown: T;
  latex: T;
}): T {
  return params.editMode === 'latex' ? params.latex : params.markdown;
}

export function pickByEditMode<T>(params: { editMode: EditorEditMode; markdown: T; latex: T }): T {
  return params.editMode === 'latex' ? params.latex : params.markdown;
}

export function getTypingHistoryAdapter(params: {
  editMode: EditorEditMode;
  markdown: {
    debounceTimeoutRef: { current: NodeJS.Timeout | null };
    previousValueRef: { current: string };
  };
  latex: {
    debounceTimeoutRef: { current: NodeJS.Timeout | null };
    previousValueRef: { current: string };
  };
}) {
  return pickByEditMode({
    editMode: params.editMode,
    markdown: params.markdown,
    latex: params.latex,
  });
}

export function getCursorScopeText(params: {
  editMode: EditorEditMode;
  selectionText: string | null;
  cursorPosition: { line: number; column: number } | null;
  content: string;
  latexDraft: string;
}): string {
  const { selectionText, cursorPosition, editMode, content, latexDraft } = params;
  if (selectionText && selectionText.trim().length > 0) return selectionText;
  if (!cursorPosition) return '';

  if (editMode === 'latex') {
    const lines = latexDraft.split('\n');
    const idx = Math.max(0, Math.min(cursorPosition.line - 1, Math.max(0, lines.length - 1)));
    return (lines[idx] ?? '').trim();
  }

  const cursorLine = cursorPosition.line - 1;
  const { blocks, cursorBlockId } = buildInlineBlocksAroundCursor(content, cursorLine);
  const cursorBlock = blocks.find((b) => b.id === cursorBlockId);
  if (cursorBlock?.kind === 'paragraph') return cursorBlock.text;

  const idx = blocks.findIndex((b) => b.id === cursorBlockId);
  for (let i = idx - 1; i >= 0; i--) {
    if (blocks[i]?.kind === 'paragraph') return blocks[i].text;
  }
  return cursorBlock?.text || '';
}

type LineStyle = 'title' | 'heading1' | 'heading2' | 'heading3' | 'paragraph';

export function getSurfaceSyntax(editMode: EditorEditMode) {
  const detectLineStyle = (trimmedLine: string): LineStyle => {
    if (editMode === 'latex') {
      if (/^\\title\{/.test(trimmedLine)) return 'title';
      if (/^\\section\{/.test(trimmedLine)) return 'heading1';
      if (/^\\subsection\{/.test(trimmedLine)) return 'heading2';
      if (/^\\subsubsection\{/.test(trimmedLine)) return 'heading3';
      return 'paragraph';
    }

    if (/^@\s+/.test(trimmedLine)) return 'title';
    const m = /^(#{1,6})\s+/.exec(trimmedLine);
    if (!m) return 'paragraph';
    const level = m[1].length;
    if (level === 1) return 'heading1';
    if (level === 2) return 'heading2';
    return 'heading3';
  };

  const replaceLineAsHeading = (lineText: string, level: number | null): string => {
    const trimmed = lineText.trimStart();
    if (editMode === 'latex') {
      const stripLatex = (t: string) => {
        const m =
          /^\\(title|section|subsection|subsubsection)\{([\s\S]*)\}\s*$/.exec(t) ||
          /^\\(title|section|subsection|subsubsection)\{([\s\S]*)\}\s*$/.exec(t.trim());
        if (m) return String(m[2] ?? '');
        return t.replace(/^\s+/, '');
      };
      const core = stripLatex(trimmed);
      if (level === null) return core;
      if (level === 0) return core;
      const cmd = level === 1 ? '\\section' : level === 2 ? '\\subsection' : '\\subsubsection';
      return `${cmd}{${core}}`;
    }

    const stripped = lineText.replace(/^\s*(?:@\s+|#{1,6}\s+)/, '');
    if (level === null) return stripped;
    const hashes = '#'.repeat(level);
    return `${hashes} ${stripped}`;
  };

  const replaceLineAsTitle = (lineText: string): string => {
    if (editMode === 'latex') {
      const stripped = lineText
        .replace(/^\s*\\(title|section|subsection|subsubsection)\{/, '')
        .replace(/\}\s*$/, '');
      return `\\title{${stripped}}`;
    }
    const stripped = lineText.replace(/^\s*(?:@\s+|#{1,6}\s+)/, '');
    return `@ ${stripped}`;
  };

  const wrapInline = (
    format: Exclude<FormatType, 'title' | 'heading1' | 'heading2' | 'heading3' | 'paragraph'>,
    text: string
  ) => {
    if (editMode === 'latex') {
      if (format === 'bold') return `\\textbf{${text}}`;
      if (format === 'italic') return `\\emph{${text}}`;
      if (format === 'underline') return `\\underline{${text}}`;
      if (format === 'superscript') return `\\textsuperscript{${text}}`;
      if (format === 'subscript') return `\\textsubscript{${text}}`;
      if (format === 'code') return `\\texttt{${text}}`;
      if (format === 'link') return `\\href{https://example.com}{${text}}`;
      return text;
    }
    if (format === 'bold') return `**${text}**`;
    if (format === 'italic') return `*${text}*`;
    if (format === 'underline') return `<u>${text}</u>`;
    if (format === 'superscript') return `<sup>${text}</sup>`;
    if (format === 'subscript') return `<sub>${text}</sub>`;
    if (format === 'code') return `\`${text}\``;
    if (format === 'link') return `[${text}](https://example.com)`;
    return text;
  };

  const placeholderForInline = (
    format: Exclude<FormatType, 'title' | 'heading1' | 'heading2' | 'heading3' | 'paragraph'>
  ) => {
    if (editMode === 'latex') {
      if (format === 'bold') return '\\textbf{}';
      if (format === 'italic') return '\\emph{}';
      if (format === 'underline') return '\\underline{}';
      if (format === 'superscript') return '\\textsuperscript{}';
      if (format === 'subscript') return '\\textsubscript{}';
      if (format === 'code') return '\\texttt{}';
      if (format === 'link') return '\\href{https://example.com}{}';
      return '';
    }
    if (format === 'bold') return '****';
    if (format === 'italic') return '**';
    if (format === 'underline') return '<u></u>';
    if (format === 'superscript') return '<sup></sup>';
    if (format === 'subscript') return '<sub></sub>';
    if (format === 'code') return '``';
    if (format === 'link') return '[]()';
    return '';
  };

  return { detectLineStyle, replaceLineAsHeading, replaceLineAsTitle, wrapInline, placeholderForInline };
}


