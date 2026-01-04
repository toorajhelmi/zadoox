import { describe, expect, it } from 'vitest';
import { parseXmdToIr } from '../../xmd/parser';
import { buildNodeHashMap, makeSnapshotFromIr } from '../store';
import { computeIrDelta } from '../delta';
import { irToLatexDocument } from '../../latex/to-latex';

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

  it('parses ::: (grid) into a GridNode with per-cell IR children (stable IDs)', () => {
    const xmd = [
      '@ Title',
      '',
      '::: cols=2 caption="Grid Cap"',
      'Cell A text.',
      '|||',
      '![Cap](zadoox-asset://img){#fig:demo}',
      '---',
      ':::table',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      ':::',
      '|||',
      'Cell D text.',
      ':::',
    ].join('\n');

    const a = parseXmdToIr({ docId: 'doc-grid-1', xmd });
    const b = parseXmdToIr({ docId: 'doc-grid-1', xmd });

    const gridA = a.children.find((n) => n.type === 'grid');
    expect(gridA).toBeTruthy();
    if (!gridA || gridA.type !== 'grid') throw new Error('grid not found');

    expect(gridA.cols).toBe(2);
    expect(gridA.caption).toBe('Grid Cap');
    expect(gridA.rows.length).toBe(2);
    expect(gridA.rows[0]?.length).toBe(2);
    expect(gridA.rows[1]?.length).toBe(2);

    // Ensure cell children were parsed (paragraph + figure + table + paragraph).
    expect(gridA.rows[0]![0]!.children.some((n) => n.type === 'paragraph')).toBe(true);
    expect(gridA.rows[0]![1]!.children.some((n) => n.type === 'figure')).toBe(true);
    expect(gridA.rows[1]![0]!.children.some((n) => n.type === 'table')).toBe(true);
    expect(gridA.rows[1]![1]!.children.some((n) => n.type === 'paragraph')).toBe(true);

    // IDs should be stable for identical input (including inside grid cells).
    const aIds = Array.from(buildNodeHashMap(a).keys()).sort();
    const bIds = Array.from(buildNodeHashMap(b).keys()).sort();
    expect(aIds).toEqual(bIds);
  });

  it('renders ::: (grid) to LaTeX using subfigures for figure-only grids', () => {
    const xmd = [
      '@ Title',
      '',
      '::: cols=2 caption="Grid Cap"',
      '![Cap A](zadoox-asset://img-a){#fig:a width="50%"}',
      '|||',
      '![Cap B](zadoox-asset://img-b){#fig:b width="50%"}',
      ':::',
    ].join('\n');

    const ir = parseXmdToIr({ docId: 'doc-grid-2', xmd });
    const latex = irToLatexDocument(ir);

    // Figure-only grids render as a typical LaTeX figure grid using subfigures.
    expect(latex).toContain('\\usepackage{subcaption}');
    expect(latex).toContain('\\begin{figure}');
    expect(latex).toContain('\\begin{subfigure}');
    expect(latex).toContain('\\includegraphics[width=0.500\\linewidth]{\\detokenize{assets/img-a}}');
    expect(latex).toContain('\\includegraphics[width=0.500\\linewidth]{\\detokenize{assets/img-b}}');
    expect(latex).toContain('\\caption{Cap A}');
    expect(latex).toContain('\\caption{Cap B}');
    expect(latex).toContain('\\caption{Grid Cap}');
  });
});


