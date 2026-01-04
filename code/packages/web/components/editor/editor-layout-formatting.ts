import { useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import type { FormatType } from './floating-format-menu';

type CursorPosition = { line: number; column: number } | null;
type SelectionRefValue = { from: number; to: number; text: string } | null;
type MutableRef<T> = { current: T };

type HistoryEntry = {
  content: string;
  cursorPosition: CursorPosition;
  selection: SelectionRefValue;
  timestamp: number;
};

type UndoRedoApi = {
  addToHistory: (entry: HistoryEntry) => void;
};

export type EditorLayoutFormatHandlerParams = {
  content: string;
  updateContent: (next: string) => void;
  selectedVersion: number | null;
  latestVersion: number | null;
  cursorPosition: CursorPosition;
  editFormat: 'markdown' | 'latex';
  handleContentChange: (next: string) => void;
  changeTracking: { isTracking: boolean };
  undoRedo: UndoRedoApi;
  latexUndoRedo: UndoRedoApi;

  editorViewRef: MutableRef<EditorView | null>;
  currentSelectionRef: MutableRef<SelectionRefValue>;
  isUserInputRef: MutableRef<boolean>;
  debounceTimeoutRef: MutableRef<NodeJS.Timeout | null>;
  latexDebounceTimeoutRef: MutableRef<NodeJS.Timeout | null>;
  previousContentForHistoryRef: MutableRef<string>;
  previousLatexForHistoryRef: MutableRef<string>;
};

export function useEditorFormatHandler(params: EditorLayoutFormatHandlerParams) {
  const {
    content,
    updateContent,
    selectedVersion,
    latestVersion,
    cursorPosition,
    editFormat,
    handleContentChange,
    changeTracking,
    undoRedo,
    latexUndoRedo,
    editorViewRef,
    currentSelectionRef,
    isUserInputRef,
    debounceTimeoutRef,
    latexDebounceTimeoutRef,
    previousContentForHistoryRef,
    previousLatexForHistoryRef,
  } = params;

  return useCallback(
    (format: FormatType) => {
      // Don't allow formatting if viewing an older version
      // Allow formatting if selectedVersion === null (latest) or selectedVersion === latestVersion
      if (selectedVersion !== null && latestVersion !== null && selectedVersion !== latestVersion) {
        return; // Don't allow formatting older versions
      }

      // Formatting is a user edit: apply to the active edit surface (MD or LaTeX) and record history.
      const applyUserEdit = (nextText: string) => {
        // Mark as user input so the "external content change" effect does not clear history
        isUserInputRef.current = true;

        // Capture cursor position if available
        let currentCursorPos = cursorPosition;
        if (editorViewRef.current && !currentCursorPos) {
          try {
            const selection = editorViewRef.current.state.selection.main;
            const line = editorViewRef.current.state.doc.lineAt(selection.head);
            currentCursorPos = { line: line.number, column: selection.head - line.from + 1 };
          } catch {
            // ignore
          }
        }

        if (editFormat === 'latex') {
          // Cancel any pending LaTeX typing history entry to avoid duplicates/out-of-order.
          if (latexDebounceTimeoutRef.current) {
            clearTimeout(latexDebounceTimeoutRef.current);
            latexDebounceTimeoutRef.current = null;
          }
          // Prevent the LaTeX typing debounce from adding another identical entry.
          previousLatexForHistoryRef.current = nextText;

          // Apply to LaTeX surface (this also re-derives XMD).
          handleContentChange(nextText);

          if (!changeTracking.isTracking) {
            latexUndoRedo.addToHistory({
              content: nextText,
              cursorPosition: currentCursorPos,
              selection: currentSelectionRef.current,
              timestamp: Date.now(),
            });
          }
          return;
        }

        // Markdown surface
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
          debounceTimeoutRef.current = null;
        }
        updateContent(nextText);

        if (!changeTracking.isTracking) {
          undoRedo.addToHistory({
            content: nextText,
            cursorPosition: currentCursorPos,
            selection: currentSelectionRef.current,
            timestamp: Date.now(),
          });
          previousContentForHistoryRef.current = nextText;
        }
      };

      // Always prefer CodeMirror's current doc + selection to avoid stale indices/content
      const view = editorViewRef.current;
      const baseContent = view ? view.state.doc.toString() : content;
      const cmSelection = view?.state.selection.main ?? null;

      // Resolve a selection range in document coordinates (prefer stored selection, fallback to CodeMirror selection)
      const from = cmSelection ? Math.min(cmSelection.from, cmSelection.to) : null;
      const to = cmSelection ? Math.max(cmSelection.from, cmSelection.to) : null;

      const hasRange = typeof from === 'number' && typeof to === 'number' && from >= 0 && to >= 0 && to > from;

      const applyHeadingToRange = (level: number | null) => {
        if (!view) return;
        const doc = view.state.doc;
        const rangeFrom = typeof from === 'number' ? from : view.state.selection.main.head;
        const rangeTo = typeof to === 'number' ? to : rangeFrom;

        const startLine = doc.lineAt(rangeFrom);
        const endLine = doc.lineAt(rangeTo);

        const lines: Array<{ from: number; to: number; text: string }> = [];
        for (let n = startLine.number; n <= endLine.number; n++) {
          const l = doc.line(n);
          lines.push({ from: l.from, to: l.to, text: l.text });
        }

        const replaceLine = (lineText: string) => {
          const trimmed = lineText.trimStart();
          if (editFormat === 'latex') {
            // Strip existing heading-ish commands.
            const stripLatex = (t: string) => {
              const m =
                /^\\(title|section|subsection|subsubsection)\{([\s\S]*)\}\s*$/.exec(t) ||
                /^\\(title|section|subsection|subsubsection)\{([\s\S]*)\}\s*$/.exec(t.trim());
              if (m) return String(m[2] ?? '');
              return t.replace(/^\s+/, '');
            };
            const core = stripLatex(trimmed);
            if (level === null) return core;
            if (level === 0) return core;
            const cmd = level === 1 ? '\\section' : level === 2 ? '\\subsection' : '\\subsubsection';
            return `${cmd}{${core}}`;
          }

          const stripped = lineText.replace(/^\s*(?:@\s+|#{1,6}\s+)/, '');
          if (level === null) return stripped; // "Normal"
          const hashes = '#'.repeat(level);
          return `${hashes} ${stripped}`;
        };

        // Build new document content by editing from bottom to top to keep indices valid.
        let next = baseContent;
        for (let i = lines.length - 1; i >= 0; i--) {
          const l = lines[i];
          const replaced = replaceLine(l.text);
          next = next.slice(0, l.from) + replaced + next.slice(l.to);
        }
        applyUserEdit(next);
      };

      const applyTitleToLine = () => {
        if (!view) return;
        const doc = view.state.doc;
        const pos = typeof from === 'number' ? from : view.state.selection.main.head;
        const l = doc.lineAt(pos);
        if (editFormat === 'latex') {
          const stripped = l.text
            .replace(/^\s*\\(title|section|subsection|subsubsection)\{/, '')
            .replace(/\}\s*$/, '');
          const replaced = `\\title{${stripped}}`;
          const next = baseContent.slice(0, l.from) + replaced + baseContent.slice(l.to);
          applyUserEdit(next);
          return;
        }
        const stripped = l.text.replace(/^\s*(?:@\s+|#{1,6}\s+)/, '');
        const replaced = `@ ${stripped}`;
        const next = baseContent.slice(0, l.from) + replaced + baseContent.slice(l.to);
        applyUserEdit(next);
      };

      if (hasRange) {
        if (format === 'title') return applyTitleToLine();
        if (format === 'heading1') return applyHeadingToRange(1);
        if (format === 'heading2') return applyHeadingToRange(2);
        if (format === 'heading3') return applyHeadingToRange(3);
        if (format === 'paragraph') return applyHeadingToRange(null);

        // Format selected text using exact positions from CodeMirror
        let formattedText = '';
        const selectedText = baseContent.slice(from!, to!);
        switch (format) {
          case 'bold':
            formattedText = editFormat === 'latex' ? `\\textbf{${selectedText}}` : `**${selectedText}**`;
            break;
          case 'italic':
            formattedText = editFormat === 'latex' ? `\\emph{${selectedText}}` : `*${selectedText}*`;
            break;
          case 'underline':
            formattedText = editFormat === 'latex' ? `\\underline{${selectedText}}` : `<u>${selectedText}</u>`;
            break;
          case 'superscript':
            formattedText = editFormat === 'latex' ? `\\textsuperscript{${selectedText}}` : `<sup>${selectedText}</sup>`;
            break;
          case 'subscript':
            formattedText = editFormat === 'latex' ? `\\textsubscript{${selectedText}}` : `<sub>${selectedText}</sub>`;
            break;
          case 'code':
            formattedText = editFormat === 'latex' ? `\\texttt{${selectedText}}` : `\`${selectedText}\``;
            break;
          case 'link':
            // Use an absolute placeholder so clicking in preview doesn't navigate the SPA route
            formattedText =
              editFormat === 'latex'
                ? `\\href{https://example.com}{${selectedText}}`
                : `[${selectedText}](https://example.com)`;
            break;
        }

        // Replace using exact positions from CodeMirror
        const newContent = baseContent.slice(0, from!) + formattedText + baseContent.slice(to!);
        applyUserEdit(newContent);
      } else {
        if (format === 'title') return applyTitleToLine();
        if (format === 'heading1') return applyHeadingToRange(1);
        if (format === 'heading2') return applyHeadingToRange(2);
        if (format === 'heading3') return applyHeadingToRange(3);
        if (format === 'paragraph') return applyHeadingToRange(null);

        // No selection - insert placeholder at cursor position (fallback to end)
        let placeholder = '';
        switch (format) {
          case 'bold':
            placeholder = editFormat === 'latex' ? '\\textbf{}' : '****';
            break;
          case 'italic':
            placeholder = editFormat === 'latex' ? '\\emph{}' : '**';
            break;
          case 'underline':
            placeholder = editFormat === 'latex' ? '\\underline{}' : '<u></u>';
            break;
          case 'superscript':
            placeholder = editFormat === 'latex' ? '\\textsuperscript{}' : '<sup></sup>';
            break;
          case 'subscript':
            placeholder = editFormat === 'latex' ? '\\textsubscript{}' : '<sub></sub>';
            break;
          case 'code':
            placeholder = editFormat === 'latex' ? '\\texttt{}' : '``';
            break;
          case 'link':
            placeholder = editFormat === 'latex' ? '\\href{https://example.com}{}' : '[]()';
            break;
        }
        const insertPos = cmSelection ? cmSelection.head : content.length;
        const safeInsertPos = Math.min(Math.max(0, insertPos), baseContent.length);
        const nextText = baseContent.slice(0, safeInsertPos) + placeholder + baseContent.slice(safeInsertPos);
        applyUserEdit(nextText);
      }
    },
    [
      content,
      updateContent,
      selectedVersion,
      latestVersion,
      cursorPosition,
      undoRedo,
      latexUndoRedo,
      editFormat,
      handleContentChange,
      changeTracking.isTracking,
      editorViewRef,
      currentSelectionRef,
      isUserInputRef,
      debounceTimeoutRef,
      latexDebounceTimeoutRef,
      previousContentForHistoryRef,
      previousLatexForHistoryRef,
    ]
  );
}


