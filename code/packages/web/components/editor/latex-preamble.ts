function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureLatexPreambleHasPackages(latex: string, packages: string[]): { latex: string; added: string[] } {
  const src = String(latex ?? '');
  const beginDocIdx = src.indexOf('\\begin{document}');
  if (beginDocIdx < 0) return { latex: src, added: [] };

  const preamble = src.slice(0, beginDocIdx);
  const rest = src.slice(beginDocIdx);

  const wanted = packages
    .map((p) => String(p).trim())
    .filter((p) => p.length > 0);

  const missing = wanted.filter((p) => {
    const re = new RegExp(String.raw`\\usepackage(\[[^\]]+\])?\{${escapeRegExp(p)}\}`);
    return !re.test(preamble);
  });

  if (missing.length === 0) return { latex: src, added: [] };

  const insert = missing.map((p) => `\\usepackage{${p}}`).join('\n') + '\n';
  return { latex: preamble + insert + rest, added: missing };
}

export function ensureLatexPreambleForLatexContent(latex: string): { latex: string; added: string[] } {
  const src = String(latex ?? '');
  const needed: string[] = [];

  // Infer required packages from LaTeX content present in the draft.
  if (src.includes('\\includegraphics')) needed.push('graphicx');
  if (src.includes('\\begin{subfigure}') || src.includes('\\end{subfigure}')) needed.push('subcaption');
  if (src.includes('\\begin{tabularx}') || src.includes('\\end{tabularx}')) needed.push('tabularx', 'array');
  if (src.includes('\\captionof{figure}')) needed.push('caption');
  if (src.includes('\\begin{wrapfigure}') || src.includes('\\end{wrapfigure}')) needed.push('wrapfig');

  // Dedupe while preserving order
  const seen = new Set<string>();
  const deduped = needed.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));

  return ensureLatexPreambleHasPackages(src, deduped);
}


