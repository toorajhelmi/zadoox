import { describe, expect, it } from 'vitest';
import { parseXmdToIr } from '../../xmd/parser';
import { irToXmd } from '../../ir/to-xmd';
import { irToLatexDocument } from '../to-latex';
import { parseLatexToIr } from '../to-ir';

describe('LaTeX <-> IR <-> XMD round-trips (Phase 12)', () => {
  it('XMD -> IR -> LaTeX emits zadoox-* figure comments (even if trailing text)', () => {
    const xmd = [
      '@ Title',
      '',
      // Note: trailing text after the attr block (this was the regression we fixed).
      '![Cap](zadoox-asset://img){#fig:demo align="right" width="33%" placement="inline" desc="d"}Trailing text',
    ].join('\n');

    const ir = parseXmdToIr({ docId: 'doc-1', xmd });
    const latex = irToLatexDocument(ir);

    expect(latex).toContain('\\begin{figure}');
    expect(latex).toContain('% zadoox-src: zadoox-asset://img');
    expect(latex).toContain('% zadoox-align: right');
    expect(latex).toContain('% zadoox-placement: inline');
    expect(latex).toContain('% zadoox-width: 33\\%');
    expect(latex).toContain('% zadoox-desc: d');
    expect(latex).toContain('\\caption{Cap}');
    expect(latex).toContain('\\label{fig:demo}');
    expect(latex).toContain('\\end{figure}');
  });

  it('LaTeX -> IR -> XMD reconstructs figure attrs from zadoox-* comments', () => {
    const latex = [
      '\\documentclass{article}',
      '\\begin{document}',
      '\\begin{figure}',
      '% zadoox-src: zadoox-asset://img',
      '% zadoox-align: right',
      '% zadoox-placement: inline',
      '% zadoox-width: 33%',
      '% zadoox-desc: d',
      '\\caption{Cap}',
      '\\label{fig:demo}',
      '\\end{figure}',
      '\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-2', latex });
    const xmd = irToXmd(ir);

    expect(xmd).toContain('![Cap](zadoox-asset://img){#fig:demo');
    expect(xmd).toContain('align="right"');
    expect(xmd).toContain('placement="inline"');
    expect(xmd).toContain('width="33%"');
    expect(xmd).toContain('desc="d"');
  });

  it('XMD title/author/date round-trip to LaTeX without injecting missing author/date', () => {
    const xmdWithAll = ['@ Title', '@^ Ada', '@= 1843-01-01', '', 'Hello.'].join('\n');
    const irAll = parseXmdToIr({ docId: 'doc-3', xmd: xmdWithAll });
    const latexAll = irToLatexDocument(irAll);
    expect(latexAll).toContain('\\title{Title}');
    expect(latexAll).toContain('\\author{Ada}');
    expect(latexAll).toContain('\\date{1843-01-01}');
    expect(latexAll).toContain('\\maketitle');

    const xmdNoAuthorDate = ['@ Title', '', 'Hello.'].join('\n');
    const irNo = parseXmdToIr({ docId: 'doc-4', xmd: xmdNoAuthorDate });
    const latexNo = irToLatexDocument(irNo);
    expect(latexNo).toContain('\\title{Title}');
    expect(latexNo).not.toContain('\\author{');
    expect(latexNo).not.toContain('\\date{');
  });

  it('Empty \\date{} / \\author{} are preserved into empty XMD markers', () => {
    const latex = [
      '\\documentclass{article}',
      '\\title{T}',
      '\\author{}',
      '\\date{}',
      '\\begin{document}',
      '\\maketitle',
      '\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-5', latex });
    const xmd = irToXmd(ir);
    expect(xmd).toContain('@ T');
    expect(xmd).toContain('@^');
    expect(xmd).toContain('@=');
  });
});


