import { stableNodeId } from '../ir/id';
import type {
  CodeBlockNode,
  DocumentTitleNode,
  DocumentAuthorNode,
  DocumentDateNode,
  DocumentNode,
  IrNode,
  ListNode,
  MathBlockNode,
  ParagraphNode,
  RawLatexBlockNode,
  SectionNode,
} from '../ir/types';

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
  const countersStack: Counters[] = [{ section: 0, paragraph: 0, list: 0, code_block: 0, math_block: 0, raw_latex_block: 0 }];
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
    countersStack.push({ section: 0, paragraph: 0, list: 0, code_block: 0, math_block: 0, raw_latex_block: 0 });
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

      // raw fallback
      const idx = counters.raw_latex_block ?? 0;
      counters.raw_latex_block = idx + 1;
      const path = fullPath(`raw[${idx}]`);
      const node: RawLatexBlockNode = {
        type: 'raw_latex_block',
        id: stableNodeId({ docId, nodeType: 'raw_latex_block', path }),
        latex: b.latex ?? b.raw,
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

  const pushParagraph = (startIdx: number, endIdxExclusive: number, blockIndex: number) => {
    const seg = lines.slice(startIdx, endIdxExclusive);
    const raw = seg.map((l) => l.line).join('\n');
    const text = latexInlineToMarkdown(raw.trimEnd());
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
    if (/^\\documentclass\{[^}]+\}\s*$/.test(line.trim())) {
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\usepackage(\[[^\]]+\])?\{[^}]+\}\s*$/.test(line.trim())) {
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\begin\{document\}\s*$/.test(line.trim())) {
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\end\{document\}\s*$/.test(line.trim())) {
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\maketitle\s*$/.test(line.trim())) {
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\author\{[^}]*\}\s*$/.test(line.trim())) {
      const m = /^\\author\{([^}]*)\}\s*$/.exec(line.trim());
      const text = latexInlineToMarkdown((m?.[1] ?? '').trim());
      if (text.trim().length > 0) {
        blocks.push({ kind: 'author', text, raw: line, blockIndex, startOffset: start, endOffset: end });
      }
      i++;
      blockIndex++;
      continue;
    }
    if (/^\\date\{[^}]*\}\s*$/.test(line.trim())) {
      const m = /^\\date\{([^}]*)\}\s*$/.exec(line.trim());
      const text = latexInlineToMarkdown((m?.[1] ?? '').trim());
      if (text.trim().length > 0) {
        blocks.push({ kind: 'date', text, raw: line, blockIndex, startOffset: start, endOffset: end });
      }
      i++;
      blockIndex++;
      continue;
    }

    // \title{...}
    const titleMatch = /^\\title\{([^}]*)\}\s*$/.exec(line.trim());
    if (titleMatch) {
      const title = latexInlineToMarkdown((titleMatch[1] ?? '').trim());
      blocks.push({
        kind: 'title',
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

    // Sections
    const sec = /^\\(section|subsection|subsubsection)\{([^}]*)\}\s*$/.exec(line.trim());
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

    // equation environment
    if (line.trim() === '\\begin{equation}') {
      const startOffset = start;
      let j = i + 1;
      const body: string[] = [];
      while (j < lines.length && lines[j].line.trim() !== '\\end{equation}') {
        body.push(lines[j].line);
        j++;
      }
      if (j < lines.length && lines[j].line.trim() === '\\end{equation}') {
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

    // Paragraph: consume until blank line or recognized block start
    const startIdx = i;
    let j = i;
    while (j < lines.length) {
      const t = lines[j].line.trim();
      if (j !== startIdx && isBlank(t)) break;
      if (j !== startIdx && (/^\\(section|subsection|subsubsection)\{/.test(t) || t === '\\begin{verbatim}' || t === '\\begin{equation}' || /^\\begin\{(itemize|enumerate)\}/.test(t))) {
        break;
      }
      if (j !== startIdx && isBlank(lines[j].line)) break;
      if (j !== startIdx && isBlank(t)) break;
      if (j !== startIdx && t === '') break;
      if (j !== startIdx && t.startsWith('%')) {
        // comments can be inside paragraphs; keep them
      }
      if (j !== startIdx && isBlank(lines[j].line)) break;
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

function latexInlineToMarkdown(text: string): string {
  let s = text ?? '';

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


