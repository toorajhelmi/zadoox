import type { ConceptionChatTurn, ConceptionState } from '@zadoox/shared';
import { api } from '@/lib/api/client';
import { BeliefPolicyV0 } from '../strategy/belief-policy-v0';
import { TwoStageV0 } from '../strategy/two-stage-v0';
import type { ConceptionStrategy } from '../strategy/types';
import { buildConceptionDR } from './dr';
import { mergeExtractedIg } from './merge-extracted-ig';
import { mergeTwoStageKps } from './merge-two-stage-kps';
import { generateId } from './utils';

export async function sendConceptionMessage(args: {
  conception: ConceptionState;
  message: string;
  onSaveConception: (next: ConceptionState, changeType?: 'auto-save' | 'ai-action') => void;
  uiPinnedKps?: Array<{ id: string; label: string }>;
  contextGroup?: { id: string; anchorKps: Array<{ id: string; label: string }> };
}): Promise<void> {
  const { conception, message, onSaveConception } = args;
  const msg = String(message ?? '').trim();
  if (!msg) return;

  const userTurn: ConceptionChatTurn = { id: `t-${generateId()}`, role: 'user', content: msg, createdAt: new Date().toISOString() };

  const pickStrategy = (s: ConceptionState): ConceptionStrategy => {
    // v0: lookup by strategyId; default to two-stage.
    if (s.strategyId === 'belief_policy:v0') return BeliefPolicyV0;
    if (s.strategyId === 'two_stage:v0') return TwoStageV0;
    return TwoStageV0;
  };

  const strat = pickStrategy(conception);
  const out = await strat.step({ conception, userTurn });
  const dr = buildConceptionDR(out.next, {
    uiPinnedKps: args.uiPinnedKps ?? [],
    contextGroup: args.contextGroup,
    latestUserTurnId: userTurn.id,
  });

  // Optimistic save: persist + render the user turn immediately (before the LLM responds).
  // This avoids the UX where the user's message only appears after the assistant reply.
  if (args.contextGroup?.id && Array.isArray(args.contextGroup.anchorKps) && args.contextGroup.anchorKps.length >= 2) {
    const cg = args.contextGroup;
    (out.next as any).dm = {
      ...((out.next as any).dm ?? {}),
      contextGroups: [
        ...((((out.next as any).dm ?? {}) as any).contextGroups ?? []),
        {
          id: cg.id,
          anchorKps: cg.anchorKps,
          turnId: userTurn.id,
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }
  onSaveConception(
    {
      ...out.next,
      updatedAt: new Date().toISOString(),
    },
    'auto-save'
  );

  // Two-stage strategy: single backend call yields both assistant text and KP/IG deltas.
  if (out.next.strategyId === 'two_stage:v0') {
    const step = await api.ai.conception.twoStageStep({ message: msg, dr, model: 'auto' });
    (out.next as any).dm = {
      ...(out.next as any).dm,
      stage: step.stage,
      convergenceScore: step.convergenceScore,
    };
    mergeTwoStageKps(out.next, userTurn.id, step.kps);
    const assistantTurn: ConceptionChatTurn = {
      id: `t-${generateId()}`,
      role: 'assistant',
      content: step.assistantText,
      createdAt: new Date().toISOString(),
    };

    const final: ConceptionState = {
      ...out.next,
      turns: [...(out.next.turns ?? []), assistantTurn],
      updatedAt: new Date().toISOString(),
    };

    onSaveConception(final, 'auto-save');
    return;
  }

  // Legacy fallback: extract-ig + chat.
  try {
    const extracted = await api.ai.conception.extractIg({ message: msg, dr, model: 'auto' });
    mergeExtractedIg(out.next, userTurn.id, extracted);
  } catch {
    // ignore
  }

  const llm = await api.ai.conception.chat({ message: msg, action: out.action, dr: buildConceptionDR(out.next), model: 'auto' });
  const assistantTurn: ConceptionChatTurn = {
    id: `t-${generateId()}`,
    role: 'assistant',
    content: llm.assistantText,
    createdAt: new Date().toISOString(),
  };

  const final: ConceptionState = {
    ...out.next,
    turns: [...(out.next.turns ?? []), assistantTurn],
    updatedAt: new Date().toISOString(),
  };

  onSaveConception(final, 'auto-save');
}


