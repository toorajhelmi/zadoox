import { AIService } from './ai-service.js';

// Initialize AI service (singleton pattern)
let aiService: AIService | null = null;
let aiServiceError: Error | null = null;

// SG-specific AI service (lets us use a stronger model without affecting other AI features)
let sgAiService: AIService | null = null;
let sgAiServiceError: Error | null = null;

export function getAIService(): AIService {
  if (aiServiceError) {
    throw aiServiceError;
  }

  if (!aiService) {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        aiServiceError = new Error('OPENAI_API_KEY environment variable is not set');
        throw aiServiceError;
      }

      aiService = new AIService({
        defaultModel: (process.env.AI_DEFAULT_MODEL as 'openai' | 'auto') || 'openai',
        openaiApiKey,
        openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      });
    } catch (error) {
      aiServiceError = error instanceof Error ? error : new Error('Failed to initialize AI service');
      throw aiServiceError;
    }
  }
  return aiService;
}

export function getSgAIService(): AIService {
  if (sgAiServiceError) throw sgAiServiceError;

  if (!sgAiService) {
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        sgAiServiceError = new Error('OPENAI_API_KEY environment variable is not set');
        throw sgAiServiceError;
      }

      // Prefer SG_OPENAI_MODEL if set; otherwise fall back to the default OPENAI_MODEL.
      // We intentionally do NOT change the global AIService model, because SG bootstrap can be much heavier.
      const sgOpenAiModel = process.env.SG_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

      sgAiService = new AIService({
        defaultModel: (process.env.SG_AI_DEFAULT_MODEL as 'openai' | 'auto') || (process.env.AI_DEFAULT_MODEL as 'openai' | 'auto') || 'openai',
        openaiApiKey,
        openaiModel: sgOpenAiModel,
      });
    } catch (error) {
      sgAiServiceError = error instanceof Error ? error : new Error('Failed to initialize SG AI service');
      throw sgAiServiceError;
    }
  }

  return sgAiService;
}


