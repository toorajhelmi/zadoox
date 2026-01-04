/**
 * AIEnhancedEditor tests
 * Goal: exercise hover-driven toolbar dispatch + basic rendering.
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { AIEnhancedEditor } from '../ai-enhanced-editor';

vi.mock('@/hooks/use-ai-analysis', () => ({
  useAIAnalysis: () => ({
    paragraphs: [
      {
        id: 'para-0',
        startLine: 0,
        endLine: 0,
        text: 'Hello world, this is long enough',
      },
    ],
    getAnalysis: () => ({ analysis: { metrics: { clarity: 0.5 } }, lastEdited: new Date() }),
    isAnalyzing: false,
    analyze: vi.fn(),
  }),
}));

vi.mock('@/lib/api/client', () => ({
  api: {
    ai: { action: vi.fn().mockResolvedValue({ result: 'Improved text' }) },
  },
}));

// Keep CodeMirrorEditor lightweight but provide an editorView with dispatch to capture effects.
vi.mock('../codemirror-editor', () => ({
  CodeMirrorEditor: (props: any) => {
    const view = {
      state: {
        doc: {
          length: props.value.length,
          lines: props.value.split('\n').length,
          lineAt: (_pos: number) => ({ text: props.value, from: 0, to: props.value.length, number: 1 }),
          line: (_n: number) => ({ text: props.value, from: 0, to: props.value.length, number: 1 }),
        },
      },
      dispatch: (tr: any) => {
        (globalThis as any).__cmDispatchCalls = ((globalThis as any).__cmDispatchCalls || []).concat([tr]);
      },
      scrollDOM: document.createElement('div'),
      contentDOM: document.createElement('div'),
    };
    props.onEditorViewReady?.(view);
    return <div data-testid="cm" />;
  },
}));

// Prevent Supabase usage from blowing up if embedded image extension is constructed.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) },
  }),
}));

describe('AIEnhancedEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).__cmDispatchCalls = [];
    // Make safeDispatchToolbar run immediately in tests.
    (globalThis as any).requestAnimationFrame = (cb: any) => {
      cb(0);
      return 0;
    };
  });

  it('renders AIIndicators overlay and dispatches toolbar show effect on indicator hover', async () => {
    const { container } = render(
      <AIEnhancedEditor value={'Hello world, this is long enough'} onChange={vi.fn()} />
    );

    const indicator = await waitFor(() => {
      const el = container.querySelector('.ai-indicator') as HTMLElement | null;
      expect(el).toBeTruthy();
      return el!;
    });

    fireEvent.mouseEnter(indicator);

    // Hover should trigger a CodeMirror dispatch with effects (showToolbar)
    await waitFor(() => {
      const calls = (globalThis as any).__cmDispatchCalls as any[];
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.some((c) => c && 'effects' in c && c.effects)).toBe(true);
    });
  });
});


