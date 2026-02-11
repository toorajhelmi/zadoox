'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConceptionState } from '@zadoox/shared';
import { IdeaGraphCanvas } from './idea-graph-canvas';
import { IdeaGraphPropertiesPanel } from './idea-graph-properties-panel';
import { DocPlanPanel } from './doc-plan-panel';

function cascadeDeleteIds(ig: NonNullable<ConceptionState['ideaGraph']>, rootId: string): Set<string> {
  const toDelete = new Set<string>();
  const q: string[] = [rootId];
  while (q.length) {
    const cur = q.shift()!;
    if (toDelete.has(cur)) continue;
    toDelete.add(cur);
    for (const e of ig.edges ?? []) {
      if (e.src === cur && e.dst && !toDelete.has(e.dst)) q.push(e.dst);
    }
  }
  return toDelete;
}

export function IdeationSurface(props: {
  conception: ConceptionState | undefined;
  onSaveConception: (next: ConceptionState, changeType?: 'auto-save' | 'ai-action') => void;
  onPinKp: (kp: { id: string; label: string }) => void;
  onSelectionKpsChange?: (kps: Array<{ id: string; label: string }>) => void;
  onStartDrafting?: (args: { includedNodeIds?: string[]; importanceById?: Record<string, 'H' | 'M' | 'L'> }) => void | Promise<void>;
}) {
  const { conception, onSaveConception, onPinKp, onSelectionKpsChange, onStartDrafting } = props;
  const [activeTab, setActiveTab] = useState<'ideagraph' | 'docplan'>('ideagraph');
  const [manualTab, setManualTab] = useState<'ideagraph' | 'docplan' | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clearSelectionNonce, setClearSelectionNonce] = useState(0);
  const [propsMode, setPropsMode] = useState<'closed' | 'open' | 'minimized'>('closed');

  const EMPTY_NODES: Array<{ id: string; label: string }> = [];
  const ideaNodes = (conception?.ideaGraph?.nodes ?? EMPTY_NODES) as Array<{ id: string; label: string }>;
  const byId = useMemo(() => new Map(ideaNodes.map((n) => [n.id, n])), [ideaNodes]);
  const selectedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const handleSelectIds = useCallback((ids: string[]) => {
    const next = Array.from(new Set(ids)).filter(Boolean).sort();
    const prev = selectedIdsRef.current;
    if (prev.length === next.length && prev.every((x, i) => x === next[i])) return;
    // Update ref immediately to avoid repeated identical setState during drag-select.
    selectedIdsRef.current = next;
    setSelectedIds(next);
    if (onSelectionKpsChange) {
      const kps = next
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((n) => ({ id: n!.id, label: n!.label }));
      onSelectionKpsChange(kps);
    }
    // Auto-close properties when switching away from single-select.
    if (next.length !== 1) setPropsMode('closed');
  }, [byId, onSelectionKpsChange]);

  useEffect(() => {
    // Reset local UI state when conception instance changes.
    setSelectedIds((prev) => (prev.length === 0 ? prev : []));
    setPropsMode((prev) => (prev === 'closed' ? prev : 'closed'));
    onSelectionKpsChange?.([]);
  }, [conception?.updatedAt, onSelectionKpsChange]);

  const dmPhase = (conception as any)?.dm?.phase as string | undefined;
  const showDocPlanTab =
    dmPhase === 'formalization' || (conception?.docPlan?.docType && conception.docPlan.docType !== 'unknown') || false;

  const dmAny = ((conception as any)?.dm ?? {}) as Record<string, unknown>;
  const docPlanReady = Boolean((dmAny as any).docPlanReady);
  const draftingAny = ((dmAny as any).drafting ?? null) as
    | { stage?: unknown; includedNodeIds?: unknown; importanceById?: unknown }
    | null;
  const draftingStage = String(draftingAny?.stage ?? '').trim() as
    | 'review'
    | 'select_nodes'
    | 'rank_nodes'
    | 'materializing'
    | 'done'
    | '';
  const draftingIncludedRaw = draftingAny?.includedNodeIds;
  const draftingImportanceRaw = draftingAny?.importanceById;
  const draftingIncludedNodeIds = useMemo(() => {
    return Array.isArray(draftingIncludedRaw)
      ? (draftingIncludedRaw as unknown[]).map(String).filter(Boolean)
      : [];
  }, [draftingIncludedRaw]);
  const draftingImportanceById: Record<string, 'H' | 'M' | 'L'> = useMemo(() => {
    return draftingImportanceRaw && typeof draftingImportanceRaw === 'object'
      ? (Object.fromEntries(
          Object.entries(draftingImportanceRaw as Record<string, unknown>)
            .map(([k, v]) => [String(k), String(v)])
            .filter(([, v]) => v === 'H' || v === 'M' || v === 'L')
        ) as Record<string, 'H' | 'M' | 'L'>)
      : {};
  }, [draftingImportanceRaw]);

  const updateDrafting = useCallback(
    (patch: Partial<{ stage: 'review' | 'select_nodes' | 'rank_nodes' | 'materializing' | 'done'; includedNodeIds: string[]; importanceById: Record<string, 'H' | 'M' | 'L'> }>) => {
      if (!conception) return;
      const curDm = ((conception as any).dm ?? {}) as any;
      const cur = (curDm.drafting ?? { stage: 'review', includedNodeIds: [], importanceById: {} }) as any;
      const nextDrafting = {
        ...cur,
        ...(patch.stage ? { stage: patch.stage } : {}),
        ...(patch.includedNodeIds ? { includedNodeIds: patch.includedNodeIds } : {}),
        ...(patch.importanceById ? { importanceById: patch.importanceById } : {}),
      };
      const next: ConceptionState = {
        ...conception,
        dm: { ...curDm, drafting: nextDrafting },
        updatedAt: new Date().toISOString(),
      };
      onSaveConception(next, 'ai-action');
    },
    [conception, onSaveConception]
  );

  const computeIncludedClosure = useCallback(
    (explicitIds: string[]): string[] => {
      const ig = conception?.ideaGraph;
      const nodes = ig?.nodes ?? [];
      const edges = ig?.edges ?? [];
      const byId = new Set(nodes.map((n) => n.id));
      const explicit = explicitIds.map(String).filter((id) => byId.has(id));
      // In rank_nodes: empty explicit ids means "include all".
      if (explicit.length === 0 && draftingStage === 'rank_nodes') {
        return nodes.map((n) => n.id).filter(Boolean).sort();
      }
      if (explicit.length === 0) return [];
      const incoming = new Map<string, string[]>();
      for (const e of edges) {
        const dst = String((e as any).dst ?? '');
        const src = String((e as any).src ?? '');
        if (!dst || !src) continue;
        const arr = incoming.get(dst) ?? [];
        arr.push(src);
        incoming.set(dst, arr);
      }
      const out = new Set<string>();
      const q = [...explicit];
      while (q.length) {
        const cur = q.pop()!;
        if (out.has(cur)) continue;
        out.add(cur);
        for (const p of incoming.get(cur) ?? []) {
          if (!out.has(p)) q.push(p);
        }
      }
      return Array.from(out).sort();
    },
    [conception?.ideaGraph, draftingStage]
  );

  const effectiveIncludedIds = useMemo(() => computeIncludedClosure(draftingIncludedNodeIds), [computeIncludedClosure, draftingIncludedNodeIds]);
  useEffect(() => {
    if (!showDocPlanTab && activeTab === 'docplan') setActiveTab('ideagraph');
  }, [showDocPlanTab, activeTab]);

  useEffect(() => {
    if (draftingStage === 'select_nodes' || draftingStage === 'rank_nodes') {
      if (activeTab !== 'ideagraph') setActiveTab('ideagraph');
    }
  }, [draftingStage, activeTab]);

  const prevDmPhaseRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevDmPhaseRef.current;
    prevDmPhaseRef.current = dmPhase;
    // Auto-switch to Doc Plan when formalization begins, unless user explicitly chose IG.
    if (dmPhase === 'formalization' && prev !== 'formalization') {
      if (manualTab !== 'ideagraph') setActiveTab('docplan');
    }
  }, [dmPhase, manualTab]);

  if (!conception) {
    return (
      <div className="h-full w-full border border-vscode-border bg-[#1e1e1e] overflow-hidden flex items-center justify-center text-sm text-[#969696]">
        No ideation state yet.
      </div>
    );
  }

  const handleDeleteCascade = (rootId: string) => {
    const ig = conception.ideaGraph;
    if (!ig) return;
    const del = cascadeDeleteIds(ig, rootId);
    const nextIg = {
      ...ig,
      nodes: (ig.nodes ?? []).filter((n) => !del.has(n.id)),
      edges: (ig.edges ?? []).filter((e) => !del.has(e.src) && !del.has(e.dst)),
    };
    const next = { ...conception, ideaGraph: nextIg, updatedAt: new Date().toISOString() };
    onSaveConception(next, 'ai-action');
    setSelectedIds([]);
    setClearSelectionNonce((n) => n + 1);
    setPropsMode('closed');
  };

  const handleDeleteCascadeMany = (rootIds: string[]) => {
    const ig = conception.ideaGraph;
    if (!ig) return;
    const del = new Set<string>();
    for (const id of rootIds) {
      for (const x of cascadeDeleteIds(ig, id)) del.add(x);
    }
    const nextIg = {
      ...ig,
      nodes: (ig.nodes ?? []).filter((n) => !del.has(n.id)),
      edges: (ig.edges ?? []).filter((e) => !del.has(e.src) && !del.has(e.dst)),
    };
    const next = { ...conception, ideaGraph: nextIg, updatedAt: new Date().toISOString() };
    onSaveConception(next, 'ai-action');
    setSelectedIds([]);
    setClearSelectionNonce((n) => n + 1);
    setPropsMode('closed');
  };

  const primarySelectedId = selectedIds.length === 1 ? selectedIds[0]! : null;
  const selectedCount = selectedIds.length;

  return (
    <div className="h-full w-full border border-vscode-border bg-[#1e1e1e] overflow-hidden">
      <div className="px-4 py-3 border-b border-vscode-border bg-[#252526] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-xs font-mono uppercase text-[#a855f7]">Ideation</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`px-2 py-1 rounded border text-[10px] font-mono uppercase transition-colors ${
                activeTab === 'ideagraph'
                  ? 'border-[#a855f7]/40 bg-[#a855f7]/10 text-[#e9d5ff]'
                  : 'border-transparent hover:border-[#3e3e42] hover:bg-[#1e1e1e] text-[#969696] hover:text-[#cccccc]'
              }`}
              onClick={() => {
                setManualTab('ideagraph');
                setActiveTab('ideagraph');
              }}
              title="Idea Graph"
              aria-label="Idea Graph"
            >
              Idea Graph
            </button>
            {showDocPlanTab ? (
              <button
                type="button"
                className={`px-2 py-1 rounded border text-[10px] font-mono uppercase transition-colors ${
                  activeTab === 'docplan'
                    ? 'border-[#3e3e42] bg-[#1e1e1e] text-[#cccccc]'
                    : 'border-transparent hover:border-[#3e3e42] hover:bg-[#1e1e1e] text-[#969696] hover:text-[#cccccc]'
                }`}
                onClick={() => {
                  setManualTab('docplan');
                  setActiveTab('docplan');
                }}
                title="Doc Plan"
                aria-label="Doc Plan"
              >
                Doc Plan
              </button>
            ) : null}
          </div>
        </div>
        {docPlanReady ? (
          <div className="flex items-center gap-2">
            {draftingStage ? (
              <div className="px-2 py-1 rounded border border-[#3e3e42] bg-[#111111] text-[10px] font-mono uppercase text-[#bfe3ff]">
                Drafting: {draftingStage.replace('_', ' ')}
              </div>
            ) : null}

            {draftingStage === 'review' || draftingStage === '' ? (
              <>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-[rgba(59,130,246,0.45)] bg-[rgba(59,130,246,0.12)] hover:bg-[rgba(59,130,246,0.18)] text-[10px] font-mono uppercase text-[#bfe3ff] transition-colors"
                  onClick={() => {
                    updateDrafting({ stage: 'rank_nodes', includedNodeIds: [], importanceById: draftingImportanceById });
                  }}
                  title="Include all ideas"
                >
                  Include all
                </button>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[10px] font-mono uppercase text-[#cccccc] transition-colors"
                  onClick={() => {
                    updateDrafting({ stage: 'select_nodes', includedNodeIds: [], importanceById: draftingImportanceById });
                  }}
                  title="Select nodes in the graph"
                >
                  Select nodes
                </button>
              </>
            ) : null}

            {draftingStage === 'select_nodes' ? (
              <>
                <div className="text-[10px] font-mono uppercase text-[#969696]">
                  {draftingIncludedNodeIds.length} picked
                </div>
                <button
                  type="button"
                  disabled={draftingIncludedNodeIds.length === 0}
                  className="px-2 py-1 rounded border border-[rgba(59,130,246,0.45)] bg-[rgba(59,130,246,0.12)] hover:bg-[rgba(59,130,246,0.18)] disabled:opacity-50 disabled:hover:bg-[rgba(59,130,246,0.12)] text-[10px] font-mono uppercase text-[#bfe3ff] transition-colors"
                  onClick={() => updateDrafting({ stage: 'rank_nodes', includedNodeIds: draftingIncludedNodeIds, importanceById: draftingImportanceById })}
                  title="Done selecting"
                >
                  Done selecting
                </button>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[10px] font-mono uppercase text-[#cccccc] transition-colors"
                  onClick={() => updateDrafting({ stage: 'review', includedNodeIds: [], importanceById: draftingImportanceById })}
                  title="Back"
                >
                  Back
                </button>
              </>
            ) : null}

            {draftingStage === 'rank_nodes' ? (
              <>
                <button
                  type="button"
                  disabled={!onStartDrafting}
                  className="px-2 py-1 rounded border border-[rgba(59,130,246,0.45)] bg-[rgba(59,130,246,0.12)] hover:bg-[rgba(59,130,246,0.18)] disabled:opacity-50 disabled:hover:bg-[rgba(59,130,246,0.12)] text-[10px] font-mono uppercase text-[#bfe3ff] transition-colors"
                  onClick={() => void onStartDrafting?.({ includedNodeIds: draftingIncludedNodeIds, importanceById: draftingImportanceById })}
                  title="Start drafting"
                >
                  Start drafting
                </button>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[10px] font-mono uppercase text-[#cccccc] transition-colors"
                  onClick={() => updateDrafting({ stage: 'select_nodes', includedNodeIds: draftingIncludedNodeIds, importanceById: draftingImportanceById })}
                  title="Back"
                >
                  Back
                </button>
              </>
            ) : null}

            {draftingStage === 'materializing' ? (
              <>
                <div className="text-[10px] font-mono uppercase text-[#969696]">Materializing…</div>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-[rgba(59,130,246,0.45)] bg-[rgba(59,130,246,0.12)] hover:bg-[rgba(59,130,246,0.18)] text-[10px] font-mono uppercase text-[#bfe3ff] transition-colors"
                  onClick={() => updateDrafting({ stage: 'rank_nodes', includedNodeIds: draftingIncludedNodeIds, importanceById: draftingImportanceById })}
                  title="Retry drafting"
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[10px] font-mono uppercase text-[#cccccc] transition-colors"
                  onClick={() => updateDrafting({ stage: 'review', includedNodeIds: [], importanceById: draftingImportanceById })}
                  title="Back"
                >
                  Back
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="h-[calc(100%-44px)] flex min-w-0 min-h-0 overflow-hidden">
        {activeTab === 'ideagraph' && primarySelectedId && propsMode === 'open' && draftingStage !== 'select_nodes' && draftingStage !== 'rank_nodes' ? (
          <IdeaGraphPropertiesPanel
            ig={conception.ideaGraph}
            selectedId={primarySelectedId}
            onMinimize={() => setPropsMode('minimized')}
            onAddToChat={(kp) => onPinKp(kp)}
            onDeleteCascade={(nextIg) => {
              const next = { ...conception, ideaGraph: nextIg, updatedAt: new Date().toISOString() };
              onSaveConception(next, 'ai-action');
            }}
          />
        ) : null}

        <div className="flex-1 relative min-w-0 min-h-0 overflow-hidden">
          {activeTab === 'ideagraph' && primarySelectedId && propsMode === 'minimized' && draftingStage !== 'select_nodes' && draftingStage !== 'rank_nodes' ? (
            <button
              type="button"
              className="absolute left-0 top-14 z-30 w-[34px] h-[140px] rounded-r border border-l-0 border-vscode-border bg-[#111111] hover:bg-[#222222] text-[#e9d5ff] transition-colors flex flex-col items-center justify-center gap-2"
              title="Expand properties"
              aria-label="Expand properties panel"
              onClick={() => setPropsMode('open')}
            >
              <span className="text-xs leading-none">›</span>
              <span className="text-[10px] font-mono uppercase" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                Properties
              </span>
            </button>
          ) : null}

          {activeTab === 'ideagraph' ? (
            <IdeaGraphCanvas
              ig={conception.ideaGraph}
              selectedIds={selectedIds}
              onSelectIds={handleSelectIds}
              clearSelectionNonce={clearSelectionNonce}
              onInspectSelected={() => {
                if (selectedIds.length === 1) setPropsMode('open');
              }}
              onAddSelectedToChat={(kp) => onPinKp(kp)}
              onDeleteSelectedCascade={(id) => handleDeleteCascade(id)}
              onDeleteSelectedManyCascade={(ids) => handleDeleteCascadeMany(ids)}
              drafting={
                draftingStage === 'select_nodes' || draftingStage === 'rank_nodes'
                  ? {
                      stage: draftingStage as 'select_nodes' | 'rank_nodes',
                      includedIds: effectiveIncludedIds,
                      importanceById: draftingImportanceById,
                      onToggleExplicit: (id: string) => {
                        if (draftingStage === 'rank_nodes' && draftingIncludedNodeIds.length === 0) return;
                        const cur = draftingIncludedNodeIds;
                        const has = cur.includes(id);
                        const next = has ? cur.filter((x) => x !== id) : Array.from(new Set([...cur, id])).sort();
                        updateDrafting({ includedNodeIds: next, importanceById: draftingImportanceById });
                      },
                      onSetImportance: (id: string, v: 'H' | 'M' | 'L') => {
                        const next = { ...draftingImportanceById, [id]: v };
                        updateDrafting({ importanceById: next, includedNodeIds: draftingIncludedNodeIds });
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <DocPlanPanel conception={conception} onSaveConception={onSaveConception} />
          )}
        </div>
      </div>
    </div>
  );
}


