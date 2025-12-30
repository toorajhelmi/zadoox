'use client';

import { StateField, Transaction } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';

type BlockKind = 'paragraph' | 'section';

export interface EditorBlock {
  id: string; // para-{startLine}
  kind: BlockKind;
  startLine: number; // 0-based
  endLine: number; // 0-based, inclusive
  startPos: number; // doc position (from)
  endPos: number; // doc position (to), inclusive-ish for selection
  widgetPos: number; // where to place the widget (usually end of first line)
}

function isHeadingLine(text: string): number | null {
  const trimmed = text.trim();
  const m = /^(#{1,6})\s+/.exec(trimmed);
  if (!m) return null;
  return m[1].length;
}

function computeBlocks(doc: EditorView['state']['doc']): EditorBlock[] {
  const lines = doc.lines;
  const headingLevels: Array<{ line: number; level: number }> = [];

  // First pass: detect headings
  for (let i = 1; i <= lines; i++) {
    const line = doc.line(i);
    const level = isHeadingLine(line.text);
    if (level !== null) {
      headingLevels.push({ line: i, level });
    }
  }

  const hasHeadings = headingLevels.length > 0;

  const blocks: EditorBlock[] = [];

  if (!hasHeadings) {
    // Paragraph mode: contiguous non-empty lines are a block
    let startLine: number | null = null; // 0-based

    for (let i = 1; i <= lines; i++) {
      const line = doc.line(i);
      const isEmpty = line.text.trim().length === 0;

      if (!isEmpty && startLine === null) {
        startLine = i - 1;
      }

      const isLast = i === lines;
      if ((isEmpty || isLast) && startLine !== null) {
        const endLine = isEmpty ? i - 2 : i - 1; // inclusive, 0-based
        const startDocLine = doc.line(startLine + 1);
        const endDocLine = doc.line(endLine + 1);

        blocks.push({
          id: `para-${startLine}`,
          kind: 'paragraph',
          startLine,
          endLine,
          startPos: startDocLine.from,
          endPos: endDocLine.to,
          widgetPos: startDocLine.to,
        });

        startLine = null;
      }
    }

    return blocks;
  }

  // Section mode:
  // - Each heading line starts a block
  // - A heading block includes all content until the next heading with level <= current (recursive subsection inclusion)
  // - Any content before the first heading becomes a paragraph-like block

  // Preamble block (before first heading), if any non-empty content
  const firstHeadingLine1 = headingLevels[0]!.line; // 1-based
  let hasPreamble = false;
  for (let i = 1; i < firstHeadingLine1; i++) {
    const t = doc.line(i).text.trim();
    if (t.length > 0) {
      hasPreamble = true;
      break;
    }
  }
  if (hasPreamble) {
    // Find first non-empty line and last non-empty line before first heading
    let start = 1;
    while (start < firstHeadingLine1 && doc.line(start).text.trim().length === 0) start++;
    let end = firstHeadingLine1 - 1;
    while (end >= 1 && doc.line(end).text.trim().length === 0) end--;

    const startLine0 = start - 1;
    const endLine0 = end - 1;
    const startDocLine = doc.line(start);
    const endDocLine = doc.line(end);

    blocks.push({
      id: `para-${startLine0}`,
      kind: 'paragraph',
      startLine: startLine0,
      endLine: endLine0,
      startPos: startDocLine.from,
      endPos: endDocLine.to,
      widgetPos: startDocLine.to,
    });
  }

  // Heading blocks
  for (let i = 0; i < headingLevels.length; i++) {
    const { line: line1, level } = headingLevels[i]!;
    let nextBoundaryLine1: number | null = null;

    for (let j = i + 1; j < headingLevels.length; j++) {
      const next = headingLevels[j]!;
      if (next.level <= level) {
        nextBoundaryLine1 = next.line;
        break;
      }
    }

    const startDocLine = doc.line(line1);
    const startLine0 = line1 - 1;

    const endPos =
      nextBoundaryLine1 !== null
        ? Math.max(startDocLine.from, doc.line(nextBoundaryLine1).from - 1)
        : doc.length;

    // Compute endLine for metadata (best-effort)
    const endLine0 =
      nextBoundaryLine1 !== null ? Math.max(startLine0, nextBoundaryLine1 - 2) : lines - 1;

    blocks.push({
      id: `para-${startLine0}`,
      kind: 'section',
      startLine: startLine0,
      endLine: endLine0,
      startPos: startDocLine.from,
      endPos,
      widgetPos: startDocLine.to,
    });
  }

  return blocks;
}

class BlockToggleWidget extends WidgetType {
  constructor(
    private opts: {
      blockId: string;
      startPos: number;
      endPos: number;
      isActive: boolean;
      disabled: boolean;
      onOpenPanel: (paragraphId: string) => void;
    }
  ) {
    super();
  }

  eq(other: BlockToggleWidget): boolean {
    return (
      this.opts.blockId === other.opts.blockId &&
      this.opts.isActive === other.opts.isActive &&
      this.opts.disabled === other.opts.disabled
    );
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-paragraph-block-toggle';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Think';
    btn.disabled = this.opts.disabled;
    btn.className = [
      'cm-paragraph-block-toggle-btn',
      'w-6 h-6 border-l border-vscode-border flex items-center justify-center hover:opacity-90 transition-all duration-200 font-bold text-sm',
      this.opts.isActive
        ? 'bg-purple-600 text-white'
        : 'bg-vscode-sidebar/50 text-vscode-text-secondary hover:bg-vscode-buttonBg',
      this.opts.disabled ? 'cursor-not-allowed opacity-50' : '',
    ]
      .filter(Boolean)
      .join(' ');
    btn.textContent = 'T';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (this.opts.disabled) return;

      const view = EditorView.findFromDOM(btn);
      if (view) {
        view.dispatch({
          selection: { anchor: this.opts.startPos, head: this.opts.endPos },
          scrollIntoView: true,
        });
      }

      this.opts.onOpenPanel(this.opts.blockId);
    });

    wrap.appendChild(btn);
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export function paragraphBlockControlsTheme() {
  return EditorView.baseTheme({
    '.cm-line': {
      position: 'relative',
      paddingRight: '36px', // room for the toggle button + extra gap from scrollbar
    },
    '.cm-paragraph-block-toggle': {
      position: 'absolute',
      right: '8px', // keep off the scrollbar
      top: '0px',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'auto',
    },
  });
}

export function paragraphBlockControlsExtension(opts: {
  openParagraphId?: string | null;
  onOpenPanel: (paragraphId: string) => void;
  disabled?: boolean;
}) {
  const openId = opts.openParagraphId ?? null;
  const disabled = opts.disabled ?? false;

  return StateField.define<DecorationSet>({
    create(state) {
      const blocks = computeBlocks(state.doc);
      const decos = blocks.map((b) =>
        Decoration.widget({
          widget: new BlockToggleWidget({
            blockId: b.id,
            startPos: b.startPos,
            endPos: b.endPos,
            isActive: openId === b.id,
            disabled,
            onOpenPanel: opts.onOpenPanel,
          }),
          side: 1,
        }).range(Math.min(b.widgetPos, state.doc.length))
      );
      return Decoration.set(decos, true);
    },
    update(decorations: DecorationSet, tr: Transaction) {
      // Recompute on doc changes OR if this field instance is re-created via React (openId change)
      if (!tr.docChanged) {
        return decorations;
      }
      const blocks = computeBlocks(tr.newDoc);
      const decos = blocks.map((b) =>
        Decoration.widget({
          widget: new BlockToggleWidget({
            blockId: b.id,
            startPos: b.startPos,
            endPos: b.endPos,
            isActive: openId === b.id,
            disabled,
            onOpenPanel: opts.onOpenPanel,
          }),
          side: 1,
        }).range(Math.min(b.widgetPos, tr.newDoc.length))
      );
      return Decoration.set(decos, true);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}


