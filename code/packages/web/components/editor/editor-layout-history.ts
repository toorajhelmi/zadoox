import { useEffect } from 'react';
import type { EditorView } from '@codemirror/view';
import { useChangeTracking } from '@/hooks/use-change-tracking';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { irToXmd, parseLatexToIr } from '@zadoox/shared';

type CursorPosition = { line: number; column: number } | null;
type SelectionRefValue = { from: number; to: number; text: string } | null;

type HistoryEntry = {
  content: string;
  cursorPosition: CursorPosition;
  selection: SelectionRefValue;
  timestamp: number;
};

type UndoRedoApi = ReturnType<typeof useUndoRedo>;

export function useEditorHistoryAndChangeTracking(params: {
  content: string;
  latexDraft: string;
  actualDocumentId: string | undefined;
  documentId: string;
  documentMetadata: any;

  cursorPosition: CursorPosition;
  setCursorPosition: (p: CursorPosition) => void;
  editorViewRef: React.RefObject<EditorView | null>;
  currentSelectionRef: React.RefObject<SelectionRefValue>;

  isUserInputRef: React.RefObject<boolean>;
  previousContentForHistoryRef: React.RefObject<string>;
  previousLatexForHistoryRef: React.RefObject<string>;

  setLatexDraft: (t: string) => void;
  setDocumentMetadata: React.Dispatch<React.SetStateAction<any>>;
  setContentWithoutSave: (xmd: string) => void;
  updateContent: (xmd: string) => void;

  setPendingChangeContent: (v: { original: string; new: string } | null) => void;

  cleanupInsertedSources: (newContent: string, oldContent: string) => Promise<void>;
  saveDocument: (contentToSave: string, changeType?: 'auto-save' | 'ai-action') => Promise<void>;
}) {
  const {
    content,
    latexDraft,
    actualDocumentId,
    documentId,
    documentMetadata,
    cursorPosition,
    setCursorPosition,
    editorViewRef,
    currentSelectionRef,
    isUserInputRef,
    previousContentForHistoryRef,
    previousLatexForHistoryRef,
    setLatexDraft,
    setDocumentMetadata,
    setContentWithoutSave,
    updateContent,
    setPendingChangeContent,
    cleanupInsertedSources,
    saveDocument,
  } = params;

  const undoRedo: UndoRedoApi = useUndoRedo(content, {
    maxHistorySize: 50,
    onStateChange: (state: HistoryEntry) => {
      isUserInputRef.current = false;
      previousContentForHistoryRef.current = state.content;
      setContentWithoutSave(state.content);
      if (state.cursorPosition && editorViewRef.current) {
        setCursorPosition(state.cursorPosition);
        try {
          const { line, column } = state.cursorPosition;
          const doc = editorViewRef.current.state.doc;
          const lineInfo = doc.line(Math.min(line, doc.lines));
          const pos = lineInfo.from + Math.min(column - 1, lineInfo.length);
          editorViewRef.current.dispatch({
            selection: { anchor: pos, head: pos },
            scrollIntoView: true,
          });
        } catch {
          // ignore
        }
      }
    },
  });

  const latexUndoRedo: UndoRedoApi = useUndoRedo(latexDraft, {
    maxHistorySize: 50,
    onStateChange: (state: HistoryEntry) => {
      isUserInputRef.current = false;
      setLatexDraft(state.content);
      setDocumentMetadata({ ...(documentMetadata as any), lastEditedFormat: 'latex', latex: state.content });
      try {
        const ir = parseLatexToIr({ docId: actualDocumentId || documentId, latex: state.content });
        const nextXmd = irToXmd(ir);
        setContentWithoutSave(nextXmd);
      } catch {
        // keep draft visible even if conversion fails
      }

      if (state.cursorPosition && editorViewRef.current) {
        setCursorPosition(state.cursorPosition);
        try {
          const { line, column } = state.cursorPosition;
          const doc = editorViewRef.current.state.doc;
          const lineInfo = doc.line(Math.min(line, doc.lines));
          const pos = lineInfo.from + Math.min(column - 1, lineInfo.length);
          editorViewRef.current.dispatch({
            selection: { anchor: pos, head: pos },
            scrollIntoView: true,
          });
        } catch {
          // ignore
        }
      }
    },
  });

  const changeTracking = useChangeTracking(content, {
    onApply: async (newContent: string) => {
      await cleanupInsertedSources(newContent, content);
      updateContent(newContent);
      await saveDocument(newContent, 'ai-action');
      setPendingChangeContent(null);

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
      undoRedo.addToHistory({
        content: newContent,
        cursorPosition: currentCursorPos,
        selection: currentSelectionRef.current,
        timestamp: Date.now(),
      });
      previousContentForHistoryRef.current = newContent;
    },
    onCancel: () => {
      setPendingChangeContent(null);
    },
  });

  // Clear undo/redo history when content changes from outside (e.g., loading a different document)
  useEffect(() => {
    if (previousContentForHistoryRef.current !== content && !isUserInputRef.current) {
      undoRedo.clearHistory(content);
      previousContentForHistoryRef.current = content;
    }
    isUserInputRef.current = false;
  }, [content, isUserInputRef, previousContentForHistoryRef, undoRedo]);

  useEffect(() => {
    if (previousLatexForHistoryRef.current !== latexDraft && !isUserInputRef.current) {
      latexUndoRedo.clearHistory(latexDraft);
      previousLatexForHistoryRef.current = latexDraft;
    }
    isUserInputRef.current = false;
  }, [isUserInputRef, latexDraft, latexUndoRedo, previousLatexForHistoryRef]);

  return { undoRedo, latexUndoRedo, changeTracking };
}


