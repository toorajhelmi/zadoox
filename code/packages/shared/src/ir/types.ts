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
  | 'document_title'
  | 'document_author'
  | 'document_date'
  | 'section'
  | 'paragraph'
  | 'list'
  | 'code_block'
  | 'math_block'
  | 'figure'
  | 'table'
  | 'grid'
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

export interface DocumentTitleNode extends BaseNode {
  type: 'document_title';
  text: string;
}

export interface DocumentAuthorNode extends BaseNode {
  type: 'document_author';
  text: string;
}

export interface DocumentDateNode extends BaseNode {
  type: 'document_date';
  text: string;
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

export interface GridCell {
  children: IrNode[];
}

export interface GridNode extends BaseNode {
  type: 'grid';
  /**
   * Optional explicit column count. If absent, consumers may infer it from `rows`.
   */
  cols?: number;
  /**
   * Optional grid-level caption (typically used for figure grids).
   */
  caption?: string;
  /**
   * Optional grid-level alignment (applies to the grid block as a whole).
   */
  align?: 'left' | 'center' | 'right';
  /**
   * Optional grid-level placement. `inline` is intended to behave like wrap/flow in renderers that support it.
   */
  placement?: 'block' | 'inline';
  /**
   * Optional grid-level margin preset (controls spacing around/within the grid).
   */
  margin?: 'small' | 'medium' | 'large';
  /**
   * Rows of cells. Each cell can contain any block-level IR nodes.
   */
  rows: GridCell[][];
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
  | DocumentTitleNode
  | DocumentAuthorNode
  | DocumentDateNode
  | SectionNode
  | ParagraphNode
  | ListNode
  | CodeBlockNode
  | MathBlockNode
  | FigureNode
  | TableNode
  | GridNode
  | RawLatexBlockNode
  | RawXmdBlockNode;


