import type { AIService, AIModel } from '../ai-service.js';
import { runConceptionDm } from './dm.js';
import { extractConceptionKps } from './kp-extractor.js';

export async function runConceptionTwoStageStep(args: {
  service: AIService;
  message: string;
  dr: unknown;
  model?: AIModel;
}): Promise<{
  assistantText: string;
  phase: 'ideation' | 'formalization';
  convergenceScore: number;
  allowIgUpdates: boolean;
  docPlanPatch?: unknown;
  dmPatch?: unknown;
  kps: unknown;
}> {
  const dm = await runConceptionDm({
    service: args.service,
    message: args.message,
    dr: args.dr,
    model: args.model,
  });

  const kps = await extractConceptionKps({
    service: args.service,
    dr: args.dr,
    model: args.model,
    phase: dm.phase,
    assistantText: dm.assistantText,
    allowIgUpdates: dm.allowIgUpdates,
  });

  return {
    assistantText: dm.assistantText,
    phase: dm.phase,
    convergenceScore: dm.convergenceScore,
    allowIgUpdates: dm.allowIgUpdates,
    docPlanPatch: dm.docPlanPatch,
    dmPatch: (dm as { dmPatch?: unknown }).dmPatch,
    kps,
  };
}



