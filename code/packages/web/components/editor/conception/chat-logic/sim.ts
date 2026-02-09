import type { ConceptionState } from '@zadoox/shared';
import { api } from '@/lib/api/client';
import { buildConceptionDR } from './dr';

export async function generateSimulatedUserMessage(conception: ConceptionState): Promise<string> {
  const turns = conception.turns ?? [];
  if (turns.length === 0) {
    return 'I want to write about how ideas are turned into tangible assets';
  }

  // LLM-backed simulator (no hardcoded branching beyond the first message).
  const dr = buildConceptionDR(conception);
  const out = await api.ai.conception.simulateUser({ dr, model: 'auto' });
  return String(out.message ?? '').trim();
}


