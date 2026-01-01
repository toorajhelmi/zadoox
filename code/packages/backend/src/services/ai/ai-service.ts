/**
 * AI Service
 * Main service for AI operations with model selection (Cursor-style)
 * Supports multiple providers with "auto" mode
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIProvider, AIAnalysisResult, AIModelInfo } from './ai-provider.js';
import { OpenAIProvider } from './openai-provider.js';

export type AIModel = 'openai' | 'auto';

export interface AIServiceConfig {
  defaultModel?: AIModel;
  openaiApiKey?: string;
  openaiModel?: string;
}

export class AIService {
  private providers: Map<string, AIProvider> = new Map();
  private defaultModel: AIModel;
  private supabase?: SupabaseClient;

  constructor(config: AIServiceConfig = {}, supabase?: SupabaseClient) {
    this.supabase = supabase;
    this.defaultModel = config.defaultModel || 'openai';

    // Initialize OpenAI provider if API key is provided
    if (config.openaiApiKey) {
      const openaiProvider = new OpenAIProvider(
        config.openaiApiKey,
        config.openaiModel || 'gpt-4o-mini'
      );
      this.providers.set('openai', openaiProvider);
    }
  }

  /**
   * Get AI provider for a given model
   * If "auto", selects the best available model
   */
  private getProvider(model?: AIModel): AIProvider {
    const modelToUse = model || this.defaultModel;

    if (modelToUse === 'auto') {
      // Auto mode: select best available model
      // For now, just use OpenAI if available
      const provider = this.providers.get('openai');
      if (provider) {
        return provider;
      }
      throw new Error('No AI providers available. Please configure OpenAI API key.');
    }

    const provider = this.providers.get(modelToUse);
    if (!provider) {
      throw new Error(`AI provider "${modelToUse}" is not available. Please configure it.`);
    }

    return provider;
  }

  /**
   * Analyze text for quality, sentiment, wordiness, clarity
   */
  async analyzeText(
    text: string,
    context?: string,
    model?: AIModel
  ): Promise<AIAnalysisResult> {
    const provider = this.getProvider(model);
    return provider.analyzeText(text, context);
  }

  /**
   * Improve text (general improvement)
   */
  async improveText(text: string, context?: string, model?: AIModel): Promise<string> {
    const provider = this.getProvider(model);
    return provider.improveText(text, context);
  }

  /**
   * Expand text (add more content)
   */
  async expandText(text: string, context?: string, model?: AIModel): Promise<string> {
    const provider = this.getProvider(model);
    return provider.expandText(text, context);
  }

  /**
   * Clarify text (improve clarity)
   */
  async clarifyText(text: string, context?: string, model?: AIModel): Promise<string> {
    const provider = this.getProvider(model);
    return provider.clarifyText(text, context);
  }

  /**
   * Condense text (reduce wordiness)
   */
  async condenseText(text: string, context?: string, model?: AIModel): Promise<string> {
    const provider = this.getProvider(model);
    return provider.condenseText(text, context);
  }

  /**
   * Adjust tone (formalize or casualize)
   */
  async adjustTone(
    text: string,
    tone: 'formal' | 'casual',
    context?: string,
    model?: AIModel
  ): Promise<string> {
    const provider = this.getProvider(model);
    return provider.adjustTone(text, tone, context);
  }

  /**
   * Generate completion/suggestion
   */
  async suggestCompletion(text: string, context?: string, model?: AIModel): Promise<string> {
    const provider = this.getProvider(model);
    return provider.suggestCompletion(text, context);
  }

  /**
   * Brainstorm chat - conversational brainstorming
   */
  async brainstormChat(
    message: string,
    chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    model?: AIModel
  ): Promise<string> {
    const provider = this.getProvider(model);
    return provider.brainstormChat(message, chatHistory, context);
  }

  /**
   * Extract significant ideas from assistant response
   */
  async extractIdeas(
    assistantResponse: string,
    existingIdeas: Array<{ topic: string; description: string }>,
    model?: AIModel
  ): Promise<Array<{ topic: string; description: string }>> {
    const provider = this.getProvider(model);
    return provider.extractIdeas(assistantResponse, existingIdeas);
  }

  /**
   * Generate content from an idea card
   */
  async generateFromIdea(
    idea: { topic: string; description: string },
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    mode: 'blend' | 'replace',
    model?: AIModel
  ): Promise<string> {
    const provider = this.getProvider(model);
    return provider.generateFromIdea(idea, context, mode);
  }

  /**
   * Transform draft text into polished content
   */
  async transformDraft(
    draftText: string,
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    mode: 'blend' | 'replace' = 'replace',
    model?: AIModel
  ): Promise<string> {
    const provider = this.getProvider(model);
    return provider.transformDraft(draftText, context, mode);
  }

  /**
   * Inline generation from a raw prompt + context.
   */
  async generateFromPrompt(
    prompt: string,
    context: {
      blockContent: string;
      sectionHeading?: string;
      sectionContent?: string;
    },
    mode: 'blend' | 'replace' | 'extend' = 'replace',
    model?: AIModel
  ): Promise<string> {
    const provider = this.getProvider(model);
    return provider.generateFromPrompt(prompt, context, mode);
  }

  /**
   * Generate an inline edit plan as JSON string containing operations.
   */
  async generateInlineEditPlan(
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
    },
    model?: AIModel
  ): Promise<string> {
    const provider = this.getProvider(model);
    return provider.generateInlineEditPlan(prompt, params);
  }

  /**
   * Get available models
   */
  getAvailableModels(): AIModelInfo[] {
    const models: AIModelInfo[] = [];
    
    for (const provider of this.providers.values()) {
      models.push(provider.getModelInfo());
    }

    // Add "auto" as a virtual model
    if (models.length > 0) {
      models.push({
        id: 'auto',
        name: 'Auto (Best Available)',
        provider: 'system',
      });
    }

    return models;
  }

  /**
   * Get model info for a specific model
   */
  getModelInfo(model: AIModel): AIModelInfo | null {
    if (model === 'auto') {
      return {
        id: 'auto',
        name: 'Auto (Best Available)',
        provider: 'system',
      };
    }

    const provider = this.providers.get(model);
    return provider ? provider.getModelInfo() : null;
  }

  /**
   * Check if a model is available
   */
  isModelAvailable(model: AIModel): boolean {
    if (model === 'auto') {
      return this.providers.size > 0;
    }
    return this.providers.has(model);
  }
}

