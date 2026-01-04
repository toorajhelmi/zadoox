import type { InlineEditBlock, InlineEditOperation } from '@zadoox/shared';

export function buildInlineBlocksAroundCursor(fullText: string, cursorLine0: number) {
  const lines = fullText.split('\n');
  const startLine = Math.max(0, cursorLine0 - 40);
  const endLine = Math.min(lines.length - 1, cursorLine0 + 40);

  let prefixOffset = 0;
  for (let i = 0; i < startLine; i++) prefixOffset += (lines[i]?.length || 0) + 1;

  const windowLines = lines.slice(startLine, endLine + 1);
  const windowText = windowLines.join('\n');

  const blocks: InlineEditBlock[] = [];
  const isBlank = (s: string) => s.trim().length === 0;

  const windowOffsets: number[] = [];
  {
    let off = 0;
    for (const l of windowLines) {
      windowOffsets.push(off);
      off += l.length + 1;
    }
  }

  let i = 0;
  let blockIndex = 0;
  while (i < windowLines.length) {
    const line = windowLines[i] ?? '';
    const lineTrim = line.trim();

    const startInWindow = windowOffsets[i] ?? 0;

    // Code fence block
    if (lineTrim.startsWith('```')) {
      let j = i + 1;
      while (j < windowLines.length) {
        const t = (windowLines[j] ?? '').trim();
        if (t.startsWith('```')) {
          j++;
          break;
        }
        j++;
      }
      const endInWindow = j < windowLines.length ? (windowOffsets[j] ?? windowText.length) : windowText.length;
      const text = windowText.slice(startInWindow, endInWindow);
      blocks.push({
        id: `b${blockIndex++}`,
        kind: 'code',
        text,
        start: prefixOffset + startInWindow,
        end: prefixOffset + endInWindow,
      });
      i = j;
      continue;
    }

    // Heading as its own block (include following blank line if present)
    if (lineTrim.startsWith('#')) {
      let j = i + 1;
      while (j < windowLines.length && isBlank(windowLines[j] ?? '')) j++;
      const endInWindow = j < windowLines.length ? (windowOffsets[j] ?? windowText.length) : windowText.length;
      const text = windowText.slice(startInWindow, endInWindow);
      blocks.push({
        id: `b${blockIndex++}`,
        kind: 'heading',
        text,
        start: prefixOffset + startInWindow,
        end: prefixOffset + endInWindow,
      });
      i = j;
      continue;
    }

    // Blank block (collapse contiguous blanks)
    if (isBlank(line)) {
      let j = i + 1;
      while (j < windowLines.length && isBlank(windowLines[j] ?? '')) j++;
      const endInWindow = j < windowLines.length ? (windowOffsets[j] ?? windowText.length) : windowText.length;
      const text = windowText.slice(startInWindow, endInWindow);
      blocks.push({
        id: `b${blockIndex++}`,
        kind: 'blank',
        text,
        start: prefixOffset + startInWindow,
        end: prefixOffset + endInWindow,
      });
      i = j;
      continue;
    }

    // List block (basic)
    const isListLine = (s: string) => {
      const t = s.trim();
      return /^([-*+])\s+/.test(t) || /^\d+\.\s+/.test(t);
    };
    if (isListLine(line)) {
      let j = i + 1;
      while (j < windowLines.length) {
        const l2 = windowLines[j] ?? '';
        if (isBlank(l2)) {
          j++;
          break;
        }
        if (!isListLine(l2)) break;
        j++;
      }
      const endInWindow = j < windowLines.length ? (windowOffsets[j] ?? windowText.length) : windowText.length;
      const text = windowText.slice(startInWindow, endInWindow);
      blocks.push({
        id: `b${blockIndex++}`,
        kind: 'list',
        text,
        start: prefixOffset + startInWindow,
        end: prefixOffset + endInWindow,
      });
      i = j;
      continue;
    }

    // Paragraph/other: consume until blank line
    let j = i + 1;
    while (j < windowLines.length && !isBlank(windowLines[j] ?? '')) {
      const t = (windowLines[j] ?? '').trim();
      if (t.startsWith('#') || t.startsWith('```')) break;
      j++;
    }
    if (j < windowLines.length && isBlank(windowLines[j] ?? '')) j++;
    const endInWindow = j < windowLines.length ? (windowOffsets[j] ?? windowText.length) : windowText.length;
    const text = windowText.slice(startInWindow, endInWindow);
    blocks.push({
      id: `b${blockIndex++}`,
      kind: 'paragraph',
      text,
      start: prefixOffset + startInWindow,
      end: prefixOffset + endInWindow,
    });
    i = j;
  }

  // Identify cursor block by absolute character offset
  let cursorPos = 0;
  for (let li = 0; li < cursorLine0 && li < lines.length; li++) cursorPos += (lines[li]?.length || 0) + 1;
  const cursorBlock = blocks.find((b) => cursorPos >= b.start && cursorPos < b.end) || blocks[0];
  return { blocks, cursorBlockId: cursorBlock?.id };
}

export function applyInlineOperations(fullText: string, blocks: InlineEditBlock[], operations: InlineEditOperation[]) {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  let text = fullText;

  // Apply from end to start (stable offsets)
  const toSpan = (op: InlineEditOperation) => {
    if (op.type === 'replace_range') {
      const a = byId.get(op.startBlockId);
      const b = byId.get(op.endBlockId);
      if (!a || !b) return null;
      const start = Math.min(a.start, b.start);
      const end = Math.max(a.end, b.end);
      return { start, end, insert: op.content };
    }
    if (op.type === 'insert_before') {
      const a = byId.get(op.anchorBlockId);
      if (!a) return null;
      return { start: a.start, end: a.start, insert: op.content };
    }
    if (op.type === 'insert_after') {
      const a = byId.get(op.anchorBlockId);
      if (!a) return null;
      return { start: a.end, end: a.end, insert: op.content };
    }
    return null;
  };

  const spans = operations
    .map(toSpan)
    .filter((x): x is { start: number; end: number; insert: string } => !!x);
  spans.sort((s1, s2) => s2.start - s1.start);

  for (const s of spans) {
    text = text.slice(0, s.start) + s.insert + text.slice(s.end);
  }
  return text;
}


