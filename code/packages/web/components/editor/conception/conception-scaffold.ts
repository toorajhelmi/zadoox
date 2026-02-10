import type { ConceptionState, DocPlan } from '@zadoox/shared';

export function buildInitialConceptionState(now = new Date()): ConceptionState {
  const updatedAt = now.toISOString();
  const docPlan: DocPlan = {
    docType: 'unknown',
    prefs: {},
    sections: [],
    openQuestions: [],
  };

  return {
    version: 1,
    strategyId: 'two_stage:v0',
    phase: 'ideation',
    turns: [],
    ideaGraph: { nodes: [], edges: [] },
    goalHypotheses: [{ docType: 'unknown', score: 1, evidence: ['default'] }],
    docPlan,
    updatedAt,
  };
}

export function buildInitialConceptionContent(): string {
  // During ideation, the editor surface is replaced by the IdeaGraph view.
  // Keep the actual document content empty until the user commits to a plan and starts drafting.
  return '';
}


