import type { ConceptionState, DocPlan } from '@zadoox/shared';

export function buildInitialConceptionState(now = new Date()): ConceptionState {
  const updatedAt = now.toISOString();
  const docPlan: DocPlan = {
    docType: 'unknown',
    workingTitle: '',
    oneLiner: '',
    toneGuess: [],
    sections: [
      { id: 'S1', title: 'Introduction', intent: 'Set context and motivation', bullets: [] },
      { id: 'S2', title: 'Main Ideas', intent: 'List and expand the core ideas', bullets: [] },
      { id: 'S3', title: 'Structure / Outline', intent: 'Propose an outline that matches the intent', bullets: [] },
      { id: 'S4', title: 'Next Steps', intent: 'Open questions + what to do next', bullets: [] },
    ],
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


