import { stableNodeId } from '../ir/id';
import type {
  CodeBlockNode,
  DocumentAuthorNode,
  DocumentDateNode,
  DocumentTitleNode,
  DocumentNode,
  FigureNode,
  IrNode,
  ListNode,
  MathBlockNode,
  ParagraphNode,
  RawXmdBlockNode,
  SectionNode,
  TableNode,
} from '../ir/types';

type Block =
  | { kind: 'title'; title: string; raw: string; startOffset: number; endOffset: number }
  | { kind: 'author'; text: string; raw: string; startOffset: number; endOffset: number }
  | { kind: 'date'; text: string; raw: string; startOffset: number; endOffset: number }
  | { kind: 'heading'; level: number; title: string; raw: string; startOffset: number; endOffset: number }
  | { kind: 'code'; language?: string; code: string; raw: string; startOffset: number; endOffset: number }
  | { kind: 'math'; latex: string; raw: string; startOffset: number; endOffset: number }
  | { kind: 'figure'; src: string; caption: string; label?: string; raw: string; startOffset: number; endOffset: number }
  | { kind: 'table'; header: string[]; rows: string[][]; caption?: string; label?: string; raw: string; startOffset: number; endOffset: number }
  | { kind: 'list'; ordered: boolean; items: string[]; raw: string; startOffset: number; endOffset: number }
  | { kind: 'paragraph'; text: string; raw: string; startOffset: number; endOffset: number }
  | { kind: 'raw'; xmd: string; raw: string; startOffset: number; endOffset: number };

function normalizeLineEndings(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

function splitLinesWithOffsets(xmd: string): Array<{ line: string; start: number; end: number }> {
  const s = normalizeLineEndings(xmd);
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

function parseHeading(line: string): { level: number; title: string } | null {
  const m = /^(#{1,6})\s+(.+)$/.exec(line.trim());
  if (!m) return null;
  return { level: m[1].length, title: m[2].trim() };
}

function parseDocTitle(line: string): { title: string } | null {
  // XMD title marker: "@ Title"
  const m = /^@\s+(.+)$/.exec(line.trim());
  if (!m) return null;
  const title = (m[1] || '').trim();
  if (!title) return null;
  return { title };
}

function parseDocAuthor(line: string): { text: string } | null {
  // XMD author marker: "@^ Author Name"
  const m = /^@\^\s+(.+)$/.exec(line.trim());
  if (!m) return null;
  const text = (m[1] || '').trim();
  if (!text) return null;
  return { text };
}

function parseDocDate(line: string): { text: string } | null {
  // XMD date marker: "@= 2026-01-02"
  const m = /^@=\s+(.+)$/.exec(line.trim());
  if (!m) return null;
  const text = (m[1] || '').trim();
  if (!text) return null;
  return { text };
}

function parseListItem(line: string): { ordered: boolean; item: string } | null {
  const trimmed = line.trim();
  const mOrdered = /^(\d+)\.\s+(.+)$/.exec(trimmed);
  if (mOrdered) return { ordered: true, item: mOrdered[2].trim() };
  const mUnordered = /^[-*]\s+(.+)$/.exec(trimmed);
  if (mUnordered) return { ordered: false, item: mUnordered[1].trim() };
  return null;
}

function parseMarkdownFigureLine(line: string): { src: string; caption: string; label?: string } | null {
  // Support: ![caption](url){#fig:xyz ...}
  const m = /!\[([^\]]*)\]\(([^)]+)\)\s*(\{(?:\{REF\}|\{CH\}|[^}])*\})/i.exec(line);
  if (!m) return null;
  const caption = (m[1] || '').trim();
  const src = (m[2] || '').trim();
  const attrBlock = String(m[3] || '').trim();
  const attrs = attrBlock.startsWith('{') && attrBlock.endsWith('}') ? attrBlock.slice(1, -1) : attrBlock;
  const idMatch = /#(fig:[^\s}]+)/i.exec(attrs);
  return { src, caption, label: idMatch?.[1] };
}

function parsePipeRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  // Allow leading/trailing pipes but strip them.
  const core = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells = core.split('|').map((c) => c.trim());
  if (cells.length < 2) return null;
  return cells;
}

function isTableSeparatorRow(line: string): boolean {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const parts = trimmed.split('|').map((p) => p.trim());
  if (parts.length < 2) return false;
  return parts.every((p) => /^:?-{3,}:?$/.test(p));
}

function parseBlocks(xmd: string): Block[] {
  const lines = splitLinesWithOffsets(xmd);
  const blocks: Block[] = [];
  let i = 0;

  const pushParagraph = (startIdx: number, endIdxExclusive: number) => {
    const seg = lines.slice(startIdx, endIdxExclusive);
    const raw = seg.map((l) => l.line).join('\n');
    const text = raw.trimEnd(); // keep internal newlines; store as-is-ish
    const startOffset = seg[0]?.start ?? 0;
    const endOffset = seg[seg.length - 1]?.end ?? startOffset;
    if (text.trim().length === 0) return;
    blocks.push({ kind: 'paragraph', text, raw, startOffset, endOffset });
  };

  while (i < lines.length) {
    const { line, start, end } = lines[i];

    // Skip pure blank lines
    if (isBlank(line)) {
      i++;
      continue;
    }

    // Document title (XMD): "@ Title"
    const docAuthor = parseDocAuthor(line);
    if (docAuthor) {
      blocks.push({
        kind: 'author',
        text: docAuthor.text,
        raw: line,
        startOffset: start,
        endOffset: end,
      });
      i++;
      continue;
    }

    const docDate = parseDocDate(line);
    if (docDate) {
      blocks.push({
        kind: 'date',
        text: docDate.text,
        raw: line,
        startOffset: start,
        endOffset: end,
      });
      i++;
      continue;
    }

    const docTitle = parseDocTitle(line);
    if (docTitle) {
      blocks.push({
        kind: 'title',
        title: docTitle.title,
        raw: line,
        startOffset: start,
        endOffset: end,
      });
      i++;
      continue;
    }

    // Heading
    const heading = parseHeading(line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading.level,
        title: heading.title,
        raw: line,
        startOffset: start,
        endOffset: end,
      });
      i++;
      continue;
    }

    // Fenced code block
    const fenceMatch = /^```(\w+)?\s*$/.exec(line.trim());
    if (fenceMatch) {
      const language = fenceMatch[1];
      const startOffset = start;
      let j = i + 1;
      const codeLines: string[] = [];
      while (j < lines.length && !/^```\s*$/.test(lines[j].line.trim())) {
        codeLines.push(lines[j].line);
        j++;
      }
      if (j < lines.length && /^```\s*$/.test(lines[j].line.trim())) {
        const endOffset = lines[j].end;
        const raw = lines.slice(i, j + 1).map((l) => l.line).join('\n');
        blocks.push({ kind: 'code', language, code: codeLines.join('\n'), raw, startOffset, endOffset });
        i = j + 1;
        continue;
      }
      // Unclosed fence => preserve raw as lossless block
      const raw = lines.slice(i).map((l) => l.line).join('\n');
      blocks.push({ kind: 'raw', xmd: raw, raw, startOffset, endOffset: lines[lines.length - 1]?.end ?? end });
      break;
    }

    // $$ math block (block form)
    if (line.trim() === '$$') {
      const startOffset = start;
      let j = i + 1;
      const mathLines: string[] = [];
      while (j < lines.length && lines[j].line.trim() !== '$$') {
        mathLines.push(lines[j].line);
        j++;
      }
      if (j < lines.length && lines[j].line.trim() === '$$') {
        const endOffset = lines[j].end;
        const raw = lines.slice(i, j + 1).map((l) => l.line).join('\n');
        blocks.push({ kind: 'math', latex: mathLines.join('\n').trim(), raw, startOffset, endOffset });
        i = j + 1;
        continue;
      }
      const raw = lines.slice(i).map((l) => l.line).join('\n');
      blocks.push({ kind: 'raw', xmd: raw, raw, startOffset, endOffset: lines[lines.length - 1]?.end ?? end });
      break;
    }

    // ::: blocks
    const directive = /^:::(\w+)\s*(.*)?$/.exec(line.trim());
    if (directive) {
      const kind = directive[1]?.toLowerCase();
      const startOffset = start;
      let j = i + 1;
      const bodyLines: string[] = [];
      while (j < lines.length && lines[j].line.trim() !== ':::') {
        bodyLines.push(lines[j].line);
        j++;
      }
      if (j < lines.length && lines[j].line.trim() === ':::') {
        const endOffset = lines[j].end;
        const raw = lines.slice(i, j + 1).map((l) => l.line).join('\n');
        const body = bodyLines.join('\n');

        if (kind === 'equation') {
          blocks.push({ kind: 'math', latex: body.trim(), raw, startOffset, endOffset });
          i = j + 1;
          continue;
        }

        if (kind === 'figure') {
          // Minimal: treat first non-empty line as src, remainder as caption.
          const parts = bodyLines.map((l) => l.trim()).filter((l) => l.length > 0);
          const src = parts[0] || '';
          const caption = parts.slice(1).join(' ').trim();
          if (src) {
            blocks.push({ kind: 'figure', src, caption, raw, startOffset, endOffset });
          } else {
            blocks.push({ kind: 'raw', xmd: raw, raw, startOffset, endOffset });
          }
          i = j + 1;
          continue;
        }

        if (kind === 'table') {
          // Minimal pipe-table parsing from body
          const bodyNonEmpty = bodyLines.filter((l) => l.trim().length > 0);
          const headerRow = bodyNonEmpty[0] ? parsePipeRow(bodyNonEmpty[0]) : null;
          const sepRowOk = bodyNonEmpty[1] ? isTableSeparatorRow(bodyNonEmpty[1]) : false;
          if (headerRow && sepRowOk) {
            const rows: string[][] = [];
            for (let k = 2; k < bodyNonEmpty.length; k++) {
              const row = parsePipeRow(bodyNonEmpty[k]);
              if (row) rows.push(row);
            }
            blocks.push({ kind: 'table', header: headerRow, rows, raw, startOffset, endOffset });
          } else {
            blocks.push({ kind: 'raw', xmd: raw, raw, startOffset, endOffset });
          }
          i = j + 1;
          continue;
        }

        // Unknown directive: preserve losslessly
        blocks.push({ kind: 'raw', xmd: raw, raw, startOffset, endOffset });
        i = j + 1;
        continue;
      }

      // Unclosed ::: block: preserve remaining
      const raw = lines.slice(i).map((l) => l.line).join('\n');
      blocks.push({ kind: 'raw', xmd: raw, raw, startOffset, endOffset: lines[lines.length - 1]?.end ?? end });
      break;
    }

    // List block
    const li = parseListItem(line);
    if (li) {
      const ordered = li.ordered;
      const startOffset = start;
      const items: string[] = [li.item];
      let j = i + 1;
      while (j < lines.length) {
        if (isBlank(lines[j].line)) break;
        const next = parseListItem(lines[j].line);
        if (!next || next.ordered !== ordered) break;
        items.push(next.item);
        j++;
      }
      const endOffset = lines[Math.max(i, j - 1)]?.end ?? end;
      const raw = lines.slice(i, j).map((l) => l.line).join('\n');
      blocks.push({ kind: 'list', ordered, items, raw, startOffset, endOffset });
      i = j;
      continue;
    }

    // Single-line markdown figure (existing Zadoox syntax used by outline extraction)
    const fig = parseMarkdownFigureLine(line);
    if (fig) {
      blocks.push({
        kind: 'figure',
        src: fig.src,
        caption: fig.caption,
        label: fig.label,
        raw: line,
        startOffset: start,
        endOffset: end,
      });
      i++;
      continue;
    }

    // Paragraph (consume until blank line, or until next structural block start)
    const paraStart = i;
    let j = i + 1;
    while (j < lines.length) {
      const ln = lines[j].line;
      if (isBlank(ln)) break;
      if (parseHeading(ln)) break;
      if (/^```/.test(ln.trim())) break;
      if (ln.trim() === '$$') break;
      if (/^:::\w+/.test(ln.trim())) break;
      if (parseListItem(ln)) break;
      // Keep markdown figure lines inside paragraph? They are usually standalone; stop before it.
      if (parseMarkdownFigureLine(ln)) break;
      j++;
    }
    pushParagraph(paraStart, j);
    i = j;
  }

  return blocks;
}

function makeRawNode(docId: string, path: string, blockIndex: number, xmd: string, startOffset: number, endOffset: number): RawXmdBlockNode {
  return {
    type: 'raw_xmd_block',
    id: stableNodeId({ docId, nodeType: 'raw_xmd_block', path }),
    xmd,
    source: { blockIndex, raw: xmd, startOffset, endOffset },
  };
}

/**
 * Parse XMD into IR.
 *
 * - Never throws: malformed/unknown blocks become RawXmdBlockNode.
 * - Creates stable-ish IDs based on docId + nodeType + path.
 */
export function parseXmdToIr(params: { docId: string; xmd: string }): DocumentNode {
  const { docId } = params;
  const xmd = normalizeLineEndings(params.xmd ?? '');
  const blocks = parseBlocks(xmd);

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

  const appendToCurrentContainer = (node: IrNode) => {
    const current = sectionStack[sectionStack.length - 1];
    if (current) current.children.push(node);
    else doc.children.push(node);
  };

  const openSection = (node: SectionNode) => {
    // Pop until parent level < node.level
    while (sectionStack.length > 0) {
      const top = sectionStack[sectionStack.length - 1];
      if (top.level < node.level) break;
      sectionStack.pop();
    }
    appendToCurrentContainer(node);
    sectionStack.push(node);
  };

  // Path counters are per-container. Keep a simple stack of counters tied to section stack.
  type Counters = Record<string, number>;
  const countersStack: Counters[] = [{ section: 0, paragraph: 0, list: 0, code_block: 0, math_block: 0, figure: 0, table: 0, raw_xmd_block: 0, document_title: 0 }];

  const currentCounters = () => countersStack[countersStack.length - 1]!;

  // We need stable section paths based on position among siblings at each level.
  // We encode each opened section's "section index" within its parent as a path segment like `sec[0]`.
  const sectionPathStack: string[] = [];

  const fullPath = (leaf: string) => {
    if (sectionPathStack.length === 0) return leaf;
    return `${sectionPathStack.join('/')}/${leaf}`;
  };

  blocks.forEach((b, blockIndex) => {
    try {
      if (b.kind === 'heading') {
        // New counters scope for each section container
        const parentCounters = currentCounters();
        const secIdx = parentCounters.section ?? 0;
        parentCounters.section = secIdx + 1;

        // Update section stack / path stack based on heading level
        while (sectionStack.length > 0) {
          const top = sectionStack[sectionStack.length - 1];
          if (top.level < b.level) break;
          sectionStack.pop();
          countersStack.pop();
          sectionPathStack.pop();
        }

        const leaf = `sec[${secIdx}]`;
        sectionPathStack.push(leaf);

        const path = sectionPathStack.join('/');
        const node: SectionNode = {
          type: 'section',
          id: stableNodeId({ docId, nodeType: 'section', path }),
          level: b.level,
          title: b.title,
          children: [],
          source: { blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };

        // Open section and push new counter scope for its children
        openSection(node);
        countersStack.push({ section: 0, paragraph: 0, list: 0, code_block: 0, math_block: 0, figure: 0, table: 0, raw_xmd_block: 0, document_title: 0 });
        return;
      }

      const counters = currentCounters();

      if (b.kind === 'title') {
        const idx = titleCount++;
        const path = `title[${idx}]`;
        const node: DocumentTitleNode = {
          type: 'document_title',
          id: stableNodeId({ docId, nodeType: 'document_title', path }),
          text: b.title,
          source: { blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        // Titles are always document-level nodes (never nested under sections).
        doc.children.push(node);
        return;
      }

      if (b.kind === 'author') {
        const idx = authorCount++;
        const path = `author[${idx}]`;
        const node: DocumentAuthorNode = {
          type: 'document_author',
          id: stableNodeId({ docId, nodeType: 'document_author', path }),
          text: b.text,
          source: { blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
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
          source: { blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
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
          source: { blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
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
          source: { blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
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
          language: b.language,
          code: b.code,
          source: { blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
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
          source: { blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
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
          id: stableNodeId({ docId, nodeType: 'figure', path }),
          src: b.src,
          caption: b.caption,
          label: b.label,
          source: { blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        appendToCurrentContainer(node);
        return;
      }

      if (b.kind === 'table') {
        const idx = counters.table ?? 0;
        counters.table = idx + 1;
        const path = fullPath(`table[${idx}]`);
        const node: TableNode = {
          type: 'table',
          id: stableNodeId({ docId, nodeType: 'table', path }),
          caption: b.caption,
          label: b.label,
          header: b.header,
          rows: b.rows,
          source: { blockIndex, raw: b.raw, startOffset: b.startOffset, endOffset: b.endOffset },
        };
        appendToCurrentContainer(node);
        return;
      }

      // raw fallback
      const idx = counters.raw_xmd_block ?? 0;
      counters.raw_xmd_block = idx + 1;
      const path = fullPath(`raw[${idx}]`);
      appendToCurrentContainer(makeRawNode(docId, path, blockIndex, b.xmd ?? b.raw, b.startOffset, b.endOffset));
    } catch {
      // Never throw. Preserve the original raw for this block.
      const counters = currentCounters();
      const idx = counters.raw_xmd_block ?? 0;
      counters.raw_xmd_block = idx + 1;
      const path = fullPath(`raw[${idx}]`);
      appendToCurrentContainer(makeRawNode(docId, path, blockIndex, b.raw ?? '', b.startOffset ?? 0, b.endOffset ?? 0));
    }
  });

  return doc;
}


