'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

export interface EditorState {
  content: string;
  cursorPosition: { line: number; column: number } | null;
  selection: { from: number; to: number; text: string } | null;
  timestamp: number;
}

interface UseUndoRedoOptions {
  maxHistorySize?: number;
  onStateChange?: (state: EditorState) => void;
}

const DEFAULT_MAX_HISTORY_SIZE = 50;

/**
 * Hook for managing undo/redo functionality
 * Maintains a history of editor states and allows navigation through them
 */
export function useUndoRedo(initialContent: string, options?: UseUndoRedoOptions) {
  const maxHistorySize = options?.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
  const onStateChange = options?.onStateChange;

  // History stack: [oldest, ..., current-1, current]
  const [history, setHistory] = useState<EditorState[]>([
    {
      content: initialContent,
      cursorPosition: null,
      selection: null,
      timestamp: Date.now(),
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0); // Keep ref in sync with state for synchronous access
  const historyRef = useRef<EditorState[]>([
    {
      content: initialContent,
      cursorPosition: null,
      selection: null,
      timestamp: Date.now(),
    },
  ]);
  const isUndoRedoOperationRef = useRef(false);
  const lastContentRef = useRef<string>(initialContent);

  // Keep ref in sync with state
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Keep historyRef in sync with state (so undo/redo can read synchronously)
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Update lastContentRef when content changes from outside
  useEffect(() => {
    if (!isUndoRedoOperationRef.current) {
      lastContentRef.current = initialContent;
    }
  }, [initialContent]);

  /**
   * Add a new state to the history
   * This is called when the user makes a change
   */
  const addToHistory = useCallback(
    (state: EditorState) => {
      // Don't add to history if this is an undo/redo operation
      if (isUndoRedoOperationRef.current) {
        return;
      }

      setHistory((prevHistory) => {
        // Use ref to get current index synchronously
        const currentIndex = historyIndexRef.current;
        // Remove any states after current index (when undoing and then making a new change)
        const newHistory = prevHistory.slice(0, currentIndex + 1);
        
        // Don't add if the content is the same as the current state
        const currentState = newHistory[currentIndex];
        if (currentState && currentState.content === state.content) {
          return prevHistory; // No change, don't add to history
        }
        
        // Add new state
        let updatedHistory = [...newHistory, state];
        
        // Limit history size
        if (updatedHistory.length > maxHistorySize) {
          // Remove oldest states
          const excess = updatedHistory.length - maxHistorySize;
          updatedHistory = updatedHistory.slice(excess);
        }
        
        // Update index to point to the last item (new state)
        const newIndex = updatedHistory.length - 1;
        setHistoryIndex(newIndex);
        historyIndexRef.current = newIndex; // Update ref immediately
        historyRef.current = updatedHistory; // Update ref immediately
        
        return updatedHistory;
      });
    },
    [maxHistorySize]
  );

  /**
   * Undo: Move back in history
   */
  const undo = useCallback((): EditorState | null => {
    const currentIndex = historyIndexRef.current;
    if (currentIndex <= 0) {
      return null; // Already at the beginning
    }

    isUndoRedoOperationRef.current = true;
    const newIndex = currentIndex - 1;

    const previousState = historyRef.current[newIndex] ?? null;

    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex; // Update ref immediately

    if (previousState && onStateChange) {
      onStateChange(previousState);
    }

    // Reset flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isUndoRedoOperationRef.current = false;
    }, 0);

    return previousState;
  }, [onStateChange]);

  /**
   * Redo: Move forward in history
   */
  const redo = useCallback((): EditorState | null => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;
    if (currentIndex >= currentHistory.length - 1) {
      return null; // Already at the end
    }

    isUndoRedoOperationRef.current = true;
    const newIndex = currentIndex + 1;
    const nextState = currentHistory[newIndex] ?? null;

    setHistoryIndex(newIndex);
    historyIndexRef.current = newIndex; // Update ref immediately

    if (nextState && onStateChange) {
      onStateChange(nextState);
    }

    // Reset flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isUndoRedoOperationRef.current = false;
    }, 0);

    return nextState;
  }, [onStateChange]);

  /**
   * Check if undo is available
   * Compute from both historyIndex and history.length to ensure it updates correctly
   */
  const canUndo = useMemo(() => {
    // Can undo if we have more than one item in history and we're not at the first item
    return history.length > 1 && historyIndex > 0;
  }, [historyIndex, history.length]);

  /**
   * Check if redo is available
   * Compute from both historyIndex and history.length to ensure it updates correctly
   */
  const canRedo = useMemo(() => {
    // Can redo if we're not at the last item
    return historyIndex < history.length - 1;
  }, [historyIndex, history.length]);

  /**
   * Clear history (useful when loading a new document)
   */
  const clearHistory = useCallback((newContent: string) => {
    const newState: EditorState = {
      content: newContent,
      cursorPosition: null,
      selection: null,
      timestamp: Date.now(),
    };
    setHistory([newState]);
    setHistoryIndex(0);
    historyIndexRef.current = 0; // Update ref immediately
    historyRef.current = [newState]; // Update ref immediately
    lastContentRef.current = newContent;
  }, []);

  /**
   * Update current state without adding to history
   * Useful for cursor/selection changes that don't modify content
   */
  const updateCurrentState = useCallback(
    (updates: Partial<EditorState>) => {
      setHistory((prevHistory) => {
        const currentIndex = historyIndexRef.current; // Use ref for synchronous access
        const currentState = prevHistory[currentIndex];
        if (!currentState) return prevHistory;

        const updatedState: EditorState = {
          ...currentState,
          ...updates,
          timestamp: Date.now(),
        };

        const newHistory = [...prevHistory];
        newHistory[currentIndex] = updatedState;
        historyRef.current = newHistory; // Update ref immediately
        return newHistory;
      });
    },
    [historyIndex]
  );


  return {
    addToHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    updateCurrentState,
    currentState: history[historyIndex] || null,
    historySize: history.length,
  };
}

