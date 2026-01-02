import type { IrNodeType } from './types';

/**
 * Pure TS hashing (FNV-1a 32-bit) to avoid adding dependencies.
 * This is "stable enough" for Phase 11 node IDs.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5; // 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619 (with overflow)
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

export function hashToId(hash32: number): string {
  // Compact and URL-friendly.
  return hash32.toString(36);
}

export function stableNodeId(params: {
  docId: string;
  nodeType: IrNodeType;
  path: string;
}): string {
  const raw = `${params.docId}:${params.nodeType}:${params.path}`;
  return hashToId(fnv1a32(raw));
}


