import type {
  ConceptionChatTurn,
  ConceptionGoalHypothesis,
  ConceptionState,
  DocPlan,
} from '@zadoox/shared';
import type { ConceptionActionSpec, ConceptionStrategy, ConceptionStrategyStepInput, ConceptionStrategyStepOutput } from './types';
import { detectExplicitDocTypeAnswer, inferDocTypeHypotheses } from './docplan-heuristics';

function shouldUserGetSuggestions(message: string): boolean {
  const m = String(message ?? '').toLowerCase();
  return /\boutline\b|\bstructure\b|\bplan\b|\bsections\b|\brecommend\b|\bsuggest\b|\bwhat should i\b/.test(m);
}

export const BeliefPolicyV0: ConceptionStrategy = {
  id: 'belief_policy:v0',
  step(input: ConceptionStrategyStepInput): ConceptionStrategyStepOutput {
    const { conception, userTurn } = input;
    const msg = userTurn.content;

    // Update state (DM). NOTE: We do NOT upsert IdeaGraph nodes here.
    // IdeaGraph updates should be conservative and content-aware; they are extracted separately
    // (LLM JSON extraction) to avoid “junk nodes” from naive gist heuristics.
    const next: ConceptionState = {
      ...conception,
      strategyId: 'belief_policy:v0',
      phase: conception.phase ?? 'ideation',
      turns: [...(conception.turns ?? []), userTurn],
      updatedAt: new Date().toISOString(),
    };

    // Update goal hypotheses (doc_type only for v0).
    const explicitDocType = detectExplicitDocTypeAnswer(msg);
    const inferred = explicitDocType
      ? ([
          { docType: explicitDocType, score: 0.9, evidence: ['explicit user preference'] },
          { docType: 'unknown', score: 0.1, evidence: [] },
        ] as ConceptionGoalHypothesis[])
      : inferDocTypeHypotheses(msg);
    next.goalHypotheses = inferred;

    // Keep DocPlan present; update docType only when reasonably confident.
    const dp: DocPlan = next.docPlan ?? { sections: [], docType: 'unknown' };
    const top = inferred[0];
    if (explicitDocType) {
      dp.docType = explicitDocType;
    } else if (top && top.docType !== 'unknown' && top.score >= 0.65) {
      dp.docType = top.docType;
    }
    next.docPlan = dp;

    // Response policy:
    // - DM selects the minimal next action; LLM always realizes the final text.
    const askedSlots = new Set(next.dm?.askedSlots ?? []);
    const answeredSlots = new Set(next.dm?.answeredSlots ?? []);
    if (explicitDocType) answeredSlots.add('docType');
    // Keep DM slot bookkeeping minimal; do not force conversational moves.
    // We only record that the user gave an explicit docType (slot answered).
    next.dm = {
      ...(next.dm ?? {}),
      askedSlots: Array.from(askedSlots),
      answeredSlots: Array.from(answeredSlots),
      lastAskedSlot: next.dm?.lastAskedSlot ?? null,
    };

    // Conversation flow is handled by the LLM under overall guidelines.
    const action: ConceptionActionSpec = {
      kind: 'auto',
      constraints: {
        maxQuestions: 1,
        avoidChecklistTone: true,
        avoidEchoingUser: true,
        listenFirst: true,
      },
    };

    return { next, action };
  },
};

/**
 * DEPRECATED:
 * This strategy remains only for backward compatibility with old documents that persisted
 * `strategyId="belief_policy:v0"`. The active Full‑AI Conception path always uses `two_stage:v0`.
 *
 * NOTE: Keep this file thin. Move any generic heuristics/utilities into focused modules.
 */


