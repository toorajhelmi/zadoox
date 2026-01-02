import { describe, expect, it } from 'vitest';
import { computeIrDelta } from '../delta';
import { irEventsFromDelta } from '../events';
import { extractOutlineItemsFromIr } from '../outline';
import { irToXmd } from '../to-xmd';
import type { DocumentNode, DocumentTitleNode, FigureNode, SectionNode } from '../types';

describe('ir utilities', () => {
  it('computeIrDelta detects added/removed/changed', () => {
    const prev = new Map<string, string>([
      ['a', 'h1'],
      ['b', 'h2'],
    ]);
    const next = new Map<string, string>([
      ['b', 'h2-changed'],
      ['c', 'h3'],
    ]);

    const delta = computeIrDelta(prev, next);
    expect(delta.added).toEqual(['c']);
    expect(delta.removed).toEqual(['a']);
    expect(delta.changed).toEqual(['b']);
  });

  it('irEventsFromDelta emits events for non-empty groups', () => {
    const events = irEventsFromDelta({ added: ['a'], removed: [], changed: ['b', 'c'] });
    expect(events).toEqual([
      { type: 'ir/nodes_added', nodeIds: ['a'] },
      { type: 'ir/nodes_changed', nodeIds: ['b', 'c'] },
    ]);
  });

  it('extractOutlineItemsFromIr derives headings + labeled figures', () => {
    const h: SectionNode = {
      type: 'section',
      id: 's1',
      level: 1,
      title: 'Intro',
      children: [],
    };
    const f: FigureNode = {
      type: 'figure',
      id: 'f1',
      src: 'zadoox-asset://x',
      caption: 'Cap',
      label: 'fig:demo',
    };
    const doc: DocumentNode = {
      type: 'document',
      id: 'd',
      docId: 'doc',
      children: [h, f],
    };

    const items = extractOutlineItemsFromIr(doc);
    expect(items[0]).toMatchObject({ kind: 'heading', text: 'Intro', level: 1, id: 'intro' });
    expect(items[1]).toMatchObject({ kind: 'figure', id: 'figure-fig-demo' });
  });

  it('extractOutlineItemsFromIr includes document title and unlabeled figures', () => {
    const t: DocumentTitleNode = { type: 'document_title', id: 't1', text: 'Doc Title' };
    const h: SectionNode = { type: 'section', id: 's1', level: 1, title: 'Intro', children: [] };
    const f: FigureNode = { type: 'figure', id: 'F_NODE_ID', src: 'x', caption: 'Cap' };
    const doc: DocumentNode = { type: 'document', id: 'd', docId: 'doc', children: [t, h, f] };

    const items = extractOutlineItemsFromIr(doc);
    expect(items[0]).toMatchObject({ kind: 'heading', id: 'doc-title', text: 'Doc Title' });
    expect(items[1]).toMatchObject({ kind: 'heading', text: 'Intro' });
    expect(items[2]).toMatchObject({ kind: 'figure', text: 'Figure — Cap' });
    expect(items[2].id).toContain('figure-');
  });

  it('irToXmd preserves raw figure line (attribute parity bridge)', () => {
    const raw = '![Cap](zadoox-asset://x){#fig:demo width="50%" align="center"}';
    const fig: FigureNode = {
      type: 'figure',
      id: 'f1',
      src: 'zadoox-asset://x',
      caption: 'Cap',
      label: 'fig:demo',
      source: { raw },
    };
    const doc: DocumentNode = { type: 'document', id: 'd', docId: 'doc', children: [fig] };

    expect(irToXmd(doc)).toContain(raw);
  });
});


