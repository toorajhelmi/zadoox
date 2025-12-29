'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

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
  const isUndoRedoOperationRef = useRef(false);
  const lastContentRef = useRef<string>(initialContent);

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
        const currentIndex = historyIndex;
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
        let removedCount = 0;
        if (updatedHistory.length > maxHistorySize) {
          // Remove oldest states
          const excess = updatedHistory.length - maxHistorySize;
          removedCount = excess;
          updatedHistory = updatedHistory.slice(excess);
        }
        
        // Update index to point to the last item (new state)
        const newIndex = updatedHistory.length - 1;
        setHistoryIndex(newIndex);
        
        return updatedHistory;
      });
    },
    [historyIndex, maxHistorySize]
  );

  /**
   * Undo: Move back in history
   */
  const undo = useCallback((): EditorState | null => {
    if (historyIndex <= 0) {
      return null; // Already at the beginning
    }

    isUndoRedoOperationRef.current = true;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const previousState = history[newIndex];
    
    if (previousState && onStateChange) {
      onStateChange(previousState);
    }

    // Reset flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isUndoRedoOperationRef.current = false;
    }, 0);

    return previousState || null;
  }, [historyIndex, history, onStateChange]);

  /**
   * Redo: Move forward in history
   */
  const redo = useCallback((): EditorState | null => {
    if (historyIndex >= history.length - 1) {
      return null; // Already at the end
    }

    isUndoRedoOperationRef.current = true;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    const nextState = history[newIndex];
    
    if (nextState && onStateChange) {
      onStateChange(nextState);
    }

    // Reset flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isUndoRedoOperationRef.current = false;
    }, 0);

    return nextState || null;
  }, [historyIndex, history, onStateChange]);

  /**
   * Check if undo is available
   */
  const canUndo = historyIndex > 0;

  /**
   * Check if redo is available
   */
  const canRedo = historyIndex < history.length - 1;

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
    lastContentRef.current = newContent;
  }, []);

  /**
   * Update current state without adding to history
   * Useful for cursor/selection changes that don't modify content
   */
  const updateCurrentState = useCallback(
    (updates: Partial<EditorState>) => {
      setHistory((prevHistory) => {
        const currentIndex = historyIndex;
        const currentState = prevHistory[currentIndex];
        if (!currentState) return prevHistory;

        const updatedState: EditorState = {
          ...currentState,
          ...updates,
          timestamp: Date.now(),
        };

        const newHistory = [...prevHistory];
        newHistory[currentIndex] = updatedState;
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

