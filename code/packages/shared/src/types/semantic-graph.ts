/**
 * Semantic Graph (SG) — Phase 15
 *
 * Minimal v1 schema intended to be:
 * - Persistable (JSON)
 * - Incrementally updatable
 * - BG/IR-agnostic (provenance stored separately or as optional refs)
 */
export type SemanticGraphVersion = 1;

/**
 * SG is schema-generic: node "type" is an interpreter-defined string.
 * Templates/genres define the allowed types for a given interpreter run.
 */
export type SemanticNodeType = string;

export interface BgSpanRef {
  blockId: string;
  from?: number; // optional char offset within the block source
  to?: number;   // optional char offset within the block source
}

export interface SemanticNode {
  id: string;
  type: SemanticNodeType;
  text: string;
  /**
   * Optional mapping back to BG (v1: allowed, but BG/SG independence can be enforced later
   * by moving this into a separate provenance structure).
   */
  bgRefs?: BgSpanRef[];
}

export interface SemanticEdge {
  from: string; // nodeId
  to: string;   // nodeId
  /**
   * Weight in [-1, 1]:
   * - < 0 => contradiction strength
   * - > 0 => support strength
   */
  weight: number;
}

/**
 * Optional provenance structure (kept separate from SG edges/nodes so BG/SG can remain independent).
 */
export interface NodeProvenance {
  nodes: Record<string, BgSpanRef[]>;
}

export interface SemanticGraph {
  version: SemanticGraphVersion;
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  provenance?: NodeProvenance;
  updatedAt: string; // ISO
}


