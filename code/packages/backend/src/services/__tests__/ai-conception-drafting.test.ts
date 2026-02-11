import { describe, it, expect } from 'vitest';

import { ancestorClosure, compactIncludedGraph, pickIncludedNodes } from '../ai/conception/drafting/ig-selection.js';
import { MaterializeDraftRequest, OutlinePlan } from '../ai/conception/drafting/types.js';

describe('Conception drafting helpers', () => {
  it('ancestorClosure includes all ancestors', () => {
    const edges = [
      { src: 'A', dst: 'B' },
      { src: 'B', dst: 'C' },
      { src: 'X', dst: 'Y' },
    ];
    const out = ancestorClosure(edges, ['C']);
    expect(Array.from(out).sort()).toEqual(['A', 'B', 'C']);
  });

  it('pickIncludedNodes includes all nodes when explicit list empty', () => {
    const nodes = [
      { id: 'A', label: 'A' },
      { id: 'B', label: 'B' },
    ];
    const edges: Array<{ src: string; dst: string }> = [{ src: 'A', dst: 'B' }];
    const picked = pickIncludedNodes({ nodes, edges, includedNodeIds: [] });
    expect(picked.includedIds.sort()).toEqual(['A', 'B']);
  });

  it('compactIncludedGraph defaults importance to Low', () => {
    const nodes = [
      { id: 'A', label: 'Alpha' },
      { id: 'B', label: 'Beta' },
    ];
    const edges = [{ src: 'A', dst: 'B' }];
    const g = compactIncludedGraph({ includedIds: ['A', 'B'], nodes, edges, importanceById: {} });
    expect(g.nodes.map((n) => n.importance)).toEqual(['L', 'L']);
  });

  it('MaterializeDraftRequest schema accepts optional includedNodeIds/importanceById', () => {
    const parsed = MaterializeDraftRequest.parse({ dr: { docPlan: { docType: 'blog' }, ideaGraph: { nodes: [], edges: [] } } });
    expect(parsed).toHaveProperty('dr');
  });

  it('OutlinePlan schema requires at least one section', () => {
    expect(() => OutlinePlan.parse({ docType: 'blog', sections: [] })).toThrow();
  });
});

