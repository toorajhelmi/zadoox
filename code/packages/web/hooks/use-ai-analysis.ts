'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';
import type { AIAnalysisResponse, AIModel } from '@zadoox/shared';

const DEBOUNCE_DELAY = 2000; // 2 seconds after typing stops

export interface ParagraphAnalysis {
  id: string;
  text: string;
  analysis?: AIAnalysisResponse;
  lastAnalyzed?: Date;
  lastEdited?: Date;
  isAnalyzing: boolean;
}

export function useAIAnalysis(content: string, model: AIModel = 'auto') {
  const [paragraphs, setParagraphs] = useState<Map<string, ParagraphAnalysis>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyzingParagraphsRef = useRef<Set<string>>(new Set());

  // Parse content into paragraphs
  const parseParagraphs = useCallback((text: string): Array<{ id: string; text: string }> => {
    const lines = text.split('\n');
    const parsed: Array<{ id: string; text: string }> = [];
    let currentParagraph: { startLine: number; text: string } | null = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      if (!trimmed && currentParagraph) {
        parsed.push({
          id: `para-${currentParagraph.startLine}`,
          text: currentParagraph.text.trim(),
        });
        currentParagraph = null;
      } else if (trimmed) {
        if (!currentParagraph) {
          currentParagraph = { startLine: index, text: trimmed };
        } else {
          currentParagraph.text += ' ' + trimmed;
        }
      }
    });

    if (currentParagraph) {
      const para = currentParagraph; // Type narrowing helper
      parsed.push({
        id: `para-${para.startLine}`,
        text: para.text.trim(),
      });
    }

    return parsed;
  }, []);

  // Analyze a single paragraph
  const analyzeParagraph = useCallback(
    async (paragraphId: string, text: string) => {
      if (!text || text.trim().length < 10) {
        // Skip very short paragraphs
        return;
      }

      if (analyzingParagraphsRef.current.has(paragraphId)) {
        return; // Already analyzing
      }

      analyzingParagraphsRef.current.add(paragraphId);
      setIsAnalyzing(true);

      try {
        const analysis = await api.ai.analyze({
          text,
          model,
        });

        setParagraphs((prev) => {
          const next = new Map(prev);
          const existing = next.get(paragraphId);
          next.set(paragraphId, {
            id: paragraphId,
            text,
            analysis,
            lastAnalyzed: new Date(),
            lastEdited: new Date(),
            isAnalyzing: false,
          });
          return next;
        });
      } catch (error) {
        console.error(`Failed to analyze paragraph ${paragraphId}:`, error);
        setParagraphs((prev) => {
          const next = new Map(prev);
          const existing = next.get(paragraphId);
          if (existing) {
            next.set(paragraphId, {
              ...existing,
              isAnalyzing: false,
            });
          }
          return next;
        });
      } finally {
        analyzingParagraphsRef.current.delete(paragraphId);
        if (analyzingParagraphsRef.current.size === 0) {
          setIsAnalyzing(false);
        }
      }
    },
    [model]
  );

  // Analyze all paragraphs (debounced)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const parsed = parseParagraphs(content);
      
      // Update paragraph map with new paragraphs
      setParagraphs((prev) => {
        const next = new Map(prev);
        const currentIds = new Set(parsed.map((p) => p.id));

        // Remove paragraphs that no longer exist
        for (const id of next.keys()) {
          if (!currentIds.has(id)) {
            next.delete(id);
          }
        }

        // Add/update paragraphs
        parsed.forEach((para) => {
          const existing = next.get(para.id);
          if (!existing || existing.text !== para.text) {
            // New paragraph or text changed - mark for analysis
            next.set(para.id, {
              id: para.id,
              text: para.text,
              lastEdited: new Date(),
              isAnalyzing: true,
            });
            // Trigger analysis
            analyzeParagraph(para.id, para.text);
          }
        });

        return next;
      });
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, parseParagraphs, analyzeParagraph]);

  // Get analysis for a specific paragraph
  const getAnalysis = useCallback(
    (paragraphId: string): ParagraphAnalysis | undefined => {
      return paragraphs.get(paragraphId);
    },
    [paragraphs]
  );

  // Manually trigger analysis for a paragraph
  const analyze = useCallback(
    (paragraphId: string, text: string) => {
      analyzeParagraph(paragraphId, text);
    },
    [analyzeParagraph]
  );

  return {
    paragraphs: Array.from(paragraphs.values()),
    getAnalysis,
    analyze,
    isAnalyzing,
  };
}

