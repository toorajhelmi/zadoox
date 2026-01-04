/**
 * CodeMirrorEditor tests
 * Goal: cover selectionExtension + floating format menu + format application.
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

let lastCmProps: any = null;

vi.mock('next/dynamic', () => ({
  default: () => {
    return (props: any) => {
      lastCmProps = props;
      return <div data-testid="mock-codemirror" />;
    };
  },
}));

vi.mock('@codemirror/lang-markdown', () => ({ markdown: () => 'md-ext' }));
vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: {} }));

vi.mock('@codemirror/view', () => {
  class GutterMarker {
    eq(_other: any) {
      return false;
    }
    toDOM() {
      return document.createTextNode('');
    }
  }
  return {
    EditorView: {
      lineWrapping: 'lineWrapping',
      updateListener: { of: (cb: any) => cb },
    },
    gutter: (opts: any) => opts,
    GutterMarker,
  };
});

import { CodeMirrorEditor } from '../codemirror-editor';

describe('CodeMirrorEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    lastCmProps = null;
    Object.defineProperty(window, 'scrollX', { value: 0, writable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  it('shows floating format menu on selection and applies bold formatting', async () => {
    const onChange = vi.fn();
    render(<CodeMirrorEditor value="Hello world" onChange={onChange} />);

    expect(screen.getByTestId('mock-codemirror')).toBeInTheDocument();
    expect(lastCmProps).toBeTruthy();

    const updateListener = (lastCmProps.extensions as any[]).find((x) => typeof x === 'function');
    expect(updateListener).toBeTruthy();

    // Trigger a selection update ("Hello")
    updateListener({
      selectionSet: true,
      view: {
        coordsAtPos: () => ({ left: 10, top: 20 }),
        state: {
          selection: { main: { from: 0, to: 5, head: 5 } },
          doc: { lineAt: () => ({ number: 1, from: 0 }) },
          sliceDoc: (_f: number, _t: number) => 'Hello',
        },
      },
      state: {
        selection: { main: { from: 0, to: 5, head: 5 } },
        sliceDoc: (_f: number, _t: number) => 'Hello',
      },
    });

    // menu shows after debounce 150ms
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    const boldBtn = screen.getByLabelText('Bold');
    fireEvent.click(boldBtn);

    expect(onChange).toHaveBeenCalledWith('**Hello** world');
  });

  it('does not call onChange when readOnly is true', () => {
    const onChange = vi.fn();
    render(<CodeMirrorEditor value="X" onChange={onChange} readOnly={true} />);

    lastCmProps.onChange('Y');
    expect(onChange).not.toHaveBeenCalled();
  });
});


