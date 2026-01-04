/**
 * InsertFigureWizard tests
 * Goal: cover MD vs LaTeX generation paths + key UX rules.
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InsertFigureWizard } from '../inline-wizards/insert-figure-wizard';

vi.mock('@/lib/api/client', () => ({
  api: {
    ai: {
      images: {
        generate: vi.fn(),
      },
      inline: {
        generate: vi.fn(),
      },
    },
    assets: {
      upload: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api/client';

function makeProps(params: { editFormat: 'markdown' | 'latex' }) {
  return {
    ctx: {
      option: { id: 'insert-figure', label: 'Insert figure', group: 'Structure' } as any,
      documentId: 'doc-1',
      editFormat: params.editFormat,
      content: '',
      cursorPosition: { line: 1, column: 1 },
      scope: { kind: 'cursor', text: 'Quantum Girl' },
    },
    onCancel: vi.fn(),
    onCloseAll: vi.fn(),
    onPreview: vi.fn(async () => ({ operations: [], previewText: '', newContent: '' })),
    onPreviewInsert: vi.fn(async ({ content }) => ({ operations: [], previewText: content, newContent: content })),
    onApply: vi.fn(async () => {}),
  };
}

describe('InsertFigureWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides the "What should the figure show?" input in Upload mode', async () => {
    const props = makeProps({ editFormat: 'markdown' });
    render(<InsertFigureWizard {...(props as any)} />);

    fireEvent.click(screen.getByText('Upload'));
    expect(screen.queryByText('What should the figure show?')).toBeNull();
  });

  it('inserts XMD in markdown mode (no caption when Caption is unchecked)', async () => {
    (api.ai.images.generate as any).mockResolvedValue({ mimeType: 'image/png', b64: 'AAA' });
    (api.assets.upload as any).mockResolvedValue({ ref: 'zadoox-asset://k.png' });

    const props = makeProps({ editFormat: 'markdown' });
    render(<InsertFigureWizard {...(props as any)} />);

    // Generate image (uses scope prefill)
    fireEvent.click(screen.getByText('Generate image'));

    await waitFor(() => expect(api.ai.images.generate).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Insert')).toBeInTheDocument());

    // Set width preset to Medium (50%)
    fireEvent.click(screen.getByText('Advanced'));
    fireEvent.click(screen.getByText('Medium'));

    fireEvent.click(screen.getByText('Insert'));

    await waitFor(() => expect(api.assets.upload).toHaveBeenCalled());
    await waitFor(() => expect(props.onPreviewInsert).toHaveBeenCalled());

    const insertArg = (props.onPreviewInsert as any).mock.calls[0][0].content as string;
    expect(insertArg).toContain('![]('); // empty alt => no caption
    expect(insertArg).toContain('zadoox-asset://k.png');
    expect(insertArg).toContain('width="50%"');
  });

  it('inline placement defaults to left align (so text wraps) and emits placement/align attrs in XMD', async () => {
    (api.ai.images.generate as any).mockResolvedValue({ mimeType: 'image/png', b64: 'AAA' });
    (api.assets.upload as any).mockResolvedValue({ ref: 'zadoox-asset://k.png' });

    const props = makeProps({ editFormat: 'markdown' });
    render(<InsertFigureWizard {...(props as any)} />);

    fireEvent.click(screen.getByText('Generate image'));
    await waitFor(() => expect(screen.getByText('Insert')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Advanced'));
    fireEvent.click(screen.getByText('Inline'));

    // Center should be hidden in inline mode, and align defaults to left.
    expect(screen.queryByText('Center')).toBeNull();

    fireEvent.click(screen.getByText('Insert'));
    await waitFor(() => expect(props.onPreviewInsert).toHaveBeenCalled());
    const insertArg = (props.onPreviewInsert as any).mock.calls[0][0].content as string;
    expect(insertArg).toContain('placement="inline"');
    expect(insertArg).toContain('align="left"');
  });

  it('inserts LaTeX figure in latex mode and uses caption only when Caption is enabled', async () => {
    (api.ai.images.generate as any).mockResolvedValue({ mimeType: 'image/png', b64: 'AAA' });
    (api.assets.upload as any).mockResolvedValue({ ref: 'zadoox-asset://k.png' });

    const props = makeProps({ editFormat: 'latex' });
    render(<InsertFigureWizard {...(props as any)} />);

    // Enable caption and type it
    fireEvent.click(screen.getByLabelText('Caption'));
    fireEvent.change(screen.getByPlaceholderText('Caption'), { target: { value: 'Quantum Girl' } });

    fireEvent.click(screen.getByText('Generate image'));
    await waitFor(() => expect(screen.getByText('Insert')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Advanced'));
    fireEvent.click(screen.getByText('Medium'));

    fireEvent.click(screen.getByText('Insert'));
    await waitFor(() => expect(props.onPreviewInsert).toHaveBeenCalled());
    const insertArg = (props.onPreviewInsert as any).mock.calls[0][0].content as string;

    expect(insertArg).toContain('\\begin{figure}');
    expect(insertArg).toContain('\\includegraphics');
    expect(insertArg).toContain('0.500\\textwidth');
    expect(insertArg).toContain('\\caption{Quantum Girl}');
  });
});


