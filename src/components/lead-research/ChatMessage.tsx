'use client';

import { Bot, User } from 'lucide-react';
import type { ResearchChatMessage } from '@/types/lead-research';

interface ChatMessageProps {
  message: ResearchChatMessage;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-blue-600'
            : 'bg-gradient-to-br from-cyan-500 to-blue-600'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] rounded-bl-sm'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10 text-xs opacity-70">
            {message.toolCalls.map((tc, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-cyan-400">&#9679;</span> {tc.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
