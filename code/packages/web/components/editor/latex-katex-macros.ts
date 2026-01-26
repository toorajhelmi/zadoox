/**
 * Extract a conservative subset of LaTeX macro definitions (math-focused) for KaTeX rendering.
 *
 * Goal: improve preview rendering of common academic-paper macros (e.g. \dmodel) without
 * making macros part of the IR.
 *
 * Supported (best-effort):
 * - \newcommand{\foo}{...}
 * - \renewcommand{\foo}{...}
 * - \providecommand{\foo}{...}
 * - \def\foo{...}
 * - \DeclareMathOperator{\foo}{Bar}
 * - \DeclareMathOperator*{\foo}{Bar}
 *
 * Ignored:
 * - Complex/unsafe constructs (\csname, conditionals, file IO, etc.)
 * - Optional-arg defaults
 */
export function extractKatexMacrosFromLatex(latexRaw: string): Record<string, string> {
  const latex = stripComments(String(latexRaw ?? ''));
  const preamble = (() => {
    const idx = latex.indexOf('\\begin{document}');
    if (idx >= 0) return latex.slice(0, idx);
    // For fragment LaTeX (no preamble), still scan a small prefix.
    return latex.slice(0, 12_000);
  })();

  const macros: Record<string, string> = {};

  const isTooComplex = (body: string): boolean => {
    const s = String(body ?? '');
    // Very conservative deny-list.
    return /\\(csname|endcsname|expandafter|edef|xdef|noexpand|write|openout|read|input|include|loop|catcode|if)\b/i.test(s);
  };

  const add = (nameRaw: string, defRaw: string) => {
    const name = normalizeMacroName(nameRaw);
    if (!name) return;
    const def = String(defRaw ?? '').trim();
    if (!def) return;
    if (def.length > 2_000) return; // sanity
    if (isTooComplex(def)) return;
    macros[name] = def;
  };

  // Simple scanners with brace parsing.
  let i = 0;
  while (i < preamble.length) {
    // \newcommand / \renewcommand / \providecommand
    const cmdMatch = /\\(newcommand|renewcommand|providecommand)\*?/y;
    cmdMatch.lastIndex = i;
    const m = cmdMatch.exec(preamble);
    if (m) {
      i = cmdMatch.lastIndex;
      i = skipWs(preamble, i);

      const name = readCommandNameOrBraced(preamble, i);
      if (!name) {
        i += 1;
        continue;
      }
      i = name.end;
      i = skipWs(preamble, i);

      // Optional arg count: [n]
      let argCount: number | null = null;
      if (preamble[i] === '[') {
        const br = readBracketGroup(preamble, i);
        if (br) {
          const n = Number.parseInt(br.value.trim(), 10);
          if (Number.isFinite(n) && n >= 0 && n <= 9) argCount = n;
          i = br.end;
          i = skipWs(preamble, i);
        }
      }

      // Optional default arg [default] (ignore content but skip)
      if (argCount && argCount > 0 && preamble[i] === '[') {
        const br = readBracketGroup(preamble, i);
        if (br) {
          i = br.end;
          i = skipWs(preamble, i);
        }
      }

      const def = readBraceGroup(preamble, i);
      if (!def) {
        i += 1;
        continue;
      }
      i = def.end;
      add(name.value, def.value);
      continue;
    }

    // \def\foo{...}
    if (preamble.startsWith('\\def', i)) {
      i += '\\def'.length;
      i = skipWs(preamble, i);
      const nm = readControlSequence(preamble, i);
      if (!nm) continue;
      i = nm.end;
      // Skip parameter text (e.g. #1#2) until first '{'
      while (i < preamble.length && preamble[i] !== '{') i++;
      const def = readBraceGroup(preamble, i);
      if (!def) continue;
      i = def.end;
      add(nm.value, def.value);
      continue;
    }

    // \DeclareMathOperator{...}{...} / starred
    const opMatch = /\\DeclareMathOperator\*?/y;
    opMatch.lastIndex = i;
    const om = opMatch.exec(preamble);
    if (om) {
      i = opMatch.lastIndex;
      i = skipWs(preamble, i);
      const name = readBraceGroup(preamble, i);
      if (!name) continue;
      i = skipWs(preamble, name.end);
      const text = readBraceGroup(preamble, i);
      if (!text) continue;
      i = text.end;
      // KaTeX supports \operatorname{...}
      add(name.value, `\\operatorname{${text.value}}`);
      continue;
    }

    i += 1;
  }

  return macros;
}

function stripComments(src: string): string {
  const lines = src.split('\n');
  return lines
    .map((ln) => {
      let escaped = false;
      for (let i = 0; i < ln.length; i++) {
        const ch = ln[i]!;
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '%') return ln.slice(0, i);
      }
      return ln;
    })
    .join('\n');
}

function skipWs(s: string, i: number): number {
  let idx = i;
  while (idx < s.length && /\s/.test(s[idx]!)) idx++;
  return idx;
}

function normalizeMacroName(raw: string): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  if (t.startsWith('\\')) return t;
  // Sometimes braces contain just the name without the backslash.
  if (/^[A-Za-z@]+$/.test(t)) return `\\${t}`;
  return null;
}

function readControlSequence(s: string, i: number): { value: string; end: number } | null {
  if (s[i] !== '\\') return null;
  let j = i + 1;
  while (j < s.length && /[A-Za-z@]/.test(s[j]!)) j++;
  if (j === i + 1) return null;
  return { value: s.slice(i, j), end: j };
}

function readCommandNameOrBraced(s: string, i: number): { value: string; end: number } | null {
  if (s[i] === '{') {
    const g = readBraceGroup(s, i);
    if (!g) return null;
    return { value: g.value.trim(), end: g.end };
  }
  return readControlSequence(s, i);
}

function readBraceGroup(s: string, i: number): { value: string; end: number } | null {
  if (s[i] !== '{') return null;
  let depth = 1;
  let j = i + 1;
  const start = j;
  while (j < s.length && depth > 0) {
    const ch = s[j]!;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    j++;
  }
  if (depth !== 0) return null;
  return { value: s.slice(start, j - 1), end: j };
}

function readBracketGroup(s: string, i: number): { value: string; end: number } | null {
  if (s[i] !== '[') return null;
  let j = i + 1;
  const start = j;
  while (j < s.length && s[j] !== ']') j++;
  if (j >= s.length) return null;
  return { value: s.slice(start, j), end: j + 1 };
}


