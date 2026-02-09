import type { ConceptionProvenanceRef, ConceptionState } from '@zadoox/shared';
import { keepProvRef } from './utils';

function pruneIdeaGraphByTurns(conception: ConceptionState, keepTurnIds: Set<string>): void {
  const ig = conception.ideaGraph;
  if (!ig) return;

  const keepNode = (n: any): boolean => {
    const prov = Array.isArray(n?.provenance) ? (n.provenance as ConceptionProvenanceRef[]) : null;
    if (!prov || prov.length === 0) return true;
    return prov.some((r) => keepProvRef(r, keepTurnIds));
  };

  const keptNodes = (ig.nodes ?? []).filter(keepNode);
  const keptNodeIds = new Set(keptNodes.map((n) => n.id));

  const cleanProv = (prov: unknown): ConceptionProvenanceRef[] | undefined => {
    const arr = Array.isArray(prov) ? (prov as ConceptionProvenanceRef[]) : [];
    const next = arr.filter((r) => keepProvRef(r, keepTurnIds));
    return next.length > 0 ? next : undefined;
  };

  for (const n of keptNodes) {
    n.provenance = cleanProv((n as any).provenance);
  }

  const keptEdges = (ig.edges ?? [])
    .filter((e) => keptNodeIds.has(e.src) && keptNodeIds.has(e.dst))
    .filter((e: any) => {
      const prov = Array.isArray(e?.provenance) ? (e.provenance as ConceptionProvenanceRef[]) : null;
      if (!prov || prov.length === 0) return true;
      return prov.some((r) => keepProvRef(r, keepTurnIds));
    });

  for (const e of keptEdges as any[]) {
    e.provenance = cleanProv(e.provenance);
  }

  conception.ideaGraph = { ...ig, nodes: keptNodes, edges: keptEdges };
}

export function deleteTurnsFrom(conception: ConceptionState, fromTurnId: string): ConceptionState {
  const turns = conception.turns ?? [];
  const idx = turns.findIndex((t) => t.id === fromTurnId);
  if (idx < 0) return conception;
  const keptTurns = turns.slice(0, idx);
  const keepTurnIds = new Set(keptTurns.map((t) => t.id));
  const next: ConceptionState = {
    ...conception,
    turns: keptTurns,
    updatedAt: new Date().toISOString(),
  };
  pruneIdeaGraphByTurns(next, keepTurnIds);
  return next;
}


