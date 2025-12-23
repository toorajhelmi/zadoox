/**
 * OpenAI Provider
 * Implementation of AIProvider using OpenAI API
 */

import type { AIProvider, AIAnalysisResult, AIModelInfo } from './ai-provider.js';

// Import OpenAI - will throw if package not installed
let OpenAI: any;
try {
  OpenAI = require('openai');
} catch (error) {
  // Package not installed - will throw error when provider is used
  OpenAI = null;
}

export class OpenAIProvider implements AIProvider {
  private client: any;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    if (!OpenAI) {
      throw new Error('OpenAI package is not installed. Run: pnpm install openai');
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async analyzeText(text: string, context?: string): Promise<AIAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(text, context);
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing analyst. Analyze text and provide structured feedback in JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    try {
      const analysis = JSON.parse(content);
      return {
        quality: Math.max(0, Math.min(100, analysis.quality || 70)),
        sentiment: analysis.sentiment || 'neutral',
        wordiness: Math.max(0, Math.min(100, analysis.wordiness || 50)),
        clarity: Math.max(0, Math.min(100, analysis.clarity || 70)),
        suggestions: analysis.suggestions || [],
      };
    } catch (error) {
      throw new Error('Failed to parse AI analysis response');
    }
  }

  async improveText(text: string, context?: string): Promise<string> {
    const prompt = `Improve the following text while maintaining its meaning and style:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the improved text, no explanations.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Improve text while preserving meaning and style.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  }

  async expandText(text: string, context?: string): Promise<string> {
    const prompt = `Expand the following text by adding more detail, examples, or explanation while maintaining the original meaning:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the expanded text, no explanations.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Expand text with relevant details while preserving the core message.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  }

  async clarifyText(text: string, context?: string): Promise<string> {
    const prompt = `Clarify the following text to make it more understandable and clear:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the clarified text, no explanations.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Clarify text to improve understanding while keeping the original meaning.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.6,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  }

  async condenseText(text: string, context?: string): Promise<string> {
    const prompt = `Condense the following text to be more concise while preserving all key information:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the condensed text, no explanations.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Condense text to reduce wordiness while keeping all essential information.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  }

  async adjustTone(text: string, tone: 'formal' | 'casual', context?: string): Promise<string> {
    const toneInstruction = tone === 'formal' 
      ? 'Make the text more formal and professional'
      : 'Make the text more casual and conversational';
    
    const prompt = `${toneInstruction}:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the adjusted text, no explanations.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert writing assistant. Adjust text tone to be more ${tone} while preserving meaning.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || text;
  }

  async suggestCompletion(text: string, context?: string): Promise<string> {
    const prompt = `Complete the following text in a natural way:\n\n${text}\n\n${context ? `Context: ${context}\n\n` : ''}Provide only the completion, continuing from where the text ends.`;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert writing assistant. Provide natural text completions that match the style and context.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 200,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }

  getModelInfo(): AIModelInfo {
    return {
      id: this.model,
      name: `OpenAI ${this.model}`,
      provider: 'openai',
      maxTokens: 16384, // Approximate for gpt-4o-mini
      supportsStreaming: true,
    };
  }

  private buildAnalysisPrompt(text: string, context?: string): string {
    return `Analyze the following text and provide a JSON response with this structure:
{
  "quality": <number 0-100, overall writing quality>,
  "sentiment": <"positive" | "neutral" | "negative">,
  "wordiness": <number 0-100, where 100 is very wordy>,
  "clarity": <number 0-100, where 100 is very clear>,
  "suggestions": [
    {
      "type": <"error" | "warning" | "suggestion">,
      "text": <exact text with issue>,
      "message": <description of issue>,
      "replacement": <suggested replacement, optional>
    }
  ]
}

Text to analyze:
${text}

${context ? `Context: ${context}\n\n` : ''}Provide only valid JSON, no additional text.`;
  }
}

