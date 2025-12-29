'use client';

import type { ChatMessage as ChatMessageType } from '@zadoox/shared';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 min-w-0`}>
      <div
        className={`max-w-[75%] min-w-0 rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-gray-800 text-gray-400'
            : 'bg-gray-900 border border-gray-700 text-gray-400'
        }`}
      >
        <div className="text-xs whitespace-pre-wrap break-words overflow-wrap-anywhere">{message.content}</div>
        <div className="text-xs mt-1 opacity-70 text-gray-500">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

