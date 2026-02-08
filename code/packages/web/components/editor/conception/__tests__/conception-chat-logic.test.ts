import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API client so we can assert we always go through the LLM path.
vi.mock('@/lib/api/client', () => ({
  api: {
    ai: {
      conception: {
        chat: vi.fn(async () => ({ assistantText: 'LLM response' })),
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

    expect(api.ai.conception.chat).toHaveBeenCalledTimes(1);
    const saved = onSaveConception.mock.calls[0]?.[0] as ConceptionState;
    expect(saved.turns.some((t) => t.role === 'assistant' && t.content === 'LLM response')).toBe(true);
  });
});


