import type { ConceptionChatTurn, ConceptionState } from '@zadoox/shared';

export interface ConceptionStrategyStepInput {
  conception: ConceptionState;
  userTurn: ConceptionChatTurn;
}

export interface ConceptionActionSpec {
  /**
   * The DM does NOT micromanage conversation flow. It provides state + guidance;
   * the LLM is always the responder and chooses the most natural next move.
   */
  kind: 'auto';
  /**
   * Hard constraints the LLM must follow.
   */
  constraints?: {
    maxQuestions?: number; // soft constraint
    avoidChecklistTone?: boolean;
    avoidEchoingUser?: boolean;
    listenFirst?: boolean; // soft guidance
  };
}

export interface ConceptionStrategyStepOutput {
  next: ConceptionState;
  action: ConceptionActionSpec;
}

/**
 * Strategy pattern for Conception behavior.
 *
 * Contract:
 * - Must keep outputs stable across strategies (same artifacts):
 *   - `ideaGraph`
 *   - `goalHypotheses`
 *   - `docPlan`
 * - May differ in how it updates these artifacts and how it responds.
 */
export interface ConceptionStrategy {
  id: string; // e.g. "belief_policy:v0"
  step(input: ConceptionStrategyStepInput): Promise<ConceptionStrategyStepOutput> | ConceptionStrategyStepOutput;
}


