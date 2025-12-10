'use client';

import React from 'react';
import Link from 'next/link';
import PublicLayout from '@/components/PublicLayout';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';

const DOC_CATEGORIES = [
  {
    title: 'Getting Started',
    icon: '🚀',
    docs: [
      { title: 'Quick Start Guide', href: '#', time: '5 min' },
      { title: 'Setting Up Your Account', href: '#', time: '3 min' },
      { title: 'Training Your First AI Agent', href: '#', time: '10 min' },
      { title: 'Deploying on Your Website', href: '#', time: '5 min' },
    ],
  },
  {
    title: 'CRM & Sales',
    icon: '📊',
    docs: [
      { title: 'Managing Leads & Contacts', href: '#', time: '8 min' },
      { title: 'Deal Pipeline Setup', href: '#', time: '6 min' },
      { title: 'Workflow Automation', href: '#', time: '12 min' },
      { title: 'Email Campaigns', href: '#', time: '10 min' },
    ],
  },
  {
    title: 'AI Configuration',
    icon: '🤖',
    docs: [
      { title: 'AI Agent Personality', href: '#', time: '7 min' },
      { title: 'Knowledge Base Management', href: '#', time: '9 min' },
      { title: 'Advanced Prompting', href: '#', time: '15 min' },
      { title: 'Function Calling & Tools', href: '#', time: '12 min' },
    ],
  },
  {
    title: 'Integrations',
    icon: '🔗',
    docs: [
      { title: 'Stripe Integration', href: '#', time: '10 min' },
      { title: 'Google Calendar Sync', href: '#', time: '8 min' },
      { title: 'Slack Notifications', href: '#', time: '6 min' },
      { title: 'API Documentation', href: '#', time: '20 min' },
    ],
  },
  {
    title: 'Analytics & Reporting',
    icon: '📈',
    docs: [
      { title: 'Dashboard Overview', href: '#', time: '5 min' },
      { title: 'Custom Reports', href: '#', time: '10 min' },
      { title: 'Conversion Tracking', href: '#', time: '8 min' },
      { title: 'Exporting Data', href: '#', time: '4 min' },
    ],
  },
  {
    title: 'Advanced Topics',
    icon: '⚡',
    docs: [
      { title: 'White-Label Configuration', href: '#', time: '12 min' },
      { title: 'Custom Schemas', href: '#', time: '15 min' },
      { title: 'Multi-Tenant Setup', href: '#', time: '18 min' },
      { title: 'API Rate Limits & Best Practices', href: '#', time: '10 min' },
    ],
  },
];

export default function DocsPage() {
  const { theme } = useWebsiteTheme();

  return (
    <PublicLayout>
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-white mb-6">Documentation</h1>
            <p className="text-xl text-gray-300 mb-8">
              Everything you need to know about using AI Sales Platform
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <input
                type="text"
                placeholder="Search documentation..."
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': theme.primaryColor } as any}
              />
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid md:grid-cols-4 gap-6 mb-16">
            <a
              href="#"
              className="p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-center"
            >
              <div className="text-3xl mb-3">📖</div>
              <div className="font-semibold text-white">Guides</div>
            </a>
            <a
              href="#"
              className="p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-center"
            >
              <div className="text-3xl mb-3">🎥</div>
              <div className="font-semibold text-white">Video Tutorials</div>
            </a>
            <a
              href="#"
              className="p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-center"
            >
              <div className="text-3xl mb-3">💻</div>
              <div className="font-semibold text-white">API Reference</div>
            </a>
            <a
              href="/contact"
              className="p-6 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-center"
            >
              <div className="text-3xl mb-3">💬</div>
              <div className="font-semibold text-white">Support</div>
            </a>
          </div>

          {/* Documentation Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {DOC_CATEGORIES.map((category, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">{category.icon}</div>
                  <h2 className="text-2xl font-bold text-white">{category.title}</h2>
                </div>
                <ul className="space-y-3">
                  {category.docs.map((doc, docIdx) => (
                    <li key={docIdx}>
                      <a
                        href={doc.href}
                        className="flex items-center justify-between group"
                      >
                        <span className="text-gray-300 group-hover:text-white transition">
                          {doc.title}
                        </span>
                        <span className="text-xs text-gray-500">{doc.time}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Help Section */}
          <div className="mt-16 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Can't Find What You're Looking For?</h2>
            <p className="text-gray-300 mb-6">
              Our support team is here to help. Get in touch and we'll respond within 24 hours.
            </p>
            <Link
              href="/contact"
              className="inline-block px-8 py-4 rounded-lg text-lg font-semibold transition"
              style={{ backgroundColor: theme.primaryColor, color: '#ffffff' }}
            >
              Contact Support →
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}







