type RecordLike = Record<string, unknown>;

function isRecord(v: unknown): v is RecordLike {
  return typeof v === 'object' && v !== null;
}

export function enforceContextGroupNoAnchorChildEdges(args: {
  dr: unknown;
  kps: { add?: Array<{ label: string; facets?: string[] }>; edges?: Array<{ srcLabel: string; dstLabel: string; facets?: string[] }> };
}): void {
  const { dr, kps } = args;
  if (!kps || !Array.isArray(kps.edges) || kps.edges.length === 0) return;

  const drAny: RecordLike = isRecord(dr) ? dr : {};
  const cg = isRecord(drAny.contextGroup) ? (drAny.contextGroup as RecordLike) : null;
  const cgId = cg && typeof cg.id === 'string' ? cg.id.trim() : '';
  const cgAnchors = cg && Array.isArray(cg.anchorKps) ? cg.anchorKps : [];
  if (!cgId || cgAnchors.length < 2) return;

  const anchorLabels = new Set(
    cgAnchors
      .map((x) => (isRecord(x) ? String((x as RecordLike).label ?? '').trim() : ''))
      .filter(Boolean)
      .slice(0, 12)
  );

  const groupAdd = (kps.add ?? []).find(
    (a) =>
      Array.isArray(a.facets) &&
      a.facets.includes('GROUP:context') &&
      a.facets.some((f) => String(f).startsWith(`ctx:group:${cgId}`))
  );
  const groupLabel = String(groupAdd?.label ?? '').trim();
  if (!groupLabel) return;

  kps.edges = (kps.edges ?? []).filter((e) => {
    const src = String(e?.srcLabel ?? '').trim();
    const dst = String(e?.dstLabel ?? '').trim();
    if (!src || !dst) return true;
    // Keep anchor -> group
    if (anchorLabels.has(src) && dst === groupLabel) return true;
    // Drop anchor -> anything else (prevents children being attached to anchors in group mode)
    if (anchorLabels.has(src) && dst !== groupLabel) return false;
    return true;
  });
}


