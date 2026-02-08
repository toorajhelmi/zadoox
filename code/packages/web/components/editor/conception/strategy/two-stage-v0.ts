'use client';

import type { ConceptionState, ConceptionChatTurn } from '@zadoox/shared';
import type { ConceptionStrategy, ConceptionStrategyStepInput, ConceptionStrategyStepOutput } from './types';

/**
 * Two-stage strategy:
 * - DM is lightweight (append the user turn, track strategyId)
 * - LLM drives both the visible response AND scribe KP extraction via backend endpoint.
 */
export const TwoStageV0: ConceptionStrategy = {
  id: 'two_stage:v0',
  step(input: ConceptionStrategyStepInput): ConceptionStrategyStepOutput {
    const { conception, userTurn } = input;
    const next: ConceptionState = {
      ...conception,
      strategyId: 'two_stage:v0',
      phase: conception.phase ?? 'ideation',
      turns: [...(conception.turns ?? []), userTurn as ConceptionChatTurn],
      updatedAt: new Date().toISOString(),
    };

    return {
      next,
      action: { kind: 'auto', constraints: { maxQuestions: 2, avoidChecklistTone: true, avoidEchoingUser: true, listenFirst: true } },
    };
  },
};


