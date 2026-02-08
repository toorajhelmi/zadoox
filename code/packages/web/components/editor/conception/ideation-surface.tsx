'use client';

import { useEffect, useState } from 'react';
import type { ConceptionState } from '@zadoox/shared';
import { IdeaGraphCanvas } from './idea-graph-canvas';
import { IdeaGraphPropertiesPanel } from './idea-graph-properties-panel';

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
}) {
  const { conception, onSaveConception, onPinKp } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [propsMode, setPropsMode] = useState<'closed' | 'open' | 'minimized'>('closed');

  useEffect(() => {
    // Reset local UI state when conception instance changes.
    setSelectedId(null);
    setPropsMode('closed');
  }, [conception?.updatedAt]);

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
    setSelectedId(null);
    setPropsMode('closed');
  };

  return (
    <div className="h-full w-full border border-vscode-border bg-[#1e1e1e] overflow-hidden">
      <div className="px-4 py-3 border-b border-vscode-border bg-[#252526] flex items-center justify-between">
        <div className="text-xs font-mono uppercase text-[#a855f7]">Ideation • IdeaGraph</div>
      </div>

      <div className="h-[calc(100%-44px)] flex min-w-0 min-h-0 overflow-hidden">
        {selectedId && propsMode === 'open' ? (
          <IdeaGraphPropertiesPanel
            ig={conception.ideaGraph}
            selectedId={selectedId}
            onMinimize={() => setPropsMode('minimized')}
            onAddToChat={(kp) => onPinKp(kp)}
            onDeleteCascade={(nextIg) => {
              const next = { ...conception, ideaGraph: nextIg, updatedAt: new Date().toISOString() };
              onSaveConception(next, 'ai-action');
            }}
          />
        ) : null}

        <div className="flex-1 relative min-w-0 min-h-0 overflow-hidden">
          {selectedId && propsMode === 'minimized' ? (
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

          <IdeaGraphCanvas
            ig={conception.ideaGraph}
            selectedId={selectedId}
            onSelectId={setSelectedId}
            onInspectSelected={() => setPropsMode('open')}
            onAddSelectedToChat={(kp) => onPinKp(kp)}
            onDeleteSelectedCascade={(id) => handleDeleteCascade(id)}
          />
        </div>
      </div>
    </div>
  );
}


