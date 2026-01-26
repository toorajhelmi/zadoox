import { describe, expect, it } from 'vitest';
import { parseXmdToIr } from '../../xmd/parser';
import { irToXmd } from '../../ir/to-xmd';
import { irToLatexDocument } from '../to-latex';
import { parseLatexToIr } from '../to-ir';

describe('LaTeX <-> IR <-> XMD round-trips (Phase 12)', () => {
  it('XMD -> IR -> LaTeX does not emit wrapfigure for placement="inline" (block-only output)', () => {
    const xmd = [
      '@ Title',
      '',
      // Note: trailing text after the attr block (this was the regression we fixed).
      '![Cap](zadoox-asset://img){#fig:demo align="right" width="33%" placement="inline" desc="d"}Trailing text',
      '',
      'This paragraph should wrap around the inline figure.',
    ].join('\n');

    const ir = parseXmdToIr({ docId: 'doc-1', xmd });
    const latex = irToLatexDocument(ir);

    expect(latex).not.toContain('\\usepackage{wrapfig}');
    expect(latex).not.toContain('\\begin{wrapfigure}');
    expect(latex).toContain('\\begin{figure}');
    expect(latex).toContain('\\includegraphics');
    expect(latex).toContain('\\caption{Cap}');
    expect(latex).toContain('\\label{fig:demo}');
    expect(latex).toContain('\\end{figure}');
  });

  it('LaTeX -> IR -> XMD reconstructs inline placement from wrapfigure + includegraphics (user-authored LaTeX)', () => {
    const latex = [
      '\\documentclass{article}',
      '\\usepackage{wrapfig}',
      '\\begin{document}',
      '\\begin{wrapfigure}{r}{0.33\\textwidth}',
      '\\raggedleft',
      '\\includegraphics[width=\\linewidth]{\\detokenize{assets/img}}',
      '\\caption{Cap}',
      '\\label{fig:demo}',
      '\\end{wrapfigure}',
      '\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-2', latex });
    const xmd = irToXmd(ir);

    expect(xmd).toContain('![Cap](zadoox-asset://img){#fig:demo');
    expect(xmd).toContain('align="right"');
    expect(xmd).toContain('placement="inline"');
    expect(xmd).toContain('width="33%"');
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

  it('LaTeX boilerplate \\end{document} is ignored even with a BOM/zero-width prefix', () => {
    const latex = [
      '\\documentclass{article}',
      '\\begin{document}',
      'Hello.',
      '\uFEFF\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-6', latex });
    const xmd = irToXmd(ir);
    expect(xmd).toContain('Hello.');
    expect(xmd).not.toContain('\\end{document}');
  });

  it('LaTeX comment-only lines are ignored (do not show up in IR/XMD)', () => {
    const latex = [
      '\\documentclass{article}',
      '\\begin{document}',
      '% this is a comment that should not appear',
      'Hello.',
      '% another comment',
      '\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-c1', latex });
    const xmd = irToXmd(ir);
    expect(xmd).toContain('Hello.');
    expect(xmd).not.toContain('this is a comment');
  });

  it('LaTeX preamble macros are ignored (do not show up in IR/XMD)', () => {
    const latex = [
      '\\documentclass{article}',
      '\\PassOptionsToPackage{numbers, compress}{natbib}',
      '\\newcommand\\mc[1]{\\mathcal{#1}}',
      '\\title{T}',
      '\\begin{document}',
      'Hello.',
      '\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-pre-1', latex });
    const xmd = irToXmd(ir);
    expect(xmd).toContain('@ T');
    expect(xmd).toContain('Hello.');
    expect(xmd).not.toContain('PassOptionsToPackage');
    expect(xmd).not.toContain('newcommand');
  });

  it('Multi-line \\author{...} is parsed and multiple authors are preserved', () => {
    const latex = [
      '\\documentclass{article}',
      '\\title{T}',
      '\\author{',
      'Alice \\\\',
      'Bob',
      '}',
      '\\begin{document}',
      '\\maketitle',
      'Hello.',
      '\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-auth-ml-1', latex });
    const xmd = irToXmd(ir);
    expect(xmd).toContain('@^ Alice');
    expect(xmd).toContain('@^ Bob');
  });

  it('NeurIPS-style author separators (\\AND) and \\thanks{...} are cleaned for authors', () => {
    const latex = [
      '\\documentclass{article}',
      '\\title{T}',
      '\\author{Alice\\thanks{Equal contribution.} \\AND Bob}',
      '\\begin{document}',
      '\\maketitle',
      'Hello.',
      '\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-auth-ml-2', latex });
    const xmd = irToXmd(ir);
    expect(xmd).toContain('@^ Alice');
    expect(xmd).toContain('@^ Bob');
    expect(xmd).not.toContain('Equal contribution');
    expect(xmd).not.toContain('\\AND');
  });

  it('Template variants (\\And, \\hspace{...}) are removed from author blocks', () => {
    const latex = [
      '\\documentclass{article}',
      '\\title{T}',
      '\\author{Alice \\And \\hspace{1em} Bob}',
      '\\begin{document}',
      '\\maketitle',
      'Hello.',
      '\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-auth-ml-3', latex });
    const xmd = irToXmd(ir);
    expect(xmd).toContain('@^ Alice');
    expect(xmd).toContain('@^ Bob');
    expect(xmd).not.toContain('\\And');
    expect(xmd).not.toContain('hspace');
  });

  it('center environment text is extracted and formatting macros are stripped', () => {
    const latex = [
      '\\documentclass{article}',
      '\\begin{document}',
      '\\begin{center} \\color{red} \\large Provided proper attribution is provided.\\end{center}',
      '\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-center-1', latex });
    const xmd = irToXmd(ir);
    expect(xmd).toContain('Provided proper attribution is provided.');
    expect(xmd).not.toContain('\\begin{center}');
    expect(xmd).not.toContain('\\color');
    expect(xmd).not.toContain('\\large');

    // Style hint is preserved in IR (even though it doesn't round-trip to XMD).
    const p = ir.children.find((n) => n.type === 'paragraph' && String((n as any).text || '').includes('Provided proper attribution')) as any;
    expect(p?.style?.align).toBe('center');
    expect(p?.style?.color).toBe('red');
    expect(p?.style?.size).toBe('large');
  });

  it('LaTeX abstract environment becomes an "Abstract" section in IR', () => {
    const latex = [
      '\\documentclass{article}',
      '\\title{T}',
      '\\begin{document}',
      '\\begin{abstract}',
      'We propose a method.',
      '\\end{abstract}',
      '\\section{Intro}',
      'Hi.',
      '\\end{document}',
    ].join('\n');

    const ir = parseLatexToIr({ docId: 'doc-abs-1', latex });
    const titles = ir.children.filter((n) => n.type === 'section').map((n) => (n.type === 'section' ? n.title : ''));
    expect(titles).toContain('Abstract');
  });

  it('XMD table -> IR -> LaTeX emits tabularx with caption/label and border color/width (best-effort)', () => {
    const xmd = [
      '@ Title',
      '',
      '::: caption="Results" label="tbl:results" borderStyle="dotted" borderColor="#6b7280" borderWidth="2"',
      // colSpec: 3 cols, single vertical rules everywhere (including outer border)
      '|L|C|R|',
      // top rule
      '-',
      // header + (ignored) pipe-table separator line
      '| A | B | C |',
      '| --- | --- | --- |',
      // rule after header
      '-',
      '| 1 | 2 | 3 |',
      // bottom rule
      '-',
      ':::',
    ].join('\n');

    const ir = parseXmdToIr({ docId: 'doc-tbl-1', xmd });
    const latex = irToLatexDocument(ir);

    // Preamble should include tabular support + xcolor (for \arrayrulecolor + \definecolor).
    expect(latex).toContain('\\usepackage{tabularx}');
    expect(latex).toContain('\\usepackage{array}');
    expect(latex).toContain('\\usepackage[table]{xcolor}');

    // Table float + caption/label.
    expect(latex).toContain('\\begin{table}[h]');
    expect(latex).toContain('\\caption{Results}');
    expect(latex).toContain('\\label{tbl:results}');

    // Border width and color (hex) should be applied (dotted degraded to solid internally).
    expect(latex).toContain('\\definecolor{zdxcol6b7280}{HTML}{6B7280}');
    expect(latex).toContain('\\setlength{\\arrayrulewidth}{2pt}');
    expect(latex).toContain('\\arrayrulecolor{zdxcol6b7280}');
  });

  it('XMD grid -> IR -> LaTeX applies border color/width and emits label when present', () => {
    const xmd = [
      '@ Title',
      '',
      '::: cols="2" caption="Grid Cap" label="grd:demo" borderColor="#6b7280" borderWidth="3"',
      'A | B',
      'C | D',
      ':::',
    ].join('\n');

    const ir = parseXmdToIr({ docId: 'doc-grid-1', xmd });
    const latex = irToLatexDocument(ir);

    expect(latex).toContain('\\usepackage[table]{xcolor}');
    expect(latex).toContain('\\definecolor{zdxcol6b7280}{HTML}{6B7280}');
    expect(latex).toContain('\\setlength{\\arrayrulewidth}{3pt}');
    expect(latex).toContain('\\arrayrulecolor{zdxcol6b7280}');
    expect(latex).toContain('\\caption{Grid Cap}');
    expect(latex).toContain('\\label{grd:demo}');
  });
});


