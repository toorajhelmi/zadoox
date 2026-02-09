import type { ConceptionProvenanceRef } from '@zadoox/shared';

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function provTurn(id: string): ConceptionProvenanceRef {
  return { kind: 'chat_turn', id };
}

export function normalizeLabel(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/["'“”‘’]+/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function keepProvRef(ref: ConceptionProvenanceRef, keepTurnIds: Set<string>): boolean {
  if (ref.kind === 'chat_turn') return keepTurnIds.has(ref.id);
  if (ref.kind === 'chat_turn_range') return keepTurnIds.has(ref.fromId) && keepTurnIds.has(ref.toId);
  return false;
}


