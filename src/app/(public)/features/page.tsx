'use client';

import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

export default function FeaturesPage() {
  const { theme } = useWebsiteTheme();

  return (
    <PublicLayout>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Everything You Need to
            <br />
            <span style={{ color: theme.primaryColor }}>
              Sell More, Faster
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
            A complete AI-powered sales platform with CRM, automation, and e-commerce built in
          </p>
        </div>
      </section>

      {/* Main Features */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-24">
          
          {/* Feature 1: Trainable AI Agent */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ backgroundColor: `${theme.primaryColor}20`, borderWidth: '1px', borderStyle: 'solid', borderColor: `${theme.primaryColor}40` }}>
                <span className="text-sm" style={{ color: theme.primaryColor }}>🔥 Flagship Feature</span>
              </div>
              <h2 className="text-4xl font-bold text-white mb-6">
                Train Your Own AI Sales Agent
              </h2>
              <p className="text-xl text-gray-300 mb-6">
                Not a generic chatbot. A custom AI agent trained specifically on YOUR business, 
                products, and sales process. It learns your brand voice, handles objections your way, 
                and gets smarter with every conversation.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  'Upload product docs, pricing sheets, FAQs',
                  'Train on real scenarios in our sandbox',
                  'Give feedback and watch it improve',
                  "Deploy when it's ready - not before",
                  'Continuous learning from real conversations'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="inline-block px-8 py-3 rounded-lg font-semibold transition"
                style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
              >
                Try It Free →
              </Link>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 h-96 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">🤖</div>
                <p>Training Interface Screenshot</p>
              </div>
            </div>
          </div>

          {/* Feature 2: Customer Memory */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 h-96 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">🧠</div>
                <p>Customer Memory Visualization</p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ backgroundColor: `${theme.primaryColor}20`, borderWidth: '1px', borderStyle: 'solid', borderColor: `${theme.primaryColor}40` }}>
                <span className="text-sm" style={{ color: theme.primaryColor }}>🧠 Smart Memory</span>
              </div>
              <h2 className="text-4xl font-bold text-white mb-6">
                Never Forget a Customer
              </h2>
              <p className="text-xl text-gray-300 mb-6">
                Your AI agent remembers every conversation, preference, and interaction. 
                When customers return, it picks up exactly where they left off - building 
                relationships that convert.
              </p>
              <ul className="space-y-4">
                {[
                  'Conversation history across all sessions',
                  'Learned preferences and objections',
                  'Purchase history and patterns',
                  'Sentiment tracking over time',
                  'Automatic notes and insights'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: theme.secondaryColor }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature 3: Built-in CRM */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ backgroundColor: `${theme.primaryColor}20`, borderWidth: '1px', borderStyle: 'solid', borderColor: `${theme.primaryColor}40` }}>
                <span className="text-sm" style={{ color: theme.primaryColor }}>📊 Powerful CRM</span>
              </div>
              <h2 className="text-4xl font-bold text-white mb-6">
                CRM That Actually Fits Your Business
              </h2>
              <p className="text-xl text-gray-300 mb-6">
                Create custom objects for anything - not just leads and deals. 
                Track shipments, appointments, inventory, or whatever your business needs. 
                Fully customizable with 20+ field types.
              </p>
              <ul className="space-y-4">
                {[
                  'Custom objects for your industry',
                  'Relationships between data',
                  'Formula fields (like Excel)',
                  'Multiple views: Kanban, Calendar, Table',
                  'Workflow automation built-in'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: theme.accentColor }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 h-96 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">📊</div>
                <p>CRM Dashboard Screenshot</p>
              </div>
            </div>
          </div>

          {/* Feature 4: E-Commerce */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 h-96 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">🛒</div>
                <p>E-Commerce Embed Screenshot</p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ backgroundColor: `${theme.primaryColor}20`, borderWidth: '1px', borderStyle: 'solid', borderColor: `${theme.primaryColor}40` }}>
                <span className="text-sm" style={{ color: theme.primaryColor }}>🛒 E-Commerce</span>
              </div>
              <h2 className="text-4xl font-bold text-white mb-6">
                Sell Products Directly
              </h2>
              <p className="text-xl text-gray-300 mb-6">
                Turn on e-commerce with one click. Your AI agent can show products, 
                answer questions, and complete purchases - all in the same conversation.
              </p>
              <ul className="space-y-4">
                {[
                  'Shopping cart in-chat',
                  'Payment processing (Stripe, PayPal)',
                  'Inventory management',
                  'Order tracking',
                  'Embed anywhere with shortcodes'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: theme.secondaryColor }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature 5: Workflow Automation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ backgroundColor: `${theme.primaryColor}20`, borderWidth: '1px', borderStyle: 'solid', borderColor: `${theme.primaryColor}40` }}>
                <span className="text-sm" style={{ color: theme.primaryColor }}>⚡ Automation</span>
              </div>
              <h2 className="text-4xl font-bold text-white mb-6">
                Automate Your Entire Sales Process
              </h2>
              <p className="text-xl text-gray-300 mb-6">
                Build workflows that run automatically. Send follow-ups, create tasks, 
                update records, notify your team - all without lifting a finger.
              </p>
              <ul className="space-y-4">
                {[
                  'Auto-follow-up emails based on behavior',
                  'Lead scoring and assignment',
                  'Task creation from conversations',
                  'Integrations with Slack, Gmail, more',
                  'Custom triggers and conditions'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: theme.accentColor }}>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 h-96 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">⚡</div>
                <p>Workflow Builder Screenshot</p>
              </div>
            </div>
          </div>

          {/* Feature 6: Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 h-96 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <div className="text-6xl mb-4">📈</div>
                <p>Analytics Dashboard Screenshot</p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ backgroundColor: `${theme.primaryColor}20`, borderWidth: '1px', borderStyle: 'solid', borderColor: `${theme.primaryColor}40` }}>
                <span className="text-sm" style={{ color: theme.primaryColor }}>📈 Analytics</span>
              </div>
              <h2 className="text-4xl font-bold text-white mb-6">
                Know What's Working
              </h2>
              <p className="text-xl text-gray-300 mb-6">
                Track every metric that matters. See which messages convert, 
                what objections come up most, and how your agent's performance improves over time.
              </p>
              <ul className="space-y-4">
                {[
                  'Conversion rates by topic',
                  'Revenue forecasting',
                  'Agent performance scoring',
                  'Lead source attribution',
                  'Real-time dashboards'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* All Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Plus Everything Else You'd Expect
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '🎨', title: 'White-Labeling', desc: 'Your brand, your colors, your domain' },
              { icon: '🔗', title: 'Integrations', desc: 'Slack, Stripe, Gmail, Calendar, and more' },
              { icon: '📧', title: 'Email Campaigns', desc: 'Drip campaigns and nurture sequences' },
              { icon: '📱', title: 'Mobile Ready', desc: 'Works perfectly on all devices' },
              { icon: '🔒', title: 'Enterprise Security', desc: 'SOC 2, GDPR, CCPA compliant' },
              { icon: '🌍', title: 'Multi-Language', desc: 'Serve customers in any language' },
              { icon: '📞', title: 'SMS Support', desc: 'Send SMS messages automatically' },
              { icon: '🎯', title: 'Lead Scoring', desc: 'AI-powered lead qualification' },
              { icon: '⏱️', title: '99.9% Uptime', desc: 'Always available when you need it' }
            ].map((feature, index) => (
              <div key={index} className="p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Start Your 14-Day Free Trial
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            No credit card required. Full access to all features.
          </p>
          <Link
            href="/signup"
            className="inline-block px-12 py-4 rounded-lg text-xl font-semibold transition shadow-lg"
            style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
          >
            Get Started Free →
          </Link>
        </div>
      </section>

    </PublicLayout>
  );
}

