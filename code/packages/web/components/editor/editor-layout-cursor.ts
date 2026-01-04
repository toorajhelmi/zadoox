import { useCallback, useEffect } from 'react';
import type { EditorView } from '@codemirror/view';

export function useEditorCursorScreenPosition(params: {
  editorViewRef: React.RefObject<EditorView | null>;
  editorContainerRef: React.RefObject<HTMLDivElement | null>;
  cursorPosition: { line: number; column: number } | null;
  thinkPanelOpen: boolean;
  inlineAIChatOpen: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  setCursorScreenPosition: (pos: { top: number; left: number } | null) => void;
}) {
  const {
    editorViewRef,
    editorContainerRef,
    cursorPosition,
    thinkPanelOpen,
    inlineAIChatOpen,
    sidebarOpen,
    sidebarWidth,
    setCursorScreenPosition,
  } = params;

  const getCursorScreenPosition = useCallback((): { top: number; left: number } | null => {
    if (!editorViewRef.current || !editorContainerRef.current) return null;

    try {
      const view = editorViewRef.current;
      const selection = view.state.selection.main;
      const pos = selection.head;

      const coords = view.coordsAtPos(pos);
      if (!coords) return null;

      return {
        top: coords.top,
        left: coords.left,
      };
    } catch (error) {
      console.error('Failed to get cursor screen position:', error);
      return null;
    }
  }, [editorContainerRef, editorViewRef]);

  // Update cursor screen position when cursor moves or layout changes.
  // Use requestAnimationFrame to defer update and avoid nested CodeMirror updates.
  useEffect(() => {
    if (cursorPosition && !thinkPanelOpen && !inlineAIChatOpen) {
      requestAnimationFrame(() => {
        try {
          const screenPos = getCursorScreenPosition();
          if (screenPos) {
            setCursorScreenPosition(screenPos);
          }
        } catch {
          // ignore
        }
      });
    }
  }, [
    cursorPosition,
    thinkPanelOpen,
    inlineAIChatOpen,
    sidebarOpen,
    sidebarWidth,
    getCursorScreenPosition,
    setCursorScreenPosition,
  ]);

  return { getCursorScreenPosition };
}


