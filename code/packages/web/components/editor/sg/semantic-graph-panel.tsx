'use client';

import { useMemo, useState } from 'react';
import type { SemanticGraph, SemanticNodeType } from '@zadoox/shared';
import { SG_METADATA_KEY } from './semantic-graph-keys';
import { clampEdgeWeight, createEmptySemanticGraph, makeSgId, SEMANTIC_NODE_TYPES } from './semantic-graph-utils';

export function SemanticGraphPanel(props: {
  documentMetadata: Record<string, any>;
  saveMetadataPatch: (patch: Record<string, any>, changeType?: 'auto-save' | 'ai-action') => void;
}) {
  const { documentMetadata, saveMetadataPatch } = props;

  const sg = (documentMetadata as any)?.[SG_METADATA_KEY] as SemanticGraph | undefined;
  const hasSg = Boolean(sg);

  const nodeOptions = useMemo(() => {
    const nodes = sg?.nodes ?? [];
    return nodes.map((n) => ({ id: n.id, label: `${n.type.toUpperCase()}: ${n.text.slice(0, 32)}${n.text.length > 32 ? '…' : ''}` }));
  }, [sg]);

  const [newNodeType, setNewNodeType] = useState<SemanticNodeType>('claim');
  const [newNodeText, setNewNodeText] = useState('');

  const [newEdgeFrom, setNewEdgeFrom] = useState<string>('');
  const [newEdgeTo, setNewEdgeTo] = useState<string>('');
  const [newEdgeWeight, setNewEdgeWeight] = useState('0.5');

  const persist = (next: SemanticGraph) => {
    saveMetadataPatch(
      {
        [SG_METADATA_KEY]: {
          ...next,
          updatedAt: new Date().toISOString(),
        },
      },
      'ai-action'
    );
  };

  const ensureSg = (): SemanticGraph => sg ?? createEmptySemanticGraph();

  return (
    <div className="mt-3 rounded border border-[#3e3e42] bg-[#1e1e1e]">
      <div className="px-3 py-2 border-b border-[#3e3e42] flex items-center justify-between">
        <div className="text-[11px] font-mono uppercase text-[#cccccc]">Semantic Graph (alpha)</div>
        {!hasSg && (
          <button
            type="button"
            className="text-xs px-2 py-1 rounded bg-[#3e3e42] hover:bg-[#464647] text-white transition-colors"
            onClick={() => persist(createEmptySemanticGraph())}
          >
            Create
          </button>
        )}
      </div>

      {hasSg ? (
        <div className="p-3 space-y-4">
          <div className="text-xs text-[#969696]">
            Nodes: <span className="text-[#cccccc]">{sg!.nodes.length}</span> · Edges:{' '}
            <span className="text-[#cccccc]">{sg!.edges.length}</span>
          </div>

          {/* Add Node */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase text-[#969696]">Add node</div>
            <div className="flex gap-2">
              <select
                className="flex-shrink-0 bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs rounded px-2 py-1"
                value={newNodeType}
                onChange={(e) => setNewNodeType(e.target.value as SemanticNodeType)}
              >
                {SEMANTIC_NODE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs rounded px-2 py-1"
                placeholder="Node text…"
                value={newNodeText}
                onChange={(e) => setNewNodeText(e.target.value)}
              />
              <button
                type="button"
                className="px-2 py-1 rounded bg-[#007acc] hover:bg-[#1a8cd8] text-white text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!newNodeText.trim()}
                onClick={() => {
                  const next = ensureSg();
                  const id = makeSgId('n');
                  persist({
                    ...next,
                    nodes: [...next.nodes, { id, type: newNodeType, text: newNodeText.trim() }],
                  });
                  setNewNodeText('');
                  if (!newEdgeFrom) setNewEdgeFrom(id);
                  if (!newEdgeTo) setNewEdgeTo(id);
                }}
              >
                Add
              </button>
            </div>
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
                      <select
                        className="bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-xs rounded px-2 py-1"
                        value={n.type}
                        onChange={(e) => {
                          const next = ensureSg();
                          persist({
                            ...next,
                            nodes: next.nodes.map((x) =>
                              x.id === n.id ? { ...x, type: e.target.value as SemanticNodeType } : x
                            ),
                          });
                        }}
                      >
                        {SEMANTIC_NODE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="ml-auto text-xs text-[#969696] hover:text-white transition-colors"
                        onClick={() => {
                          const next = ensureSg();
                          persist({
                            ...next,
                            nodes: next.nodes.filter((x) => x.id !== n.id),
                            edges: next.edges.filter((e) => e.from !== n.id && e.to !== n.id),
                          });
                        }}
                        title="Delete node"
                      >
                        Delete
                      </button>
                    </div>
                    <textarea
                      className="mt-2 w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-xs rounded px-2 py-1 resize-none"
                      rows={2}
                      value={n.text}
                      onChange={(e) => {
                        const next = ensureSg();
                        persist({
                          ...next,
                          nodes: next.nodes.map((x) => (x.id === n.id ? { ...x, text: e.target.value } : x)),
                        });
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Edge */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase text-[#969696]">Add edge</div>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs rounded px-2 py-1"
                value={newEdgeFrom}
                onChange={(e) => setNewEdgeFrom(e.target.value)}
              >
                <option value="">From…</option>
                {nodeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className="flex-1 bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs rounded px-2 py-1"
                value={newEdgeTo}
                onChange={(e) => setNewEdgeTo(e.target.value)}
              >
                <option value="">To…</option>
                {nodeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                className="w-[72px] bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs rounded px-2 py-1"
                value={newEdgeWeight}
                onChange={(e) => setNewEdgeWeight(e.target.value)}
                title="Weight in [-1, 1]"
              />
              <button
                type="button"
                className="px-2 py-1 rounded bg-[#3e3e42] hover:bg-[#464647] text-white text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!newEdgeFrom || !newEdgeTo || newEdgeFrom === newEdgeTo}
                onClick={() => {
                  const next = ensureSg();
                  const w = clampEdgeWeight(Number(newEdgeWeight));
                  persist({
                    ...next,
                    edges: [...next.edges, { from: newEdgeFrom, to: newEdgeTo, weight: w }],
                  });
                }}
              >
                Add
              </button>
            </div>
            <div className="text-[11px] text-[#969696]">
              Weight: <span className="text-[#cccccc]">+support</span>, <span className="text-[#cccccc]">-contradiction</span>
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
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#cccccc]">
                        <span className="font-mono text-[10px] text-[#969696]">{e.from}</span> →{' '}
                        <span className="font-mono text-[10px] text-[#969696]">{e.to}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <input
                          className="w-[72px] bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-xs rounded px-2 py-1"
                          value={String(e.weight)}
                          onChange={(ev) => {
                            const next = ensureSg();
                            const w = clampEdgeWeight(Number(ev.target.value));
                            persist({
                              ...next,
                              edges: next.edges.map((x, i) => (i === idx ? { ...x, weight: w } : x)),
                            });
                          }}
                        />
                        <button
                          type="button"
                          className="text-xs text-[#969696] hover:text-white transition-colors"
                          onClick={() => {
                            const next = ensureSg();
                            persist({
                              ...next,
                              edges: next.edges.filter((_, i) => i !== idx),
                            });
                          }}
                          title="Delete edge"
                        >
                          Delete
                        </button>
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
          No Semantic Graph saved for this document yet. Click <span className="text-[#cccccc]">Create</span> to start.
        </div>
      )}
    </div>
  );
}


