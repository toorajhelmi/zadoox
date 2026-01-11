/**
 * InsertTableWizard tests
 * Goal: cover basic snippet generation + insertion callback.
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InsertTableWizard } from '../inline-wizards/insert-table-wizard';

function makeProps(params: { editMode: 'markdown' | 'latex' }) {
  return {
    ctx: {
      option: { id: 'insert-table', label: 'Insert table', group: 'Structure' } as any,
      documentId: 'doc-1',
      editMode: params.editMode,
      content: '',
      cursorPosition: { line: 1, column: 1 },
      scope: { kind: 'cursor', text: '' },
    },
    onCancel: vi.fn(),
    onCloseAll: vi.fn(),
    onPreview: vi.fn(async () => ({ operations: [], previewText: '', newContent: '' })),
    onPreviewInsert: vi.fn(async ({ content }) => ({ operations: [], previewText: content, newContent: content })),
    onApply: vi.fn(async () => {}),
  };
}

describe('InsertTableWizard', () => {
  it('inserts an XMD :::table snippet with colSpec', async () => {
    const props = makeProps({ editMode: 'markdown' });
    render(<InsertTableWizard {...(props as any)} />);

    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: '2' } });
    fireEvent.change(screen.getByPlaceholderText('Optional caption'), { target: { value: 'Results' } });

    fireEvent.click(screen.getByRole('button', { name: 'Insert table' }));
    await waitFor(() => expect(props.onPreviewInsert).toHaveBeenCalled());

    const insertArg = (props.onPreviewInsert as any).mock.calls[0][0].content as string;
    expect(insertArg).toContain(':::');
    expect(insertArg).toContain('caption="Results"');
    // ColSpec line should exist (default includes boundaries + L/C/R).
    expect(insertArg).toMatch(/\|L.*C.*R\|/);
    expect(insertArg).toContain('| A | B | C |');
    expect(insertArg).toMatch(/\|\s*---/);
    expect(insertArg).toContain(':::');
  });

  it('disables insertion in LaTeX mode (for now)', async () => {
    const props = makeProps({ editMode: 'latex' });
    render(<InsertTableWizard {...(props as any)} />);
    const btn = screen.getByRole('button', { name: 'Insert table' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});


