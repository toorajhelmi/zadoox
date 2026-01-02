/**
 * Zadoox IR (Intermediate Representation) types.
 *
 * Phase 11 notes:
 * - Keep types minimal.
 * - IR is derived from XMD (editable surface) and is used internally for structure-aware features.
 * - For lossless behavior on malformed/unknown blocks, use RawXmdBlockNode.
 */

export type IrNodeType =
  | 'document'
  | 'section'
  | 'paragraph'
  | 'list'
  | 'code_block'
  | 'math_block'
  | 'figure'
  | 'table'
  | 'raw_latex_block'
  | 'raw_xmd_block';

export interface SourceSpan {
  /**
   * Optional offsets into the original XMD string.
   * These are best-effort and may be absent in early iterations.
   */
  startOffset?: number;
  endOffset?: number;
  /**
   * A stable-ish "block index" in the parsed block stream (Phase 11).
   */
  blockIndex?: number;
  /**
   * Original raw text for this node (when available). Not necessarily normalized.
   */
  raw?: string;
}

export interface BaseNode {
  id: string;
  type: IrNodeType;
  source?: SourceSpan;
}

export interface DocumentNode extends BaseNode {
  type: 'document';
  docId: string;
  children: IrNode[];
}

export interface SectionNode extends BaseNode {
  type: 'section';
  level: number;
  title: string;
  children: IrNode[];
}

export interface ParagraphNode extends BaseNode {
  type: 'paragraph';
  text: string;
}

export interface ListNode extends BaseNode {
  type: 'list';
  ordered: boolean;
  items: string[];
}

export interface CodeBlockNode extends BaseNode {
  type: 'code_block';
  language?: string;
  code: string;
}

export interface MathBlockNode extends BaseNode {
  type: 'math_block';
  latex: string;
}

export interface FigureNode extends BaseNode {
  type: 'figure';
  src: string;
  caption: string;
  label?: string;
}

export interface TableNode extends BaseNode {
  type: 'table';
  caption?: string;
  label?: string;
  header: string[];
  rows: string[][];
}

export interface RawLatexBlockNode extends BaseNode {
  type: 'raw_latex_block';
  latex: string;
}

export interface RawXmdBlockNode extends BaseNode {
  type: 'raw_xmd_block';
  xmd: string;
}

export type IrNode =
  | DocumentNode
  | SectionNode
  | ParagraphNode
  | ListNode
  | CodeBlockNode
  | MathBlockNode
  | FigureNode
  | TableNode
  | RawLatexBlockNode
  | RawXmdBlockNode;


