import type { DocumentNode } from '@zadoox/shared';
import { makeSnapshotFromIr } from '@zadoox/shared';

export function computeDocIrHash(ir: DocumentNode | null): string | null {
  try {
    if (!ir) return null;
    const snap = makeSnapshotFromIr(ir);
    // Stable full-doc hash: fold all node hashes in a stable order.
    const pairs = Array.from(snap.nodeHash.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const s = pairs.map(([id, h]) => `${id}:${h}`).join('|');
    // Deterministic, small hash (FNV-1a-ish).
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) {
      x ^= s.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    return `ir_${(x >>> 0).toString(16)}`;
  } catch {
    return null;
  }
}


