/**
 * Tests for ChatMessage component
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChatMessage } from '../chat-message';
import type { ChatMessage as ChatMessageType } from '@zadoox/shared';

describe('ChatMessage', () => {
  it('should render user message', () => {
    const userMessage: ChatMessageType = {
      id: 'msg-1',
      role: 'user',
      content: 'This is a user message',
      timestamp: new Date().toISOString(),
    };

    render(<ChatMessage message={userMessage} />);
    
    expect(screen.getByText('This is a user message')).toBeInTheDocument();
  });

  it('should render assistant message', () => {
    const assistantMessage: ChatMessageType = {
      id: 'msg-2',
      role: 'assistant',
      content: 'This is an assistant response',
      timestamp: new Date().toISOString(),
    };

    render(<ChatMessage message={assistantMessage} />);
    
    expect(screen.getByText('This is an assistant response')).toBeInTheDocument();
  });

  it('should display timestamp', () => {
    const message: ChatMessageType = {
      id: 'msg-1',
      role: 'user',
      content: 'Test message',
      timestamp: new Date('2024-01-01T12:00:00Z').toISOString(),
    };

    const { container } = render(<ChatMessage message={message} />);
    
    // Timestamp should be formatted and displayed (format depends on locale)
    const content = container.textContent || '';
    // Just verify timestamp is present (could be 12:00 PM, 12:00, etc. depending on locale)
    expect(content).toMatch(/\d{1,2}:\d{2}/);
  });

  it('should handle multi-line content', () => {
    const message: ChatMessageType = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Line 1\nLine 2\nLine 3',
      timestamp: new Date().toISOString(),
    };

    const { container } = render(<ChatMessage message={message} />);
    
    // Multi-line content is rendered as a single text node with newlines preserved
    const content = container.textContent || '';
    expect(content).toContain('Line 1');
    expect(content).toContain('Line 2');
    expect(content).toContain('Line 3');
  });

  it('should apply correct styling for user messages', () => {
    const userMessage: ChatMessageType = {
      id: 'msg-1',
      role: 'user',
      content: 'User message',
      timestamp: new Date().toISOString(),
    };

    const { container } = render(<ChatMessage message={userMessage} />);
    
    const messageDiv = container.querySelector('.bg-gray-800');
    expect(messageDiv).toBeInTheDocument();
  });

  it('should apply correct styling for assistant messages', () => {
    const assistantMessage: ChatMessageType = {
      id: 'msg-2',
      role: 'assistant',
      content: 'Assistant message',
      timestamp: new Date().toISOString(),
    };

    const { container } = render(<ChatMessage message={assistantMessage} />);
    
    const messageDiv = container.querySelector('.bg-gray-900');
    expect(messageDiv).toBeInTheDocument();
  });
});

