'use client';

import React, { useState, useRef, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme'
import { logger } from '@/lib/logger/logger';

interface PublicLayoutProps {
  children: ReactNode;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const { theme, loading } = useWebsiteTheme();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi there! 👋 I'm your AI sales assistant. How can I help you today? I can answer questions about our platform, help you understand pricing, or guide you through getting started.",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isTyping) {return;}

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          orgId: 'platform', // Platform's own sales agent
          customerId: `visitor_${Date.now()}`,
        }),
      });

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: (data.response !== '' && data.response != null) ? data.response : "I apologize, but I'm having trouble responding right now. Please try again or contact us directly.",
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      logger.error('Chat error:', error, { file: 'PublicLayout.tsx' });
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment or reach out to us at support@salesvelocity.ai",
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Calculate nav height based on logo height
  const navHeight = Math.max(80, (theme.logoHeight ?? 48) + 32);

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.backgroundColor, color: theme.textColor, fontFamily: theme.fontFamily }}>
      {/* Navigation */}
      <nav 
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg border-b border-white/10"
        style={{ backgroundColor: theme.navBackground ?? 'rgba(15, 23, 42, 0.8)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center" style={{ height: `${navHeight}px` }}>
            <Link href="/" className="flex items-center gap-2">
              {theme.logoUrl ? (
                <img 
                  src={theme.logoUrl} 
                  alt={(theme.companyName !== '' && theme.companyName != null) ? theme.companyName : 'SalesVelocity.ai'} 
                  style={{ 
                    height: `${theme.logoHeight ?? 48}px`, 
                    width: 'auto', 
                    objectFit: 'contain',
                  }} 
                />
              ) : (
                <span 
                  className="text-2xl font-bold"
                  style={{ color: theme.textColor, fontFamily: theme.headingFont }}
                >
                  {(theme.companyName !== '' && theme.companyName != null) ? theme.companyName : 'SalesVelocity.ai'}
                </span>
              )}
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="/features" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                Features
              </Link>
              <Link href="/pricing" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                Pricing
              </Link>
              <Link href="/faq" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                FAQ
              </Link>
              <Link href="/about" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                About
              </Link>
              <Link href="/contact" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                Contact
              </Link>
              <Link href="/login" className="hover:opacity-100 transition" style={{ color: theme.textColor, opacity: 0.8 }}>
                Login
              </Link>
              <Link
                href="/onboarding/industry"
                className="px-4 py-2 rounded-lg font-semibold transition hover:opacity-90"
                style={{ backgroundColor: theme.primaryColor ?? '#6366f1', color: '#ffffff' }}
              >
                Start Free Trial
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg"
              style={{ color: theme.textColor }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-white/10">
              <div className="flex flex-col space-y-4">
                <Link href="/features" className="hover:opacity-100 transition py-2" style={{ color: theme.textColor, opacity: 0.8 }} onClick={() => setIsMobileMenuOpen(false)}>
                  Features
                </Link>
                <Link href="/pricing" className="hover:opacity-100 transition py-2" style={{ color: theme.textColor, opacity: 0.8 }} onClick={() => setIsMobileMenuOpen(false)}>
                  Pricing
                </Link>
                <Link href="/faq" className="hover:opacity-100 transition py-2" style={{ color: theme.textColor, opacity: 0.8 }} onClick={() => setIsMobileMenuOpen(false)}>
                  FAQ
                </Link>
                <Link href="/about" className="hover:opacity-100 transition py-2" style={{ color: theme.textColor, opacity: 0.8 }} onClick={() => setIsMobileMenuOpen(false)}>
                  About
                </Link>
                <Link href="/contact" className="hover:opacity-100 transition py-2" style={{ color: theme.textColor, opacity: 0.8 }} onClick={() => setIsMobileMenuOpen(false)}>
                  Contact
                </Link>
                <Link href="/login" className="hover:opacity-100 transition py-2" style={{ color: theme.textColor, opacity: 0.8 }} onClick={() => setIsMobileMenuOpen(false)}>
                  Login
                </Link>
                <Link
                  href="/onboarding/industry"
                  className="px-4 py-2 rounded-lg font-semibold transition text-center"
                  style={{ backgroundColor: theme.primaryColor ?? '#6366f1', color: '#ffffff' }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer 
        className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10"
        style={{ backgroundColor: theme.footerBackground ?? '#0a0a0a' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4" style={{ color: theme.textColor }}>Product</h3>
              <ul className="space-y-2" style={{ color: theme.textColor, opacity: 0.6 }}>
                <li><Link href="/features" className="hover:opacity-100 transition">Features</Link></li>
                <li><Link href="/pricing" className="hover:opacity-100 transition">Pricing</Link></li>
                <li><Link href="/faq" className="hover:opacity-100 transition">FAQ</Link></li>
                <li><Link href="/docs" className="hover:opacity-100 transition">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4" style={{ color: theme.textColor }}>Company</h3>
              <ul className="space-y-2" style={{ color: theme.textColor, opacity: 0.6 }}>
                <li><Link href="/about" className="hover:opacity-100 transition">About</Link></li>
                <li><Link href="/blog" className="hover:opacity-100 transition">Blog</Link></li>
                <li><Link href="/contact" className="hover:opacity-100 transition">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4" style={{ color: theme.textColor }}>Legal</h3>
              <ul className="space-y-2" style={{ color: theme.textColor, opacity: 0.6 }}>
                <li><Link href="/privacy" className="hover:opacity-100 transition">Privacy</Link></li>
                <li><Link href="/terms" className="hover:opacity-100 transition">Terms</Link></li>
                <li><Link href="/security" className="hover:opacity-100 transition">Security</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4" style={{ color: theme.textColor }}>Connect</h3>
              <ul className="space-y-2" style={{ color: theme.textColor, opacity: 0.6 }}>
                <li><a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition">Twitter</a></li>
                <li><a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition">LinkedIn</a></li>
                <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center" style={{ color: theme.textColor, opacity: 0.6 }}>
            <p>© {new Date().getFullYear()} {(theme.companyName !== '' && theme.companyName != null) ? theme.companyName : 'SalesVelocity.ai'}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Dimmed Overlay when chat is open */}
      {isChatOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-300"
          onClick={() => setIsChatOpen(false)}
        />
      )}

      {/* Chat Widget */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Chat Window - Modal Style */}
        {isChatOpen && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
            <div 
              className="w-full max-w-2xl bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-in slide-in-from-bottom-8 zoom-in-95 duration-300 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div 
              className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: theme.primaryColor ?? '#6366f1' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xl">🤖</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold">AI Sales Agent</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    <span className="text-white/80 text-xs">Online</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="h-[500px] overflow-y-auto p-4 space-y-3 bg-slate-800">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-md'
                        : 'bg-slate-700 text-gray-100 rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-slate-700 px-3 py-2 rounded-2xl rounded-bl-md">
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

            {/* Input */}
            <div className="p-3 bg-slate-900 border-t border-slate-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                  disabled={isTyping}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isTyping}
                  className="px-3 py-2 rounded-xl transition disabled:opacity-50"
                  style={{ backgroundColor: theme.primaryColor ?? '#6366f1', color: '#fff' }}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button 
          id="platform-chat-toggle"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-white text-2xl hover:scale-110 transition"
          style={{ backgroundColor: theme.primaryColor ?? '#6366f1' }}
        >
          {isChatOpen ? '✕' : '💬'}
        </button>
      </div>
    </div>
  );
}
