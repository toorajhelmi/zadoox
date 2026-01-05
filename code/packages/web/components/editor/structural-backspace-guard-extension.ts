import type { Extension } from '@codemirror/state';
import { keymap, type KeyBinding } from '@codemirror/view';

function looksLikeFigureLine(line: string): boolean {
  const t = String(line ?? '').trim();
  // Block-level markdown image line (optionally with an attribute block).
  // Examples:
  // ![Cap](zadoox-asset://x.png)
  // ![Cap](zadoox-asset://x.png){align="center" width="33%"}
  return /^!\[[^\]]*\]\([^)]+\)(\s*\{[^}]*\})?$/.test(t);
}

function looksLikeGridFenceOrDelimiter(line: string): boolean {
  const t = String(line ?? '').trim();
  // Grid fences/delimiters used by our XMD grid syntax.
  if (t === ':::' || t.startsWith('::: ')) return true;
  if (t === '|||' || t.endsWith('|||')) return true;
  if (t === '---' || t.endsWith('---')) return true;
  return false;
}

/**
 * Prevent Backspace from merging a heading line into the preceding figure/grid line.
 *
 * This commonly happens when users delete "extra blank lines" after an embedded figure widget:
 * - They remove the blank line(s)
 * - The next Backspace would join `# Heading` onto the end of the figure line
 * - That breaks our figure parsing and the editor shows raw MD/XMD “leftovers”
 */
export function structuralBackspaceGuardExtension(): Extension {
  const bindings: KeyBinding[] = [
    {
      key: 'Backspace',
      preventDefault: true,
      run(view) {
        const sel = view.state.selection.main;
        if (!sel.empty) return false;

        const line = view.state.doc.lineAt(sel.from);
        // Only guard when cursor is at the very start of a line.
        if (sel.from !== line.from) return false;

        const currentText = String(line.text ?? '');
        // Only relevant for markdown headings (e.g. "# New Section").
        if (!/^\s*#{1,6}\s+/.test(currentText)) return false;

        if (line.number <= 1) return false;
        const prevLine = view.state.doc.line(line.number - 1);
        const prevText = String(prevLine.text ?? '');

        if (looksLikeFigureLine(prevText) || looksLikeGridFenceOrDelimiter(prevText)) {
          // Swallow the backspace to avoid joining the lines.
          return true;
        }
        return false;
      },
    },
  ];

  return keymap.of(bindings);
}


