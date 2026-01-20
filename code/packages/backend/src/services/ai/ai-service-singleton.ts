import { AIService } from './ai-service.js';

// Initialize AI service (singleton pattern)
let aiService: AIService | null = null;
let aiServiceError: Error | null = null;

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


