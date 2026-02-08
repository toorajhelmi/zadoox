'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IdeaGraph } from '@zadoox/shared';
import ReactFlow, {
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlowProvider,
  SelectionMode,
  type NodeChange,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from 'reactflow';
import ELK from 'elkjs/lib/elk.bundled.js';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function relFromFacets(facets: unknown): string {
  const fs = Array.isArray(facets) ? facets.map(String) : [];
  return fs.find((f) => f.startsWith('REL:'))?.slice(4) ?? '';
}

type KpNodeData = {
  label: string;
  isAssistant: boolean;
  multiSelectActive?: boolean;
  isGroup?: boolean;
  onSelect?: (opts: { additive: boolean }) => void;
  onInspect?: () => void;
  onAddToChat?: () => void;
  onDelete?: () => void;
};

const EMPTY_IDS: string[] = [];

function KpNode(props: NodeProps<KpNodeData>) {
  const { data, selected } = props;
  const [hover, setHover] = useState(false);
  // Match chat bubble styling for Z (assistant) nodes.
  // Context/analysis group nodes should look like user-origin KPs (purple), not a separate visual type.
  const fill = data.isAssistant ? '#1e1e1e' : 'rgba(168,85,247,0.18)';
  const stroke = data.isAssistant ? '#3e3e42' : 'rgba(168,85,247,0.75)';
  const selectedRing = data.isAssistant ? 'rgba(229,229,229,0.22)' : 'rgba(233,213,255,0.30)';
  const showTooltip = hover && (data.label?.length ?? 0) > 34;
  return (
    <div
      style={{
        background: fill,
        border: `${selected ? 2 : 1.5}px solid ${stroke}`,
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 220,
        maxWidth: 280,
        color: data.isAssistant ? '#e5e5e5' : 'rgba(229,229,229,0.95)',
        fontSize: 12,
        lineHeight: 1.2,
        // Make selection state unmistakable (especially during multi-select).
        boxShadow: selected ? `0 0 0 3px ${selectedRing}, 0 10px 26px rgba(0,0,0,0.22)` : 'none',
        position: 'relative',
      }}
      onClick={(e) => {
        // Support Cmd/Ctrl-click additive selection reliably (even when React Flow's internal
        // click selection doesn't play well with controlled nodes).
        e.stopPropagation();
        const additive = Boolean((e as any).metaKey || (e as any).ctrlKey);
        data.onSelect?.({ additive });
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Invisible handles so edges can attach to custom nodes */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {data.label}
      </div>

      {showTooltip ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 8,
            zIndex: 50,
            pointerEvents: 'none',
            maxWidth: 360,
          }}
        >
          <div
            style={{
              background: '#111111',
              border: '1px solid #3e3e42',
              borderRadius: 8,
              padding: '6px 8px',
              color: 'rgba(229,229,229,0.95)',
              fontSize: 12,
              lineHeight: 1.25,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            }}
          >
            {data.label}
          </div>
        </div>
      ) : null}

      {selected && !data.multiSelectActive ? (
        <div style={{ position: 'absolute', right: 8, top: -12, display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onInspect?.();
            }}
            className="w-[26px] h-[26px] rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[#c5c5c5] hover:text-white text-[12px] flex items-center justify-center"
            title="Open properties"
            aria-label="Open properties panel"
          >
            🔍
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onAddToChat?.();
            }}
            className="w-[26px] h-[26px] rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[#c5c5c5] hover:text-white text-[12px] flex items-center justify-center"
            title="Add to chat"
            aria-label="Add selected KP to chat"
          >
            ＋
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.();
            }}
            className="w-[26px] h-[26px] rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[#ffb4b4] hover:text-white text-[12px] flex items-center justify-center"
            title="Delete (cascade)"
            aria-label="Delete node (cascade)"
          >
            🗑
          </button>
        </div>
      ) : null}
    </div>
  );
}

const nodeTypes = { kp: KpNode } as const;

function sameSortedIds(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function IdeaGraphCanvasInner(props: {
  ig: IdeaGraph | null | undefined;
  selectedIds?: string[] | null;
  onSelectIds?: (ids: string[]) => void;
  clearSelectionNonce?: number;
  onInspectSelected?: () => void;
  onAddSelectedToChat?: (kp: { id: string; label: string }) => void;
  onDeleteSelectedCascade?: (id: string) => void;
  onDeleteSelectedManyCascade?: (ids: string[]) => void;
}) {
  const ig = props.ig;
  const selectedIds = props.selectedIds ?? EMPTY_IDS;
  const onSelectIds = props.onSelectIds;
  const clearSelectionNonce = Number(props.clearSelectionNonce ?? 0);
  const onInspectSelected = props.onInspectSelected;
  const onAddSelectedToChat = props.onAddSelectedToChat;
  const onDeleteSelectedCascade = props.onDeleteSelectedCascade;
  const onDeleteSelectedManyCascade = props.onDeleteSelectedManyCascade;
  const [rfNodes, setRfNodes] = useState<Node<KpNodeData>[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const didFitRef = useRef(false);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const lastSelectionKeyRef = useRef<string>(''); // last selection sent upward
  const onSelectIdsRef = useRef<typeof onSelectIds>(onSelectIds);
  const onInspectSelectedRef = useRef<typeof onInspectSelected>(onInspectSelected);
  const onAddSelectedToChatRef = useRef<typeof onAddSelectedToChat>(onAddSelectedToChat);
  const onDeleteSelectedCascadeRef = useRef<typeof onDeleteSelectedCascade>(onDeleteSelectedCascade);
  const onDeleteSelectedManyCascadeRef = useRef<typeof onDeleteSelectedManyCascade>(onDeleteSelectedManyCascade);
  useEffect(() => {
    onSelectIdsRef.current = onSelectIds;
    onInspectSelectedRef.current = onInspectSelected;
    onAddSelectedToChatRef.current = onAddSelectedToChat;
    onDeleteSelectedCascadeRef.current = onDeleteSelectedCascade;
    onDeleteSelectedManyCascadeRef.current = onDeleteSelectedManyCascade;
  }, [onSelectIds, onInspectSelected, onAddSelectedToChat, onDeleteSelectedCascade, onDeleteSelectedManyCascade]);

  const propagateSelection = useCallback((nodes: Array<Node<KpNodeData>>) => {
    const ids = nodes
      .filter((n) => Boolean(n.selected))
      .map((n) => n.id)
      .filter(Boolean)
      .sort();
    const key = ids.join('|');
    if (key === lastSelectionKeyRef.current) return;
    lastSelectionKeyRef.current = key;
    onSelectIdsRef.current?.(ids);
  }, []);

  const applySelection = useCallback(
    (nodeId: string, opts: { additive: boolean }) => {
      setRfNodes((prev) => {
        let next = prev;
        if (opts.additive) {
          next = prev.map((n) => (n.id === nodeId ? { ...n, selected: !n.selected } : n));
        } else {
          next = prev.map((n) => ({ ...n, selected: n.id === nodeId }));
        }
        const selCount = next.filter((n) => Boolean(n.selected)).length;
        const multi = selCount > 1;
        next = next.map((n) => {
          const cur = (n.data as KpNodeData | undefined)?.multiSelectActive ?? false;
          if (cur === multi) return n;
          return { ...n, data: { ...(n.data as KpNodeData), multiSelectActive: multi } };
        });
        propagateSelection(next);
        return next;
      });
    },
    [propagateSelection]
  );

  // Per ideation.md: keep the *visible* graph conservative and high-trust.
  // Proposed nodes/edges remain in state; hide only low-confidence noise by default.
  const visibleNodes = useMemo(() => {
    const nodes = ig?.nodes ?? [];
    return nodes.filter((n) => {
      if (n.status === 'deprecated') return false;
      if (n.status === 'proposed') {
        const conf = clamp01(Number(n.confidence ?? 0));
        const facets = Array.isArray(n.facets) ? n.facets.map(String) : [];
        // Show assistant-origin proposed nodes more readily (they represent Z's suggestions).
        if (facets.includes('src:assistant')) return conf >= 0.25;
        return conf >= 0.4;
      }
      return true; // accepted or unspecified
    });
  }, [ig?.nodes]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    const edges = ig?.edges ?? [];
    return edges.filter(
      (e) =>
        e.status !== 'deprecated' &&
        (e.status !== 'proposed' || clamp01(Number(e.confidence ?? 0)) >= 0.25) &&
        visibleNodeIds.has(e.src) &&
        visibleNodeIds.has(e.dst)
    );
  }, [ig?.edges, visibleNodeIds]);

  const selectedIdsLocal = useMemo(
    () => rfNodes.filter((n) => Boolean(n.selected)).map((n) => n.id).filter(Boolean).sort(),
    [rfNodes]
  );
  const selectedCountLocal = selectedIdsLocal.length;
  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of visibleNodes) m.set(n.id, String(n.label ?? '').trim());
    return m;
  }, [visibleNodes]);

  // Always keep parent selection in sync with what we render as selected.
  // This is the most robust path with controlled nodes + box-select, and it does not create feedback loops
  // because parent selection does not mutate `rfNodes`.
  useEffect(() => {
    propagateSelection(rfNodes);
  }, [rfNodes, propagateSelection]);

  // Explicit clear request from parent (e.g., bulk toolbar Clear).
  useEffect(() => {
    if (!clearSelectionNonce) return;
    setRfNodes((prev) => {
      if (!prev.some((n) => n.selected)) return prev;
      return prev.map((n) => (n.selected ? { ...n, selected: false, data: { ...(n.data as KpNodeData), multiSelectActive: false } } : n));
    });
    // Also reset lastSelectionKey so we propagate the cleared selection.
    lastSelectionKeyRef.current = '';
  }, [clearSelectionNonce]);

  // Build React Flow nodes/edges and run ELK layout whenever graph changes.
  // IMPORTANT: this hook must run unconditionally (no early returns before it) to avoid hook-order crashes.
  useEffect(() => {
    if (!ig || visibleNodes.length === 0) {
      setRfNodes([]);
      setRfEdges([]);
      return;
    }
    let cancelled = false;
    const elk = new ELK();
    const NODE_W = 260;
    const NODE_H = 54;

    const isAssistantById = new Map<string, boolean>();
    for (const n of visibleNodes) {
      const facets = Array.isArray(n.facets) ? n.facets.map(String) : [];
      isAssistantById.set(n.id, facets.includes('src:assistant'));
    }

    const rfN: Node<KpNodeData>[] = visibleNodes.map((n) => {
      const facets = Array.isArray(n.facets) ? n.facets.map(String) : [];
      const isAssistant = facets.includes('src:assistant');
      const isGroup = facets.includes('GROUP:context');
      const label = String(n.label ?? '').trim();
      return {
        id: n.id,
        type: 'kp',
        position: { x: 0, y: 0 },
        data: {
          label,
          isAssistant,
          isGroup,
          multiSelectActive: false,
          onSelect: (opts) => applySelection(n.id, opts),
          onInspect: () => {
            onSelectIdsRef.current?.([n.id]);
            onInspectSelectedRef.current?.();
          },
          onAddToChat: () => {
            if (!label) return;
            onAddSelectedToChatRef.current?.({ id: n.id, label });
          },
          onDelete: () => {
            onDeleteSelectedCascadeRef.current?.(n.id);
          },
        },
      };
    });

    const rfE: Edge[] = visibleEdges.map((e, idx) => {
      const conf = clamp01(Number(e.confidence ?? 0.6));
      // Edge color inherits the source node color (only purple/cyan).
      const isAssistantSrc = Boolean(isAssistantById.get(e.src));
      // Assistant nodes now use the same gray border as chat bubbles; match edges to that.
      const base = isAssistantSrc ? '62,62,66' : '168,85,247'; // #3e3e42 vs purple
      const color = `rgba(${base},${0.22 + conf * 0.60})`;
      return {
        id: `e-${e.src}-${e.dst}-${idx}`,
        source: e.src,
        target: e.dst,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 1.5 },
      };
    });

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.layered.spacing.nodeNodeBetweenLayers': '70',
        'elk.spacing.nodeNode': '40',
        'elk.edgeRouting': 'SPLINES',
      },
      children: rfN.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
      edges: rfE.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    } as any;

    void (async () => {
      try {
        const res = await elk.layout(graph);
        if (cancelled) return;
        const byId = new Map<string, { x: number; y: number }>();
        for (const c of res.children ?? []) {
          byId.set(String(c.id), { x: Number(c.x ?? 0), y: Number(c.y ?? 0) });
        }
        setRfNodes(
          rfN.map((n) => {
            const p = byId.get(n.id) ?? { x: 0, y: 0 };
            return { ...n, position: p };
          })
        );
        setRfEdges(rfE);
      } catch {
        if (cancelled) return;
        setRfNodes(rfN);
        setRfEdges(rfE);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ig, visibleNodes, visibleEdges, applySelection]);

  if (!ig) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-[#969696]">
        No IdeaGraph yet.
      </div>
    );
  }

  if (visibleNodes.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-[#969696]">
        IdeaGraph is empty — start chatting to add nodes and edges.
      </div>
    );
  }

  return (
    <div
      className="h-full w-full min-w-0 min-h-0"
      onWheelCapture={(e) => {
        // Support both scrolling (pan) and zooming.
        // - wheel: pan (handled by React Flow via panOnScroll)
        // - Ctrl/Cmd + wheel: zoom (we do it manually since React Flow wheel zoom would steal normal scroll)
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        e.stopPropagation();
        const inst = rfInstanceRef.current;
        if (!inst) return;
        const cur = inst.getViewport?.().zoom ?? 1;
        // Smooth zoom: scale factor derived from delta (avoid "jump" on first gesture).
        const factor = Math.exp(-e.deltaY / 450);
        const nextZoom = Math.max(0.15, Math.min(2.8, cur * factor));
        inst.zoomTo(nextZoom, { duration: 0 });
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView={!didFitRef.current}
        onInit={(inst) => {
          didFitRef.current = true;
          rfInstanceRef.current = inst;
        }}
        onPaneClick={() => {
          setRfNodes((prev) => {
            const next = prev.map((n) =>
              n.selected ? { ...n, selected: false, data: { ...(n.data as KpNodeData), multiSelectActive: false } } : n
            );
            // Ensure parent selection state updates immediately.
            propagateSelection(next);
            return next;
          });
        }}
        onNodesChange={(changes: NodeChange[]) => {
          // React Flow selection (including box-select) updates nodes via onNodesChange.
          // Since we pass controlled `nodes`, we must apply these changes for selection to work.
          setRfNodes((prev) => {
            const next = applyNodeChanges(changes, prev);
            const selCount = next.filter((n) => Boolean(n.selected)).length;
            const multi = selCount > 1;
            let changed = false;
            const next2 = next.map((n) => {
              const cur = (n.data as KpNodeData | undefined)?.multiSelectActive ?? false;
              if (cur === multi) return n;
              changed = true;
              return { ...n, data: { ...(n.data as KpNodeData), multiSelectActive: multi } };
            });
            const out = changed ? next2 : next;
            propagateSelection(out);
            return out;
          });
        }}
        onSelectionChange={(sel) => {
          // Some React Flow versions do not always emit selection changes via onNodesChange
          // in a way that updates our controlled `nodes`. Use this as an additional signal
          // to keep the parent bulk-toolbar selection in sync with what the user sees.
          const ids = (sel.nodes ?? []).map((n) => n.id).filter(Boolean).sort();
          const key = ids.join('|');
          if (key === lastSelectionKeyRef.current) return;
          lastSelectionKeyRef.current = key;
          onSelectIdsRef.current?.(ids);
        }}
        proOptions={{ hideAttribution: true }}
        panOnScroll
        // Enable box selection (drag rectangle on the pane). Keep panning available on middle/right mouse.
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        nodesDraggable={false}
      >
        {selectedCountLocal > 1 ? (
          <Panel position="top-right">
            <div className="flex items-center gap-2 rounded border border-[#3e3e42] bg-[#111111] px-2 py-1 shadow">
              <div className="text-[10px] font-mono uppercase text-[#cccccc]">{selectedCountLocal} selected</div>
              <button
                type="button"
                className="px-2 py-1 rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[#bfe3ff] text-[10px] font-mono uppercase"
                onClick={() => {
                  for (const id of selectedIdsLocal) {
                    const label = labelById.get(id) ?? '';
                    if (!label) continue;
                    onAddSelectedToChatRef.current?.({ id, label });
                  }
                }}
                aria-label="Add all selected KPs to chat"
                title="Add all selected to chat"
              >
                Add
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[#ffb4b4] text-[10px] font-mono uppercase"
                onClick={() => {
                  if (onDeleteSelectedManyCascadeRef.current) {
                    onDeleteSelectedManyCascadeRef.current(selectedIdsLocal);
                    return;
                  }
                  // Fallback: delete one-by-one (less ideal than a union delete).
                  for (const id of selectedIdsLocal) onDeleteSelectedCascadeRef.current?.(id);
                }}
                aria-label="Delete all selected KPs (cascade)"
                title="Delete all selected (cascade)"
              >
                Delete
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[#c5c5c5] text-[10px] font-mono uppercase"
                onClick={() => {
                  setRfNodes((prev) =>
                    prev.map((n) => (n.selected ? { ...n, selected: false, data: { ...(n.data as KpNodeData), multiSelectActive: false } } : n))
                  );
                  lastSelectionKeyRef.current = '';
                  onSelectIdsRef.current?.([]);
                }}
                aria-label="Clear selection"
                title="Clear selection"
              >
                Clear
              </button>
            </div>
          </Panel>
        ) : null}
        <Background color="rgba(255,255,255,0.04)" gap={18} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export function IdeaGraphCanvas(props: {
  ig: IdeaGraph | null | undefined;
  selectedIds?: string[] | null;
  onSelectIds?: (ids: string[]) => void;
  clearSelectionNonce?: number;
  onInspectSelected?: () => void;
  onAddSelectedToChat?: (kp: { id: string; label: string }) => void;
  onDeleteSelectedCascade?: (id: string) => void;
  onDeleteSelectedManyCascade?: (ids: string[]) => void;
}) {
  // React Flow hooks (useStore/useReactFlow) require a provider ancestor.
  // Wrap the inner canvas so hooks run under ReactFlowProvider.
  return (
    <ReactFlowProvider>
      <IdeaGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}


