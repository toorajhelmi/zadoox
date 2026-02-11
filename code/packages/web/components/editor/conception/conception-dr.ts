import type { ConceptionState } from '@zadoox/shared';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Build a compact "DR" (Drafting/Dialogue Representation) payload for backend Conception endpoints.
 * Keep this stable: backend prompts and heuristics assume this general shape.
 */
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
        if ((n as any).status === 'deprecated') return false;
        if ((n as any).status === 'proposed') return clamp01(Number((n as any).confidence ?? 0)) >= 0.4;
        return true;
      })
      .map((n) => n.id)
  );
  const igCompact = {
    nodes: (ig.nodes ?? [])
      .filter((n) => includeNodeIds.has(n.id))
      .slice()
      .sort((a, b) => ((b as any).weight ?? 0) - ((a as any).weight ?? 0))
      .slice(0, 25)
      .map((n) => ({
        id: n.id,
        label: n.label,
        state: (n as any).state,
        weight: (n as any).weight,
        confidence: (n as any).confidence,
        status: (n as any).status,
        facets: (n as any).facets,
      })),
    edges: (ig.edges ?? [])
      .filter(
        (e) =>
          includeNodeIds.has(e.src) &&
          includeNodeIds.has(e.dst) &&
          (e as any).status !== 'deprecated' &&
          ((e as any).status !== 'proposed' || clamp01(Number((e as any).confidence ?? 0)) >= 0.4)
      )
      .slice(0, 40)
      .map((e) => ({
        src: e.src,
        dst: e.dst,
        weight: (e as any).weight,
        confidence: (e as any).confidence,
        status: (e as any).status,
        facets: (e as any).facets,
      })),
  };

  return {
    // UI surface is driven by `conception.phase`, but LLM mode is driven by DM.
    // We keep the UI in ideation until the user explicitly starts drafting, while allowing the DM
    // to switch into formalization mode for DocPlan questions.
    phase: (conception as any)?.dm?.phase ?? conception.phase,
    turnCount,
    dm: (conception as any).dm ?? {},
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

