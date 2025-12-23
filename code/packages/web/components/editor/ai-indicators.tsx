'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AIAnalysisResponse, AISuggestion } from '@zadoox/shared';

export type IndicatorState = 'error' | 'warning' | 'suggestion' | 'good' | 'pending';

export interface ParagraphMetadata {
  id: string;
  startLine: number;
  endLine: number;
  text: string;
  analysis?: AIAnalysisResponse;
  lastAnalyzed?: Date;
}

interface AIIndicatorsProps {
  content: string;
  onParagraphHover?: (paragraphId: string | null) => void;
  onIndicatorClick?: (paragraphId: string, indicator: IndicatorState) => void;
  model?: 'openai' | 'auto';
}

/**
 * AI Indicators Component
 * Displays left margin indicators for paragraphs with AI analysis
 */
export function AIIndicators({
  content,
  onParagraphHover,
  onIndicatorClick,
  model = 'auto',
}: AIIndicatorsProps) {
  const [paragraphs, setParagraphs] = useState<ParagraphMetadata[]>([]);
  const [hoveredParagraph, setHoveredParagraph] = useState<string | null>(null);

  // Parse content into paragraphs
  useEffect(() => {
    const lines = content.split('\n');
    const parsed: ParagraphMetadata[] = [];
    let currentParagraph: { startLine: number; text: string } | null = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Empty line ends current paragraph
      if (!trimmed && currentParagraph) {
        parsed.push({
          id: `para-${currentParagraph.startLine}`,
          startLine: currentParagraph.startLine,
          endLine: index - 1,
          text: currentParagraph.text.trim(),
        });
        currentParagraph = null;
      } else if (trimmed) {
        // Start new paragraph or continue current
        if (!currentParagraph) {
          currentParagraph = { startLine: index, text: trimmed };
        } else {
          currentParagraph.text += ' ' + trimmed;
        }
      }
    });

    // Add final paragraph if exists
    if (currentParagraph !== null) {
      parsed.push({
        id: `para-${currentParagraph.startLine}`,
        startLine: currentParagraph.startLine,
        endLine: lines.length - 1,
        text: currentParagraph.text.trim(),
      });
    }

    setParagraphs(parsed);
  }, [content]);

  // Get indicator state for a paragraph
  const getIndicatorState = useCallback((paragraph: ParagraphMetadata): IndicatorState => {
    if (!paragraph.analysis) {
      return 'pending';
    }

    const { quality, suggestions } = paragraph.analysis;

    // Check for errors
    const hasError = suggestions?.some((s) => s.type === 'error');
    if (hasError || quality < 60) {
      return 'error';
    }

    // Check for warnings
    const hasWarning = suggestions?.some((s) => s.type === 'warning');
    if (hasWarning || quality < 80) {
      return 'warning';
    }

    // Check for suggestions
    const hasSuggestion = suggestions?.some((s) => s.type === 'suggestion');
    if (hasSuggestion) {
      return 'suggestion';
    }

    // Good quality
    if (quality >= 80) {
      return 'good';
    }

    return 'pending';
  }, []);

  // Get indicator color
  const getIndicatorColor = useCallback((state: IndicatorState): string => {
    switch (state) {
      case 'error':
        return '#f48771'; // Red
      case 'warning':
        return '#dcdcaa'; // Yellow
      case 'suggestion':
        return '#569cd6'; // Blue
      case 'good':
        return '#4ec9b0'; // Green
      case 'pending':
      default:
        return '#858585'; // Gray
    }
  }, []);

  const handleParagraphHover = useCallback(
    (paragraphId: string | null) => {
      setHoveredParagraph(paragraphId);
      if (onParagraphHover) {
        onParagraphHover(paragraphId);
      }
    },
    [onParagraphHover]
  );

  const handleIndicatorClick = useCallback(
    (paragraphId: string, state: IndicatorState) => {
      if (onIndicatorClick) {
        onIndicatorClick(paragraphId, state);
      }
    },
    [onIndicatorClick]
  );

  return (
    <div className="ai-indicators-column relative h-full w-full pointer-events-none">
      {paragraphs.map((paragraph) => {
        const state = getIndicatorState(paragraph);
        const color = getIndicatorColor(state);
        const isHovered = hoveredParagraph === paragraph.id;

        // Calculate approximate position (simplified - in production, use CodeMirror's line positions)
        const lineHeight = 1.5; // rem
        const topOffset = paragraph.startLine * lineHeight;
        const height = Math.max(0.5, paragraph.endLine - paragraph.startLine + 1) * lineHeight;

        return (
          <div
            key={paragraph.id}
            data-paragraph-id={paragraph.id}
            className="ai-indicator absolute left-0 w-1 transition-all duration-200 pointer-events-auto cursor-pointer hover:w-2 z-10"
            style={{
              top: `${topOffset}rem`,
              height: `${height}rem`,
              backgroundColor: color,
              opacity: isHovered ? 1 : 0.6,
            }}
            onMouseEnter={() => {
              handleParagraphHover(paragraph.id);
            }}
            onMouseLeave={() => {
              // Call with null to trigger hide logic (with delay)
              handleParagraphHover(null);
            }}
            onClick={() => handleIndicatorClick(paragraph.id, state)}
          />
        );
      })}
    </div>
  );
}

