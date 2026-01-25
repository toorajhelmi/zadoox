/**
 * Unit tests for DocumentOutline component (Phase 7)
 * Focus: Core functionality only
 */

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentOutline } from '../document-outline';
import type { DocumentNode } from '@zadoox/shared';

describe('DocumentOutline', () => {
  it('should render "No outline available" when there are no headings', () => {
    const ir: DocumentNode = {
      id: 'doc',
      type: 'document',
      docId: 'doc-1',
      children: [{ id: 'p1', type: 'paragraph', text: 'Just text' }],
    };

    render(<DocumentOutline content="Just text" ir={ir} projectName="My Project" />);

    expect(screen.getByText('No outline available')).toBeInTheDocument();
  });

  it('should render headings when content has headings', () => {
    const ir: DocumentNode = {
      id: 'doc',
      type: 'document',
      docId: 'doc-1',
      children: [
        { id: 't1', type: 'document_title', text: 'My Doc' },
        {
          id: 's1',
          type: 'section',
          level: 1,
          title: 'Introduction',
          children: [
            {
              id: 's2',
              type: 'section',
              level: 2,
              title: 'Getting Started',
              children: [],
            },
          ],
        },
      ],
    };

    render(<DocumentOutline content="# Introduction\n## Getting Started" ir={ir} projectName="My Project" />);

    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('My Doc')).toBeInTheDocument();
  });

  it('should render figures in the outline', () => {
    const ir: DocumentNode = {
      id: 'doc',
      type: 'document',
      docId: 'doc-1',
      children: [
        { id: 't1', type: 'document_title', text: 'My Doc' },
        { id: 's1', type: 'section', level: 1, title: 'Intro', children: [] },
        {
          id: 'f1',
          type: 'figure',
          src: 'x',
          caption: 'A caption',
          label: 'fig:generated-1',
        },
        {
          id: 'f2',
          type: 'figure',
          src: 'x',
          caption: '',
          label: 'fig:generated-2',
        },
      ],
    };

    render(<DocumentOutline content="# Intro" ir={ir} projectName="My Project" />);

    expect(screen.getByText('Figure — A caption')).toBeInTheDocument();
    expect(screen.getByText('Figure 2')).toBeInTheDocument();
    expect(screen.getByText('My Doc')).toBeInTheDocument();
  });

  it('should render an assets folder with referenced zadoox-asset files', () => {
    const ir: DocumentNode = {
      id: 'doc',
      type: 'document',
      docId: 'doc-1',
      children: [
        { id: 't1', type: 'document_title', text: 'My Doc' },
        {
          id: 'f1',
          type: 'figure',
          src: 'zadoox-asset://doc-1__img-1.png',
          caption: 'Has asset',
          label: 'fig:generated-1',
        },
      ],
    };

    render(<DocumentOutline content="" ir={ir} projectName="My Project" />);

    expect(screen.getByText('assets')).toBeInTheDocument();
    expect(screen.getByText('doc-1__img-1.png')).toBeInTheDocument();
  });
});
