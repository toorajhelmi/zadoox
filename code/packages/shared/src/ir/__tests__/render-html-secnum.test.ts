import { describe, expect, it } from 'vitest';
import { renderIrToHtml } from '../render-html';
import type { DocumentNode, SectionNode } from '../types';

describe('renderIrToHtml section numbering metadata', () => {
  it('adds data-zx-secnum to numbered section headings and strips sec: prefix from DOM id', () => {
    const doc: DocumentNode = {
      type: 'document',
      id: 'd',
      docId: 'doc',
      children: [
        {
          type: 'section',
          id: 's1',
          level: 1,
          title: 'Intro',
          label: 'sec:intro',
          children: [],
        } satisfies SectionNode,
        {
          type: 'section',
          id: 's2',
          level: 2,
          title: 'Background',
          label: 'sec:bg',
          children: [],
        } satisfies SectionNode,
      ],
    };

    const html = renderIrToHtml(doc);
    expect(html).toContain('id="sec-intro"');
    expect(html).toContain('data-zx-secnum="1"');
    expect(html).toContain('id="sec-bg"');
    expect(html).toContain('data-zx-secnum="1.1"');
  });
});


