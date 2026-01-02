import { describe, expect, it } from 'vitest';
import { parseXmdToIr } from '../../xmd/parser';
import { buildNodeHashMap, makeSnapshotFromIr } from '../store';
import { computeIrDelta } from '../delta';

describe('parseXmdToIr', () => {
  it('parses basic structure and stays stable across runs', () => {
    const xmd = [
      '@ Title',
      '@^ Ada Lovelace',
      '@= 1843-01-01',
      '',
      '# Intro',
      '',
      'Hello world.',
      '',
      '- a',
      '- b',
      '',
      '```ts',
      'const x = 1',
      '```',
      '',
      '![Cap](zadoox-asset://img){#fig:demo}',
      '',
      '$$',
      'x^2',
      '$$',
    ].join('\n');

    const a = parseXmdToIr({ docId: 'doc-1', xmd });
    const b = parseXmdToIr({ docId: 'doc-1', xmd });

    expect(a.children.length).toBeGreaterThan(0);
    expect(a.id).toBe(b.id);

    // IDs should be stable for identical input.
    const aIds = Array.from(buildNodeHashMap(a).keys()).sort();
    const bIds = Array.from(buildNodeHashMap(b).keys()).sort();
    expect(aIds).toEqual(bIds);
  });

  it('produces node-level deltas when content changes', () => {
    const xmd1 = ['@ Title', '', 'Hello world.'].join('\n');
    const xmd2 = ['@ Title', '', 'Hello changed.'].join('\n');

    const ir1 = parseXmdToIr({ docId: 'doc-2', xmd: xmd1 });
    const ir2 = parseXmdToIr({ docId: 'doc-2', xmd: xmd2 });

    const snap1 = makeSnapshotFromIr(ir1);
    const snap2 = makeSnapshotFromIr(ir2);
    const delta = computeIrDelta(snap1.nodeHash, snap2.nodeHash);

    expect(delta.added.length).toBe(0);
    expect(delta.removed.length).toBe(0);
    expect(delta.changed.length).toBeGreaterThan(0);
  });
});


