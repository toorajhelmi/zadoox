'use client';

import type { SemanticGraph } from '@zadoox/shared';

export function createEmptySemanticGraph(nowIso = new Date().toISOString()): SemanticGraph {
  return {
    version: 1,
    nodes: [],
    edges: [],
    updatedAt: nowIso,
  };
}

export function clampEdgeWeight(w: number): number {
  if (Number.isNaN(w)) return 0;
  return Math.max(-1, Math.min(1, w));
}

export function makeSgId(prefix: string): string {
  // Avoid relying on crypto in all environments.
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// SG node types are interpreter-defined; we keep a small "common types" list for UI affordances only.
export const COMMON_SG_NODE_TYPES: Array<{ value: string; label: string }> = [
  { value: 'definition', label: 'Definition' },
  { value: 'proposition', label: 'Proposition' },
  { value: 'support', label: 'Support' },
  { value: 'intent', label: 'Intent' },
];


