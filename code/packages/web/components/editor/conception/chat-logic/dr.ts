import type { ConceptionState } from '@zadoox/shared';
import { clamp01 } from './utils';

export function buildConceptionDR(
  conception: ConceptionState,
  opts?: {
    uiPinnedKps?: Array<{ id: string; label: string }>;
    contextGroup?: { id: string; anchorKps: Array<{ id: string; label: string }> };
    latestUserTurnId?: string;
  }
): unknown {
  const turns = conception.turns ?? [];
  const lastTurns = turns.slice(Math.max(0, turns.length - 12)).map((t) => ({
    id: t.id,
    role: t.role,
    content: t.content,
    createdAt: t.createdAt,
  }));
  const turnCount = turns.length;

  const ig = conception.ideaGraph ?? { nodes: [], edges: [] };
  // Include accepted nodes, plus high-confidence proposed nodes (so early “main topic” doesn't disappear).
  const includeNodeIds = new Set(
    (ig.nodes ?? [])
      .filter((n) => {
        if (n.status === 'deprecated') return false;
        if (n.status === 'proposed') return clamp01(Number(n.confidence ?? 0)) >= 0.4;
        return true;
      })
      .map((n) => n.id)
  );
  const igCompact = {
    nodes: (ig.nodes ?? [])
      .filter((n) => includeNodeIds.has(n.id))
      .slice()
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, 25)
      .map((n) => ({
        id: n.id,
        label: n.label,
        state: n.state,
        weight: n.weight,
        confidence: n.confidence,
        status: n.status,
        facets: n.facets,
      })),
    edges: (ig.edges ?? [])
      .filter(
        (e) =>
          includeNodeIds.has(e.src) &&
          includeNodeIds.has(e.dst) &&
          e.status !== 'deprecated' &&
          (e.status !== 'proposed' || clamp01(Number(e.confidence ?? 0)) >= 0.4)
      )
      .slice(0, 40)
      .map((e) => ({
        src: e.src,
        dst: e.dst,
        weight: e.weight,
        confidence: e.confidence,
        status: e.status,
        facets: e.facets,
      })),
  };

  return {
    phase: conception.phase,
    turnCount,
    dm: conception.dm ?? {},
    goalHypotheses: conception.goalHypotheses ?? [],
    docPlan: conception.docPlan ?? {},
    ideaGraph: igCompact,
    lastTurns,
    ...(opts?.uiPinnedKps && opts.uiPinnedKps.length > 0 ? { uiPinnedKps: opts.uiPinnedKps } : {}),
    ...(opts?.contextGroup && opts.contextGroup.anchorKps.length >= 2
      ? { contextGroup: { id: opts.contextGroup.id, anchorKps: opts.contextGroup.anchorKps, latestUserTurnId: opts.latestUserTurnId ?? '' } }
      : {}),
  };
}


