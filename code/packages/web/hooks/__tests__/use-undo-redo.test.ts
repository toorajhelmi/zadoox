/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUndoRedo } from '../use-undo-redo';

describe('useUndoRedo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with initial content', () => {
      const { result } = renderHook(() => useUndoRedo('initial content'));

      expect(result.current.currentState?.content).toBe('initial content');
      expect(result.current.historySize).toBe(1);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('should initialize with empty content', () => {
      const { result } = renderHook(() => useUndoRedo(''));

      expect(result.current.currentState?.content).toBe('');
      expect(result.current.historySize).toBe(1);
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('addToHistory', () => {
    it('should add new state to history', () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      act(() => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      expect(result.current.historySize).toBe(2);
      expect(result.current.currentState?.content).toBe('updated');
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('should not add duplicate content to history', () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      act(() => {
        result.current.addToHistory({
          content: 'initial',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      expect(result.current.historySize).toBe(1);
      expect(result.current.canUndo).toBe(false);
    });

    it('should limit history size to maxHistorySize', () => {
      const { result } = renderHook(() => useUndoRedo('initial', { maxHistorySize: 3 }));

      // Add more than maxHistorySize states
      for (let i = 1; i <= 5; i++) {
        act(() => {
          result.current.addToHistory({
            content: `content ${i}`,
            cursorPosition: null,
            selection: null,
            timestamp: Date.now(),
          });
        });
      }

      expect(result.current.historySize).toBe(3);
      expect(result.current.currentState?.content).toBe('content 5');
    });

    it('should store cursor position and selection', () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      act(() => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: { line: 5, column: 10 },
          selection: { from: 0, to: 7, text: 'updated' },
          timestamp: Date.now(),
        });
      });

      const state = result.current.currentState;
      expect(state?.cursorPosition).toEqual({ line: 5, column: 10 });
      expect(state?.selection).toEqual({ from: 0, to: 7, text: 'updated' });
    });

    it('should not add to history during undo/redo operations', () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      // Add a state
      act(() => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      const initialSize = result.current.historySize;

      // Undo
      act(() => {
        result.current.undo();
      });

      // Try to add during undo operation (simulated by checking if flag prevents it)
      // The hook uses isUndoRedoOperationRef internally, so we can't directly test this
      // But we can verify that undo/redo don't add to history
      expect(result.current.historySize).toBe(initialSize);
    });
  });

  describe('undo', () => {
    it('should undo to previous state', async () => {
      const onStateChange = vi.fn();
      const { result } = renderHook(() =>
        useUndoRedo('initial', { onStateChange })
      );

      await act(async () => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
        expect(result.current.currentState?.content).toBe('updated');
      });

      await act(async () => {
        result.current.undo();
      });

      // Wait for onStateChange to be called first
      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledWith(
          expect.objectContaining({ content: 'initial' })
        );
      });

      // Then wait for state to update
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('initial');
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(true);
      });
    });

    it('should not undo when at the beginning', () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      expect(result.current.canUndo).toBe(false);

      let state: ReturnType<typeof result.current.undo> | null = null;
      act(() => {
        state = result.current.undo();
      });

      expect(state).toBeNull();
      expect(result.current.currentState?.content).toBe('initial');
    });

    it('should restore cursor position on undo', async () => {
      const onStateChange = vi.fn();
      const { result } = renderHook(() =>
        useUndoRedo('initial', { onStateChange })
      );

      await act(async () => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: { line: 2, column: 5 },
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      await act(async () => {
        result.current.undo();
      });

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'initial',
            cursorPosition: null, // Initial state had no cursor position
          })
        );
      });
    });

    it('should allow multiple undos', async () => {
      const { result } = renderHook(() => useUndoRedo('state 0'));

      // Add multiple states
      for (let i = 1; i <= 3; i++) {
        await act(async () => {
          result.current.addToHistory({
            content: `state ${i}`,
            cursorPosition: null,
            selection: null,
            timestamp: Date.now(),
          });
        });
      }

      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 3');
        expect(result.current.canUndo).toBe(true);
      });

      // Undo multiple times
      await act(async () => {
        result.current.undo();
      });
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 2');
      });

      await act(async () => {
        result.current.undo();
      });
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 1');
      });

      await act(async () => {
        result.current.undo();
      });
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 0');
        expect(result.current.canUndo).toBe(false);
      });
    });
  });

  describe('redo', () => {
    it('should redo to next state', async () => {
      const onStateChange = vi.fn();
      const { result } = renderHook(() =>
        useUndoRedo('initial', { onStateChange })
      );

      await act(async () => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
        expect(result.current.currentState?.content).toBe('updated');
      });

      await act(async () => {
        result.current.undo();
      });

      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('initial');
        expect(result.current.canRedo).toBe(true);
      });

      await act(async () => {
        result.current.redo();
      });

      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('updated');
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);
      });

      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'updated' })
      );
    });

    it('should not redo when at the end', async () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      act(() => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.canRedo).toBe(false);
      });

      let state: ReturnType<typeof result.current.redo> | null = null;
      act(() => {
        state = result.current.redo();
      });

      expect(state).toBeNull();
      expect(result.current.currentState?.content).toBe('updated');
    });

    it('should restore cursor position on redo', async () => {
      const onStateChange = vi.fn();
      const { result } = renderHook(() =>
        useUndoRedo('initial', { onStateChange })
      );

      await act(async () => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: { line: 3, column: 8 },
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      await act(async () => {
        result.current.undo();
      });

      await waitFor(() => {
        expect(result.current.canRedo).toBe(true);
      });

      await act(async () => {
        result.current.redo();
      });

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'updated',
            cursorPosition: { line: 3, column: 8 },
          })
        );
      });
    });

    it('should allow multiple redos', async () => {
      const { result } = renderHook(() => useUndoRedo('state 0'));

      // Add multiple states
      for (let i = 1; i <= 3; i++) {
        await act(async () => {
          result.current.addToHistory({
            content: `state ${i}`,
            cursorPosition: null,
            selection: null,
            timestamp: Date.now(),
          });
        });
      }

      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 3');
      });

      // Undo all
      await act(async () => {
        result.current.undo();
      });
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 2');
      });

      await act(async () => {
        result.current.undo();
      });
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 1');
      });

      await act(async () => {
        result.current.undo();
      });
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 0');
        expect(result.current.canRedo).toBe(true);
      });

      // Redo multiple times
      await act(async () => {
        result.current.redo();
      });
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 1');
      });

      await act(async () => {
        result.current.redo();
      });
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 2');
      });

      await act(async () => {
        result.current.redo();
      });
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 3');
        expect(result.current.canRedo).toBe(false);
      });
    });
  });

  describe('undo/redo interaction', () => {
    it('should clear redo history when adding new state after undo', async () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      // Add state and undo
      await act(async () => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      await act(async () => {
        result.current.undo();
      });

      await waitFor(() => {
        expect(result.current.canRedo).toBe(true);
      });

      // Add new state after undo
      await act(async () => {
        result.current.addToHistory({
          content: 'new content',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      // Redo should no longer be available (new branch created)
      await waitFor(() => {
        expect(result.current.canRedo).toBe(false);
        expect(result.current.currentState?.content).toBe('new content');
      });
    });

    it('should maintain correct history after undo and new addition', async () => {
      const { result } = renderHook(() => useUndoRedo('state 0'));

      // Add states: state 0 -> state 1 -> state 2
      await act(async () => {
        result.current.addToHistory({
          content: 'state 1',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      await act(async () => {
        result.current.addToHistory({
          content: 'state 2',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 2');
      });

      // Undo to state 1
      await act(async () => {
        result.current.undo();
      });

      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 1');
      });

      // Add new state (should create: state 0 -> state 1 -> state 3)
      await act(async () => {
        result.current.addToHistory({
          content: 'state 3',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 3');
        expect(result.current.historySize).toBe(3);
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);
      });

      // Undo should go to state 1, not state 2
      await act(async () => {
        result.current.undo();
      });
      await waitFor(() => {
        expect(result.current.currentState?.content).toBe('state 1');
      });
    });
  });

  describe('clearHistory', () => {
    it('should clear history and reset to new content', () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      // Add some history
      act(() => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      act(() => {
        result.current.addToHistory({
          content: 'updated again',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      expect(result.current.historySize).toBe(3);
      expect(result.current.canUndo).toBe(true);

      // Clear history
      act(() => {
        result.current.clearHistory('new content');
      });

      expect(result.current.historySize).toBe(1);
      expect(result.current.currentState?.content).toBe('new content');
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('updateCurrentState', () => {
    it('should update current state without adding to history', () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      const initialSize = result.current.historySize;

      act(() => {
        result.current.updateCurrentState({
          cursorPosition: { line: 10, column: 20 },
        });
      });

      // History size should not change
      expect(result.current.historySize).toBe(initialSize);
      expect(result.current.currentState?.cursorPosition).toEqual({
        line: 10,
        column: 20,
      });
      expect(result.current.currentState?.content).toBe('initial');
    });

    it('should update selection without adding to history', () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      act(() => {
        result.current.updateCurrentState({
          selection: { from: 0, to: 7, text: 'initial' },
        });
      });

      expect(result.current.currentState?.selection).toEqual({
        from: 0,
        to: 7,
        text: 'initial',
      });
      expect(result.current.historySize).toBe(1);
    });
  });

  describe('canUndo and canRedo', () => {
    it('should correctly report canUndo and canRedo states', async () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      // Initially: no undo, no redo
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);

      // After adding: can undo, cannot redo
      await act(async () => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);
      });

      // After undo: cannot undo, can redo
      await act(async () => {
        result.current.undo();
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(true);
      });

      // After redo: can undo, cannot redo
      await act(async () => {
        result.current.redo();
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);
      });
    });
  });

  describe('onStateChange callback', () => {
    it('should call onStateChange when undo is performed', async () => {
      const onStateChange = vi.fn();
      const { result } = renderHook(() =>
        useUndoRedo('initial', { onStateChange })
      );

      await act(async () => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      await act(async () => {
        result.current.undo();
      });

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledTimes(1);
        expect(onStateChange).toHaveBeenCalledWith(
          expect.objectContaining({ content: 'initial' })
        );
      });
    });

    it('should call onStateChange when redo is performed', async () => {
      const onStateChange = vi.fn();
      const { result } = renderHook(() =>
        useUndoRedo('initial', { onStateChange })
      );

      await act(async () => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBe(true);
      });

      await act(async () => {
        result.current.undo();
      });

      await waitFor(() => {
        expect(result.current.canRedo).toBe(true);
      });

      await act(async () => {
        result.current.redo();
      });

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledTimes(2);
        expect(onStateChange).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ content: 'initial' })
        );
        expect(onStateChange).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ content: 'updated' })
        );
      });
    });

    it('should not call onStateChange when adding to history', () => {
      const onStateChange = vi.fn();
      const { result } = renderHook(() =>
        useUndoRedo('initial', { onStateChange })
      );

      act(() => {
        result.current.addToHistory({
          content: 'updated',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      expect(onStateChange).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid addToHistory calls', () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      act(() => {
        for (let i = 1; i <= 10; i++) {
          result.current.addToHistory({
            content: `content ${i}`,
            cursorPosition: null,
            selection: null,
            timestamp: Date.now(),
          });
        }
      });

      // Should have the latest content
      expect(result.current.currentState?.content).toBe('content 10');
      expect(result.current.canUndo).toBe(true);
    });

    it('should handle empty content changes', () => {
      const { result } = renderHook(() => useUndoRedo('initial'));

      act(() => {
        result.current.addToHistory({
          content: '',
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      expect(result.current.currentState?.content).toBe('');
      expect(result.current.canUndo).toBe(true);
    });

    it('should handle very long content', () => {
      const longContent = 'a'.repeat(10000);
      const { result } = renderHook(() => useUndoRedo('initial'));

      act(() => {
        result.current.addToHistory({
          content: longContent,
          cursorPosition: null,
          selection: null,
          timestamp: Date.now(),
        });
      });

      expect(result.current.currentState?.content).toBe(longContent);
      expect(result.current.currentState?.content.length).toBe(10000);
    });
  });
});

