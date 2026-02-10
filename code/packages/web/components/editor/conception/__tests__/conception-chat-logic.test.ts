import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API client so we can assert we always go through the LLM path.
vi.mock('@/lib/api/client', () => ({
  api: {
    ai: {
      conception: {
        twoStageStep: vi.fn(async () => ({
          assistantText: 'LLM response',
          phase: 'ideation',
          convergenceScore: 0.2,
          allowIgUpdates: true,
          dmPatch: undefined,
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

  it('does not switch the UI surface when DM detects formalization (stores it in dm)', async () => {
    (api.ai.conception.twoStageStep as any).mockImplementationOnce(async () => ({
      assistantText: 'OK, let’s switch to planning.',
      phase: 'formalization',
      convergenceScore: 0.86,
      allowIgUpdates: false,
      dmPatch: { phase: 'formalization', allowIgUpdates: false, docPlanCompleteness: 0.3, docPlanReady: false, lastAskedSlot: 'docType' },
      kps: { add: [], strengthen: [], supersede: [], edges: [] },
    }));

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
    await sendConceptionMessage({ conception, message: 'Let’s start writing.', onSaveConception });

    const savedStates = onSaveConception.mock.calls.map((c) => c[0] as ConceptionState);
    const final = savedStates[savedStates.length - 1];
    expect(final?.phase).toBe('ideation');
    expect((final as any)?.dm?.phase).toBe('formalization');
  });

  it('applies docPlanPatch from the DM response', async () => {
    (api.ai.conception.twoStageStep as any).mockImplementationOnce(async () => ({
      assistantText: 'Let’s plan the doc. I pre-filled a title and a couple sections—does this look right?',
      phase: 'formalization',
      convergenceScore: 0.9,
      allowIgUpdates: false,
      dmPatch: { phase: 'formalization', allowIgUpdates: false },
      docPlanPatch: {
        docType: 'blog',
        workingTitle: 'How technology turns ideas into tangible assets',
        sections: [
          { title: 'Introduction', intent: 'Set context and stakes', bullets: ['What “tangible assets” means here'] },
          { title: 'Mechanisms', intent: 'Explain the transformation pathways', bullets: ['Data analytics', 'Crowdsourcing'] },
        ],
      },
      kps: { add: [], strengthen: [], supersede: [], edges: [] },
    }));

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
    await sendConceptionMessage({ conception, message: 'Let’s start writing.', onSaveConception });

    const savedStates = onSaveConception.mock.calls.map((c) => c[0] as ConceptionState);
    const final = savedStates[savedStates.length - 1];
    expect(final?.docPlan?.docType).toBe('blog');
    expect(final?.docPlan?.workingTitle).toContain('tangible assets');
    expect((final?.docPlan?.sections ?? []).length).toBeGreaterThanOrEqual(2);
    expect(final?.docPlan?.sections?.[0]?.title).toBeTruthy();
  });

  // NOTE: we intentionally do not emit a "NOT detected" marker.
  // The only marker is when formalization is detected (phase="formalization").
});


