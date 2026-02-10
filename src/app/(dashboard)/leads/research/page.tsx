'use client';

/**
 * Lead Research Teaching Interface
 * Chat-based lead generation with AI learning from user feedback
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger/logger';
import {
  Search,
  Send,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Building,
  Users,
  Sparkles,
  Bot,
  User,
  Plus,
  Globe
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  leads?: LeadResult[];
  cost?: number;
}

interface LeadResult {
  name: string;
  website: string;
  domain: string;
  industry: string;
  size: string;
  description: string;
  confidence: number;
  isGoodLead?: boolean;
}

interface ApiLeadResearchResponse {
  success: boolean;
  message?: string;
  leads?: LeadResult[];
  cost?: number;
  error?: string;
}

export default function LeadResearchPage() {
  const { user: _user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your lead research assistant. Tell me what kind of companies you're looking for, and I'll find them for you.\n\nTry something like:\n- \"Find me HVAC companies in Texas with 20-50 employees\"\n- \"Show me SaaS companies that use Stripe\"\n- \"Find companies like acme.com but in the finance industry\"",
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/leads/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
        }),
      });

      const rawData: unknown = await response.json();

      // Type guard for API response
      const isApiResponse = (obj: unknown): obj is ApiLeadResearchResponse => {
        if (typeof obj !== 'object' || obj === null) {
          return false;
        }
        const candidate = obj as Record<string, unknown>;
        return typeof candidate.success === 'boolean';
      };

      if (!isApiResponse(rawData)) {
        throw new Error('Invalid API response format');
      }

      const data = rawData;

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message ?? `I found ${data.leads?.length ?? 0} companies matching your criteria:`,
          timestamp: new Date(),
          leads: data.leads,
          cost: data.cost,
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Sorry, I couldn't complete that search: ${data.error ?? 'Unknown error'}`,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error: unknown) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, there was an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeadFeedback = async (messageId: string, leadDomain: string, isGood: boolean) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.leads) {
        return {
          ...msg,
          leads: msg.leads.map(lead =>
            lead.domain === leadDomain ? { ...lead, isGoodLead: isGood } : lead
          ),
        };
      }
      return msg;
    }));

    try {
      await fetch(`/api/leads/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadDomain,
          isGoodLead: isGood,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error: unknown) {
      logger.error('Failed to save feedback:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    }
  };

  const exampleQueries = [
    'Find SaaS companies in Austin with 50-200 employees',
    'Show me e-commerce stores using Shopify',
    'Find companies like stripe.com in the fintech space',
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] flex flex-col">
      <div className="flex-1 flex flex-col w-full p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg" style={{ boxShadow: '0 10px 25px -5px rgba(var(--color-primary-rgb), 0.25)' }}>
            <Search className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Lead Research Assistant</h1>
            <p className="text-[var(--color-text-secondary)] text-sm">
              Chat-based lead generation. Find companies and teach the system what you&apos;re looking for.
            </p>
          </div>
        </motion.div>

        {/* Messages Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 overflow-y-auto rounded-2xl backdrop-blur-xl border border-white/10 p-6 mb-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
        >
          <AnimatePresence>
            {messages.map((message, idx) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`mb-6 flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Message Bubble */}
                <div
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-primary to-secondary'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  {/* Sender Label */}
                  <div className={`flex items-center gap-2 text-xs mb-2 ${
                    message.role === 'user' ? 'text-primary-light' : 'text-[var(--color-text-disabled)]'
                  }`}>
                    {message.role === 'user' ? (
                      <>
                        <User className="w-3 h-3" />
                        You
                      </>
                    ) : (
                      <>
                        <Bot className="w-3 h-3" />
                        AI Assistant
                      </>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="text-white whitespace-pre-wrap">{message.content}</div>

                  {/* Cost Info */}
                  {message.cost !== undefined && (
                    <div className="mt-3 pt-3 border-t border-white/10 text-xs text-[var(--color-text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Cost: ${message.cost.toFixed(4)} • Saved vs Clearbit: ${(0.75 - message.cost).toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Lead Results */}
                {message.leads && message.leads.length > 0 && (
                  <div className="w-full mt-4 space-y-3">
                    {message.leads.map((lead, leadIdx) => (
                      <motion.div
                        key={leadIdx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: leadIdx * 0.05 }}
                        className="rounded-xl bg-white/5 border border-white/10 p-4 hover:bg-white/[0.07] transition-all"
                      >
                        {/* Lead Header */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="text-lg font-semibold text-white mb-1">{lead.name}</h3>
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-light transition-colors"
                            >
                              <Globe className="w-3 h-3" />
                              {lead.domain}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <span
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                            style={
                              lead.confidence >= 80
                                ? { backgroundColor: 'rgba(var(--color-success-rgb), 0.2)', borderColor: 'rgba(var(--color-success-rgb), 0.3)', color: 'var(--color-success)' }
                                : lead.confidence >= 60
                                ? { backgroundColor: 'rgba(var(--color-warning-rgb), 0.2)', borderColor: 'rgba(var(--color-warning-rgb), 0.3)', color: 'var(--color-warning)' }
                                : { backgroundColor: 'var(--color-surface-elevated)', borderColor: 'var(--color-border-strong)', color: 'var(--color-text-secondary)' }
                            }
                          >
                            {lead.confidence}% confidence
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-[var(--color-text-secondary)] mb-3">{lead.description}</p>

                        {/* Meta Info */}
                        <div className="flex gap-4 mb-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Building className="w-4 h-4 text-[var(--color-text-disabled)]" />
                            <span className="text-[var(--color-text-secondary)]">Industry:</span>
                            <span className="text-white">{lead.industry}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-[var(--color-text-disabled)]" />
                            <span className="text-[var(--color-text-secondary)]">Size:</span>
                            <span className="text-white">{lead.size}</span>
                          </div>
                        </div>

                        {/* Feedback Actions */}
                        <div className="flex gap-3 pt-3 border-t border-white/10">
                          <button
                            onClick={() => void handleLeadFeedback(message.id, lead.domain, true)}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all border"
                            style={
                              lead.isGoodLead === true
                                ? { backgroundColor: 'var(--color-success)', color: 'white', borderColor: 'transparent' }
                                : { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--color-text-secondary)' }
                            }
                            onMouseEnter={(e) => {
                              if (lead.isGoodLead !== true) {
                                e.currentTarget.style.backgroundColor = 'rgba(var(--color-success-rgb), 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(var(--color-success-rgb), 0.3)';
                                e.currentTarget.style.color = 'var(--color-success)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (lead.isGoodLead !== true) {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.color = 'var(--color-text-secondary)';
                              }
                            }}
                          >
                            <ThumbsUp className="w-4 h-4" />
                            Good Lead
                          </button>
                          <button
                            onClick={() => void handleLeadFeedback(message.id, lead.domain, false)}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all border"
                            style={
                              lead.isGoodLead === false
                                ? { backgroundColor: 'var(--color-error)', color: 'white', borderColor: 'transparent' }
                                : { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', color: 'var(--color-text-secondary)' }
                            }
                            onMouseEnter={(e) => {
                              if (lead.isGoodLead !== false) {
                                e.currentTarget.style.backgroundColor = 'rgba(var(--color-error-rgb), 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(var(--color-error-rgb), 0.3)';
                                e.currentTarget.style.color = 'var(--color-error)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (lead.isGoodLead !== false) {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.color = 'var(--color-text-secondary)';
                              }
                            }}
                          >
                            <ThumbsDown className="w-4 h-4" />
                            Not Relevant
                          </button>
                          <button
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white rounded-lg text-sm font-medium transition-all"
                          >
                            <Plus className="w-4 h-4" />
                            Add to CRM
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Researching leads...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </motion.div>

        {/* Input Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={(e) => void handleSubmit(e)}
          className="flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the companies you're looking for..."
            disabled={isLoading}
            className="flex-1 px-5 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            style={{ boxShadow: '0 10px 25px -5px rgba(var(--color-primary-rgb), 0.25)' }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Search
              </>
            )}
          </button>
        </motion.form>

        {/* Example Queries */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-2 mt-4"
        >
          {exampleQueries.map((example, idx) => (
            <button
              key={idx}
              onClick={() => setInput(example)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-white/10 hover:text-white transition-all"
              style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(var(--color-primary-rgb), 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              {example}
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
