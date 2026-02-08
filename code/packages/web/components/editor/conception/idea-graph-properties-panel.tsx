'use client';

import type { IdeaGraph } from '@zadoox/shared';

function cascadeDeleteIds(ig: IdeaGraph, rootId: string): Set<string> {
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

export function IdeaGraphPropertiesPanel(props: {
  ig: IdeaGraph | null | undefined;
  selectedId: string | null;
  onDeleteCascade: (next: IdeaGraph) => void;
  onMinimize: () => void;
  onAddToChat: (kp: { id: string; label: string }) => void;
}) {
  const ig = props.ig;
  const selected = props.selectedId ? (ig?.nodes ?? []).find((n) => n.id === props.selectedId) ?? null : null;

  return (
    <div className="h-full w-[300px] min-w-[260px] max-w-[360px] border-r border-vscode-border bg-[#111111]">
      <div className="px-3 py-3 border-b border-vscode-border bg-[#1b1b1b] flex items-center justify-between">
        <div className="text-xs font-mono uppercase text-[#a855f7]">Properties</div>
        <button
          type="button"
          className="w-[24px] h-[24px] rounded border border-[#3e3e42] bg-[#111111] hover:bg-[#222222] text-[#c5c5c5] hover:text-white text-xs flex items-center justify-center"
          onClick={props.onMinimize}
          aria-label="Minimize properties panel"
          title="Minimize"
        >
          –
        </button>
      </div>

      {!selected ? (
        <div className="p-3 text-xs text-[#9aa0a6]">Select a node to see its properties.</div>
      ) : (
        <div className="p-3">
          <div className="text-[11px] font-mono uppercase text-[#9aa0a6]">Selected KP</div>
          <div className="mt-2 text-xs text-[#e5e5e5] leading-snug">{String(selected.label ?? '').trim()}</div>

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded border border-[#3e3e42] bg-[#1b1b1b] hover:bg-[#222222] text-[#cccccc] text-xs w-fit"
              onClick={() => {
                props.onAddToChat({ id: selected.id, label: String(selected.label ?? '').trim() });
              }}
            >
              Add to chat
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded border border-[#5a5a5a] bg-[#1b1b1b] hover:bg-[#222222] text-[#ffb4b4] text-xs w-fit"
              onClick={() => {
                if (!ig) return;
                const del = cascadeDeleteIds(ig, selected.id);
                const next: IdeaGraph = {
                  ...ig,
                  nodes: (ig.nodes ?? []).filter((n) => !del.has(n.id)),
                  edges: (ig.edges ?? []).filter((e) => !del.has(e.src) && !del.has(e.dst)),
                };
                props.onDeleteCascade(next);
              }}
            >
              Delete (cascade)
            </button>
            <div className="text-[11px] text-[#9aa0a6]">Deletes this KP and all descendants (outgoing links).</div>
          </div>
        </div>
      )}
    </div>
  );
}


