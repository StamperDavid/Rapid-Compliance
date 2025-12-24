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
          orgId: 'platform-admin',
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
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-full mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-gray-300">AI-Powered Sales Automation</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Your AI Sales Team,
              <br />
              <span className="bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent">
                Working 24/7
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
              Train a custom AI sales agent on your business in minutes. Deploy it on your website. 
              Watch it qualify leads, answer questions, and close deals while you sleep.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="px-8 py-4 rounded-lg text-lg font-semibold transition shadow-lg"
                style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
              >
                Start Free Trial →
              </Link>
              <button
                onClick={() => {
                  document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-white/10 text-white rounded-lg text-lg font-semibold hover:bg-white/20 transition border border-white/20"
              >
                See Demo
              </button>
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

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">10x</div>
              <div className="text-gray-400">More Qualified Leads</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">24/7</div>
              <div className="text-gray-400">Always Available</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">&lt;1hr</div>
              <div className="text-gray-400">Setup Time</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">90%</div>
              <div className="text-gray-400">Customer Satisfaction</div>
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
              Get up and running in hours, not weeks
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

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything You Need to Sell More
            </h2>
            <p className="text-xl text-gray-300">
              Not just a chatbot. A complete AI sales platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '🤖',
                title: 'Trainable AI Agent',
                description: 'Custom-trained on YOUR business, products, and sales process'
              },
              {
                icon: '🧠',
                title: 'Customer Memory',
                description: 'Remembers every conversation, preference, and interaction'
              },
              {
                icon: '💬',
                title: 'Lead Qualification',
                description: 'Automatically scores and qualifies leads using AI'
              },
              {
                icon: '📊',
                title: 'Built-in CRM',
                description: 'Manage contacts, deals, and pipeline in one place'
              },
              {
                icon: '⚡',
                title: 'Workflow Automation',
                description: 'Auto-follow-ups, email sequences, task creation'
              },
              {
                icon: '🛒',
                title: 'E-Commerce Ready',
                description: 'Take payments, manage inventory, process orders'
              },
              {
                icon: '📈',
                title: 'Real-Time Analytics',
                description: 'Track conversions, revenue, and agent performance'
              },
              {
                icon: '🎨',
                title: 'White-Label Ready',
                description: 'Your brand, your colors, your domain'
              },
              {
                icon: '🔗',
                title: 'Integrations',
                description: 'Connect to Stripe, Slack, Google, and more'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl hover:bg-white/10 transition"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo-section" className="py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              See It In Action
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              This is a live AI sales agent. Go ahead - ask it anything about our platform. 
              This is exactly what your customers will experience on your website.
            </p>
          </div>

          <LiveChatDemo primaryColor={theme.primaryColor} />

          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-4">
              Impressed? Your AI agent can be even smarter - trained specifically on YOUR business.
            </p>
            <Link
              href="/signup"
              className="inline-block px-8 py-4 rounded-lg text-lg font-semibold transition shadow-lg"
              style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
            >
              Create Your Own AI Agent →
            </Link>
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





