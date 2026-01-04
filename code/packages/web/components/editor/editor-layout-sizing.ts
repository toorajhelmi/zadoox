import { useCallback, useEffect } from 'react';

export function useEditorLayoutSizing(params: {
  sidebarRef: React.RefObject<HTMLDivElement>;
  editorContainerRef: React.RefObject<HTMLDivElement>;

  isResizingSidebar: boolean;
  setIsResizingSidebar: (v: boolean) => void;
  setSidebarWidth: (w: number) => void;

  isResizingEditorPane: boolean;
  setIsResizingEditorPane: (v: boolean) => void;
  setEditorPaneWidth: (w: number) => void;
}) {
  const {
    sidebarRef,
    editorContainerRef,
    isResizingSidebar,
    setIsResizingSidebar,
    setSidebarWidth,
    isResizingEditorPane,
    setIsResizingEditorPane,
    setEditorPaneWidth,
  } = params;

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, [setIsResizingSidebar]);

  const handleEditorPaneResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingEditorPane(true);
  }, [setIsResizingEditorPane]);

  // Load persisted editor pane width (split mode)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('editor-pane-width');
      if (saved) {
        const next = parseInt(saved, 10);
        if (Number.isFinite(next) && next > 0) {
          setEditorPaneWidth(next);
        }
      }
    } catch {
      // ignore
    }
  }, [setEditorPaneWidth]);

  // Sidebar drag-resize
  useEffect(() => {
    if (!isResizingSidebar) return;

    const MIN_SIDEBAR_WIDTH = 150;
    const MAX_SIDEBAR_WIDTH = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (!sidebarRef.current) return;

      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - sidebarRect.left;
      const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
      setSidebarWidth(clampedWidth);
      localStorage.setItem('editor-sidebar-width', clampedWidth.toString());
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, setIsResizingSidebar, setSidebarWidth, sidebarRef]);

  // Editor/preview splitter drag-resize
  useEffect(() => {
    if (!isResizingEditorPane) return;

    const MIN_EDITOR_WIDTH = 360;
    const MIN_PREVIEW_WIDTH = 360;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (!editorContainerRef.current) return;

      const rect = editorContainerRef.current.getBoundingClientRect();
      const raw = e.clientX - rect.left;
      const maxEditor = Math.max(MIN_EDITOR_WIDTH, rect.width - MIN_PREVIEW_WIDTH);
      const clamped = Math.max(MIN_EDITOR_WIDTH, Math.min(maxEditor, raw));

      setEditorPaneWidth(clamped);
      try {
        localStorage.setItem('editor-pane-width', clamped.toString());
      } catch {
        // ignore
      }
    };

    const handleMouseUp = () => {
      setIsResizingEditorPane(false);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: false });
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [editorContainerRef, isResizingEditorPane, setEditorPaneWidth, setIsResizingEditorPane]);

  return { handleSidebarResizeStart, handleEditorPaneResizeStart };
}


