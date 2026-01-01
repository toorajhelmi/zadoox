import { describe, it, expect } from 'vitest';
import { getAllQuickOptions, getContextOptions } from '../context-options';

describe('context-options', () => {
  it('returns start-of-doc suggestions when cursor is before any text', () => {
    const opts = getContextOptions({
      documentStyle: 'other',
      cursorPosition: { line: 1, column: 1 },
      content: '',
      adjacentBlocks: { before: null, after: null },
    });

    const ids = opts.slice(0, 5).map((o) => o.id);
    expect(ids).toContain('gen-add-abstract');
    expect(ids).toContain('gen-add-introduction');
  });

  it('returns end-of-doc suggestion to add conclusion when missing', () => {
    const content = '# Title\n\n## Introduction\n\nSome text.\n';
    const opts = getContextOptions({
      documentStyle: 'other',
      cursorPosition: { line: content.split('\n').length, column: 1 },
      content,
      adjacentBlocks: { before: 'Some text.', after: null },
    });

    expect(opts.map((o) => o.id)).toContain('gen-add-conclusion');
  });

  it('includes a global catalog for the searchable picker', () => {
    const all = getAllQuickOptions();
    expect(all.length).toBeGreaterThan(5);
    expect(all.map((o) => o.id)).toContain('gen-insert-figure');
  });
});


