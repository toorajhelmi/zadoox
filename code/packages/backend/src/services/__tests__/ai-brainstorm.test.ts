/**
 * Unit tests for AI Brainstorming functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIProvider } from '../ai/openai-provider.js';
import OpenAI from 'openai';

// Mock OpenAI client
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

describe('AI Brainstorming', () => {
  let provider: OpenAIProvider;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn();
    // Create a new provider and mock its client
    provider = new OpenAIProvider('gpt-4o-mini');
    (provider as any).client = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  });

  describe('brainstormChat', () => {
    it('should send chat message with context on first message', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test brainstorming response',
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await provider.brainstormChat(
        'Test message',
        [],
        {
          blockContent: 'Test block content',
          sectionHeading: 'Test Section',
          sectionContent: 'Test section content',
        }
      );

      expect(result).toBe('Test brainstorming response');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: expect.stringContaining('BLOCK TO BRAINSTORM') }),
            expect.objectContaining({ role: 'user', content: 'Test message' }),
          ]),
        })
      );
    });

    it('should include chat history in subsequent messages', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Follow-up response',
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const chatHistory = [
        { role: 'user' as const, content: 'First message' },
        { role: 'assistant' as const, content: 'First response' },
      ];

      await provider.brainstormChat(
        'Second message',
        chatHistory,
        {
          blockContent: 'Test block content',
        }
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(4); // system + 2 history + current
      expect(callArgs.messages[1]).toEqual({ role: 'user', content: 'First message' });
      expect(callArgs.messages[2]).toEqual({ role: 'assistant', content: 'First response' });
      expect(callArgs.messages[3]).toEqual({ role: 'user', content: 'Second message' });
    });

    it('should filter invalid chat history entries', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Response',
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const chatHistory = [
        { role: 'user' as const, content: 'Valid message' },
        { role: 'user' as const, content: '' }, // Empty - should be filtered
        { role: 'assistant' as const, content: '   ' }, // Whitespace only - should be filtered
      ];

      await provider.brainstormChat(
        'Current message',
        chatHistory,
        {
          blockContent: 'Test content',
        }
      );

      const callArgs = mockCreate.mock.calls[0][0];
      // Should only have system + 1 valid history + current = 3 messages
      expect(callArgs.messages.length).toBeLessThanOrEqual(3);
      expect(callArgs.messages.some((m: any) => m.content === 'Valid message')).toBe(true);
    });

    it('should throw error if message structure is invalid', async () => {
      // This shouldn't happen in practice, but test the validation
      await expect(
        provider.brainstormChat('', [], { blockContent: '' })
      ).rejects.toThrow();
    });
  });

  describe('extractIdeas', () => {
    it('should extract ideas from response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                ideas: [
                  { topic: 'Idea 1', description: 'Description 1' },
                  { topic: 'Idea 2', description: 'Description 2' },
                ],
              }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await provider.extractIdeas(
        'Test assistant response with ideas',
        []
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ topic: 'Idea 1', description: 'Description 1' });
      expect(result[1]).toEqual({ topic: 'Idea 2', description: 'Description 2' });
    });

    it('should return empty array when no ideas found', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ ideas: [] }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await provider.extractIdeas(
        'Response with no extractable ideas',
        []
      );

      expect(result).toEqual([]);
    });

    it('should filter out ideas without topic or description', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                ideas: [
                  { topic: 'Valid Idea', description: 'Valid description' },
                  { topic: '', description: 'Invalid - no topic' },
                  { topic: 'No Description', description: '' },
                  { topic: 'Another Valid', description: 'Another description' },
                ],
              }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await provider.extractIdeas('Test response', []);

      expect(result).toHaveLength(2);
      expect(result[0].topic).toBe('Valid Idea');
      expect(result[1].topic).toBe('Another Valid');
    });

    it('should truncate topic to 50 characters', async () => {
      const longTopic = 'A'.repeat(60);
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                ideas: [
                  { topic: longTopic, description: 'Test description' },
                ],
              }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await provider.extractIdeas('Test response', []);

      expect(result[0].topic).toHaveLength(50);
      expect(result[0].topic).toBe('A'.repeat(50));
    });

    it('should handle existing ideas in prompt', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                ideas: [
                  { topic: 'New Idea', description: 'New description' },
                ],
              }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const existingIdeas = [
        { topic: 'Existing Idea', description: 'Existing description' },
      ];

      await provider.extractIdeas('New response', existingIdeas);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('EXISTING IDEA CARDS');
      expect(callArgs.messages[1].content).toContain('Existing Idea');
    });
  });

  describe('generateFromIdea', () => {
    it('should generate content from idea in replace mode', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Generated content from idea',
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await provider.generateFromIdea(
        { topic: 'Test Idea', description: 'Test description' },
        { blockContent: 'Existing content' },
        'replace'
      );

      expect(result).toBe('Generated content from idea');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Test Idea'),
            }),
          ]),
        })
      );
    });

    it('should generate content in blend mode', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Blended content',
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await provider.generateFromIdea(
        { topic: 'Blend Idea', description: 'Blend description' },
        { blockContent: 'Original content' },
        'blend'
      );

      expect(result).toBe('Blended content');
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('blend');
      expect(callArgs.messages[1].content).toContain('Original content');
    });

    it('should include section context when provided', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Generated with context',
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      await provider.generateFromIdea(
        { topic: 'Test Idea', description: 'Test description' },
        {
          blockContent: 'Block content',
          sectionHeading: 'Section Title',
          sectionContent: 'Section content',
        },
        'replace'
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('Section Title');
      expect(callArgs.messages[1].content).toContain('Section content');
    });
  });
});

