import type { ConceptionState } from '@zadoox/shared';
import { clamp01, generateId, normalizeLabel } from './utils';

export function mergeExtractedIg(
  next: ConceptionState,
  userTurnId: string,
  extracted: { nodes: unknown[]; edges: unknown[] }
): void {
  const ig = next.ideaGraph ?? { nodes: [], edges: [] };
  ig.nodes = ig.nodes ?? [];
  ig.edges = ig.edges ?? [];

  const existingByNorm = new Map<string, { id: string; idx: number }>();
  for (let i = 0; i < ig.nodes.length; i++) {
    const n = ig.nodes[i]!;
    existingByNorm.set(normalizeLabel(n.label), { id: n.id, idx: i });
  }

  const nodes = Array.isArray(extracted.nodes) ? extracted.nodes : [];
  for (const raw of nodes) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const label = String(obj.label ?? '').trim();
    const norm = normalizeLabel(label);
    if (!norm || norm.length < 4) continue;
    // Filter obvious “junk” labels defensively.
    if (/^(lets|let us|discussion|thoughts|question|help|idea)$/.test(norm)) continue;

    const state = (String(obj.state ?? 'topic') as any) as
      | 'topic'
      | 'question'
      | 'constraint'
      | 'assumption'
      | 'hypothesis'
      | 'requirement'
      | 'example';
    const confidence = clamp01(Number(obj.confidence ?? 0.6));
    const facets = Array.isArray(obj.facets) ? obj.facets.map((x) => String(x)).filter(Boolean).slice(0, 6) : [];

    const status: 'accepted' | 'proposed' = confidence >= 0.65 ? 'accepted' : 'proposed';

    const existing = existingByNorm.get(norm);
    if (existing) {
      const n = ig.nodes[existing.idx]!;
      n.weight = clamp01(Number(n.weight ?? 0.5) + 0.08);
      n.confidence = clamp01(Math.max(Number(n.confidence ?? 0), confidence));
      n.status = n.status ?? status;
      if (state && !n.state) n.state = state;
      if (facets.length > 0) n.facets = Array.from(new Set([...(n.facets ?? []), ...facets]));
      n.provenance = [...(n.provenance ?? []), { kind: 'chat_turn', id: userTurnId }];
      continue;
    }

    const id = `i-${generateId()}`;
    ig.nodes.push({
      id,
      label,
      weight: clamp01(0.45 + confidence * 0.35),
      status,
      confidence,
      state,
      ...(facets.length > 0 ? { facets } : {}),
      provenance: [{ kind: 'chat_turn', id: userTurnId }],
    });
    existingByNorm.set(norm, { id, idx: ig.nodes.length - 1 });
  }

  const edges = Array.isArray(extracted.edges) ? extracted.edges : [];
  for (const raw of edges) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const srcLabel = String(obj.srcLabel ?? '').trim();
    const dstLabel = String(obj.dstLabel ?? '').trim();
    const src = existingByNorm.get(normalizeLabel(srcLabel))?.id ?? null;
    const dst = existingByNorm.get(normalizeLabel(dstLabel))?.id ?? null;
    if (!src || !dst || src === dst) continue;
    const confidence = clamp01(Number(obj.confidence ?? 0.55));
    const status: 'accepted' | 'proposed' = confidence >= 0.65 ? 'accepted' : 'proposed';

    const existing = ig.edges.find((e) => e.src === src && e.dst === dst);
    if (existing) {
      existing.weight = clamp01(Number(existing.weight ?? 0.35) + 0.05);
      existing.confidence = clamp01(Math.max(Number(existing.confidence ?? 0), confidence));
      existing.status = existing.status ?? status;
      existing.provenance = [...(existing.provenance ?? []), { kind: 'chat_turn', id: userTurnId }];
      continue;
    }

    ig.edges.push({
      src,
      dst,
      weight: clamp01(0.25 + confidence * 0.35),
      confidence,
      status,
      provenance: [{ kind: 'chat_turn', id: userTurnId }],
    });
  }

  next.ideaGraph = ig;
}


