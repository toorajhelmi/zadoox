'use client';

import type { IdeaGraph } from '@zadoox/shared';
import { IdeaGraphCanvas } from './idea-graph-canvas';

export function IdeaGraphPanel(props: { ig: IdeaGraph | null | undefined }) {
  return (
    <div className="h-[360px]">
      <IdeaGraphCanvas
        ig={props.ig}
        selectedIds={[]}
        onSelectIds={() => {}}
        clearSelectionNonce={0}
        onDeleteSelectedManyCascade={() => {}}
      />
    </div>
  );
}


