import { fnv1a32, hashToId } from './id';
import type { DocumentNode, IrNode, TableNode } from './types';

export interface IrStoreSnapshot {
  ir: DocumentNode;
  nodeHash: Map<string, string>;
}

function normalizeLineEndings(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

function normalizeWhitespace(s: string): string {
  return normalizeLineEndings(s).trim();
}

function normalizeTableCell(s: string): string {
  return normalizeWhitespace(s).replace(/\s+/g, ' ');
}

function nodeContentForHash(node: IrNode): string {
  switch (node.type) {
    case 'document':
      return `doc:${node.docId}`;
    case 'section':
      return `sec:${node.level}:${normalizeWhitespace(node.title)}`;
    case 'paragraph':
      return `p:${normalizeWhitespace(node.text)}`;
    case 'list':
      return `list:${node.ordered ? '1' : '0'}:${node.items.map(normalizeWhitespace).join('\n')}`;
    case 'code_block':
      return `code:${node.language ?? ''}:${normalizeLineEndings(node.code).trimEnd()}`;
    case 'math_block':
      return `math:${normalizeLineEndings(node.latex).trim()}`;
    case 'figure':
      return `fig:${normalizeWhitespace(node.src)}:${normalizeWhitespace(node.caption)}:${normalizeWhitespace(node.label ?? '')}`;
    case 'table': {
      const t = node as TableNode;
      const header = t.header.map(normalizeTableCell).join('|');
      const rows = t.rows.map((r) => r.map(normalizeTableCell).join('|')).join('\n');
      return `table:${normalizeWhitespace(t.caption ?? '')}:${normalizeWhitespace(t.label ?? '')}:${header}\n${rows}`;
    }
    case 'raw_latex_block':
      return `rawlatex:${normalizeLineEndings(node.latex)}`;
    case 'raw_xmd_block':
      // Preserve raw (but normalize line endings) so hash changes if user text changes.
      return `rawxmd:${normalizeLineEndings(node.xmd)}`;
    default: {
      const _exhaustive: never = node;
      return String(_exhaustive);
    }
  }
}

export function computeNodeHash(node: IrNode): string {
  const content = `${node.type}:${node.id}:${nodeContentForHash(node)}`;
  return hashToId(fnv1a32(content));
}

export function* walkIrNodes(root: DocumentNode): Generator<IrNode, void, void> {
  const stack: IrNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    yield node;
    if (node.type === 'document' || node.type === 'section') {
      // Traverse in-order
      const children = node.children ?? [];
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push(children[i]!);
      }
    }
  }
}

export function buildNodeIndex(root: DocumentNode): Map<string, IrNode> {
  const idx = new Map<string, IrNode>();
  for (const n of walkIrNodes(root)) idx.set(n.id, n);
  return idx;
}

export function buildNodeHashMap(root: DocumentNode): Map<string, string> {
  const map = new Map<string, string>();
  for (const n of walkIrNodes(root)) {
    // Do not hash structural container children list directly; hashes are per node content.
    map.set(n.id, computeNodeHash(n));
  }
  return map;
}

/**
 * Minimal in-memory IR store.
 * Phase 11: callers can keep this per-document instance and update it on XMD edits (debounced).
 */
export class IrStore {
  private _ir: DocumentNode;
  private _nodeHash: Map<string, string>;
  private _nodeIndex: Map<string, IrNode>;

  constructor(initial: IrStoreSnapshot) {
    this._ir = initial.ir;
    this._nodeHash = initial.nodeHash;
    this._nodeIndex = buildNodeIndex(initial.ir);
  }

  get ir(): DocumentNode {
    return this._ir;
  }

  get nodeHash(): ReadonlyMap<string, string> {
    return this._nodeHash;
  }

  getNode(id: string): IrNode | undefined {
    return this._nodeIndex.get(id);
  }

  /**
   * Replace IR snapshot (typically after re-parsing XMD).
   */
  setSnapshot(next: IrStoreSnapshot) {
    this._ir = next.ir;
    this._nodeHash = next.nodeHash;
    this._nodeIndex = buildNodeIndex(next.ir);
  }
}

export function makeSnapshotFromIr(ir: DocumentNode): IrStoreSnapshot {
  return { ir, nodeHash: buildNodeHashMap(ir) };
}


