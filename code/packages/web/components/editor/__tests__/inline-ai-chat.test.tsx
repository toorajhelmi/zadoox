/**
 * InlineAIChat tests
 * Goal: cover option flow + viewport clamping + wizard mounting.
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineAIChat } from '../inline-ai-chat';

vi.mock('@/lib/services/context-options', () => ({
  getAdjacentBlocks: vi.fn(() => ({ previous: 'prev', current: 'cur', next: 'next' })),
  getContextOptions: vi.fn(() => [
    { id: 'insert-figure', label: 'Insert figure', group: 'Structure', wizardKey: 'insert-figure' },
    { id: 'rewrite', label: 'Rewrite', group: 'Transformation' },
    { id: 'translate', label: 'Translate', group: 'Transformation', wizardKey: 'translate' },
  ]),
  getAllQuickOptions: vi.fn(() => [
    { id: 'insert-figure', label: 'Insert figure', group: 'Structure', wizardKey: 'insert-figure' },
    { id: 'rewrite', label: 'Rewrite', group: 'Transformation' },
    { id: 'translate', label: 'Translate', group: 'Transformation', wizardKey: 'translate' },
  ]),
}));

// Make wizards easy to detect
vi.mock('../inline-wizards/insert-figure-wizard', () => ({
  InsertFigureWizard: () => <div data-testid="wizard-insert-figure" />,
}));
vi.mock('../inline-wizards/translate-wizard', () => ({
  TranslateWizard: () => <div data-testid="wizard-translate" />,
}));
vi.mock('../inline-wizards/todo-wizard', () => ({
  TodoWizard: () => <div data-testid="wizard-todo" />,
}));

// jsdom doesn't ship ResizeObserver by default
class MockResizeObserver {
  constructor(private _cb: any) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('InlineAIChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).ResizeObserver = MockResizeObserver as any;
    (globalThis as any).requestAnimationFrame = (cb: any) => {
      cb(0);
      return 0;
    };
    Object.defineProperty(window, 'innerWidth', { value: 300, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 200, writable: true });
  });

  it('clamps position to viewport bounds', async () => {
    render(
      <InlineAIChat
        position={{ top: 1000, left: 1000 }}
        documentId="doc-1"
        editMode="markdown"
        content="Hello"
        cursorPosition={{ line: 1, column: 1 }}
        documentStyle="other" as any
        onClose={vi.fn()}
        onSend={vi.fn()}
        onQuickOption={vi.fn()}
        onPreviewInlineEdit={vi.fn(async () => ({ operations: [], previewText: '', newContent: '' }))}
        onPreviewInsertAtCursor={vi.fn(async ({ content }) => ({ operations: [], previewText: content, newContent: content }))}
        onApplyInlinePreview={vi.fn(async () => {})}
      />
    );

    const container = await waitFor(() => {
      const el = document.querySelector('.fixed.z-50') as HTMLElement | null;
      expect(el).toBeTruthy();
      return el!;
    });

    // With rect width/height effectively 0, maxLeft = 300 - 0 - 16 = 284, maxTop = 200 - 0 - 16 = 184
    expect(container.style.left).toBe('284px');
    expect(container.style.top).toBe('184px');
  });

  it('opens a wizard when clicking a quick option with wizardKey', async () => {
    render(
      <InlineAIChat
        position={{ top: 10, left: 10 }}
        documentId="doc-1"
        editMode="markdown"
        content="Hello"
        cursorPosition={{ line: 1, column: 1 }}
        documentStyle="other" as any
        onClose={vi.fn()}
        onSend={vi.fn()}
        onQuickOption={vi.fn()}
        onPreviewInlineEdit={vi.fn(async () => ({ operations: [], previewText: '', newContent: '' }))}
        onPreviewInsertAtCursor={vi.fn(async ({ content }) => ({ operations: [], previewText: content, newContent: content }))}
        onApplyInlinePreview={vi.fn(async () => {})}
      />
    );

    fireEvent.click(screen.getByText('Insert figure'));
    expect(await screen.findByTestId('wizard-insert-figure')).toBeInTheDocument();
  });

  it('calls onQuickOption and onClose for non-wizard options', async () => {
    const onQuickOption = vi.fn();
    const onClose = vi.fn();

    render(
      <InlineAIChat
        position={{ top: 10, left: 10 }}
        documentId="doc-1"
        editMode="markdown"
        content="Hello"
        cursorPosition={{ line: 1, column: 1 }}
        documentStyle="other" as any
        onClose={onClose}
        onSend={vi.fn()}
        onQuickOption={onQuickOption}
        onPreviewInlineEdit={vi.fn(async () => ({ operations: [], previewText: '', newContent: '' }))}
        onPreviewInsertAtCursor={vi.fn(async ({ content }) => ({ operations: [], previewText: content, newContent: content }))}
        onApplyInlinePreview={vi.fn(async () => {})}
      />
    );

    fireEvent.click(screen.getByText('Rewrite'));
    expect(onQuickOption).toHaveBeenCalledWith(expect.objectContaining({ id: 'rewrite' }));
    expect(onClose).toHaveBeenCalled();
  });
});


