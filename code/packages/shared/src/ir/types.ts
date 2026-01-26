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
  /**
   * Optional LaTeX/XMD label (e.g. "sec:intro") for linking via \ref.
   * Renderers may use this to set a stable DOM id.
   */
  label?: string;
  children: IrNode[];
}

export interface ParagraphNode extends BaseNode {
  type: 'paragraph';
  text: string;
  /**
   * Optional styling hints for renderers. This is intentionally small + generic to avoid
   * exploding IR node types for every LaTeX/XMD visual construct.
   */
  style?: TextStyle;
  /**
   * Optional inline style ranges within `text` (character offsets in the stored string).
   * This reuses `TextStyle` but is separate from `style` since inline styling is span-based.
   * Not all renderers support this yet.
   */
  inlineStyles?: Array<{ from: number; to: number; style: TextStyle }>;
}

/**
 * Minimal, cross-format styling hints for text blocks/spans.
 * Keep this very small + whitelist-like.
 */
export interface TextStyle {
  align?: 'left' | 'center' | 'right' | 'justify';
  color?: string; // CSS color name or #RRGGBB
  size?: 'small' | 'normal' | 'large';
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
  /**
   * Optional LaTeX label (e.g. "eq:attention") for linking via \eqref/\ref.
   */
  label?: string;
}

export interface FigureNode extends BaseNode {
  type: 'figure';
  src: string;
  caption: string;
  label?: string;
}

export type TableRule = 'none' | 'single' | 'double';
export type TableColumnAlign = 'left' | 'center' | 'right';
export type TableBorderStyle = 'solid' | 'dotted' | 'dashed';

export interface TableStyle {
  /**
   * Style used for single-line rules (vertical + horizontal).
   * Double rules always render using CSS/LaTeX "double" regardless of this setting.
   */
  borderStyle?: TableBorderStyle;
  /**
   * CSS color for table rules (e.g. "#6b7280", "rgba(0,0,0,0.2)").
   */
  borderColor?: string;
  /**
   * Border width in pixels (stringy in XMD, numeric in IR).
   */
  borderWidthPx?: number;
}

export interface TableNode extends BaseNode {
  type: 'table';
  caption?: string;
  label?: string;
  header: string[];
  rows: string[][];
  /**
   * Optional per-column alignment, derived from the table colSpec line (L/C/R).
   * If absent, consumers should treat columns as left-aligned.
   */
  colAlign?: TableColumnAlign[];
  /**
   * Optional vertical rules per boundary (length: cols + 1). Index 0 is left outer border.
   * Index i is the boundary between col i-1 and col i (for i in 1..cols-1). Index cols is right outer border.
   */
  vRules?: TableRule[];
  /**
   * Optional horizontal rules per boundary (length: (header+rows) + 1).
   * Index 0 is the top border. Index 1 is the border between header and first data row. Last index is bottom border.
   */
  hRules?: TableRule[];
  /**
   * Optional table-wide styling (applies to rendered rules).
   */
  style?: TableStyle;
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
   * Optional grid label for linking/export (e.g. "grid:overview" or "fig:grid-1").
   * Note: label semantics are project-defined; we keep it as a raw string.
   */
  label?: string;
  /**
   * Optional grid-level caption (typically used for figure grids).
   */
  caption?: string;
  /**
   * Optional grid-level styling for borders. This is intentionally the same shape as TableStyle
   * so grids and tables can share border attributes in XMD.
   */
  style?: TableStyle;
  /**
   * Optional grid-level alignment (applies to the grid block as a whole).
   */
  align?: 'left' | 'center' | 'right' | 'full';
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


