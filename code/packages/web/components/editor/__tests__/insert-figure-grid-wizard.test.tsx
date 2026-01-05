/**
 * InsertFigureGridWizard tests
 * Goal: cover XMD vs LaTeX insertion + per-cell workflow basics.
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InsertFigureGridWizard } from '../inline-wizards/insert-figure-grid-wizard';

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

function makeProps(params: { editMode: 'markdown' | 'latex' }) {
  return {
    ctx: {
      option: { id: 'insert-figure-grid', label: 'Insert figure grid', group: 'Structure' } as any,
      documentId: 'doc-1',
      editMode: params.editMode,
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

describe('InsertFigureGridWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts XMD grid with ::: header and delimiters', async () => {
    (api.ai.images.generate as any).mockResolvedValue({ mimeType: 'image/png', b64: 'AAA' });
    (api.ai.inline.generate as any).mockResolvedValue({ content: 'Cap A' });
    (api.assets.upload as any).mockResolvedValue({ ref: 'zadoox-asset://a.png' });

    const props = makeProps({ editMode: 'markdown' });
    render(<InsertFigureGridWizard {...(props as any)} />);

    // Provide "what" (prefilled by scope) and generate for cell 1,1
    fireEvent.change(screen.getByPlaceholderText('Prefilled from scope (editable)'), {
      target: { value: 'Quantum Girl' },
    });
    fireEvent.click(screen.getByLabelText('Generate caption'));
    fireEvent.click(screen.getByText('Generate for this cell'));
    await waitFor(() => expect(api.ai.images.generate).toHaveBeenCalled());
    await waitFor(() => expect(api.ai.inline.generate).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText('Image set').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insert grid' })).not.toBeDisabled());

    fireEvent.click(screen.getByText('Insert grid'));
    await waitFor(() => expect(api.assets.upload).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(props.onPreviewInsert).toHaveBeenCalled());

    const insertArg = (props.onPreviewInsert as any).mock.calls[0][0].content as string;
    expect(insertArg).toContain('::: cols=2');
    expect(insertArg).toContain('|||');
    expect(insertArg).toContain('![');
    expect(insertArg).toContain('zadoox-asset://a.png');
    expect(insertArg).toContain(':::');
  });

  it('inserts LaTeX grid with figure+tabular and optional caption', async () => {
    (api.ai.images.generate as any).mockResolvedValue({ mimeType: 'image/png', b64: 'AAA' });
    (api.assets.upload as any).mockResolvedValue({ ref: 'zadoox-asset://a.png' });

    const props = makeProps({ editMode: 'latex' });
    render(<InsertFigureGridWizard {...(props as any)} />);

    fireEvent.change(screen.getByPlaceholderText('Figure grid caption'), { target: { value: 'Grid cap' } });
    fireEvent.change(screen.getByPlaceholderText('Prefilled from scope (editable)'), {
      target: { value: 'Quantum Girl' },
    });

    fireEvent.click(screen.getByText('Generate for this cell'));
    await waitFor(() => expect(api.ai.images.generate).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByText('Image set').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insert grid' })).not.toBeDisabled());

    fireEvent.click(screen.getByText('Insert grid'));
    await waitFor(() => expect(props.onPreviewInsert).toHaveBeenCalled());

    const insertArg = (props.onPreviewInsert as any).mock.calls[0][0].content as string;
    expect(insertArg).toContain('\\begin{figure}');
    expect(insertArg).toContain('\\begin{tabular}{cc}');
    expect(insertArg).toContain('\\includegraphics');
    expect(insertArg).toContain('\\caption{Grid cap}');
  });
});


