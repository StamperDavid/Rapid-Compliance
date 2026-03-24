/**
 * Discovery Chat Panel — Left panel for directing Jasper's research
 *
 * Phase 3 will wire this to the real chat API with intelligence tools.
 * For now, provides the themed UI shell with message display and input.
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import type { DiscoveryChatMessage } from '@/hooks/useIntelligenceDiscovery';

interface DiscoveryChatPanelProps {
  messages: DiscoveryChatMessage[];
  loading: boolean;
  onSendMessage: (text: string) => Promise<void>;
}

export default function DiscoveryChatPanel({
  messages,
  loading,
  onSendMessage,
}: DiscoveryChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) { return; }
    setInput('');
    void onSendMessage(text);
  };

  return (
    <div className="flex flex-col h-full border-r border-[var(--color-border-light)] bg-[var(--color-bg-paper)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border-light)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-cyan)]/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[var(--color-cyan)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Jasper — Intelligence
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Direct research operations
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-cyan)]/10 flex items-center justify-center mb-3">
              <Bot className="w-6 h-6 text-[var(--color-cyan)]" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">
              Intelligence Discovery
            </p>
            <p className="text-xs text-[var(--color-text-disabled)]">
              Tell me what data sources to scrape, what information to look for, or ask me to enrich your findings.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-[var(--color-cyan)]/20 flex-shrink-0 flex items-center justify-center mt-0.5">
                <Bot className="w-3 h-3 text-[var(--color-cyan)]" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-[var(--color-primary)]/20 flex-shrink-0 flex items-center justify-center mt-0.5">
                <User className="w-3 h-3 text-[var(--color-primary)]" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--color-cyan)]/20 flex-shrink-0 flex items-center justify-center mt-0.5">
              <Bot className="w-3 h-3 text-[var(--color-cyan)]" />
            </div>
            <div className="bg-[var(--color-bg-elevated)] rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-disabled)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-disabled)] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-disabled)] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--color-border-light)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Research a source, enrich findings..."
            disabled={loading}
            className="flex-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-cyan)] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-[var(--color-cyan)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
