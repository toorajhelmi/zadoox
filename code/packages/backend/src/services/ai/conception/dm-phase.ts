import type { AIService, AIModel } from '../ai-service.js';
import { ConceptionDmResponse } from './types.js';

/**
 * Phase controller DM (ideation-only).
 *
 * IMPORTANT: Once we're in formalization, we use a deterministic state machine instead.
 */
export async function runConceptionPhaseDm(args: {
  service: AIService;
  message: string;
  dr: unknown;
  model?: AIModel;
}): Promise<{
  assistantText: string;
  phase: 'ideation' | 'formalization';
  convergenceScore: number;
  allowIgUpdates: boolean;
}> {
  const { service, model } = args;
  const message = String(args.message ?? '').trim();
  if (!message) throw new Error('Message is required');

  const system = `You are Z, the Zadoox ideation agent.

Task per turn:
- Decide phase ("ideation" | "formalization") based on the latest user message + DR.
- Decide allowIgUpdates (boolean):
  - If phase="ideation", allowIgUpdates MUST be true.
  - If phase="formalization", default allowIgUpdates=false unless the user clearly ideates again.
- Produce assistantText:
  - If phase="ideation": be helpful and concise; ask 0–1 questions max.
  - If phase="formalization": keep it VERY short; do not write an outline.

Formalization triggers:
- If the user expresses intent to start drafting/outlining/writing now, phase MUST be "formalization".

Return ONLY JSON with this exact shape:
{
  "assistantText": string,
  "phase": "ideation"|"formalization",
  "convergenceScore": number,
  "allowIgUpdates": boolean
}`;

  const user = `DR:
${JSON.stringify(args.dr ?? {}, null, 2)}

LATEST USER MESSAGE:
${message}

Produce the JSON response.`;

  const raw = await service.chatJson({ system, user, temperature: 0.15 }, model);
  const parsed = ConceptionDmResponse.pick({
    assistantText: true,
    phase: true,
    convergenceScore: true,
    allowIgUpdates: true,
  }).parse(raw);
  return {
    assistantText: parsed.assistantText.trim(),
    phase: parsed.phase,
    convergenceScore: parsed.convergenceScore,
    allowIgUpdates: parsed.allowIgUpdates,
  };
}

