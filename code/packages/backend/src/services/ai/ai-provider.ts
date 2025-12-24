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

