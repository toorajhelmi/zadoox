'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { IdeaGraph } from '@zadoox/shared';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlowProvider,
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
  onInspect?: () => void;
  onAddToChat?: () => void;
  onDelete?: () => void;
};

function KpNode(props: NodeProps<KpNodeData>) {
  const { data, selected } = props;
  const [hover, setHover] = useState(false);
  // Match chat bubble styling for Z (assistant) nodes.
  const fill = data.isAssistant ? '#1e1e1e' : 'rgba(168,85,247,0.18)';
  const stroke = data.isAssistant ? '#3e3e42' : 'rgba(168,85,247,0.75)';
  const showTooltip = hover && (data.label?.length ?? 0) > 34;
  return (
    <div
      style={{
        background: fill,
        border: `1.5px solid ${stroke}`,
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 220,
        maxWidth: 280,
        color: data.isAssistant ? '#e5e5e5' : 'rgba(229,229,229,0.95)',
        fontSize: 12,
        lineHeight: 1.2,
        boxShadow: selected ? '0 0 0 2px rgba(255,255,255,0.07)' : 'none',
        position: 'relative',
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

      {selected ? (
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

export function IdeaGraphCanvas(props: {
  ig: IdeaGraph | null | undefined;
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
  onInspectSelected?: () => void;
  onAddSelectedToChat?: (kp: { id: string; label: string }) => void;
  onDeleteSelectedCascade?: (id: string) => void;
}) {
  const ig = props.ig;
  const nodes = ig?.nodes ?? [];
  const edges = ig?.edges ?? [];
  const selectedId = props.selectedId ?? null;
  const onSelectId = props.onSelectId;
  const onInspectSelected = props.onInspectSelected;
  const onAddSelectedToChat = props.onAddSelectedToChat;
  const onDeleteSelectedCascade = props.onDeleteSelectedCascade;
  const [rfNodes, setRfNodes] = useState<Node<KpNodeData>[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const didFitRef = useRef(false);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  // Per ideation.md: keep the *visible* graph conservative and high-trust.
  // Proposed nodes/edges remain in state; hide only low-confidence noise by default.
  const visibleNodes = useMemo(() => {
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
  }, [nodes]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    return edges.filter(
      (e) =>
        e.status !== 'deprecated' &&
        (e.status !== 'proposed' || clamp01(Number(e.confidence ?? 0)) >= 0.25) &&
        visibleNodeIds.has(e.src) &&
        visibleNodeIds.has(e.dst)
    );
  }, [edges, visibleNodeIds]);

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
      const label = String(n.label ?? '').trim();
      return {
        id: n.id,
        type: 'kp',
        position: { x: 0, y: 0 },
        data: {
          label,
          isAssistant,
          onInspect: () => onInspectSelected?.(),
          onAddToChat: () => {
            if (!label) return;
            onAddSelectedToChat?.({ id: n.id, label });
          },
          onDelete: () => {
            onDeleteSelectedCascade?.(n.id);
          },
        },
        selected: selectedId === n.id,
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
  }, [visibleNodes, visibleEdges, selectedId, onInspectSelected, onAddSelectedToChat]);

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
      <ReactFlowProvider>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          fitView={!didFitRef.current}
          onInit={(inst) => {
            didFitRef.current = true;
            rfInstanceRef.current = inst;
          }}
          onPaneClick={() => onSelectId?.(null)}
          onNodeClick={(_evt, node) => onSelectId?.(node.id)}
          proOptions={{ hideAttribution: true }}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
        >
          <Background color="rgba(255,255,255,0.04)" gap={18} />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}


