import type { AIService, AIModel } from '../ai-service.js';
import { runConceptionPhaseDm } from './dm-phase.js';
import { runConceptionFormalizationStep } from './dm-formalization.js';

export async function runConceptionDm(args: {
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
}> {
  const drAny = (args.dr && typeof args.dr === 'object' ? (args.dr as Record<string, unknown>) : {}) as Record<string, unknown>;
  const drPhase = String(drAny.phase ?? '').trim();

  // Once we're in formalization, run the deterministic DP state machine (no phase-decision prompt).
  if (drPhase === 'formalization') {
    return await runConceptionFormalizationStep({
      service: args.service,
      message: args.message,
      dr: args.dr,
      model: args.model,
    });
  }

  // Otherwise: use a small phase controller (ideation-only).
  const phaseDm = await runConceptionPhaseDm({
    service: args.service,
    message: args.message,
    dr: args.dr,
    model: args.model,
  });

  // If we just transitioned into formalization, immediately hand off to the formalization machine
  // so we ask DP questions (instead of a generic phase-controller reply).
  if (phaseDm.phase === 'formalization') {
    return await runConceptionFormalizationStep({
      service: args.service,
      message: args.message,
      dr: { ...(drAny ?? {}), phase: 'formalization' },
      model: args.model,
    });
  }

  return phaseDm;
}



