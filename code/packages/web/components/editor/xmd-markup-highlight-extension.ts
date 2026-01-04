'use client';

import { StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';

/**
 * Adds consistent styling for Zadoox XMD structural markup tokens.
 *
 * Goal: avoid inconsistent syntax coloring for our non-standard markdown markers (e.g. `:::` grids, `@` title),
 * and keep the UI consistent across titles/author/date/sections/grids/figures.
 *
 * NOTE: This is purely visual; it does not change the document.
 */
export function xmdMarkupHighlightExtension() {
  const build = (state: EditorView['state']): DecorationSet => {
    const doc = state.doc;
    const decos: Array<import('@codemirror/state').Range<Decoration>> = [];

    const mark = (from: number, to: number) => {
      if (to <= from) return;
      decos.push(
        Decoration.mark({
          class: 'cm-xmd-markup-token',
        }).range(from, to)
      );
    };

    for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
      const line = doc.line(lineNo);
      const text = line.text ?? '';
      const trimmed = text.trimStart();
      const leadingWs = text.length - trimmed.length;
      const lineStart = line.from;
      const nonWsStart = lineStart + leadingWs;

      // Title / author / date markers: "@ ", "@^ ", "@= "
      if (trimmed.startsWith('@')) {
        const m = /^@(?:\^|=)?\s+/.exec(trimmed);
        if (m) {
          mark(nonWsStart, nonWsStart + m[0].length);
          continue;
        }
      }

      // Markdown heading markers: "# ", "## ", etc.
      const h = /^(#{1,6})\s+/.exec(trimmed);
      if (h) {
        mark(nonWsStart, nonWsStart + h[0].length);
        continue;
      }

      // Grid fences: highlight full fence line (it is structural, not prose).
      if (/^:::\s*/.test(trimmed)) {
        mark(nonWsStart, line.to);
        continue;
      }

      // Grid delimiters on their own line.
      if (trimmed === '|||' || trimmed === '---') {
        mark(nonWsStart, line.to);
        continue;
      }

      // Figure attribute blocks at end of line: "{...}" (common in XMD)
      // Highlight only the attribute block to avoid fighting markdown link coloring for the URL/caption.
      const attrIdx = trimmed.lastIndexOf('{');
      if (attrIdx >= 0 && trimmed.endsWith('}')) {
        const absFrom = nonWsStart + attrIdx;
        mark(absFrom, line.to);
      }
    }

    return Decoration.set(decos, true);
  };

  return StateField.define<DecorationSet>({
    create(state) {
      return build(state);
    },
    update(value, tr) {
      if (!tr.docChanged) return value;
      return build(tr.state);
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}


