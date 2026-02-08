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
  docType?: 'unknown' | 'academic_paper' | 'novel' | 'blog' | 'spec' | 'proposal' | 'notes' | 'mixed';
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

export interface ConceptionDmState {
  askedSlots?: string[]; // e.g. ["docType", "oneLiner", "audience"]
  answeredSlots?: string[];
  lastAskedSlot?: string | null;
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


