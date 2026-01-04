/**
 * DraftTab tests
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DraftTab } from '../draft-tab';

vi.mock('@/lib/api/client', () => ({
  api: {
    ai: {
      draft: {
        transform: vi.fn(),
      },
    },
  },
}));

vi.mock('../generated-content-action-modal', () => ({
  GeneratedContentActionModal: (props: any) => {
    if (!props.isOpen) return null;
    return (
      <div data-testid="gen-modal">
        <button onClick={() => props.onSelect('replace')}>Replace</button>
        <button onClick={() => props.onSelect('blend')}>Blend</button>
        <button onClick={props.onCancel}>Cancel</button>
      </div>
    );
  },
}));

import { api } from '@/lib/api/client';

describe('DraftTab', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transforms draft text and uses transformed content when block is empty', async () => {
    (api.ai.draft.transform as any).mockResolvedValue({ content: 'Polished content' });
    const onContentGenerated = vi.fn();

    render(
      <DraftTab
        paragraphId="para-0"
        blockContent=""
        onContentGenerated={onContentGenerated}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Paste notes, copied text, or rough draft here...'), {
      target: { value: 'rough draft' },
    });
    fireEvent.click(screen.getByText('Transform'));

    await waitFor(() => expect(api.ai.draft.transform).toHaveBeenCalled());
    expect(await screen.findByText('Polished content')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Use This'));
    expect(onContentGenerated).toHaveBeenCalledWith('Polished content', 'replace');
  });

  it('shows blend/replace dialog when block has existing content', async () => {
    (api.ai.draft.transform as any).mockResolvedValue({ content: 'Polished content' });
    const onContentGenerated = vi.fn();

    render(
      <DraftTab
        paragraphId="para-0"
        blockContent="Existing"
        onContentGenerated={onContentGenerated}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Paste notes, copied text, or rough draft here...'), {
      target: { value: 'rough draft' },
    });
    fireEvent.click(screen.getByText('Transform'));
    expect(await screen.findByText('Polished content')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Use This'));
    expect(await screen.findByTestId('gen-modal')).toBeInTheDocument();

    // Selecting replace triggers a second transform with block context and calls onContentGenerated
    (api.ai.draft.transform as any).mockResolvedValueOnce({ content: 'Replaced content' });
    fireEvent.click(screen.getByText('Replace'));

    await waitFor(() => expect(onContentGenerated).toHaveBeenCalled());
  });
});


