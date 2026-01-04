/**
 * AIIndicators tests
 * Focus: paragraph parsing + hover visibility behavior.
 */
/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AIIndicators } from '../ai-indicators';

describe('AIIndicators', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses headings as section blocks and triggers hover callback', () => {
    const onHover = vi.fn();
    const { container } = render(
      <AIIndicators
        content={[
          '# Intro',
          'Line one',
          'Line two',
          '',
          '# Next',
          'Another line',
        ].join('\n')}
        onParagraphHover={onHover}
      />
    );

    const indicators = container.querySelectorAll('.ai-indicator');
    // Expect at least two blocks: section + paragraph
    expect(indicators.length).toBeGreaterThanOrEqual(2);

    fireEvent.mouseEnter(indicators[0] as Element);
    expect(onHover).toHaveBeenCalled();
    expect(onHover.mock.calls[0][0]).toMatch(/^para-\d+$/);
  });

  it('when toolbarVisible is true, only the toolbarParagraphId indicator is visible', () => {
    const { container } = render(
      <AIIndicators
        content={['Para 1', '', 'Para 2'].join('\n')}
        toolbarVisible={true}
        toolbarParagraphId="para-2"
      />
    );

    const indicators = Array.from(container.querySelectorAll('.ai-indicator')) as HTMLElement[];
    expect(indicators.length).toBeGreaterThanOrEqual(2);

    // Only the active one should be fully visible (opacity 1); others should be hidden (opacity 0)
    const visible = indicators.filter((n) => (n.style.opacity || '') === '1');
    expect(visible.length).toBe(1);
    expect(visible[0]!.getAttribute('data-paragraph-id')).toBe('para-2');
  });
});


