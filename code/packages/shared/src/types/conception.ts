/**
 * Conception (Ideation → Formalization)
 *
 * This is the structured “blank page” authoring state for Full‑AI mode.
 * It is intentionally lightweight and versioned so we can evolve it without breaking old docs.
 *
 * Conception.md reference: IG (IdeaGraph) → DP (DocPlan) → (Template/SG/IR)
 */

export type ConceptionPhase = 'ideation' | 'formalization';

export type ConceptionProvenanceRef =
  | { kind: 'chat_turn'; id: string }
  | { kind: 'chat_turn_range'; fromId: string; toId: string };

export interface ConceptionChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string; // ISO timestamp
  meta?: {
    source?: 'llm' | 'rule' | 'system';
    model?: string;
  };
}

export interface IdeaGraphNode {
  id: string;
  label: string;
  /**
   * Salience / intended coverage depth in [0,1]
   */
  weight: number;
  /**
   * Commitment status.
   * - accepted: high-trust representation of what the user intends
   * - proposed: candidate update (not yet user-endorsed; should not be treated as fact)
   * - deprecated: superseded by a newer revision
   */
  status?: 'accepted' | 'proposed' | 'deprecated';
  /**
   * Confidence in [0,1] (separate from weight/salience).
   * Use this to keep accepted graph conservative early, and increase as user endorses/clarifies.
   */
  confidence?: number;
  /**
   * Rough node state during ideation.
   */
  state?: 'hypothesis' | 'question' | 'topic' | 'assumption' | 'example' | 'requirement' | 'constraint';
  /**
   * Facets/aspects (genre lens tags) — e.g. for academic ideation:
   * Clarification, Exploration, Conception, Distinction, Question, Approach.
   * Kept generic so other lenses can reuse it.
   */
  facets?: string[];
  provenance?: ConceptionProvenanceRef[];
}

export interface IdeaGraphEdge {
  src: string;
  dst: string;
  /**
   * Loose relatedness / inclusion link weight in [0,1] (v0).
   */
  weight?: number;
  status?: 'accepted' | 'proposed' | 'deprecated';
  confidence?: number;
  facets?: string[];
  provenance?: ConceptionProvenanceRef[];
}

export interface IdeaGraph {
  nodes: IdeaGraphNode[];
  edges: IdeaGraphEdge[];
}

export interface DocPlanSection {
  id: string;
  title: string;
  /**
   * Why this section exists (goal/intent).
   */
  intent?: string;
  bullets?: string[];
  igLinks?: Array<{ igId: string; coverage?: number }>;
}

export interface DocPlan {
  docType?: 'unknown' | 'academic_paper' | 'whitepaper' | 'novel' | 'blog' | 'spec' | 'proposal' | 'notes' | 'mixed' | 'other';
  /**
   * Non-content planning preferences/constraints.
   * Keyed by template field ids (e.g. "blog.platform", "academic.venueType").
   */
  prefs?: Record<string, unknown>;
  /**
   * Deprecated content-oriented fields (kept for backward compatibility; do not rely on them for DP).
   */
  workingTitle?: string;
  oneLiner?: string;
  toneGuess?: string[];
  scope?: {
    inScope?: Array<{ igId: string; targetWeight?: number }>;
    outOfScope?: Array<{ igId: string }>;
  };
  sections: DocPlanSection[];
  openQuestions?: Array<{ igId?: string; question: string }>;
}

export interface ConceptionGoalHypothesis {
  /**
   * Minimal v0 hypothesis space; can expand later into the full goal-vector from conception.md.
   */
  docType: NonNullable<DocPlan['docType']>;
  score: number; // [0,1]
  evidence: string[]; // short snippets / reasons derived from turns
}

export type ConceptionDraftingStage = 'review' | 'select_nodes' | 'rank_nodes' | 'materializing' | 'done';

export interface ConceptionDraftingState {
  stage: ConceptionDraftingStage;
  /**
   * Included IdeaGraph node IDs for drafting.
   * If empty, the client may treat it as "include all" (but UX typically expands to explicit ids).
   */
  includedNodeIds: string[];
  /**
   * Per-node importance ranking for drafting.
   * Unspecified nodes are implicitly Low ('L').
   */
  importanceById: Record<string, 'H' | 'M' | 'L'>;
}

export interface ConceptionDmState {
  /**
   * LLM-detected dialogue phase (decoupled from UI surface `conception.phase`).
   */
  phase?: ConceptionPhase;
  convergenceScore?: number; // [0,1]
  allowIgUpdates?: boolean;
  askedSlots?: string[]; // e.g. ["docType", "oneLiner", "audience"]
  answeredSlots?: string[];
  lastAskedSlot?: string | null;
  formalizationState?: string;
  docPlanCompleteness?: number; // [0,1]
  docPlanReady?: boolean;
  suggestedDocTypeOptions?: string[];
  suggestedWorkingTitles?: string[];
  suggestedOneLiners?: string[];
  suggestedSections?: string[];
  docPlanTemplate?: unknown;
  selectedMediumFieldIds?: string[];
  askedFieldIds?: string[];
  answeredFieldIds?: string[];
  /**
   * The user turn id that first triggered formalization (for debug reset).
   * Used to truncate turns back to pre-formalization ideation.
   */
  formalizationStartTurnId?: string;
  /**
   * Drafting flow state (after DocPlan is ready, before the editor surface takes over).
   */
  drafting?: ConceptionDraftingState;
}

export interface ConceptionState {
  version: number; // schema version for this state object
  /**
   * Strategy identifier (swap behavior without changing outputs).
   * All strategies must produce the same artifacts: IG + goalHypotheses + DocPlan.
   */
  strategyId?: string; // e.g. "belief_policy:v0"
  phase: ConceptionPhase;
  turns: ConceptionChatTurn[];
  ideaGraph?: IdeaGraph;
  goalHypotheses?: ConceptionGoalHypothesis[];
  docPlan?: DocPlan;
  dm?: ConceptionDmState;
  updatedAt: string; // ISO timestamp
}


