import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API client so we can assert we always go through the LLM path.
vi.mock('@/lib/api/client', () => ({
  api: {
    ai: {
      conception: {
        twoStageStep: vi.fn(async () => ({
          assistantText: 'LLM response',
          stage: 'discovery',
          convergenceScore: 0.2,
          kps: { add: [], strengthen: [], supersede: [], edges: [] },
        })),
        // Not used in this test, but present in the real client shape.
        chat: vi.fn(async () => ({ assistantText: 'SHOULD_NOT_BE_CALLED' })),
      },
    },
  },
}));

import { sendConceptionMessage } from '../conception-chat-logic';
import type { ConceptionState } from '@zadoox/shared';
import { api } from '@/lib/api/client';

describe('sendConceptionMessage (Conception)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always uses the LLM conception endpoint (no rule-based assistantText)', async () => {
    const conception: ConceptionState = {
      version: 1,
      phase: 'ideation',
      turns: [],
      ideaGraph: { nodes: [], edges: [] },
      docPlan: { sections: [], docType: 'unknown' },
      goalHypotheses: [],
      updatedAt: new Date().toISOString(),
    };

    const onSaveConception = vi.fn();
    await sendConceptionMessage({ conception, message: 'hello', onSaveConception });

    expect(api.ai.conception.twoStageStep).toHaveBeenCalledTimes(1);
    expect(api.ai.conception.chat).toHaveBeenCalledTimes(0);
    const savedStates = onSaveConception.mock.calls.map((c) => c[0] as ConceptionState);
    const sawAssistant = savedStates.some((s) => (s.turns ?? []).some((t) => t.role === 'assistant' && t.content === 'LLM response'));
    expect(sawAssistant).toBe(true);
  });
});


