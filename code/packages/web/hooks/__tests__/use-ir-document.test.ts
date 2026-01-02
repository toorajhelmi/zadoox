/// <reference types="vitest" />
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIrDocument } from '../use-ir-document';

describe('useIrDocument', () => {
  it('debounces parsing and produces node-level deltas', async () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ xmd }) => useIrDocument({ docId: 'doc-1', xmd, debounceMs: 10, enabled: true }),
      { initialProps: { xmd: '# Title\n\nHello' } }
    );

    // Debounced: not parsed immediately
    expect(result.current.ir).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    expect(result.current.ir).not.toBeNull();
    expect(result.current.delta).not.toBeNull();

    // Change content: should compute changed nodes after debounce
    await act(async () => {
      rerender({ xmd: '# Title\n\nHello changed' });
    });
    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    expect((result.current.delta?.changed.length || 0) + (result.current.delta?.added.length || 0)).toBeGreaterThan(0);

    expect(result.current.changedNodeIds.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});


