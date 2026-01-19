'use client';

import type { SemanticGraph, SemanticNodeType } from '@zadoox/shared';

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

export const SEMANTIC_NODE_TYPES: Array<{ value: SemanticNodeType; label: string }> = [
  { value: 'goal', label: 'Goal' },
  { value: 'claim', label: 'Claim' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'definition', label: 'Definition' },
  { value: 'gap', label: 'Gap' },
];


