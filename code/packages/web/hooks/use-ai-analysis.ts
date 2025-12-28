'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';
import type { AIAnalysisResponse, AIModel } from '@zadoox/shared';

const DEBOUNCE_DELAY = 2000; // 2 seconds after typing stops
const ANALYSIS_TIMEOUT = 30000; // 30 seconds timeout for analysis

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

  // Helper function to check if a line is a markdown heading
  const isHeading = (line: string): boolean => {
    const trimmed = line.trim();
    return /^#{1,6}\s/.test(trimmed);
  };

  // Parse content into paragraphs
  // Sections (headings) and all content below until next heading are treated as one paragraph
  const parseParagraphs = useCallback((text: string): Array<{ id: string; text: string }> => {
    const lines = text.split('\n');
    const parsed: Array<{ id: string; text: string }> = [];
    let currentParagraph: { startLine: number; text: string } | null = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineIsHeading = isHeading(trimmed);
      
      if (lineIsHeading) {
        // If we encounter a heading, save current paragraph (if any) and start a new section
        if (currentParagraph) {
        parsed.push({
          id: `para-${currentParagraph.startLine}`,
          text: currentParagraph.text.trim(),
        });
        }
        // Start new section with this heading
        currentParagraph = { startLine: index, text: trimmed };
      } else if (trimmed) {
        // Non-heading content - add to current paragraph (or start one if none exists)
        if (!currentParagraph) {
          currentParagraph = { startLine: index, text: trimmed };
        } else {
          currentParagraph.text += ' ' + trimmed;
        }
      } else if (!trimmed && currentParagraph) {
        // Blank line - only end paragraph if it's not a section (sections continue through blank lines)
        // Check if current paragraph starts with a heading by checking the first line
        const firstLine = lines[currentParagraph.startLine]?.trim() || '';
        const currentIsHeading = isHeading(firstLine);
        if (!currentIsHeading) {
          // Regular paragraph ends at blank line
          parsed.push({
            id: `para-${currentParagraph.startLine}`,
            text: currentParagraph.text.trim(),
          });
          currentParagraph = null;
        }
        // If it's a section, blank lines are part of the section content
      }
    });

    if (currentParagraph) {
      const para: { startLine: number; text: string } = currentParagraph;
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

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Analysis timeout'));
        }, ANALYSIS_TIMEOUT);
      });

      try {
        // Race between analysis and timeout
        const analysis = await Promise.race([
          api.ai.analyze({
            text,
            model,
          }),
          timeoutPromise,
        ]);

        setParagraphs((prev) => {
          const next = new Map(prev);
          const existing = next.get(paragraphId);
          next.set(paragraphId, {
            id: paragraphId,
            text,
            analysis,
            lastAnalyzed: new Date(),
            lastEdited: existing?.lastEdited || new Date(),
            isAnalyzing: false,
          });
          return next;
        });
      } catch (error) {
        console.error(`Failed to analyze paragraph ${paragraphId}:`, error);
        // Always reset analyzing state on error
        setParagraphs((prev) => {
          const next = new Map(prev);
          const existing = next.get(paragraphId);
          if (existing) {
            next.set(paragraphId, {
              ...existing,
              isAnalyzing: false,
            });
          } else {
            // If paragraph doesn't exist, create it with no analysis
            next.set(paragraphId, {
              id: paragraphId,
              text,
              lastEdited: new Date(),
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

