/**
 * AI Provider Interface
 * Abstract interface for different AI model providers
 */

export interface AIProvider {
  /**
   * Analyze text for quality, sentiment, wordiness, clarity
   */
  analyzeText(text: string, context?: string): Promise<AIAnalysisResult>;

  /**
   * Improve text (general improvement)
   */
  improveText(text: string, context?: string): Promise<string>;

  /**
   * Expand text (add more content)
   */
  expandText(text: string, context?: string): Promise<string>;

  /**
   * Clarify text (improve clarity)
   */
  clarifyText(text: string, context?: string): Promise<string>;

  /**
   * Condense text (reduce wordiness)
   */
  condenseText(text: string, context?: string): Promise<string>;

  /**
   * Adjust tone (formalize or casualize)
   */
  adjustTone(text: string, tone: 'formal' | 'casual', context?: string): Promise<string>;

  /**
   * Generate completion/suggestion
   */
  suggestCompletion(text: string, context?: string): Promise<string>;

  /**
   * Brainstorm chat - conversational brainstorming
   */
  brainstormChat(
    message: string,
    chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    }
  ): Promise<string>;

  /**
   * Extract significant ideas from assistant response
   */
  extractIdeas(
    assistantResponse: string,
    existingIdeas: Array<{ topic: string; description: string }>
  ): Promise<Array<{ topic: string; description: string }>>;

  /**
   * Generate content from an idea card
   */
  generateFromIdea(
    idea: { topic: string; description: string },
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    mode: 'blend' | 'replace'
  ): Promise<string>;

  /**
   * Transform draft text into polished content
   */
  transformDraft(
    draftText: string,
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    mode: 'blend' | 'replace'
  ): Promise<string>;

  /**
   * Generate an image from a prompt. Returns base64 encoded image data.
   */
  generateImage(
    prompt: string,
    options?: {
      size?: '256x256' | '512x512' | '1024x1024';
    }
  ): Promise<{ b64: string; mimeType: string }>;

  /**
   * Inline generation from a raw prompt + context.
   * Used by /ai/inline/generate.
   */
  generateFromPrompt(
    prompt: string,
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    mode: 'blend' | 'replace' | 'extend'
  ): Promise<string>;

  /**
   * Generate an inline edit plan as JSON string containing operations.
   * Used by /ai/inline/edit.
   */
  generateInlineEditPlan(
    prompt: string,
    params: {
      mode: 'update' | 'insert';
      blocks: Array<{
        id: string;
        text: string;
        kind?: 'heading' | 'paragraph' | 'list' | 'code' | 'blank' | 'other';
        start: number;
        end: number;
      }>;
      cursorBlockId?: string;
    }
  ): Promise<string>;

  /**
   * Component-scoped edit response as JSON (clarify or update).
   * Used by /ai/component/edit.
   */
  generateComponentEditPlan(
    prompt: string,
    params: {
      kind: string;
      context?: unknown;
    }
  ): Promise<string>;

  /**
   * Get model information
   */
  getModelInfo(): AIModelInfo;
}

export interface AIAnalysisResult {
  quality: number; // 0-100
  sentiment: 'positive' | 'neutral' | 'negative';
  wordiness: number; // 0-100 (higher = more wordy)
  clarity: number; // 0-100 (higher = clearer)
  suggestions?: AISuggestion[];
}

export interface AISuggestion {
  type: 'error' | 'warning' | 'suggestion';
  text: string;
  position?: {
    from: number;
    to: number;
  };
  message: string;
  replacement?: string;
}

export interface AIModelInfo {
  id: string;
  name: string;
  provider: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
}

