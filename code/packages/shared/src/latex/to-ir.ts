import { stableNodeId } from '../ir/id';
import type {
  CodeBlockNode,
  DocumentTitleNode,
  DocumentAuthorNode,
  DocumentDateNode,
  DocumentNode,
  FigureNode,
  GridNode,
  IrNode,
  ListNode,
  MathBlockNode,
  ParagraphNode,
  RawLatexBlockNode,
  SectionNode,
  TableNode,
  TableStyle,
  TableRule,
  TableColumnAlign,
} from '../ir/types';
import type { TextStyle } from '../ir/types';

/**
 * Parse a supported-subset LaTeX string into IR (best-effort, Phase 12).
 *
 * - Never throws: unknown/malformed constructs become RawLatexBlockNode.
 * - Produces stable-ish IDs using docId + nodeType + path similar to XMD parser.
 *
 * Supported (initial subset):
 * - \section, \subsection, \subsubsection
 * - paragraphs (blank-line separated)
 * - itemize/enumerate with \item
 * - verbatim environment
 * - equation environment (as math_block)
 * - basic inline: \textbf{}, \emph{}, \href{url}{text}, \url{...}, \texttt{}
 */
export function parseLatexToIr(params: { docId: string; latex: string }): DocumentNode {
  const { docId } = params;
  const latex = normalizeLineEndings(params.latex ?? '');
  const blocks = parseBlocks(latex);

  const doc: DocumentNode = {
    type: 'document',
    id: stableNodeId({ docId, nodeType: 'document', path: 'doc' }),
    docId,
    children: [],
  };

  const sectionStack: SectionNode[] = [];
  let titleCount = 0;
  let authorCount = 0;
  let dateCount = 0;
  type Counters = Record<string, number>;
  const countersStack: Counters[] = [
    {
      section: 0,
      paragraph: 0,
      list: 0,
      code_block: 0,
      math_block: 0,
      figure: 0,
      grid: 0,
      table: 0,
      raw_latex_block: 0,
    },
  ];
  const sectionPathStack: string[] = [];

  const currentCounters = () => countersStack[countersStack.length - 1]!;
  const appendToCurrentContainer = (node: IrNode) => {
    const current = sectionStack[sectionStack.length - 1];
    if (current) current.children.push(node);
    else doc.children.push(node);
  };
  const openSection = (node: SectionNode) => {
    while (sectionStack.length > 0) {
      const top = sectionStack[sectionStack.length - 1];
      if (top.level < node.level) break;
      sectionStack.pop();
      countersStack.pop();
      sectionPathStack.pop();
    }
    appendToCurrentContainer(node);
    sectionStack.push(node);
    countersStack.push({
      section: 0,
      paragraph: 0,
      list: 0,
      code_block: 0,
      math_block: 0,
      figure: 0,
      grid: 0,
      table: 0,
      raw_latex_block: 0,
    });
  };
  const fullPath = (leaf: string) => (sectionPathStack.length ? `${sectionPathStack.join('/')}/${leaf}` : leaf);

  blocks.forEach((b) => {
    try {
      if (b.kind === 'title') {
        const idx = titleCount++;
        const path = `title[${idx}]`;
        const node: DocumentTitleNode = {
          type: 'document_title',
          id: stableNodeId({ docId, nodeType: 'document_title', path }),
          text: b.title,
          source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        // Always document-level.
        doc.children.push(node);
        return;
      }

      if (b.kind === 'section') {
        const parent = currentCounters();
        const secIdx = parent.section ?? 0;
        parent.section = secIdx + 1;

        const leaf = `sec[${secIdx}]`;
        sectionPathStack.push(leaf);
        const path = sectionPathStack.join('/');

        const node: SectionNode = {
          type: 'section',
          id: stableNodeId({ docId, nodeType: 'section', path }),
          level: b.level,
          title: b.title,
          children: [],
          source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        openSection(node);
        return;
      }

      const counters = currentCounters();

      if (b.kind === 'author') {
        const idx = authorCount++;
        const path = `author[${idx}]`;
        const node: DocumentAuthorNode = {
          type: 'document_author',
          id: stableNodeId({ docId, nodeType: 'document_author', path }),
          text: b.text,
          source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        doc.children.push(node);
        return;
      }

      if (b.kind === 'date') {
        const idx = dateCount++;
        const path = `date[${idx}]`;
        const node: DocumentDateNode = {
          type: 'document_date',
          id: stableNodeId({ docId, nodeType: 'document_date', path }),
          text: b.text,
          source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        doc.children.push(node);
        return;
      }

      if (b.kind === 'paragraph') {
        const idx = counters.paragraph ?? 0;
        counters.paragraph = idx + 1;
        const path = fullPath(`p[${idx}]`);
        const node: ParagraphNode = {
          type: 'paragraph',
          id: stableNodeId({ docId, nodeType: 'paragraph', path }),
          text: b.text,
          ...(b.style ? { style: b.style } : null),
          source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        appendToCurrentContainer(node);
        return;
      }

      if (b.kind === 'list') {
        const idx = counters.list ?? 0;
        counters.list = idx + 1;
        const path = fullPath(`list[${idx}]`);
        const node: ListNode = {
          type: 'list',
          id: stableNodeId({ docId, nodeType: 'list', path }),
          ordered: b.ordered,
          items: b.items,
          source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        appendToCurrentContainer(node);
        return;
      }

      if (b.kind === 'code') {
        const idx = counters.code_block ?? 0;
        counters.code_block = idx + 1;
        const path = fullPath(`code[${idx}]`);
        const node: CodeBlockNode = {
          type: 'code_block',
          id: stableNodeId({ docId, nodeType: 'code_block', path }),
          code: b.code,
          source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        appendToCurrentContainer(node);
        return;
      }

      if (b.kind === 'math') {
        const idx = counters.math_block ?? 0;
        counters.math_block = idx + 1;
        const path = fullPath(`math[${idx}]`);
        const node: MathBlockNode = {
          type: 'math_block',
          id: stableNodeId({ docId, nodeType: 'math_block', path }),
          latex: b.latex,
          source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        appendToCurrentContainer(node);
        return;
      }

      if (b.kind === 'figure') {
        const idx = counters.figure ?? 0;
        counters.figure = idx + 1;
        const path = fullPath(`fig[${idx}]`);
        const node: FigureNode = {
          type: 'figure',
          id: b.id || stableNodeId({ docId, nodeType: 'figure', path }),
          src: b.src,
          caption: b.caption,
          ...(b.label ? { label: b.label } : null),
          // Prefer XMD raw for round-trip back to MD (preserve attrs)
          source: {
            blockIndex: b.blockIndex,
            raw: buildXmdFigureLine(b),
            startOffset: b.startOffset,
            endOffset: b.endOffset,
          },
        };
        appendToCurrentContainer(node);
        return;
      }

      if (b.kind === 'grid') {
        const idx = counters.grid ?? 0;
        counters.grid = idx + 1;
        const path = fullPath(`grid[${idx}]`);

        const grid: GridNode = {
          type: 'grid',
          id: b.id || stableNodeId({ docId, nodeType: 'grid', path }),
          cols: b.cols,
          caption: b.caption,
          ...(b.label ? { label: b.label } : null),
          ...(b.align ? { align: b.align as GridNode['align'] } : null),
          ...(b.style ? { style: b.style } : null),
          rows: (b.rows ?? []).map((row, r) =>
            (row ?? []).map((cell, c) => {
              if (!cell) return { children: [] };
              const figPath = `${path}/r[${r}]/c[${c}]/fig[0]`;
              const figBlock: Extract<Block, { kind: 'figure' }> = {
                kind: 'figure',
                src: cell.src,
                caption: cell.caption,
                label: undefined,
                align: undefined,
                placement: undefined,
                width: cell.width,
                desc: undefined,
                raw: '',
                blockIndex: b.blockIndex,
                startOffset: b.startOffset,
                endOffset: b.endOffset,
              };
              const fig: FigureNode = {
                type: 'figure',
                id: stableNodeId({ docId, nodeType: 'figure', path: figPath }),
                src: cell.src,
                caption: cell.caption,
                source: {
                  blockIndex: b.blockIndex,
                  raw: buildXmdFigureLine(figBlock),
                  startOffset: b.startOffset,
                  endOffset: b.endOffset,
                },
              };
              return { children: [fig] };
            })
          ),
          source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };

        appendToCurrentContainer(grid);
        return;
      }

      if (b.kind === 'table') {
        const idx = counters.table ?? 0;
        counters.table = idx + 1;
        const path = fullPath(`table[${idx}]`);
        const node: TableNode = {
          type: 'table',
          id: b.id || stableNodeId({ docId, nodeType: 'table', path }),
          ...(b.caption ? { caption: b.caption } : null),
          ...(b.label ? { label: b.label } : null),
          header: b.header,
          rows: b.rows,
          ...(b.colAlign ? { colAlign: b.colAlign } : null),
          ...(b.vRules ? { vRules: b.vRules } : null),
          ...(b.hRules ? { hRules: b.hRules } : null),
          ...(b.style ? { style: b.style } : null),
          source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        appendToCurrentContainer(node);
        return;
      }

      // raw fallback
      const idx = counters.raw_latex_block ?? 0;
      counters.raw_latex_block = idx + 1;
      const path = fullPath(`raw[${idx}]`);
      const node: RawLatexBlockNode = {
        type: 'raw_latex_block',
        id: stableNodeId({ docId, nodeType: 'raw_latex_block', path }),
        // Every block carries its original raw LaTeX; use it for the raw fallback.
        latex: b.raw,
        source: { blockIndex: b.blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
      };
      appendToCurrentContainer(node);
    } catch {
      const counters = currentCounters();
      const idx = counters.raw_latex_block ?? 0;
      counters.raw_latex_block = idx + 1;
      const path = fullPath(`raw[${idx}]`);
      appendToCurrentContainer({
        type: 'raw_latex_block',
        id: stableNodeId({ docId, nodeType: 'raw_latex_block', path }),
        latex: b.raw ?? '',
      });
    }
  });

  return doc;
}

function latexGraphicPathToSrc(pathArg: string): string {
  const p = String(pathArg ?? '').trim();
  if (p.startsWith('assets/')) return `zadoox-asset://${p.slice('assets/'.length)}`;
  return p;
}

function latexWidthToXmdWidth(widthRaw: string): string | undefined {
  const w = String(widthRaw ?? '').trim();
  const toPct = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) return undefined;
    const pct = n * 100;
    const pretty = pct % 1 === 0 ? String(pct.toFixed(0)) : String(pct.toFixed(1));
    return `${pretty}%`;
  };

  // Convert <n>\textwidth / <n>\linewidth / <n>\columnwidth to a % string (best-effort).
  // Our LaTeX generator uses \textwidth for standalone figures, and \linewidth for grid cells/subfigures.
  const mText = /^(\d+(?:\.\d+)?)\\textwidth$/.exec(w);
  if (mText) return toPct(Number(mText[1]));
  const mLine = /^(\d+(?:\.\d+)?)\\linewidth$/.exec(w);
  if (mLine) return toPct(Number(mLine[1]));
  const mCol = /^(\d+(?:\.\d+)?)\\columnwidth$/.exec(w);
  if (mCol) return toPct(Number(mCol[1]));

  // Bare symbolic widths.
  if (w === '\\linewidth' || w === '\\textwidth' || w === '\\columnwidth') return '100%';
  // Keep absolute dims as-is.
  if (/^\d+(\.\d+)?(cm|mm|in|pt)$/.test(w)) return w;
  return undefined;
}

function parseIncludegraphicsLine(line: string): { src?: string; width?: string } {
  const raw = String(line ?? '');
  // \includegraphics is often wrapped (e.g. \fbox{...}, \fcolorbox{...}{...}{...}),
  // so we must match it as a substring and not require end-of-line anchors.
  const detok = /\\includegraphics\s*(?:\[([^\]]*)\])?\s*\{\s*\\detokenize\{([\s\S]*?)\}\s*\}/.exec(raw);
  const plain = /\\includegraphics\s*(?:\[([^\]]*)\])?\s*\{\s*([^{}]+?)\s*\}/.exec(raw);
  const m = detok ?? plain;
  if (!m) return {};
  const opt = String(m[1] ?? '').trim();
  const pathArg = String(m[2] ?? '').trim();

  let width: string | undefined;
  if (opt) {
    const wm = /(^|,)\s*width\s*=\s*([^,]+)\s*(,|$)/.exec(opt);
    if (wm) width = String(wm[2] ?? '').trim();
  }
  return { src: latexGraphicPathToSrc(pathArg), width };
}

type Block =
  | {
      kind: 'title';
      title: string;
      raw: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'author';
      text: string;
      raw: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'date';
      text: string;
      raw: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'section';
      level: number;
      title: string;
      raw: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'paragraph';
      text: string;
      style?: TextStyle;
      raw: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'list';
      ordered: boolean;
      items: string[];
      raw: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'code';
      code: string;
      raw: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'math';
      latex: string;
      raw: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'figure';
      src: string;
      caption: string;
      label?: string;
      align?: string;
      placement?: string;
      width?: string;
      desc?: string;
      id?: string;
      raw: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'grid';
      cols: number;
      caption?: string;
      label?: string;
      align?: 'left' | 'center' | 'right' | 'full';
      placement?: 'inline' | 'block';
      style?: TableStyle;
      rows: Array<Array<{ src: string; caption: string; width?: string } | null>>;
      raw: string;
      id?: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'table';
      caption?: string;
      label?: string;
      header: string[];
      rows: string[][];
      colAlign?: TableColumnAlign[];
      vRules?: TableRule[];
      hRules?: TableRule[];
      style?: TableStyle;
      raw: string;
      id?: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    }
  | {
      kind: 'raw';
      latex: string;
      raw: string;
      blockIndex: number;
      startOffset: number;
      endOffset: number;
    };

function normalizeLineEndings(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

function splitLinesWithOffsets(src: string): Array<{ line: string; start: number; end: number }> {
  const s = normalizeLineEndings(src);
  const out: Array<{ line: string; start: number; end: number }> = [];
  let idx = 0;
  const lines = s.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = idx;
    const end = start + line.length + (i === lines.length - 1 ? 0 : 1);
    out.push({ line, start, end });
    idx = end;
  }
  return out;
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function parseBlocks(latex: string): Block[] {
  const lines = splitLinesWithOffsets(latex);
  const blocks: Block[] = [];
  const hasBeginDocument = /\\begin\{document\}/.test(latex);
  let inPreamble = hasBeginDocument;

  const isZxMarkerLine = (trimmed: string): boolean => /^%\s*ZX-(BEGIN|END):/i.test(trimmed);

  const stripInlineComment = (line: string): string => {
    // Remove LaTeX comments (best-effort) by stripping from the first unescaped %.
    // We intentionally do not attempt to fully parse TeX; this is just to avoid previewing comment text.
    const s = String(line ?? '');
    let escaped = false;
    for (let k = 0; k < s.length; k++) {
      const ch = s[k]!;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '%') {
        return s.slice(0, k).trimEnd();
      }
    }
    return s;
  };

  const stripFormattingOnlyMacros = (input: string): string => {
    let s = String(input ?? '');
    // Remove simple formatting-only commands that often appear in boilerplate/legal notices.
    s = s.replace(/\\color\{[^}]*\}/g, ' ');
    // Common font size switches (no braces).
    s = s.replace(/\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g, ' ');
    // Spacing helpers.
    s = s.replace(/\\hspace\*?\{[^}]*\}/g, ' ');
    s = s.replace(/\\vspace\*?\{[^}]*\}/g, ' ');
    s = s.replace(/\\hfill\b/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  };

  const extractTextStyleAndClean = (input: string): { text: string; style?: TextStyle } => {
    let s = String(input ?? '');
    const style: TextStyle = {};

    // Alignment (currently only from explicit environments like center; handled by caller)
    // Color
    const colorMatch = /\\color\{([^}]+)\}/.exec(s);
    if (colorMatch) {
      const c = String(colorMatch[1] ?? '').trim();
      if (c) style.color = c;
      s = s.replace(/\\color\{[^}]*\}/g, ' ');
    }

    // Size (map many LaTeX size switches to a small enum)
    const sizeMatch = /\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/.exec(s);
    if (sizeMatch) {
      const k = String(sizeMatch[1] ?? '');
      if (['tiny', 'scriptsize', 'footnotesize', 'small'].includes(k)) style.size = 'small';
      else if (k === 'normalsize') style.size = 'normal';
      else style.size = 'large';
      s = s.replace(/\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)\b/g, ' ');
    }

    // Strip spacing macros that should not render as text.
    s = s.replace(/\\hspace\*?\{[^}]*\}/g, ' ');
    s = s.replace(/\\vspace\*?\{[^}]*\}/g, ' ');
    s = s.replace(/\\hfill\b/g, ' ');

    const cleaned = stripFormattingOnlyMacros(s);
    const outStyle = Object.keys(style).length > 0 ? style : undefined;
    return { text: cleaned, style: outStyle };
  };

  const parseBracedCommand = (
    startLineIndex: number,
    cmd: 'title' | 'author' | 'date'
  ): { content: string; raw: string; endIndex: number; startOffset: number; endOffset: number } | null => {
    const first = lines[startLineIndex];
    if (!first) return null;
    const firstTrim = first.line.trim().replace(/^[\uFEFF\u200B\u200C\u200D]+/, '');
    const openRe = new RegExp(`^\\\\+${cmd}\\s*\\{`, 'i');
    const m = openRe.exec(firstTrim);
    if (!m) return null;

    const segStartOffset = first.start;
    let i = startLineIndex;
    let depth = 0;
    let started = false;
    let content = '';
    let endOffset = first.end;

    const scan = (s: string, includeNewlineBefore: boolean) => {
      const lineText = stripInlineComment(s);
      let escaped = false;
      for (let k = 0; k < lineText.length; k++) {
        const ch = lineText[k]!;
        if (escaped) {
          escaped = false;
          if (started) content += ch;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          if (started) content += ch;
          continue;
        }
        if (!started) {
          // Wait until we hit the first opening '{' of the command.
          if (ch === '{') {
            started = true;
            depth = 1;
            if (includeNewlineBefore) content += '\n';
            continue;
          }
          continue;
        }
        if (ch === '{') {
          depth++;
          content += ch;
          continue;
        }
        if (ch === '}') {
          depth--;
          if (depth === 0) return true; // done
          content += ch;
          continue;
        }
        content += ch;
      }
      return false;
    };

    while (i < lines.length) {
      const ln = lines[i]!;
      const done = scan(ln.line, i !== startLineIndex);
      endOffset = ln.end;
      if (done) {
        const raw = lines.slice(startLineIndex, i + 1).map((l) => l.line).join('\n');
        return { content: content.trim(), raw, endIndex: i, startOffset: segStartOffset, endOffset };
      }
      i++;
    }
    return null;
  };

  const splitAuthorContent = (raw: string): string[] => {
    const stripCmdWithArg = (input: string, cmd: string): string => {
      const s = String(input ?? '');
      let out = '';
      let i = 0;
      while (i < s.length) {
        const ch = s[i]!;
        if (ch !== '\\') {
          out += ch;
          i++;
          continue;
        }
        // parse command name
        let j = i + 1;
        while (j < s.length && /[a-zA-Z*]/.test(s[j]!)) j++;
        const name = s.slice(i + 1, j);
        if (name !== cmd) {
          out += ch;
          i++;
          continue;
        }
        // skip optional [..]
        i = j;
        if (s[i] === '[') {
          let depth = 1;
          i++;
          while (i < s.length && depth > 0) {
            const c = s[i]!;
            if (c === '[') depth++;
            else if (c === ']') depth--;
            i++;
          }
        }
        // skip {..}
        if (s[i] === '{') {
          let depth = 1;
          i++;
          while (i < s.length && depth > 0) {
            const c = s[i]!;
            if (c === '{') depth++;
            else if (c === '}') depth--;
            i++;
          }
        }
        // command stripped
      }
      return out;
    };

    let s = String(raw ?? '');
    // NeurIPS-style author blocks often contain \thanks{...} and similar footnote macros.
    // Strip them so author names remain clean.
    for (const cmd of ['thanks', 'samethanks', 'footnotemark', 'footnotetext']) {
      s = stripCmdWithArg(s, cmd);
    }
    // Strip common spacing macros that appear between author tokens in some templates.
    for (const cmd of ['hspace', 'hspace*', 'vspace', 'vspace*']) {
      s = stripCmdWithArg(s, cmd);
    }
    // Strip no-arg spacing commands.
    s = s
      .replace(/\\hfill\b/g, ' ')
      .replace(/\\quad\b/g, ' ')
      .replace(/\\qquad\b/g, ' ')
      .replace(/\\hskip\b/g, ' ')
      .replace(/\\vskip\b/g, ' ');

    const normalized = s
      .replace(/\\AND\b/g, '\n')
      .replace(/\\And\b/g, '\n')
      .replace(/\\and\b/g, '\n')
      .replace(/\\\\/g, '\n')
      .replace(/\\newline\b/g, '\n');
    const parts = normalized
      .split('\n')
      .map((p) => latexInlineToMarkdown(String(p ?? '').trim()))
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length ? parts : [''];
  };

  const pushParagraph = (startIdx: number, endIdxExclusive: number, blockIndex: number) => {
    const seg = lines.slice(startIdx, endIdxExclusive);
    const raw = seg.map((l) => l.line).join('\n');
    const rawWithoutComments = seg
      .map((l) => l.line)
      .filter((ln) => {
        const t = ln.trim();
        if (t.startsWith('%') && !isZxMarkerLine(t)) return false;
        return true;
      })
      .map(stripInlineComment)
      .join('\n');
    const text = latexInlineToMarkdown(rawWithoutComments.trimEnd());
    const startOffset = seg[0]?.start ?? 0;
    const endOffset = seg[seg.length - 1]?.end ?? startOffset;
    if (text.trim().length === 0) return;
    blocks.push({ kind: 'paragraph', text, raw, blockIndex, startOffset, endOffset });
  };

  let i = 0;
  let blockIndex = 0;
  while (i < lines.length) {
    const { line, start, end } = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    // Boilerplate (system-generated for compilable docs) — ignore so round-trips stay clean.
    // Also tolerate trailing comments like: \end{document} % comment
    // Some environments may introduce a BOM/zero-width chars (e.g. from copy/paste or server transforms).
    // Strip them so boilerplate lines like \end{document} never leak into IR/XMD.
    const trimmed = line.trim().replace(/^[\uFEFF\u200B\u200C\u200D]+/, '');
    // If this doc has an explicit \begin{document}, treat everything before it as "preamble":
    // - ignore macro/package/setup lines (e.g. \PassOptionsToPackage, \newcommand, \def, etc.)
    // - but still extract \title/\author/\date so the document renders nicely.
    if (inPreamble) {
      if (/^\\+begin\{document\}(?:\s*%.*)?$/.test(trimmed)) {
        inPreamble = false;
        i++;
        blockIndex++;
        continue;
      }
      // Keep comment-line ignore behavior in preamble too.
      if (trimmed.startsWith('%') && !isZxMarkerLine(trimmed)) {
        i++;
        blockIndex++;
        continue;
      }
      // Preserve metadata fields from preamble.
      const titleBlock = parseBracedCommand(i, 'title');
      if (titleBlock) {
        blocks.push({ kind: 'title', title: latexInlineToMarkdown(titleBlock.content), raw: titleBlock.raw, blockIndex, startOffset: titleBlock.startOffset, endOffset: titleBlock.endOffset });
        i = titleBlock.endIndex + 1;
        blockIndex++;
        continue;
      }
      const authorBlock = parseBracedCommand(i, 'author');
      if (authorBlock) {
        const authors = splitAuthorContent(authorBlock.content);
        for (const a of authors) {
          blocks.push({ kind: 'author', text: a, raw: authorBlock.raw, blockIndex, startOffset: authorBlock.startOffset, endOffset: authorBlock.endOffset });
          blockIndex++;
        }
        i = authorBlock.endIndex + 1;
        continue;
      }
      const dateBlock = parseBracedCommand(i, 'date');
      if (dateBlock) {
        blocks.push({ kind: 'date', text: latexInlineToMarkdown(dateBlock.content), raw: dateBlock.raw, blockIndex, startOffset: dateBlock.startOffset, endOffset: dateBlock.endOffset });
        i = dateBlock.endIndex + 1;
        blockIndex++;
        continue;
      }
      // Ignore everything else in preamble.
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\+documentclass\{[^}]+\}(?:\s*%.*)?$/.test(trimmed)) {
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\+usepackage(\[[^\]]+\])?\{[^}]+\}(?:\s*%.*)?$/.test(trimmed)) {
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\+begin\{document\}(?:\s*%.*)?$/.test(trimmed)) {
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\+end\{document\}(?:\s*%.*)?$/.test(trimmed)) {
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\+maketitle(?:\s*%.*)?$/.test(trimmed)) {
      i++;
      blockIndex++;
      continue;
    }

    // Pure comment lines: ignore (but keep ZX markers which are also comments).
    if (trimmed.startsWith('%') && !isZxMarkerLine(trimmed)) {
      i++;
      blockIndex++;
      continue;
    }

    // abstract environment -> emit a synthetic "Abstract" section + paragraph(s)
    if (trimmed === '\\begin{abstract}') {
      const startOffset = start;
      let j = i + 1;
      const bodyLines: Array<{ line: string; start: number; end: number }> = [];
      while (j < lines.length && lines[j].line.trim() !== '\\end{abstract}') {
        const rawLine = lines[j].line;
        const t = rawLine.trim();
        if (t.startsWith('%') && !isZxMarkerLine(t)) {
          j++;
          continue;
        }
        bodyLines.push({ line: stripInlineComment(rawLine), start: lines[j].start, end: lines[j].end });
        j++;
      }
      if (j < lines.length && lines[j].line.trim() === '\\end{abstract}') {
        const endOffset = lines[j].end;
        const raw = lines.slice(i, j + 1).map((l) => l.line).join('\n');

        blocks.push({
          kind: 'section',
          level: 1,
          title: 'Abstract',
          raw: '\\section*{Abstract}',
          blockIndex,
          startOffset,
          endOffset,
        });

        // Split abstract into paragraph blocks (blank-line separated).
        const text = latexInlineToMarkdown(bodyLines.map((l) => l.line).join('\n').trimEnd());
        if (text.trim().length > 0) {
          blocks.push({
            kind: 'paragraph',
            text,
            raw,
            blockIndex: blockIndex + 1,
            startOffset,
            endOffset,
          });
        }

        i = j + 1;
        blockIndex += 2;
        continue;
      }
      // Unclosed => raw
      const raw = lines.slice(i).map((l) => l.line).join('\n');
      blocks.push({ kind: 'raw', latex: raw, raw, blockIndex, startOffset, endOffset: lines[lines.length - 1]?.end ?? end });
      break;
    }

    // center environment (often used for boilerplate notes / centered callouts)
    // We do NOT preserve centering semantics in IR yet; we just extract the text.
    if (trimmed.startsWith('\\begin{center}')) {
      const startOffset = start;
      let j = i;
      const body: string[] = [];
      const blockStyle: TextStyle = { align: 'center' };

      // Extract any inline content that appears on the same line as \begin{center}
      const afterBeginFull = stripInlineComment(line).replace(/^.*?\\begin\{center\}/, '').trim();
      const inlineEndIdx = afterBeginFull.indexOf('\\end{center}');
      if (inlineEndIdx >= 0) {
        const inlineBody = afterBeginFull.slice(0, inlineEndIdx).trim();
        const raw = line;
        const { text: cleaned, style } = extractTextStyleAndClean(inlineBody);
        const text = latexInlineToMarkdown(cleaned);
        if (text.trim().length > 0) {
          const merged: TextStyle | undefined = (() => {
            const s = { ...blockStyle, ...(style || {}) };
            return Object.keys(s).length ? s : undefined;
          })();
          blocks.push({
            kind: 'paragraph',
            text,
            raw,
            blockIndex,
            startOffset,
            endOffset: end,
            ...(merged ? { style: merged } : null),
          } as Extract<Block, { kind: 'paragraph' }>);
        }
        i = i + 1;
        blockIndex++;
        continue;
      }
      if (afterBeginFull) body.push(afterBeginFull);

      j = i + 1;
      while (j < lines.length) {
        const rawLine = lines[j]!.line;
        const t = rawLine.trim();
        if (t === '\\end{center}') break;
        if (t.startsWith('%') && !isZxMarkerLine(t)) {
          j++;
          continue;
        }
        const noComment = stripInlineComment(rawLine);
        const endIdx = noComment.indexOf('\\end{center}');
        if (endIdx >= 0) {
          const beforeEnd = noComment.slice(0, endIdx).trim();
          if (beforeEnd) body.push(beforeEnd);
          break;
        }
        body.push(noComment);
        j++;
      }
      if (j < lines.length && (lines[j]!.line.trim() === '\\end{center}' || stripInlineComment(lines[j]!.line).includes('\\end{center}'))) {
        const endOffset = lines[j]!.end;
        const raw = lines.slice(i, j + 1).map((l) => l.line).join('\n');
        const { text: cleaned, style } = extractTextStyleAndClean(body.join('\n'));
        const text = latexInlineToMarkdown(cleaned);
        if (text.trim().length > 0) {
          const merged: TextStyle | undefined = (() => {
            const s = { ...blockStyle, ...(style || {}) };
            return Object.keys(s).length ? s : undefined;
          })();
          blocks.push({
            kind: 'paragraph',
            text,
            raw,
            blockIndex,
            startOffset,
            endOffset,
            ...(merged ? { style: merged } : null),
          } as Extract<Block, { kind: 'paragraph' }>);
        }
        i = j + 1;
        blockIndex++;
        continue;
      }
      // Unclosed => raw
      const raw = lines.slice(i).map((l) => l.line).join('\n');
      blocks.push({ kind: 'raw', latex: raw, raw, blockIndex, startOffset, endOffset: lines[lines.length - 1]?.end ?? end });
      break;
    }

    // ZX markers: lossless block boundaries for generated content.
    const zxBegin = /^%\s*ZX-BEGIN:([a-zA-Z0-9_]+)(?:\s+(.+?))?\s*$/.exec(trimmed);
    if (zxBegin) {
      const zxKind = zxBegin[1]?.toLowerCase();
      const tokenStr = String(zxBegin[2] ?? '').trim();
      const tokens: Record<string, string> = {};
      if (tokenStr) {
        for (const tok of tokenStr.split(/\s+/g)) {
          const eq = tok.indexOf('=');
          if (eq <= 0) continue;
          const k = tok.slice(0, eq).trim();
          const v = tok.slice(eq + 1).trim();
          if (!k || !v) continue;
          tokens[k] = v;
        }
      }
      const markerId = tokens.id;
      let j = i + 1;
      while (j < lines.length) {
        const t = lines[j].line.trim();
        // ZX-END matches on kind and (optionally) exact same token string.
        // This stays compatible with older markers that only had id=... (or nothing).
        if (new RegExp(`^%\\s*ZX-END:${zxBegin[1]}(?:\\s+.*)?\\s*$`).test(t)) break;
        j++;
      }
      if (j >= lines.length) {
        // No matching end; treat as raw and continue.
        blocks.push({ kind: 'raw', latex: line, raw: line, blockIndex, startOffset: start, endOffset: end });
        i++;
        continue;
      }
      const seg = lines.slice(i, j + 1);
      const raw = seg.map((l) => l.line).join('\n');
      const startOffset = seg[0]?.start ?? start;
      const endOffset = seg[seg.length - 1]?.end ?? end;

      if (zxKind === 'grid') {
        const parsed = parseFigureGridFromLatexRaw(raw) ?? parseFigureGridFromSubfigureRaw(raw);
        if (parsed) {
          const style = parseTabularRuleStyleFromRaw(raw);
          const alignFromToken = (() => {
            const a = String(tokens.align ?? '').trim().toLowerCase();
            if (a === 'left' || a === 'center' || a === 'right' || a === 'full') return a as 'left' | 'center' | 'right' | 'full';
            return null;
          })();
          const align = alignFromToken ?? parseAlignFromRaw(raw);
          const placement = (() => {
            const p = String(tokens.placement ?? '').trim().toLowerCase();
            if (p === 'inline' || p === 'block') return p as 'inline' | 'block';
            return undefined;
          })();
          // Grids may contain many subfigure captions. The *outer* grid caption is the last \caption{...}
          // in the environment, emitted after the tabular.
          const capMatches = Array.from(raw.matchAll(/\\caption\{([^}]*)\}/g));
          const lastCap = capMatches.length ? capMatches[capMatches.length - 1] : null;
          const caption = lastCap ? latexInlineToMarkdown(String(lastCap[1] ?? '').trim()) : undefined;
          const labMatches = Array.from(raw.matchAll(/\\label\{([^}]*)\}/g));
          const lastLab = labMatches.length ? labMatches[labMatches.length - 1] : null;
          const label = lastLab ? latexInlineToMarkdown(String(lastLab[1] ?? '').trim()) : undefined;
          blocks.push({
            kind: 'grid',
            cols: parsed.cols,
            rows: parsed.rows,
            raw,
            id: markerId,
            ...(align ? { align } : null),
            ...(placement ? { placement } : null),
            ...(style ? { style } : null),
            ...(caption ? { caption } : null),
            ...(label ? { label } : null),
            blockIndex,
            startOffset,
            endOffset,
          });
          i = j + 1;
          blockIndex++;
          continue;
        }
      }
      if (zxKind === 'figure') {
        const fig = parseFigureFromRaw(raw);
        if (fig) {
          blocks.push({
            ...fig,
            id: markerId,
            blockIndex,
            startOffset,
            endOffset,
          });
          i = j + 1;
          blockIndex++;
          continue;
        }
      }
      if (zxKind === 'table') {
        const t = parseTableFromRaw(raw);
        if (t) {
          blocks.push({
            ...t,
            id: markerId,
            blockIndex,
            startOffset,
            endOffset,
          });
          i = j + 1;
          blockIndex++;
          continue;
        }
      }
      // Unknown zx-kind or parse failure: keep raw to avoid data loss.
      blocks.push({ kind: 'raw', latex: raw, raw, blockIndex, startOffset, endOffset });
      i = j + 1;
      blockIndex++;
      continue;
    }
    const authorBlock2 = parseBracedCommand(i, 'author');
    if (authorBlock2) {
      const authors = splitAuthorContent(authorBlock2.content);
      for (const a of authors) {
        blocks.push({ kind: 'author', text: a, raw: authorBlock2.raw, blockIndex, startOffset: authorBlock2.startOffset, endOffset: authorBlock2.endOffset });
        blockIndex++;
      }
      i = authorBlock2.endIndex + 1;
      continue;
    }
    const dateBlock2 = parseBracedCommand(i, 'date');
    if (dateBlock2) {
      blocks.push({ kind: 'date', text: latexInlineToMarkdown(dateBlock2.content), raw: dateBlock2.raw, blockIndex, startOffset: dateBlock2.startOffset, endOffset: dateBlock2.endOffset });
      i = dateBlock2.endIndex + 1;
      blockIndex++;
      continue;
    }

    // \title{...}
    const titleBlock2 = parseBracedCommand(i, 'title');
    if (titleBlock2) {
      blocks.push({ kind: 'title', title: latexInlineToMarkdown(titleBlock2.content), raw: titleBlock2.raw, blockIndex, startOffset: titleBlock2.startOffset, endOffset: titleBlock2.endOffset });
      i = titleBlock2.endIndex + 1;
      blockIndex++;
      continue;
    }

    // Sections
    const sec = /^\\+(section|subsection|subsubsection)\{([^}]*)\}(?:\s*%.*)?$/.exec(trimmed);
    if (sec) {
      const level = sec[1] === 'section' ? 1 : sec[1] === 'subsection' ? 2 : 3;
      const title = latexInlineToMarkdown((sec[2] ?? '').trim());
      blocks.push({
        kind: 'section',
        level,
        title,
        raw: line,
        blockIndex,
        startOffset: start,
        endOffset: end,
      });
      i++;
      blockIndex++;
      continue;
    }

    // verbatim environment
    if (line.trim() === '\\begin{verbatim}') {
      const startOffset = start;
      let j = i + 1;
      const codeLines: string[] = [];
      while (j < lines.length && lines[j].line.trim() !== '\\end{verbatim}') {
        codeLines.push(lines[j].line);
        j++;
      }
      if (j < lines.length && lines[j].line.trim() === '\\end{verbatim}') {
        const endOffset = lines[j].end;
        const raw = lines.slice(i, j + 1).map((l) => l.line).join('\n');
        blocks.push({ kind: 'code', code: codeLines.join('\n'), raw, blockIndex, startOffset, endOffset });
        i = j + 1;
        blockIndex++;
        continue;
      }
      // Unclosed => raw
      const raw = lines.slice(i).map((l) => l.line).join('\n');
      blocks.push({ kind: 'raw', latex: raw, raw, blockIndex, startOffset, endOffset: lines[lines.length - 1]?.end ?? end });
      break;
    }

    // math environments (best-effort)
    const mathBegin = /^\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}$/.exec(line.trim());
    if (mathBegin) {
      const env = mathBegin[1]!;
      const startOffset = start;
      let j = i + 1;
      const body: string[] = [];
      while (j < lines.length && lines[j].line.trim() !== `\\end{${env}}`) {
        const rawLine = lines[j].line;
        const t = rawLine.trim();
        if (t.startsWith('%') && !isZxMarkerLine(t)) {
          j++;
          continue;
        }
        body.push(stripInlineComment(rawLine));
        j++;
      }
      if (j < lines.length && lines[j].line.trim() === `\\end{${env}}`) {
        const endOffset = lines[j].end;
        const raw = lines.slice(i, j + 1).map((l) => l.line).join('\n');
        blocks.push({ kind: 'math', latex: body.join('\n').trim(), raw, blockIndex, startOffset, endOffset });
        i = j + 1;
        blockIndex++;
        continue;
      }
      const raw = lines.slice(i).map((l) => l.line).join('\n');
      blocks.push({ kind: 'raw', latex: raw, raw, blockIndex, startOffset, endOffset: lines[lines.length - 1]?.end ?? end });
      break;
    }

    // wrapfigure environment (inline placement)
    const wrapBegin = /^\\begin\{wrapfigure\}\{([lr])\}\{([^}]+)\}\s*$/.exec(line.trim());
    if (wrapBegin) {
      const startOffset = start;
      let j = i + 1;
      let src = '';
      let align: string | undefined = wrapBegin[1] === 'r' ? 'right' : 'left';
      const placement: string | undefined = 'inline';
      let width: string | undefined = latexWidthToXmdWidth(String(wrapBegin[2] ?? '').trim());
      let desc: string | undefined;
      let caption = '';
      let label: string | undefined;

      while (j < lines.length && lines[j].line.trim() !== '\\end{wrapfigure}') {
        const t = lines[j].line.trim();
        if (t === '\\raggedleft') align = 'right';
        if (t === '\\raggedright') align = 'left';
        if (t === '\\centering') align = 'center';

        const ig = parseIncludegraphicsLine(t);
        if (!src && ig.src) src = ig.src;
        // If width not specified by wrapfigure, fall back to includegraphics width if it maps well.
        if (!width && ig.width) width = latexWidthToXmdWidth(ig.width);

        const cap = /^\\caption\{([^}]*)\}(?:\s*%.*)?$/.exec(t);
        if (cap) {
          caption = latexInlineToMarkdown((cap[1] ?? '').trim());
          j++;
          continue;
        }
        const lab = /^\\label\{([^}]*)\}(?:\s*%.*)?$/.exec(t);
        if (lab) {
          label = latexInlineToMarkdown((lab[1] ?? '').trim());
          j++;
          continue;
        }
        j++;
      }
      if (j < lines.length && lines[j].line.trim() === '\\end{wrapfigure}') {
        const endOffset = lines[j].end;
        const raw = lines.slice(i, j + 1).map((l) => l.line).join('\n');
        blocks.push({
          kind: 'figure',
          src,
          caption,
          label,
          align,
          placement,
          width,
          desc,
          raw,
          blockIndex,
          startOffset,
          endOffset,
        });
        i = j + 1;
        blockIndex++;
        continue;
      }
      const raw = lines.slice(i).map((l) => l.line).join('\n');
      blocks.push({ kind: 'raw', latex: raw, raw, blockIndex, startOffset, endOffset: lines[lines.length - 1]?.end ?? end });
      break;
    }

    // figure environment (Zadoox subset)
    if (line.trim() === '\\begin{figure}') {
      const startOffset = start;
      let j = i + 1;
      let src = '';
      let align: string | undefined;
      let placement: string | undefined;
      let width: string | undefined;
      let desc: string | undefined;
      let caption = '';
      let label: string | undefined;

      while (j < lines.length && lines[j].line.trim() !== '\\end{figure}') {
        const t = lines[j].line.trim();
        const c = /^%\s*zadoox-([a-zA-Z0-9_-]+)\s*:\s*(.*)$/.exec(t);
        if (c) {
          const key = String(c[1] || '').toLowerCase();
          const value = latexInlineToMarkdown(String(c[2] || '').trim());
          if (key === 'src') src = value;
          else if (key === 'align') align = value;
          else if (key === 'placement') placement = value;
          else if (key === 'width') width = value;
          else if (key === 'desc') desc = value;
          j++;
          continue;
        }
        if (t === '\\raggedleft') align = 'right';
        if (t === '\\raggedright') align = 'left';
        if (t === '\\centering') align = 'center';

        const ig = parseIncludegraphicsLine(t);
        if (!src && ig.src) src = ig.src;
        if (!width && ig.width) width = latexWidthToXmdWidth(ig.width);

        const cap = /^\\caption\{([^}]*)\}(?:\s*%.*)?$/.exec(t);
        if (cap) {
          caption = latexInlineToMarkdown((cap[1] ?? '').trim());
          j++;
          continue;
        }
        const lab = /^\\label\{([^}]*)\}(?:\s*%.*)?$/.exec(t);
        if (lab) {
          label = latexInlineToMarkdown((lab[1] ?? '').trim());
          j++;
          continue;
        }
        j++;
      }
      if (j < lines.length && lines[j].line.trim() === '\\end{figure}') {
        const endOffset = lines[j].end;
        const raw = lines.slice(i, j + 1).map((l) => l.line).join('\n');

        // Detect Zadoox figure-grid pattern: outer figure with an outer tabular containing nested cells.
        // This is emitted by the InsertFigureGridWizard and should round-trip to IR GridNode.
        const grid = parseFigureGridFromLatexRaw(raw) ?? parseFigureGridFromSubfigureRaw(raw);
        if (grid) {
          blocks.push({
            kind: 'grid',
            cols: grid.cols,
            caption: caption || undefined,
            rows: grid.rows,
            raw,
            blockIndex,
            startOffset,
            endOffset,
          });
          i = j + 1;
          blockIndex++;
          continue;
        }

        blocks.push({
          kind: 'figure',
          src,
          caption,
          label,
          align,
          placement,
          width,
          desc,
          raw,
          blockIndex,
          startOffset,
          endOffset,
        });
        i = j + 1;
        blockIndex++;
        continue;
      }
      // Unclosed => raw
      const raw = lines.slice(i).map((l) => l.line).join('\n');
      blocks.push({ kind: 'raw', latex: raw, raw, blockIndex, startOffset, endOffset: lines[lines.length - 1]?.end ?? end });
      break;
    }

    // itemize/enumerate lists
    const beginList = /^\\begin\{(itemize|enumerate)\}\s*$/.exec(line.trim());
    if (beginList) {
      const ordered = beginList[1] === 'enumerate';
      const startOffset = start;
      let j = i + 1;
      const items: string[] = [];
      while (j < lines.length && !/^\\end\{(itemize|enumerate)\}\s*$/.test(lines[j].line.trim())) {
        const itemMatch = /^\\item\s*(.*)$/.exec(lines[j].line.trim());
        if (itemMatch) {
          items.push(latexInlineToMarkdown((itemMatch[1] ?? '').trim()));
        }
        j++;
      }
      if (j < lines.length && /^\\end\{(itemize|enumerate)\}\s*$/.test(lines[j].line.trim())) {
        const endOffset = lines[j].end;
        const raw = lines.slice(i, j + 1).map((l) => l.line).join('\n');
        blocks.push({ kind: 'list', ordered, items, raw, blockIndex, startOffset, endOffset });
        i = j + 1;
        blockIndex++;
        continue;
      }
      const raw = lines.slice(i).map((l) => l.line).join('\n');
      blocks.push({ kind: 'raw', latex: raw, raw, blockIndex, startOffset, endOffset: lines[lines.length - 1]?.end ?? end });
      break;
    }

    // Paragraph: consume until blank line or recognized block start.
    // Note: we must stop if we hit LaTeX boilerplate mid-paragraph (e.g. copy/paste adds "\end{document}"
    // without a blank line), otherwise it can leak into XMD/Markdown.
    const startIdx = i;
    let j = i;
    while (j < lines.length) {
      const t = lines[j].line.trim().replace(/^[\uFEFF\u200B\u200C\u200D]+/, '');
      if (j !== startIdx && isBlank(t)) break;
      if (
        j !== startIdx &&
        (/^\\(section|subsection|subsubsection)\{/.test(t) ||
          t === '\\begin{verbatim}' ||
          t === '\\begin{equation}' ||
          t === '\\begin{figure}' ||
          /^\\begin\{wrapfigure\}\{[lr]\}\{/.test(t) ||
          /^\\begin\{(itemize|enumerate)\}/.test(t))
      ) {
        break;
      }
      if (
        j !== startIdx &&
        (/^\\+documentclass\{[^}]+\}(?:\s*%.*)?$/.test(t) ||
          /^\\+usepackage(\[[^\]]+\])?\{[^}]+\}(?:\s*%.*)?$/.test(t) ||
          /^\\+begin\{document\}(?:\s*%.*)?$/.test(t) ||
          /^\\+end\{document\}(?:\s*%.*)?$/.test(t) ||
          /^\\+maketitle(?:\s*%.*)?$/.test(t))
      ) {
        break;
      }
      if (j !== startIdx && t.startsWith('%')) {
        // comments can be inside paragraphs; keep them
      }
      j++;
      if (j < lines.length && isBlank(lines[j].line)) break;
    }
    // Ensure progress even if weird input
    const endIdxExclusive = Math.max(startIdx + 1, j);
    pushParagraph(startIdx, endIdxExclusive, blockIndex);
    i = endIdxExclusive;
    blockIndex++;
  }

  return blocks;
}

function escapeXmdAttrValue(v: string | undefined): string {
  const s = String(v ?? '').replace(/\r?\n/g, ' ').trim();
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildXmdFigureLine(b: Extract<Block, { kind: 'figure' }>): string {
  const cap = b.caption ?? '';
  const src = b.src ?? '';
  const attrParts: string[] = [];
  if (b.label && b.label.trim().length > 0) {
    attrParts.push(`#${b.label.trim()}`);
  }
  if (b.align && b.align.trim().length > 0) attrParts.push(`align="${escapeXmdAttrValue(b.align)}"`);
  if (b.width && b.width.trim().length > 0) attrParts.push(`width="${escapeXmdAttrValue(b.width)}"`);
  if (b.placement && b.placement.trim().length > 0) attrParts.push(`placement="${escapeXmdAttrValue(b.placement)}"`);
  if (b.desc && b.desc.trim().length > 0) attrParts.push(`desc="${escapeXmdAttrValue(b.desc)}"`);
  const attrBlock = attrParts.length ? `{${attrParts.join(' ')}}` : '';
  return `![${cap}](${src})${attrBlock}`;
}

function latexInlineToMarkdown(text: string): string {
  let s = text ?? '';

  // Citations:
  // Convert \cite/\citep/\citet (+ optional star) into a stable inline token we can render later.
  // We intentionally ignore optional args ([...]) for now.
  const citeToToken = (mode: 'cite' | 'citep' | 'citet') => (_m: string, keysRaw: string) => {
    const keys = String(keysRaw ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .join(', ');
    return keys ? `[@${mode} ${keys}]` : '';
  };
  s = s.replace(/\\cite\*?(?:\[[^\]]*\])*\{([^}]+)\}/g, citeToToken('cite'));
  s = s.replace(/\\citep\*?(?:\[[^\]]*\])*\{([^}]+)\}/g, citeToToken('citep'));
  s = s.replace(/\\citet\*?(?:\[[^\]]*\])*\{([^}]+)\}/g, citeToToken('citet'));

  // \href{url}{text} -> [text](url)
  s = s.replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, (_m, url, t) => `[${t}](${url})`);
  // \url{url} -> <url>
  s = s.replace(/\\url\{([^}]+)\}/g, (_m, url) => `<${url}>`);
  // \textbf{t} -> **t**
  s = s.replace(/\\textbf\{([^}]+)\}/g, (_m, t) => `**${t}**`);
  // \emph{t} -> *t*
  s = s.replace(/\\emph\{([^}]+)\}/g, (_m, t) => `*${t}*`);
  // \texttt{t} -> `t`
  s = s.replace(/\\texttt\{([^}]+)\}/g, (_m, t) => `\`${t}\``);

  // Unescape common escaped characters
  s = s.replace(/\\([%&#_{}])/g, '$1');

  return s;
}

function countTabularCols(specRaw: string): number {
  const spec = String(specRaw ?? '').trim();
  if (!spec) return 0;

  // IMPORTANT:
  // Column specs can contain commands inside braces, e.g. >{\raggedright\arraybackslash}X
  // A naive regex will count the many "r" letters inside \raggedright as 'r' columns.
  // We must only count real column tokens at brace depth 0.
  let cols = 0;
  let i = 0;
  let depth = 0;

  const skipBraceGroup = () => {
    if (spec[i] !== '{') return;
    depth++;
    i++;
    while (i < spec.length && depth > 0) {
      const ch = spec[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
  };

  while (i < spec.length) {
    const ch = spec[i];

    // Track brace depth
    if (ch === '{') {
      depth++;
      i++;
      continue;
    }
    if (ch === '}') {
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }

    // Only interpret tokens at depth 0
    if (depth !== 0) {
      i++;
      continue;
    }

    // Ignore separators / whitespace
    if (ch === '|' || ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Skip modifiers like >{...} and <{...}
    if ((ch === '>' || ch === '<') && spec[i + 1] === '{') {
      i += 1; // now at '{'
      skipBraceGroup();
      continue;
    }

    // Skip @{} expressions
    if (ch === '@' && spec[i + 1] === '{') {
      i += 1; // now at '{'
      skipBraceGroup();
      continue;
    }

    // Column tokens
    if (ch === 'c' || ch === 'l' || ch === 'r' || ch === 'X') {
      cols++;
      i++;
      continue;
    }

    // p{...} / m{...} / b{...}
    if ((ch === 'p' || ch === 'm' || ch === 'b') && spec[i + 1] === '{') {
      cols++;
      i += 1; // now at '{'
      skipBraceGroup();
      continue;
    }

    // Unknown token; advance.
    i++;
  }

  return cols;
}

function parseCellCaptionFromTabularCell(lines: string[]): string {
  for (const ln of lines) {
    const t = String(ln ?? '').trim();
    // Support: \caption{Caption} inside subfigure cells (figure grids).
    const cap = /^\\caption\{([^}]*)\}(?:\s*%.*)?$/.exec(t);
    if (cap) return latexInlineToMarkdown(String(cap[1] ?? '').trim());
    // Support: \captionof{figure}{Caption} inside minipage cells (non-figure grids).
    const capOf = /^\\captionof\{figure\}\{([^}]*)\}(?:\s*%.*)?$/.exec(t);
    if (capOf) return latexInlineToMarkdown(String(capOf[1] ?? '').trim());
    // Support: \\ \scriptsize Caption
    // Support: \\ {\scriptsize Caption}
    const m1 = /^\\\\\s*\\scriptsize\s+(.+)$/.exec(t);
    if (m1) return latexInlineToMarkdown(String(m1[1] ?? '').trim());
    const m2 = /^\\\\\s*\{\s*\\scriptsize\s+(.+?)\s*\}\s*$/.exec(t);
    if (m2) return latexInlineToMarkdown(String(m2[1] ?? '').trim());
  }
  return '';
}

function parseFigureFromRaw(raw: string): Extract<Block, { kind: 'figure' }> | null {
  const lines = String(raw ?? '').split('\n');
  let src = '';
  let caption = '';
  let label = '';
  let align = 'center';
  const placement = '';
  let width: string | undefined;
  let desc: string | undefined;

  for (const ln of lines) {
    const t = ln.trim();
    if (t === '\\raggedleft') align = 'right';
    if (t === '\\raggedright') align = 'left';
    if (t === '\\centering') align = 'center';

    const ig = parseIncludegraphicsLine(t);
    if (!src && ig.src) src = ig.src;
    if (!width && ig.width) width = latexWidthToXmdWidth(ig.width);

    const cap = /^\\caption\{([^}]*)\}(?:\s*%.*)?$/.exec(t);
    if (cap) caption = latexInlineToMarkdown((cap[1] ?? '').trim());
    const lab = /^\\label\{([^}]*)\}(?:\s*%.*)?$/.exec(t);
    if (lab) label = latexInlineToMarkdown((lab[1] ?? '').trim());
  }

  if (!src) return null;
  return {
    kind: 'figure',
    src,
    caption,
    label: label || undefined,
    align,
    placement,
    width,
    desc,
    raw,
    blockIndex: 0,
    startOffset: 0,
    endOffset: raw.length,
  };
}

function parseAlignFromRaw(raw: string): 'left' | 'center' | 'right' | null {
  const lines = String(raw ?? '').split('\n');
  for (const ln of lines) {
    const t = String(ln ?? '').trim();
    if (t === '\\raggedleft') return 'right';
    if (t === '\\raggedright') return 'left';
    if (t === '\\centering') return 'center';
  }
  return null;
}

function parseTabularRuleStyleFromRaw(raw: string): TableStyle | null {
  const text = String(raw ?? '');
  const style: TableStyle = {};

  // \setlength{\arrayrulewidth}{4pt}
  const w = /\\setlength\{\\arrayrulewidth\}\{(\d+(?:\.\d+)?)pt\}/.exec(text);
  if (w) {
    const n = Number(w[1]);
    if (Number.isFinite(n) && n >= 0) style.borderWidthPx = Math.round(n);
  }

  // Extract definecolor blocks so \arrayrulecolor{NAME} can be mapped back to a CSS-ish color.
  // Supports: \definecolor{name}{HTML}{6B7280} and \definecolor{name}{rgb}{0.1,0.2,0.3}
  const colorMap = new Map<string, string>();
  const defineRe = /\\definecolor\{([^}]+)\}\{(HTML|rgb)\}\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = defineRe.exec(text))) {
    const name = String(m[1] ?? '').trim();
    const mode = String(m[2] ?? '').trim();
    const val = String(m[3] ?? '').trim();
    if (!name) continue;
    if (mode === 'HTML') {
      const hex = val.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
      if (hex.length === 6) colorMap.set(name, `#${hex}`);
    } else if (mode === 'rgb') {
      const parts = val.split(',').map((s) => Number(String(s).trim()));
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        const [r, g, b] = parts.map((n) => Math.max(0, Math.min(1, n)));
        const to255 = (x: number) => Math.round(x * 255);
        colorMap.set(name, `rgb(${to255(r)},${to255(g)},${to255(b)})`);
      }
    }
  }

  const rc = /\\arrayrulecolor\{([^}]+)\}/.exec(text);
  if (rc) {
    const name = String(rc[1] ?? '').trim();
    if (name) style.borderColor = colorMap.get(name) ?? name;
  }

  // LaTeX can't represent dotted/dashed table rules in a simple portable way; generated output is effectively solid.
  if (typeof style.borderWidthPx === 'number' || (style.borderColor && style.borderColor.trim().length > 0)) {
    style.borderStyle = 'solid';
  }

  return Object.keys(style).length ? style : null;
}

function parseTableColSpecToAlignAndVRules(specRaw: string, cols: number): { colAlign: TableColumnAlign[]; vRules: TableRule[] } {
  const spec = String(specRaw ?? '');
  const colAlign: TableColumnAlign[] = [];
  const vRules: TableRule[] = [];

  const readBars = (s: string, idx: number) => {
    let n = 0;
    while (idx < s.length && s[idx] === '|') {
      n++;
      idx++;
    }
    const rule: TableRule = n >= 2 ? 'double' : n === 1 ? 'single' : 'none';
    return { rule, idx };
  };

  const bars0 = readBars(spec, 0);
  vRules.push(bars0.rule);
  let i = bars0.idx;

  const inferAlignFromToken = (token: string): TableColumnAlign => {
    const t = token.replace(/\s+/g, '');
    if (t.includes('centering')) return 'center';
    if (t.includes('raggedleft')) return 'right';
    return 'left';
  };

  for (let c = 0; c < cols; c++) {
    // Find next column token end. Our generator always includes an X (tabularx) token per column.
    const xIdx = spec.indexOf('X', i);
    const tokenEnd = xIdx >= 0 ? xIdx + 1 : i;
    const token = spec.slice(i, tokenEnd);
    colAlign.push(inferAlignFromToken(token));
    i = tokenEnd;
    const bars = readBars(spec, i);
    vRules.push(bars.rule);
    i = bars.idx;
  }

  // Normalize length.
  while (colAlign.length < cols) colAlign.push('left');
  if (colAlign.length > cols) colAlign.length = cols;
  while (vRules.length < cols + 1) vRules.push('none');
  if (vRules.length > cols + 1) vRules.length = cols + 1;

  return { colAlign, vRules };
}

function parseTableFromRaw(raw: string): Extract<Block, { kind: 'table' }> | null {
  const text = String(raw ?? '');

  // Regex can't reliably capture the col-spec because it contains nested braces (e.g. >{\centering\arraybackslash}X).
  // Parse by scanning for the opening and matching braces.
  const beginNeedle = '\\begin{tabularx}{\\linewidth}{';
  const beginIdx = text.indexOf(beginNeedle);
  if (beginIdx < 0) return null;
  let pos = beginIdx + beginNeedle.length;
  let depth = 1;
  const colStart = pos;
  while (pos < text.length && depth > 0) {
    const ch = text[pos];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    pos++;
  }
  if (depth !== 0) return null;
  const colSpec = text.slice(colStart, pos - 1);
  const endNeedle = '\\end{tabularx}';
  const endIdx = text.indexOf(endNeedle, pos);
  if (endIdx < 0) return null;
  const body = text.slice(pos, endIdx);

  const cols = countTabularCols(colSpec);
  if (cols <= 0) return null;

  const { colAlign, vRules } = parseTableColSpecToAlignAndVRules(colSpec, cols);

  const style = parseTabularRuleStyleFromRaw(raw) ?? undefined;

  const captionMatch = /\\caption\{([^}]*)\}/.exec(text);
  const labelMatch = /\\label\{([^}]*)\}/.exec(text);
  const caption = captionMatch ? latexInlineToMarkdown(String(captionMatch[1] ?? '').trim()) : undefined;
  const label = labelMatch ? latexInlineToMarkdown(String(labelMatch[1] ?? '').trim()) : undefined;

  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    // Rule/color setup lines are emitted before hlines/rows; skip them so they don't become table content.
    .filter((l) => !/^\\arrayrulecolor\{[^}]+\}(?:\s*%.*)?$/.test(l));

  const toRule = (n: number): TableRule => (n >= 2 ? 'double' : n === 1 ? 'single' : 'none');
  const toCellText = (s: string): string => {
    const t = String(s ?? '').trim();
    const b = /^\\textbf\{([\s\S]*)\}$/.exec(t);
    return latexInlineToMarkdown((b ? b[1] : t) ?? '');
  };

  const hRules: TableRule[] = [];
  const header: string[] = [];
  const rows: string[][] = [];

  let i = 0;
  const readHLines = () => {
    let n = 0;
    while (i < lines.length && lines[i] === '\\hline') {
      n++;
      i++;
    }
    return n;
  };

  // boundary 0
  hRules.push(toRule(readHLines()));

  const readRow = (): string[] | null => {
    if (i >= lines.length) return null;
    // Row lines are emitted as: a & b & c \\
    const rowLine = lines[i] ?? '';
    i++;
    const m = /^(.*)\\\\\s*$/.exec(rowLine);
    const core = String((m ? m[1] : rowLine) ?? '').trim();
    if (!core) return Array.from({ length: cols }).map(() => '');
    const parts = core.split(/&(?![^{}]*\})/).map((p) => toCellText(p));
    while (parts.length < cols) parts.push('');
    if (parts.length > cols) parts.length = cols;
    return parts;
  };

  const h = readRow();
  if (!h) return null;
  header.push(...h);

  // boundary 1
  hRules.push(toRule(readHLines()));

  // body rows + boundaries after each row
  while (i < lines.length) {
    const r = readRow();
    if (!r) break;
    rows.push(r);
    hRules.push(toRule(readHLines()));
  }

  // Normalize hRules length: (header+rows)+1
  const totalRows = 1 + rows.length;
  while (hRules.length < totalRows + 1) hRules.push('none');
  if (hRules.length > totalRows + 1) hRules.length = totalRows + 1;

  return {
    kind: 'table',
    caption,
    label,
    header,
    rows,
    colAlign,
    vRules,
    hRules,
    ...(style ? { style } : null),
    raw,
    blockIndex: 0,
    startOffset: 0,
    endOffset: raw.length,
  };
}

function parseFigureGridFromSubfigureRaw(raw: string): {
  cols: number;
  rows: Array<Array<{ src: string; caption: string; width?: string } | null>>;
} | null {
  const lines = String(raw ?? '').split('\n');
  let inSubfigure = false;
  let subfigureDepth = 0;
  let currentCell: string[] = [];
  let currentRow: Array<{ src: string; caption: string } | null> = [];
  const rows: Array<Array<{ src: string; caption: string } | null>> = [];

  const flushCell = () => {
    const cellLines = currentCell.slice();
    currentCell = [];

    let src = '';
    let cap = '';
    let width: string | undefined;
    for (const l of cellLines) {
      const t = String(l ?? '').trim();
      const ig = parseIncludegraphicsLine(t);
      if (!src && ig.src) src = ig.src;
      if (!width && ig.width) width = latexWidthToXmdWidth(ig.width);
      const mCap = /^\\caption\{([^}]*)\}(?:\s*%.*)?$/.exec(t);
      if (mCap) cap = latexInlineToMarkdown(String(mCap[1] ?? '').trim());
    }
    if (!src) {
      currentRow.push(null);
      return;
    }
    currentRow.push({ src, caption: cap, ...(width ? { width } : null) });
  };

  const flushRow = () => {
    if (currentRow.length > 0) rows.push(currentRow);
    currentRow = [];
  };

  for (const ln of lines) {
    const t = String(ln ?? '').trim();

    if (/^\\begin\{subfigure\}/.test(t)) {
      inSubfigure = true;
      subfigureDepth++;
      currentCell = [];
      continue;
    }
    if (t === '\\end{subfigure}') {
      subfigureDepth = Math.max(0, subfigureDepth - 1);
      if (inSubfigure && subfigureDepth === 0) {
        inSubfigure = false;
        flushCell();
      }
      continue;
    }

    if (inSubfigure) {
      currentCell.push(ln);
      continue;
    }

    // Row separator emitted by our renderer.
    if (t.startsWith('\\par\\vspace')) {
      flushRow();
      continue;
    }
  }
  flushRow();

  const imgCount = rows.flat().filter((x) => x && x.src).length;
  if (imgCount < 2) return null;
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (cols <= 0) return null;

  // Normalize rows to cols
  const norm = rows.map((r) => {
    const rr = r.slice();
    while (rr.length < cols) rr.push(null);
    if (rr.length > cols) rr.length = cols;
    return rr;
  });

  return { cols, rows: norm };
}

function parseFigureGridFromLatexRaw(raw: string): {
  cols: number;
  rows: Array<Array<{ src: string; caption: string; width?: string } | null>>;
} | null {
  const text = String(raw ?? '');
  // Extract outer tabular spec
  const outerMatch = /\\begin\{tabular\}\{([^}]*)\}([\s\S]*?)\\end\{tabular\}/m.exec(text);
  if (!outerMatch) return null;
  const outerColSpec = outerMatch[1] ?? '';
  const body = outerMatch[2] ?? '';
  const cols = countTabularCols(outerColSpec);
  if (cols <= 0) return null;

  // Split rows on \\ (outside braces as best effort)
  const rowSegments = body.split(/\\\\/);
  const rows: Array<Array<{ src: string; caption: string; width?: string } | null>> = [];

  for (const rowSeg of rowSegments) {
    const cellsRaw = rowSeg.split(/&(?![^{}]*\})/);
    const row: Array<{ src: string; caption: string; width?: string } | null> = [];
    for (const cellRaw of cellsRaw) {
      const cellText = cellRaw.split('\n').map((l) => l.trim()).filter(Boolean);
      let src = '';
      let width: string | undefined;
      for (const l of cellText) {
        const ig = parseIncludegraphicsLine(l);
        if (ig.src) {
          src = ig.src;
          if (!width && ig.width) width = latexWidthToXmdWidth(ig.width);
          break;
        }
      }
      if (!src) {
        row.push(null);
        continue;
      }
      const cap = parseCellCaptionFromTabularCell(cellText);
      row.push({ src, caption: cap, ...(width ? { width } : null) });
    }
    // normalize row length
    while (row.length < cols) row.push(null);
    if (row.length > cols) row.length = cols;
    if (row.some((c) => c && c.src)) rows.push(row);
  }

  const imgCount = rows.flat().filter((x) => x && x.src).length;
  if (imgCount < 2) return null;

  return { cols, rows };
}


