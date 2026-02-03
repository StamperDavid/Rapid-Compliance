'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';
import { logger } from '@/lib/logger/logger';

interface ChatResponse {
  response?: string;
  error?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function LiveChatDemo({ primaryColor }: { primaryColor: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi there! 👋 I'm the AI sales agent for SalesVelocity.ai. I can answer questions about our platform, help you understand pricing, or show you how our AI agents work. What would you like to know?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const suggestedQuestions = [
    "What does this platform do?",
    "How much does it cost?",
    "How long does setup take?",
    "What's included in the platform?",
    "Tell me about BYOK pricing",
    "How do I get started?",
  ];

  const sendMessage = async (messageText?: string) => {
    const text = messageText ?? input.trim();
    if (!text || isTyping) {return;}

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          orgId: 'platform-admin',
          customerId: `demo_${Date.now()}`,
        }),
      });
      let data: ChatResponse = {};
      try {
        data = await response.json() as ChatResponse;
      } catch {
        data = {};
      }

      const responseText = response.ok
        ? data.response
        : data.error ?? "I'm having trouble connecting to the AI right now.";

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: responseText ?? "I'm having trouble connecting to the AI right now.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Chat error:', err, { file: 'page.tsx' });
      const fallbackMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: "I'm temporarily unavailable right now. Please try again shortly.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 max-w-4xl mx-auto">
      {/* Chat Header */}
      <div 
        className="px-6 py-4 flex items-center gap-4"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-2xl">🤖</span>
        </div>
        <div>
          <h3 className="text-white font-semibold text-lg">SalesVelocity AI Agent</h3>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-white/80 text-sm">Online now</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="h-[600px] overflow-y-auto p-4 space-y-4 bg-slate-800">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-slate-700 text-gray-100 rounded-bl-md'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-700 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div className="px-4 py-3 bg-slate-800 border-t border-slate-700">
          <p className="text-xs text-gray-400 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => { void sendMessage(q); }}
                className="px-3 py-1.5 text-xs bg-slate-700 text-gray-300 rounded-full hover:bg-slate-600 transition"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') { void sendMessage(); } }}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
            disabled={isTyping}
          />
          <button
            onClick={() => { void sendMessage(); }}
            disabled={!input.trim() || isTyping}
            className="px-4 py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: primaryColor, color: '#fff' }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const { theme } = useWebsiteTheme();

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="pt-44 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <span>🤖</span>
            <span>Live AI Demo</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            See Our AI Agent In Action
          </h1>
          <p className="text-xl text-gray-300 mb-4 max-w-3xl mx-auto">
            This is a live AI sales agent powered by our platform. Go ahead - ask it anything about our platform, pricing, or features.
          </p>
          <p className="text-lg text-gray-400 mb-8">
            This is exactly what your customers will experience when you deploy your own trained AI agent.
          </p>
        </div>
      </section>

      {/* Demo */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <LiveChatDemo primaryColor={theme.primaryColor} />

          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-6 text-lg">
              Impressed? Your AI agent can be even smarter - trained specifically on <span className="text-white font-semibold">YOUR</span> business, products, and sales process.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/onboarding/industry"
                className="inline-block px-8 py-4 rounded-lg text-lg font-semibold transition shadow-lg"
                style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
              >
                Create Your Own AI Agent →
              </Link>
              <Link
                href="/pricing"
                className="inline-block px-8 py-4 bg-white/10 text-white rounded-lg text-lg font-semibold hover:bg-white/20 transition border border-white/20"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

