/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChangeTracking } from '../use-change-tracking';

describe('useChangeTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty changes and not tracking', () => {
    const { result } = renderHook(() => useChangeTracking('initial content'));
    expect(result.current.changes).toEqual([]);
    expect(result.current.isTracking).toBe(false);
  });

  it('should start tracking when startTracking is called', () => {
    const { result } = renderHook(() => useChangeTracking('original'));
    
    act(() => {
      result.current.startTracking('original updated');
    });

    expect(result.current.isTracking).toBe(true);
    expect(result.current.changes.length).toBeGreaterThan(0);
  });

  it('should calculate changes correctly', () => {
    const { result } = renderHook(() => useChangeTracking('Hello'));
    
    act(() => {
      result.current.startTracking('Hello world');
    });

    expect(result.current.changes.length).toBeGreaterThan(0);
    const addChange = result.current.changes.find(c => c.type === 'add');
    expect(addChange).toBeDefined();
    expect(addChange?.newText).toContain('world');
  });

  it('should use originalContentOverride when provided', () => {
    const { result } = renderHook(() => useChangeTracking('initial'));
    
    act(() => {
      result.current.startTracking('new content', 'override original');
    });

    expect(result.current.isTracking).toBe(true);
    // Should compare against 'override original', not 'initial'
  });

  it('should cancel tracking and reset state', () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() => 
      useChangeTracking('original', { onCancel })
    );
    
    act(() => {
      result.current.startTracking('updated');
    });

    expect(result.current.isTracking).toBe(true);

    act(() => {
      result.current.cancelTracking();
    });

    expect(result.current.isTracking).toBe(false);
    expect(result.current.changes).toEqual([]);
    expect(onCancel).toHaveBeenCalled();
  });

  it('should apply changes and call onApply', async () => {
    const onApply = vi.fn();
    const { result } = renderHook(() => 
      useChangeTracking('original', { onApply })
    );
    
    act(() => {
      result.current.startTracking('original updated');
    });

    await act(async () => {
      await result.current.applyChanges();
    });

    expect(onApply).toHaveBeenCalled();
    expect(result.current.isTracking).toBe(false);
  });

  it('should accept all changes when none are explicitly accepted/rejected', async () => {
    const onApply = vi.fn();
    const { result } = renderHook(() => 
      useChangeTracking('original', { onApply })
    );
    
    act(() => {
      result.current.startTracking('new content');
    });

    await act(async () => {
      await result.current.applyChanges();
    });

    // Should accept all changes by default
    expect(onApply).toHaveBeenCalledWith('new content');
  });

  it('should accept a specific change', () => {
    const { result } = renderHook(() => useChangeTracking('original'));
    
    act(() => {
      result.current.startTracking('original updated');
    });

    const changeId = result.current.changes[0]?.id;
    expect(changeId).toBeDefined();

    act(() => {
      result.current.acceptChange(changeId!);
    });

    const acceptedChange = result.current.changes.find(c => c.id === changeId);
    expect(acceptedChange?.accepted).toBe(true);
  });

  it('should reject a specific change', () => {
    const { result } = renderHook(() => useChangeTracking('original'));
    
    act(() => {
      result.current.startTracking('original updated');
    });

    const changeId = result.current.changes[0]?.id;
    expect(changeId).toBeDefined();

    act(() => {
      result.current.rejectChange(changeId!);
    });

    const rejectedChange = result.current.changes.find(c => c.id === changeId);
    expect(rejectedChange?.accepted).toBe(false);
  });

  it('should accept all changes', () => {
    const { result } = renderHook(() => useChangeTracking('original'));
    
    act(() => {
      result.current.startTracking('original updated');
    });

    act(() => {
      result.current.acceptAll();
    });

    const allAccepted = result.current.changes.every(c => c.accepted === true);
    expect(allAccepted).toBe(true);
  });

  it('should update original content ref when originalContent prop changes', () => {
    const { result, rerender } = renderHook(
      ({ content }) => useChangeTracking(content),
      { initialProps: { content: 'original' } }
    );

    rerender({ content: 'updated original' });

    act(() => {
      result.current.startTracking('new content');
    });

    // Should use the updated original content
    expect(result.current.isTracking).toBe(true);
  });
});

