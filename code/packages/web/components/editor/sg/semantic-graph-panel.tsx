'use client';

import { useMemo } from 'react';
import type { SemanticGraph } from '@zadoox/shared';
import { SG_METADATA_KEY } from './semantic-graph-keys';

export function SemanticGraphPanel(props: {
  documentMetadata: Record<string, any>;
  saveMetadataPatch: (patch: Record<string, any>, changeType?: 'auto-save' | 'ai-action') => void;
  isPinned: boolean;
  onTogglePinned: () => void;
  onRequestClose?: () => void;
}) {
  const { documentMetadata } = props;

  const sg = (documentMetadata as any)?.[SG_METADATA_KEY] as SemanticGraph | undefined;
  const hasSg = Boolean(sg);

  const nodeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of sg?.nodes ?? []) {
      const label = `${n.type.toUpperCase()}: ${n.text.slice(0, 40)}${n.text.length > 40 ? '…' : ''}`;
      map.set(n.id, label);
    }
    return map;
  }, [sg]);

  return (
    <div className="rounded border border-[#3e3e42] bg-[#1e1e1e]">
      <div className="px-3 py-2 border-b border-[#3e3e42] flex items-center justify-between">
        <div className="text-[11px] font-mono uppercase text-[#cccccc]">Semantic Graph (view)</div>
      </div>

      {hasSg ? (
        <div className="p-3 space-y-4">
          <div className="text-xs text-[#969696]">
            Nodes: <span className="text-[#cccccc]">{sg!.nodes.length}</span> · Edges:{' '}
            <span className="text-[#cccccc]">{sg!.edges.length}</span>
          </div>

          {/* Nodes */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase text-[#969696]">Nodes</div>
            <div className="space-y-2">
              {sg!.nodes.length === 0 ? (
                <div className="text-xs text-[#969696]">No nodes yet.</div>
              ) : (
                sg!.nodes.map((n) => (
                  <div key={n.id} className="rounded border border-[#3e3e42] bg-[#252526] p-2">
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] font-mono text-[#969696]">{n.id}</div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-[#3e3e42] text-[#cccccc] bg-[#1e1e1e]">
                        {n.type}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-[#cccccc] whitespace-pre-wrap">{n.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Edges */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase text-[#969696]">Edges</div>
            <div className="space-y-2">
              {sg!.edges.length === 0 ? (
                <div className="text-xs text-[#969696]">No edges yet.</div>
              ) : (
                sg!.edges.map((e, idx) => (
                  <div key={`${e.from}:${e.to}:${idx}`} className="rounded border border-[#3e3e42] bg-[#252526] p-2">
                    <div className="text-xs text-[#cccccc]">
                      <div className="font-mono text-[10px] text-[#969696]">
                        {e.from} → {e.to}
                      </div>
                      <div className="mt-1 text-[11px] text-[#969696]">
                        <span className="text-[#cccccc]">from</span>: {nodeLabelById.get(e.from) ?? e.from}
                      </div>
                      <div className="text-[11px] text-[#969696]">
                        <span className="text-[#cccccc]">to</span>: {nodeLabelById.get(e.to) ?? e.to}
                      </div>
                      <div className="text-[11px] text-[#969696]">
                        <span className="text-[#cccccc]">weight</span>: {String(e.weight)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Raw JSON */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase text-[#969696]">Raw JSON (read-only)</div>
            <pre className="max-h-[240px] overflow-auto text-[10px] leading-snug bg-black/30 border border-[#3e3e42] rounded p-2 text-[#cccccc]">
              {JSON.stringify(sg, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <div className="p-3 text-xs text-[#969696]">
          No Semantic Graph saved for this document yet.
        </div>
      )}
    </div>
  );
}


