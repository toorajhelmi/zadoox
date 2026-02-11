import type { ImportanceById } from './types.js';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function extractIdeaGraph(dr: unknown): { nodes: Array<{ id: string; label: string }>; edges: Array<{ src: string; dst: string }> } {
  const drAny = isRecord(dr) ? dr : {};
  const ig = isRecord((drAny as { ideaGraph?: unknown }).ideaGraph) ? ((drAny as { ideaGraph?: unknown }).ideaGraph as Record<string, unknown>) : null;
  const nodesAny = ig && Array.isArray((ig as { nodes?: unknown }).nodes) ? ((ig as { nodes?: unknown }).nodes as unknown[]) : [];
  const edgesAny = ig && Array.isArray((ig as { edges?: unknown }).edges) ? ((ig as { edges?: unknown }).edges as unknown[]) : [];

  const nodes = nodesAny
    .map((n) => (isRecord(n) ? n : null))
    .filter(Boolean)
    .map((n) => {
      const id = String((n as { id?: unknown }).id ?? '');
      const label = String((n as { label?: unknown }).label ?? '');
      return { id, label };
    })
    .filter((n) => n.id && n.label);

  const edges = edgesAny
    .map((e) => (isRecord(e) ? e : null))
    .filter(Boolean)
    .map((e) => {
      const src = String((e as { src?: unknown }).src ?? '');
      const dst = String((e as { dst?: unknown }).dst ?? '');
      return { src, dst };
    })
    .filter((e) => e.src && e.dst);

  return { nodes, edges };
}

export function ancestorClosure(edges: Array<{ src: string; dst: string }>, explicitIds: string[]): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    const arr = incoming.get(e.dst) ?? [];
    arr.push(e.src);
    incoming.set(e.dst, arr);
  }
  const out = new Set<string>();
  const q: string[] = [...explicitIds];
  while (q.length) {
    const cur = q.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    const parents = incoming.get(cur) ?? [];
    for (const p of parents) if (!out.has(p)) q.push(p);
  }
  return out;
}

export function pickIncludedNodes(args: {
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ src: string; dst: string }>;
  includedNodeIds?: string[];
}): { includedIds: string[]; includedNodes: Array<{ id: string; label: string }> } {
  const byId = new Map(args.nodes.map((n) => [n.id, n]));
  const allIds = args.nodes.map((n) => n.id);
  const explicit = (args.includedNodeIds ?? []).map(String).filter((id) => byId.has(id));
  const includedIds = explicit.length === 0 ? allIds : Array.from(ancestorClosure(args.edges, explicit));
  const includedNodes = includedIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((n) => ({ id: n!.id, label: n!.label }));
  return { includedIds: includedIds.sort(), includedNodes };
}

export function compactIncludedGraph(args: {
  includedIds: string[];
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ src: string; dst: string }>;
  importanceById: ImportanceById;
}): {
  nodes: Array<{ id: string; label: string; importance: 'H' | 'M' | 'L' }>;
  edges: Array<{ src: string; dst: string }>;
} {
  const idSet = new Set(args.includedIds);
  const imp = args.importanceById ?? {};
  const nodes = args.nodes
    .filter((n) => idSet.has(n.id))
    .map((n) => ({ id: n.id, label: n.label, importance: (imp[n.id] ?? 'L') as 'H' | 'M' | 'L' }));
  const edges = args.edges.filter((e) => idSet.has(e.src) && idSet.has(e.dst));
  return { nodes, edges };
}

