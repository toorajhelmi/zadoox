import type { ConceptionState } from '@zadoox/shared';
import { clamp01, generateId, normalizeLabel, provTurn } from './utils';

export function mergeTwoStageKps(next: ConceptionState, latestUserTurnId: string, kps: unknown): void {
  const obj = (kps ?? {}) as Record<string, unknown>;
  const add = Array.isArray(obj.add) ? (obj.add as unknown[]) : [];
  const strengthen = Array.isArray(obj.strengthen) ? (obj.strengthen as unknown[]) : [];
  const supersede = Array.isArray(obj.supersede) ? (obj.supersede as unknown[]) : [];
  const edges = Array.isArray(obj.edges) ? (obj.edges as unknown[]) : [];

  const ig = next.ideaGraph ?? { nodes: [], edges: [] };
  ig.nodes = ig.nodes ?? [];
  ig.edges = ig.edges ?? [];

  const ctxKeyForFacets = (facets: string[] | undefined): string => {
    const fs = Array.isArray(facets) ? facets.map(String).map((s) => s.trim()) : [];
    const g = fs.find((f) => f.startsWith('ctx:group:'));
    return g ? `|${g}` : '';
  };

  const byNorm = new Map<string, { id: string; idx: number }>();
  for (let i = 0; i < ig.nodes.length; i++) {
    const n = ig.nodes[i]!;
    const norm = normalizeLabel(n.label);
    byNorm.set(norm + ctxKeyForFacets(Array.isArray(n.facets) ? n.facets.map(String) : []), { id: n.id, idx: i });
  }

  const upsert = (
    label: string,
    attrs: Partial<{
      kpType: string;
      status: 'accepted' | 'proposed';
      confidence: number;
      facets: string[];
      state: any;
      evidenceTurnIds: string[];
    }>
  ) => {
    const normBase = normalizeLabel(label);
    const ctxKey = ctxKeyForFacets(attrs.facets);
    const norm = normBase + ctxKey;
    if (!norm || norm.length < 3) return null;
    const existing = byNorm.get(norm);
    const evidenceTurnIds = Array.isArray(attrs.evidenceTurnIds) ? attrs.evidenceTurnIds.filter(Boolean) : [];
    if (existing) {
      const n = ig.nodes[existing.idx]!;
      if (typeof attrs.confidence === 'number') n.confidence = clamp01(Math.max(Number(n.confidence ?? 0), attrs.confidence));
      if (attrs.status) n.status = n.status ?? attrs.status;
      if (attrs.state && !n.state) n.state = attrs.state;
      if (attrs.kpType) n.facets = Array.from(new Set([...(n.facets ?? []), `KP:${attrs.kpType}`]));
      if (Array.isArray(attrs.facets) && attrs.facets.length > 0) n.facets = Array.from(new Set([...(n.facets ?? []), ...attrs.facets]));
      n.weight = clamp01(Number(n.weight ?? 0.5) + 0.06);
      n.provenance = [...(n.provenance ?? []), ...evidenceTurnIds.map(provTurn)];
      return n.id;
    }
    const id = `i-${generateId()}`;
    const facets = [...(attrs.kpType ? [`KP:${attrs.kpType}`] : []), ...(Array.isArray(attrs.facets) ? attrs.facets : [])].filter(Boolean);
    const confidence = clamp01(typeof attrs.confidence === 'number' ? attrs.confidence : 0.55);
    ig.nodes.push({
      id,
      label: label.trim(),
      weight: clamp01(0.4 + confidence * 0.35),
      status: attrs.status ?? (confidence >= 0.7 ? 'accepted' : 'proposed'),
      confidence,
      ...(attrs.state ? { state: attrs.state } : {}),
      ...(facets.length > 0 ? { facets } : {}),
      provenance: [...evidenceTurnIds.map(provTurn), provTurn(latestUserTurnId)],
    });
    byNorm.set(norm, { id, idx: ig.nodes.length - 1 });
    return id;
  };

  // supersede: mark old as deprecated by flipping status; create new node
  for (const raw of supersede) {
    const s = (raw ?? {}) as Record<string, unknown>;
    const oldLabel = String(s.oldLabel ?? '').trim();
    const newLabel = String(s.newLabel ?? '').trim();
    const evidenceTurnIds = Array.isArray(s.evidenceTurnIds) ? (s.evidenceTurnIds as unknown[]).map(String) : [];
    const old = byNorm.get(normalizeLabel(oldLabel));
    if (old) {
      const n = ig.nodes[old.idx]!;
      n.status = 'deprecated';
      n.provenance = [...(n.provenance ?? []), ...evidenceTurnIds.map(provTurn)];
    }
    if (newLabel) upsert(newLabel, { confidence: 0.65, status: 'accepted', evidenceTurnIds });
  }

  for (const raw of add) {
    const a = (raw ?? {}) as Record<string, unknown>;
    const label = String(a.label ?? '').trim();
    const kpType = String(a.kpType ?? '').trim();
    const status = (String(a.status ?? '') === 'accepted' ? 'accepted' : 'proposed') as 'accepted' | 'proposed';
    const confidence = clamp01(Number(a.confidence ?? 0.55));
    const evidenceTurnIds = Array.isArray(a.evidenceTurnIds)
      ? (a.evidenceTurnIds as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
      : [];

    // Normalize facets and ensure exactly one src facet exists.
    // Sometimes the model omits/whitespace-mangles facets; we infer from evidenceTurnIds (e.g., t-assistant-latest).
    const facetsRaw = Array.isArray(a.facets) ? (a.facets as unknown[]).map(String).map((s) => s.trim()).filter(Boolean) : [];
    const hasSrcUser = facetsRaw.includes('src:user');
    const hasSrcAssistant = facetsRaw.includes('src:assistant');
    const inferredSrc =
      evidenceTurnIds.some((id) => id === 't-assistant-latest' || id.startsWith('t-assistant')) ? 'src:assistant' : 'src:user';
    const facets = Array.from(
      new Set([
        ...facetsRaw.filter((f) => f !== 'src:user' && f !== 'src:assistant'),
        hasSrcAssistant ? 'src:assistant' : hasSrcUser ? 'src:user' : inferredSrc,
      ])
    );
    const state =
      kpType.toLowerCase() === 'question'
        ? 'question'
        : kpType.toLowerCase() === 'constraint'
          ? 'constraint'
          : kpType.toLowerCase() === 'example'
            ? 'example'
            : 'topic';
    upsert(label, { kpType, status, confidence, facets, evidenceTurnIds, state });
  }

  for (const raw of strengthen) {
    const st = (raw ?? {}) as Record<string, unknown>;
    const label = String(st.label ?? '').trim();
    const delta = Number(st.confidenceDelta ?? 0.08);
    const evidenceTurnIds = Array.isArray(st.evidenceTurnIds) ? (st.evidenceTurnIds as unknown[]).map(String).filter(Boolean) : [];
    const existing = byNorm.get(normalizeLabel(label));
    if (!existing) continue;
    const n = ig.nodes[existing.idx]!;
    n.confidence = clamp01(Number(n.confidence ?? 0.5) + delta);
    n.status = n.confidence >= 0.7 ? 'accepted' : n.status;
    n.weight = clamp01(Number(n.weight ?? 0.5) + 0.05);
    n.provenance = [...(n.provenance ?? []), ...evidenceTurnIds.map(provTurn)];
  }

  for (const raw of edges) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const srcLabel = String(e.srcLabel ?? '').trim();
    const dstLabel = String(e.dstLabel ?? '').trim();
    const rel = String(e.rel ?? 'elaborates').trim();
    const status = (String(e.status ?? '') === 'accepted' ? 'accepted' : 'proposed') as 'accepted' | 'proposed';
    const confidence = clamp01(Number(e.confidence ?? 0.55));
    const evidenceTurnIds = Array.isArray(e.evidenceTurnIds) ? (e.evidenceTurnIds as unknown[]).map(String).filter(Boolean) : [];
    const edgeFacets = Array.isArray((e as any).facets) ? ((e as any).facets as unknown[]).map(String).map((s) => s.trim()).filter(Boolean) : [];
    const src =
      byNorm.get(normalizeLabel(srcLabel) + ctxKeyForFacets(edgeFacets))?.id ?? byNorm.get(normalizeLabel(srcLabel))?.id ?? null;
    const dst =
      byNorm.get(normalizeLabel(dstLabel) + ctxKeyForFacets(edgeFacets))?.id ?? byNorm.get(normalizeLabel(dstLabel))?.id ?? null;
    if (!src || !dst || src === dst) continue;
    const existing = ig.edges.find((x) => x.src === src && x.dst === dst && String((x as any).rel ?? '') === rel);
    if (existing) {
      existing.confidence = clamp01(Math.max(Number(existing.confidence ?? 0), confidence));
      existing.status = existing.status ?? status;
      existing.weight = clamp01(Number(existing.weight ?? 0.35) + 0.05);
      existing.provenance = [...(existing.provenance ?? []), ...evidenceTurnIds.map(provTurn)];
      continue;
    }
    const ctxFacet = edgeFacets.find((f) => f.startsWith('ctx:group:'));
    ig.edges.push({
      src,
      dst,
      weight: clamp01(0.25 + confidence * 0.35),
      confidence,
      status,
      facets: Array.from(new Set([...(rel ? [`REL:${rel}`] : []), ...(ctxFacet ? [ctxFacet] : []), ...edgeFacets])),
      provenance: [...evidenceTurnIds.map(provTurn), provTurn(latestUserTurnId)],
    } as any);
  }

  // Context Group enforcement (client-side safety net):
  // Ensure anchors -> group and group -> children edges exist, and prevent accidental anchor -> child edges inside the group.
  try {
    const dmAny = (next as unknown as { dm?: unknown }).dm;
    const dmRec = (dmAny && typeof dmAny === 'object' ? (dmAny as Record<string, unknown>) : {}) as Record<string, unknown>;
    const ctxGroups = Array.isArray(dmRec.contextGroups) ? (dmRec.contextGroups as unknown[]) : [];
    const groupsForTurn = ctxGroups
      .map((g) => (g && typeof g === 'object' ? (g as Record<string, unknown>) : null))
      .filter(Boolean)
      .filter((g) => String(g!.turnId ?? '').trim() === latestUserTurnId);

    for (const g of groupsForTurn) {
      const groupId = String(g!.id ?? '').trim();
      const anchors = Array.isArray(g!.anchorKps) ? (g!.anchorKps as unknown[]) : [];
      if (!groupId || anchors.length < 2) continue;
      const ctxFacet = `ctx:group:${groupId}`;

      let groupNode = (ig.nodes ?? []).find((n) => {
        const fs = Array.isArray(n.facets) ? n.facets.map(String).map((s) => s.trim()) : [];
        return fs.includes('GROUP:context') && fs.includes(ctxFacet);
      });
      if (!groupNode) {
        // LLM sometimes fails to emit the synthetic group node; create it deterministically.
        const anchorLabels = anchors
          .map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>) : null))
          .map((ar) => String(ar?.label ?? '').trim())
          .filter(Boolean)
          .slice(0, 3);
        const label = anchorLabels.length >= 2 ? `Context: ${anchorLabels.join(' • ')}` : `Context group`;
        const id = `i-${generateId()}`;
        const facets = ['GROUP:context', ctxFacet, 'groupType:other', 'src:user', 'KP:group'];
        const node = {
          id,
          label,
          weight: 0.7,
          status: 'accepted' as const,
          confidence: 0.85,
          facets,
          provenance: [provTurn(latestUserTurnId)],
        };
        ig.nodes.push(node as any);
        groupNode = node as any;
      }
      if (!groupNode) continue;

      const anchorIds: string[] = [];
      for (const a of anchors) {
        const ar = a && typeof a === 'object' ? (a as Record<string, unknown>) : null;
        const aid = String(ar?.id ?? '').trim();
        const alabel = String(ar?.label ?? '').trim();
        const existingById = aid ? (ig.nodes ?? []).find((n) => n.id === aid) : null;
        if (existingById) {
          anchorIds.push(existingById.id);
          continue;
        }
        if (alabel) {
          const found = (ig.nodes ?? []).find((n) => normalizeLabel(n.label) === normalizeLabel(alabel));
          if (found) anchorIds.push(found.id);
        }
      }

      // Ensure anchor -> group edges exist.
      for (const aid of anchorIds) {
        const exists = (ig.edges ?? []).some(
          (e) => e.src === aid && e.dst === (groupNode as any).id && Array.isArray(e.facets) && e.facets.includes('REL:anchors')
        );
        if (exists) continue;
        ig.edges.push({
          src: aid,
          dst: (groupNode as any).id,
          weight: 0.42,
          confidence: 0.78,
          status: 'accepted',
          facets: Array.from(new Set(['REL:elaborates', 'REL:anchors', ctxFacet])),
          provenance: [provTurn(latestUserTurnId)],
        });
      }

      // Determine children for this group:
      // - primary: nodes explicitly tagged with ctx facet
      // - fallback: nodes created on this turn (provenance includes latestUserTurnId), excluding anchors and group
      const ctxNodeIds = new Set<string>();
      for (const n of ig.nodes ?? []) {
        if (n.id === (groupNode as any).id) continue;
        const fs = Array.isArray(n.facets) ? n.facets.map(String).map((s) => s.trim()) : [];
        if (fs.includes(ctxFacet)) ctxNodeIds.add(n.id);
      }
      for (const n of ig.nodes ?? []) {
        if (n.id === (groupNode as any).id) continue;
        if (anchorIds.includes(n.id)) continue;
        const prov = Array.isArray(n.provenance) ? n.provenance : [];
        const createdThisTurn = prov.some((p: any) => p && p.kind === 'chat_turn' && String(p.id ?? '') === latestUserTurnId);
        if (!createdThisTurn) continue;
        ctxNodeIds.add(n.id);
        // Add ctx facet if missing (keeps grouping/rendering consistent).
        const fs = Array.isArray(n.facets) ? n.facets.map(String).map((s) => s.trim()) : [];
        if (!fs.includes(ctxFacet)) n.facets = Array.from(new Set([...(n.facets ?? []), ctxFacet]));
      }

      for (const cid of Array.from(ctxNodeIds)) {
        const exists = (ig.edges ?? []).some(
          (e) => e.src === (groupNode as any).id && e.dst === cid && Array.isArray(e.facets) && e.facets.includes('REL:in_group')
        );
        if (exists) continue;
        ig.edges.push({
          src: (groupNode as any).id,
          dst: cid,
          weight: 0.44,
          confidence: 0.76,
          status: 'accepted',
          facets: Array.from(new Set(['REL:elaborates', 'REL:in_group', ctxFacet])),
          provenance: [provTurn(latestUserTurnId)],
        });
      }

      // Remove accidental anchor -> child edges within this context group (keep anchor->group).
      if (anchorIds.length > 0) {
        ig.edges = (ig.edges ?? []).filter((e) => {
          if (!anchorIds.includes(e.src)) return true;
          if (e.dst === (groupNode as any).id) return true;
          const fs = Array.isArray(e.facets) ? e.facets.map(String).map((s) => s.trim()) : [];
          if (!fs.includes(ctxFacet)) return true;
          // Anchor -> ctx child edge (not group) gets dropped.
          return false;
        });
      }
    }
  } catch {
    // ignore: context group enforcement is best-effort
  }

  next.ideaGraph = ig;
}


