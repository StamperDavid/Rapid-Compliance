'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme'
import { logger } from '@/lib/logger/logger';;

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
    "Can I see a demo?",
  ];

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isTyping) return;

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
          orgId: 'platform',
          customerId: `demo_${Date.now()}`,
        }),
      });
      let data: any = {};
      try {
        data = await response.json();
      } catch (err) {
        data = {};
      }

      const responseText = response.ok
        ? data.response
        : data.error || "I'm having trouble connecting to the AI right now.";

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: responseText || "I'm having trouble connecting to the AI right now.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      logger.error('Chat error:', error, { file: 'page.tsx' });
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
    <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 max-w-2xl mx-auto">
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
      <div className="h-80 overflow-y-auto p-4 space-y-4 bg-slate-800">
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
                onClick={() => sendMessage(q)}
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
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
            disabled={isTyping}
          />
          <button
            onClick={() => sendMessage()}
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

export default function LandingPage() {
  const { theme } = useWebsiteTheme();
  // Keep the landing page at the top on initial load to avoid unintended jumps.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <PublicLayout>

      {/* Hero Section */}
      <section className="pt-44 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 rounded-full mb-8">
              <span className="text-2xl">🚀</span>
              <span className="text-sm font-semibold text-indigo-300">Complete Sales Platform - Not Just a Chatbot</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Replace Your Entire
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Sales Stack
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-300 mb-6 max-w-3xl mx-auto">
              AI sales agents + CRM + automation + lead generation + email sequences + social media AI.
            </p>
            <p className="text-lg text-gray-400 mb-12 max-w-3xl mx-auto">
              Stop paying for 6 different tools. Get everything in one place with transparent, usage-based pricing.
            </p>

            {/* Key Differentiators */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="text-sm text-gray-400">Starting at</div>
                <div className="text-xl font-bold text-white">$400/month</div>
                <div className="text-xs text-gray-500">All features included</div>
              </div>
              <div className="px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="text-sm text-green-300">💡 BYOK</div>
                <div className="text-xl font-bold text-white">Zero AI Markup</div>
                <div className="text-xs text-green-400">Pay raw market rates</div>
              </div>
              <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg">
                <div className="text-sm text-gray-400">Simple Pricing</div>
                <div className="text-xl font-bold text-white">Records Based</div>
                <div className="text-xs text-gray-500">Not feature gated</div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="px-8 py-4 rounded-lg text-lg font-semibold transition shadow-lg"
                style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
              >
                Start Free Trial →
              </Link>
              <Link
                href="/demo"
                className="px-8 py-4 bg-white/10 text-white rounded-lg text-lg font-semibold hover:bg-white/20 transition border border-white/20"
              >
                See Demo
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No charge until trial ends</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              What's Included in Every Plan
            </h2>
            <p className="text-xl text-gray-300">
              The $400 user gets the <span className="text-indigo-400 font-semibold">same features</span> as the $1,250 user. You only pay based on CRM records stored.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: '🤖', title: 'Custom AI Sales Agent', desc: 'Fully trainable on your business' },
              { icon: '📧', title: 'Unlimited Email Sequences', desc: 'No sending limits' },
              { icon: '📱', title: 'Multi-Channel Outreach', desc: 'Email, LinkedIn, SMS automation' },
              { icon: '📊', title: 'Full CRM Suite', desc: 'Custom schemas & objects' },
              { icon: '⚡', title: 'Workflow Automation', desc: 'Build any workflow' },
              { icon: '🛒', title: 'Built-in E-Commerce Engine', desc: 'Cart, checkout, payments' },
              { icon: '🔍', title: 'Lead Scraper & Enrichment', desc: 'Find and enrich prospects' },
              { icon: '🎨', title: 'White-Label Branding', desc: 'Your domain, your brand' },
              { icon: '🔑', title: 'API Access', desc: 'Full API documentation' },
            ].map((feature, index) => (
              <div key={index} className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-center hover:border-indigo-500/50 transition">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stop Juggling Tools */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Stop Juggling 6 Different Tools
            </h2>
            <p className="text-xl text-gray-300">
              Replace your "Frankenstein stack" with one unified platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Before */}
            <div className="bg-slate-800/50 border-2 border-slate-600/50 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">😫</span>
                <div>
                  <h3 className="text-2xl font-bold text-white">The Old Way</h3>
                  <p className="text-gray-400 text-sm">Fragmented & Expensive</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/90">Apollo/ZoomInfo</span>
                  <span className="text-gray-300 font-semibold">$99-399/mo</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/90">Air AI/11x</span>
                  <span className="text-gray-300 font-semibold">$500-2,000/mo</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/90">Outreach Tool (Email/LinkedIn)</span>
                  <span className="text-gray-300 font-semibold">$49-199/mo</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/90">Zapier</span>
                  <span className="text-gray-300 font-semibold">$29-599/mo</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/90">HubSpot CRM</span>
                  <span className="text-gray-300 font-semibold">$45-1,200/mo</span>
                </div>
                <div className="border-t border-slate-600/50 pt-3 mt-3 flex justify-between items-center">
                  <span className="text-white font-bold">TOTAL</span>
                  <span className="text-gray-200 font-bold text-2xl">$722-4,397/mo</span>
                </div>
              </div>
              <div className="mt-4 text-gray-400 text-xs">
                Plus: Integration hell, 5 support teams, data syncing nightmares
              </div>
            </div>

            {/* After */}
            <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/50 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">🎉</span>
                <div>
                  <h3 className="text-2xl font-bold text-white">The New Way</h3>
                  <p className="text-indigo-300 text-sm">All-In-One & Affordable</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/90">✓ Lead Scraper & Enrichment</span>
                  <span className="text-indigo-300 font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/90">✓ AI Sales Agents (Unlimited)</span>
                  <span className="text-indigo-300 font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/90">✓ Multi-Channel Outreach</span>
                  <span className="text-indigo-300 font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/90">✓ Workflow Automation</span>
                  <span className="text-indigo-300 font-semibold">Included</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/90">✓ Full CRM + E-commerce</span>
                  <span className="text-indigo-300 font-semibold">Included</span>
                </div>
                <div className="border-t border-indigo-500/50 pt-3 mt-3 flex justify-between items-center">
                  <span className="text-white font-bold">TOTAL</span>
                  <span className="text-indigo-300 font-bold text-2xl">$400-1,250/mo</span>
                </div>
              </div>
              <div className="mt-4 text-indigo-300/70 text-xs">
                Plus: Everything synced, one dashboard, one support team, BYOK pricing
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className="inline-block bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/50 rounded-xl px-8 py-4">
              <p className="text-indigo-300 font-bold text-2xl mb-1">
                Save $322-3,147 per month
              </p>
              <p className="text-white text-sm">
                That's $3,864-37,764 saved per year
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BYOK: Zero AI Markup */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900">
          <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              BYOK: We Don't Markup Your AI Costs
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-4">
              Most AI platforms mark up tokens by 300-500%. We don't. You connect your own API key and pay the AI provider directly at cost.
            </p>
            <p className="text-lg text-indigo-300 max-w-2xl mx-auto">
              💡 <span className="font-semibold">We recommend OpenRouter</span> - one key gives you access to GPT-4, Claude, Gemini, and 200+ models
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Competitor */}
            <div className="bg-slate-800/50 border-2 border-slate-600/50 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">😰</span>
                <div>
                  <h3 className="text-2xl font-bold text-white">Typical AI Platform</h3>
                  <p className="text-gray-400 text-sm">Hidden Token Markup</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-gray-300">Platform Fee</span>
                    <span className="text-white font-semibold">$1,500/mo</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-gray-300">AI Usage <span className="text-xs text-gray-400">(400% markup)</span></span>
                    <span className="text-white font-semibold">$400/mo</span>
                  </div>
                  <div className="text-xs text-gray-400">(Real cost: $100, but you pay $400)</div>
                </div>
                <div className="border-t border-slate-600/50 pt-4 mt-4 flex justify-between items-center">
                  <span className="text-white font-bold text-lg">TOTAL YOU PAY</span>
                  <span className="text-gray-200 font-bold text-3xl">$1,900/mo</span>
                </div>
              </div>
            </div>

            {/* Our Platform */}
            <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/50 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-4xl">✨</span>
                <div>
                  <h3 className="text-2xl font-bold text-white">Our Platform (BYOK)</h3>
                  <p className="text-indigo-300 text-sm">100% Transparent</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-gray-300">Platform Fee <span className="text-xs text-indigo-400">(from us)</span></span>
                    <span className="text-white font-semibold">$650/mo</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-gray-300">AI Usage <span className="text-xs text-indigo-400">(0% markup)</span></span>
                    <span className="text-white font-semibold">$100/mo</span>
                  </div>
                  <div className="text-xs text-indigo-300/70">(You pay OpenRouter/OpenAI directly at cost)</div>
                </div>
                <div className="border-t border-indigo-500/50 pt-4 mt-4 flex justify-between items-center">
                  <span className="text-white font-bold text-lg">TOTAL YOU PAY</span>
                  <span className="text-indigo-300 font-bold text-3xl">$750/mo</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className="inline-block bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-2 border-indigo-500/50 rounded-xl px-8 py-4">
              <p className="text-indigo-300 font-bold text-2xl mb-1">
                You Save: $1,150/month
              </p>
              <p className="text-white text-sm">
                That's $13,800 saved per year with complete transparency
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Three Steps to Your AI Sales Team
            </h2>
            <p className="text-xl text-gray-300">
              Get up and running in less than an hour
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div 
                className="absolute top-0 left-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg"
                style={{ backgroundColor: theme.primaryColor }}
              >
                🎓
              </div>
              <div className="pt-20 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:border-white/20 transition">
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: theme.primaryColor }}>
                  Step 1
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Train Your Agent</h3>
                <p className="text-gray-300 mb-4">
                  Answer a few questions about your business, upload your product docs, 
                  and our AI learns everything about your offerings.
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Takes 15-30 minutes
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div 
                className="absolute top-0 left-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg"
                style={{ backgroundColor: theme.primaryColor }}
              >
                🎯
              </div>
              <div className="pt-20 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:border-white/20 transition">
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: theme.primaryColor }}>
                  Step 2
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Practice & Perfect</h3>
                <p className="text-gray-300 mb-4">
                  Role-play as a customer in our training sandbox. Give feedback. 
                  The AI improves with every session.
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Improve accuracy to 95%+
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div 
                className="absolute top-0 left-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg"
                style={{ backgroundColor: theme.primaryColor }}
              >
                🚀
              </div>
              <div className="pt-20 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:border-white/20 transition">
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: theme.primaryColor }}>
                  Step 3
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Deploy Everywhere</h3>
                <p className="text-gray-300 mb-4">
                  Embed your AI agent on your website with one line of code. 
                  It works on WordPress, Shopify, or any site.
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Works on any website
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* One Platform, Six Tools Replaced */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              One Platform. Six Tools Replaced.
            </h2>
            <p className="text-xl text-gray-300">
              Everything you need for modern sales, all in one place
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Replace Apollo/ZoomInfo */}
            <div className="p-8 bg-gradient-to-br from-indigo-900/20 to-indigo-800/10 border border-indigo-500/30 rounded-2xl">
              <div className="text-sm font-semibold text-indigo-400 mb-2">Replaces Apollo/ZoomInfo</div>
              <h3 className="text-2xl font-bold text-white mb-4">Lead Intelligence</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Lead Scraper & Enrichment</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Prospect Database</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Company & Contact Data</span>
                </li>
              </ul>
            </div>

            {/* Replace Air AI/11x */}
            <div className="p-8 bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-500/30 rounded-2xl">
              <div className="text-sm font-semibold text-purple-400 mb-2">Replaces Air AI/11x</div>
              <h3 className="text-2xl font-bold text-white mb-4">AI Sales Agents</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Unlimited AI Agents</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Custom Training</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Customer Memory</span>
                </li>
              </ul>
            </div>

            {/* Replace HubSpot */}
            <div className="p-8 bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-500/30 rounded-2xl">
              <div className="text-sm font-semibold text-purple-400 mb-2">Replaces HubSpot/Pipedrive</div>
              <h3 className="text-2xl font-bold text-white mb-4">Full CRM Suite</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Custom Schemas & Objects</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Pipeline Management</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Activity Tracking</span>
                </li>
              </ul>
            </div>

            {/* Social & Multi-Channel */}
            <div className="p-8 bg-gradient-to-br from-indigo-800/20 to-slate-800/10 border border-indigo-400/30 rounded-2xl">
              <div className="text-sm font-semibold text-indigo-300 mb-2">Outreach Automation</div>
              <h3 className="text-2xl font-bold text-white mb-4">Multi-Channel Engagement</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Email Sequences</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>LinkedIn Messaging</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>SMS Campaigns</span>
                </li>
              </ul>
            </div>

            {/* Replace Zapier */}
            <div className="p-8 bg-gradient-to-br from-purple-800/20 to-indigo-900/10 border border-purple-400/30 rounded-2xl">
              <div className="text-sm font-semibold text-purple-300 mb-2">Replaces Zapier/Make</div>
              <h3 className="text-2xl font-bold text-white mb-4">Automation Engine</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Workflow Builder</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Email Sequences (Unlimited)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Native Integrations</span>
                </li>
              </ul>
            </div>

            {/* E-Commerce */}
            <div className="p-8 bg-gradient-to-br from-slate-800/30 to-indigo-900/10 border border-slate-500/30 rounded-2xl">
              <div className="text-sm font-semibold text-slate-300 mb-2">Commerce Platform</div>
              <h3 className="text-2xl font-bold text-white mb-4">Built-in E-Commerce Engine</h3>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Product Catalog</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Cart & Checkout</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Order & Payment Processing</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>


      {/* Social Proof */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Trusted by Growing Businesses
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "This AI agent increased our lead conversion by 300%. It's like having a top sales rep working 24/7.",
                author: "Sarah Johnson",
                role: "CEO, TechStart Inc"
              },
              {
                quote: "We went from manually qualifying every lead to having AI do it for us. Saved us 20 hours a week.",
                author: "Michael Chen",
                role: "Founder, GrowthLabs"
              },
              {
                quote: "The training is so easy. We had our AI agent up and running in under an hour.",
                author: "Emily Rodriguez",
                role: "Sales Director, CloudCorp"
              }
            ].map((testimonial, index) => (
              <div
                key={index}
                className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl"
              >
                <div className="text-yellow-400 text-2xl mb-4">★★★★★</div>
                <p className="text-gray-300 mb-4 italic">"{testimonial.quote}"</p>
                <div className="border-t border-white/10 pt-4">
                  <div className="font-semibold text-white">{testimonial.author}</div>
                  <div className="text-sm text-gray-400">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to 10x Your Sales?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join hundreds of businesses using AI to close more deals
          </p>
          <Link
            href="/signup"
            className="inline-block px-12 py-4 rounded-lg text-xl font-semibold transition shadow-lg"
            style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
          >
            Start Your Free Trial →
          </Link>
          <div className="mt-6 text-sm text-gray-400">
            14-day free trial • No charge until trial ends • Cancel anytime
          </div>
        </div>
      </section>

    </PublicLayout>
  );
}





