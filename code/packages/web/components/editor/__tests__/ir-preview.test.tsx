/**
 * Unit tests for IrPreview component
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DocumentNode } from '@zadoox/shared';
import { IrPreview } from '../ir-preview';

describe('IrPreview', () => {
  it('should render IR even when content is empty (LaTeX-first docs)', () => {
    const ir: DocumentNode = {
      id: 'doc',
      type: 'document',
      docId: 'doc-1',
      children: [{ id: 't', type: 'document_title', text: 'Hello' }],
    };

    render(<IrPreview docId="doc-1" content="" ir={ir} />);

    expect(screen.queryByText('No content to preview')).not.toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});


