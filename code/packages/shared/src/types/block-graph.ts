/**
 * Block Graph (BG) — Phase 15
 *
 * A lightweight, block-level structural representation derived from the canonical IR.
 * This is intended for:
 * - stable-ish block identity (via underlying IR node ids)
 * - provenance anchoring for SG nodes/edges
 * - cheap local change detection / incremental updates
 */

export type BlockGraphVersion = 1;

export type BlockType =
  | 'doc_title'
  | 'doc_author'
  | 'doc_date'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'code'
  | 'math'
  | 'figure'
  | 'table'
  | 'grid'
  | 'raw';

export interface BlockGraphBlock {
  /**
   * Stable-ish block id. For now we use the underlying IR node id.
   */
  id: string;
  type: BlockType;
  /**
   * Human-readable summary text used for previews and simple heuristics.
   */
  text: string;
  /**
   * Optional offsets into the source document (best-effort).
   */
  source?: {
    startOffset?: number;
    endOffset?: number;
    blockIndex?: number;
  };
}

export interface BlockGraph {
  version: BlockGraphVersion;
  blocks: BlockGraphBlock[];
  updatedAt: string; // ISO
}


