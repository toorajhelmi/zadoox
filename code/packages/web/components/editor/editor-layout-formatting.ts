import { useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import type { FormatType } from './floating-format-menu';
import { getSurfaceSyntax } from './editor-surface';
import { ensureLatexPreambleForLatexContent } from './latex-preamble';

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
  editMode: 'markdown' | 'latex';
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
    editMode,
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
      const syntax = getSurfaceSyntax(editMode);
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

        if (editMode === 'latex') {
          // Cancel any pending LaTeX typing history entry to avoid duplicates/out-of-order.
          if (latexDebounceTimeoutRef.current) {
            clearTimeout(latexDebounceTimeoutRef.current);
            latexDebounceTimeoutRef.current = null;
          }
          // Keep LaTeX history + "external change" detection consistent with the actual LaTeX surface.
          // EditorLayout will also run `ensureLatexPreambleForLatexContent` on change; do it here too so:
          // - undo history entries match `latexDraft`
          // - previousLatexForHistoryRef matches the final draft, preventing the history-clear effect
          const ensured = ensureLatexPreambleForLatexContent(nextText);
          const nextLatex = ensured.latex;
          // Prevent the LaTeX typing debounce from adding another identical entry.
          previousLatexForHistoryRef.current = nextLatex;

          // Apply to LaTeX surface.
          handleContentChange(nextLatex);

          if (!changeTracking.isTracking) {
            latexUndoRedo.addToHistory({
              content: nextLatex,
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

        const replaceLine = (lineText: string) => syntax.replaceLineAsHeading(lineText, level);

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
        const replaced = syntax.replaceLineAsTitle(l.text);
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
        if (format === 'bold' || format === 'italic' || format === 'underline' || format === 'superscript' || format === 'subscript' || format === 'code' || format === 'link') {
          formattedText = syntax.wrapInline(format, selectedText);
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
        if (format === 'bold' || format === 'italic' || format === 'underline' || format === 'superscript' || format === 'subscript' || format === 'code' || format === 'link') {
          placeholder = syntax.placeholderForInline(format);
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
      editMode,
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


